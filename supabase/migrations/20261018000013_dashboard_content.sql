-- LAIRON EZ — dashboard content aligned with the approved prototype: adds the driver headcount, six-month request value,
-- the "needs attention" list and today's driver board to admin_dashboard(). Admin only; same signature as migration 12.
-- "Today" and "this month" are India dates, like everything the user sees.
create or replace function admin_dashboard(p_month date default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_month date := date_trunc('month', coalesce(p_month, (now() at time zone 'Asia/Kolkata')::date))::date;
  v_next date := (date_trunc('month', coalesce(p_month, (now() at time zone 'Asia/Kolkata')::date)) + interval '1 month')::date;
  v jsonb;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  select jsonb_build_object(
    'month', to_char(v_month, 'YYYY-MM'),
    'pending_service_requests', (select count(*) from service_request_batches where status = 'submitted'),
    -- submitted + processing = still needs the admin's attention
    'pending_starter_packs', (select count(*) from starter_pack_requests where status in ('submitted', 'processing')),
    'drivers_on_duty_now', (select count(distinct driver_id) from driver_day_entries where entry_type = 'duty' and duty_status = 'open'),
    'drivers_with_duty_today', (select count(distinct driver_id) from driver_day_entries where entry_type = 'duty' and entry_date = v_today),
    -- a request = a run of consecutive pending days with the same driver, type and reason (same grouping as the app)
    'pending_leave_requests', (
      select count(*) from (
        select 1 from (
          select driver_id, leave_type, leave_reason,
                 entry_date - (row_number() over (partition by driver_id, leave_type, leave_reason order by entry_date))::int as grp
          from driver_day_entries where entry_type = 'leave' and leave_status = 'pending') t
        group by driver_id, leave_type, leave_reason, grp) g),
    'pending_leave_days', (select count(*) from driver_day_entries where entry_type = 'leave' and leave_status = 'pending'),
    'beta_total', (select coalesce(sum(total_amount), 0) from beta_summary(v_month)),
    'beta_payable_days', (select coalesce(sum(payable_days), 0) from beta_summary(v_month)),
    'total_km', (select coalesce(sum(total_km), 0) from driver_day_entries where entry_type = 'duty' and entry_date >= v_month and entry_date < v_next),
    'fuel_amount', (select coalesce(sum(fuel_amount), 0) from driver_day_entries where entry_type = 'duty' and entry_date >= v_month and entry_date < v_next),
    'fuel_litres', (select coalesce(sum(fuel_litres), 0) from driver_day_entries where entry_type = 'duty' and entry_date >= v_month and entry_date < v_next),
    'drivers_total', (select count(*) from profiles where role = 'driver' and is_active),
    -- service request value (sum of service amounts) by submission month, last six months incl. the current one
    'sr_value_by_month', (
      select jsonb_agg(jsonb_build_object('m', to_char(m, 'YYYY-MM'), 'v', coalesce(v.total, 0)) order by m)
      from generate_series(v_month - interval '5 months', v_month, interval '1 month') m
      left join lateral (
        select sum(s.service_amount) as total
        from service_request_batches b join service_requests s on s.batch_id = b.id
        where b.status <> 'draft' and b.submitted_at is not null
          and date_trunc('month', b.submitted_at at time zone 'Asia/Kolkata') = m) v on true),
    'attention_total', (
      (select count(*) from service_request_batches where status = 'submitted')
      + (select count(*) from starter_pack_requests where status in ('submitted', 'processing'))
      + (select count(*) from (
          select 1 from (
            select driver_id, leave_type, leave_reason,
                   entry_date - (row_number() over (partition by driver_id, leave_type, leave_reason order by entry_date))::int as grp
            from driver_day_entries where entry_type = 'leave' and leave_status = 'pending') t
          group by driver_id, leave_type, leave_reason, grp) g)),
    'attention', coalesce((
      select jsonb_agg(a order by (a->>'at') desc) from (
        (select jsonb_build_object('kind', 'request', 'id', b.id, 'title', b.ref_no || ' · ' || coalesce(b.manager_name, 'Manager'),
                  'sub', (select count(*) from service_requests s where s.batch_id = b.id) || ' service(s) · ₹' ||
                         to_char((select coalesce(sum(s.service_amount), 0) from service_requests s where s.batch_id = b.id), 'FM99,99,99,990'),
                  'status', b.status, 'at', coalesce(b.submitted_at, b.created_at)) as a
         from service_request_batches b where b.status = 'submitted' order by coalesce(b.submitted_at, b.created_at) desc limit 6)
        union all
        (select jsonb_build_object('kind', 'pack', 'id', p.id, 'title', p.ref_no || ' · ' || p.doctor_name,
                  'sub', (select count(*) from starter_pack_items i where i.request_id = p.id) || ' products · by ' || p.staff_name,
                  'status', p.status, 'at', p.created_at)
         from starter_pack_requests p where p.status in ('submitted', 'processing') order by p.created_at desc limit 6)
        union all
        (select jsonb_build_object('kind', 'leave', 'id', min(e.id::text), 'title', coalesce(e.driver_name, 'Driver') || ' · ' || coalesce(e.leave_type, 'Leave') || ' leave',
                  'sub', to_char(min(e.entry_date), 'DD Mon YYYY') || case when max(e.entry_date) <> min(e.entry_date) then ' – ' || to_char(max(e.entry_date), 'DD Mon YYYY') else '' end,
                  'status', 'pending', 'at', max(e.created_at))
         from (select *, entry_date - (row_number() over (partition by driver_id, leave_type, leave_reason order by entry_date))::int as grp
               from driver_day_entries where entry_type = 'leave' and leave_status = 'pending') e
         group by e.driver_id, e.driver_name, e.leave_type, e.leave_reason, e.grp order by max(e.created_at) desc limit 6)
      ) u limit 6), '[]'::jsonb),
    'drivers_today', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.full_name, 'avatar_url', p.avatar_url,
        'state', case when d.id is not null then 'duty' when w.id is not null then 'week_off' when l.id is not null then 'leave' else 'none' end,
        'duty_type', d.duty_type, 'vehicle', d.vehicle_label, 'pickup', d.pickup_point, 'drop', d.drop_point) order by p.full_name)
      from profiles p
      left join lateral (select * from driver_day_entries x where x.driver_id = p.id and x.entry_date = v_today and x.entry_type = 'duty' order by x.created_at desc limit 1) d on true
      left join lateral (select id from driver_day_entries x where x.driver_id = p.id and x.entry_date = v_today and x.entry_type = 'week_off' limit 1) w on true
      left join lateral (select id from driver_day_entries x where x.driver_id = p.id and x.entry_date = v_today and x.entry_type = 'leave' and x.leave_status <> 'rejected' limit 1) l on true
      where p.role = 'driver' and p.is_active), '[]'::jsonb)
  ) into v;
  return v;
end $$;
revoke execute on function admin_dashboard(date) from public, anon;
grant execute on function admin_dashboard(date) to authenticated;
