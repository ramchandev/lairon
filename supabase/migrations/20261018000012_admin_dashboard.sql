-- LAIRON EZ — Phase 9: one call for the admin dashboard KPIs (PLAN §6.10). Admin only.
-- "Today" and "this month" are India dates, like everything the user sees.
create function admin_dashboard(p_month date default null) returns jsonb
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
    'fuel_litres', (select coalesce(sum(fuel_litres), 0) from driver_day_entries where entry_type = 'duty' and entry_date >= v_month and entry_date < v_next)
  ) into v;
  return v;
end $$;
revoke execute on function admin_dashboard(date) from public, anon;
grant execute on function admin_dashboard(date) to authenticated;
