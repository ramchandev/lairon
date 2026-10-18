-- LAIRON EZ — Phase 1: chauffeur beta (PLAN §6.11) and duty import (§6.12).

-- beta_summary: single source of truth for screen, CSV, PDF and finalisation.
create function beta_summary(p_month date, p_driver uuid default null)
returns table (driver_id uuid, driver_name text, local_days int, outstation_days int, payable_days int,
               local_amount numeric, outstation_amount numeric, total_amount numeric)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare m date := date_trunc('month', p_month)::date; fin boolean;
begin
  if auth.uid() is not null and not is_admin() then p_driver := auth.uid(); end if; -- drivers see only themselves
  select (status = 'finalised') into fin from beta_months where month = m;

  if coalesce(fin, false) then
    return query
      select s.driver_id, s.driver_name, s.local_days, s.outstation_days, s.payable_days,
             s.local_amount, s.outstation_amount, s.total_amount
      from beta_statements s where s.month = m and (p_driver is null or s.driver_id = p_driver)
      order by s.driver_name;
    return;
  end if;

  return query
  with days as (            -- rules 1-3: closed duties only, one payable day per driver+date, outstation wins
    select e.driver_id, e.entry_date, bool_or(e.duty_type = 'Out Station') as is_out
    from driver_day_entries e
    where e.entry_type = 'duty' and e.duty_status = 'closed'
      and e.entry_date >= m and e.entry_date < (m + interval '1 month')
    group by e.driver_id, e.entry_date
  ), rated as (             -- rule 4: latest rate with effective_from <= the day
    select d.driver_id, d.is_out,
           coalesce(case when d.is_out then r.outstation_rate else r.local_rate end, 0) as rate
    from days d
    left join lateral (select local_rate, outstation_rate from beta_rates
                       where effective_from <= d.entry_date order by effective_from desc limit 1) r on true
  ), per as (
    select driver_id,
           count(*) filter (where not is_out) as local_days,
           count(*) filter (where is_out) as outstation_days,
           coalesce(sum(rate) filter (where not is_out), 0) as local_amount,
           coalesce(sum(rate) filter (where is_out), 0) as outstation_amount
    from rated group by driver_id
  )
  select p.id, p.full_name,
         coalesce(per.local_days, 0)::int, coalesce(per.outstation_days, 0)::int,
         (coalesce(per.local_days, 0) + coalesce(per.outstation_days, 0))::int,
         coalesce(per.local_amount, 0), coalesce(per.outstation_amount, 0),
         coalesce(per.local_amount, 0) + coalesce(per.outstation_amount, 0)
  from profiles p left join per on per.driver_id = p.id
  where p.role = 'driver' and (p.is_active or per.driver_id is not null)
    and (p_driver is null or p.id = p_driver)
  order by p.full_name;                 -- rule 5 + all active drivers, even with 0 days
end $$;

-- Day-wise breakdown: "why is my beta X?"
create function beta_days(p_month date, p_driver uuid)
returns table (entry_date date, duties_logged int, day_type text, beta numeric)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare m date := date_trunc('month', p_month)::date;
begin
  if auth.uid() is not null and not is_admin() then p_driver := auth.uid(); end if;
  return query
  with days as (
    select e.entry_date, count(*)::int as duties, bool_or(e.duty_type = 'Out Station') as is_out
    from driver_day_entries e
    where e.driver_id = p_driver and e.entry_type = 'duty' and e.duty_status = 'closed'
      and e.entry_date >= m and e.entry_date < (m + interval '1 month')
    group by e.entry_date
  )
  select d.entry_date, d.duties, case when d.is_out then 'Outstation' else 'Local' end,
         coalesce(case when d.is_out then r.outstation_rate else r.local_rate end, 0)
  from days d
  left join lateral (select local_rate, outstation_rate from beta_rates
                     where effective_from <= d.entry_date order by effective_from desc limit 1) r on true
  order by d.entry_date;
end $$;

create function finalise_beta_month(p_month date) returns void language plpgsql security definer set search_path = public as $$
declare m date := date_trunc('month', p_month)::date;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if exists (select 1 from beta_months where month = m and status = 'finalised') then
    raise exception 'This month is already finalised';
  end if;
  delete from beta_statements where month = m;
  insert into beta_statements (month, driver_id, driver_name, local_days, outstation_days, payable_days,
                               local_amount, outstation_amount, total_amount, rates_used, finalised_by)
  select m, s.driver_id, s.driver_name, s.local_days, s.outstation_days, s.payable_days,
         s.local_amount, s.outstation_amount, s.total_amount,
         (select coalesce(jsonb_agg(to_jsonb(r) - 'id' - 'created_by' order by r.effective_from), '[]'::jsonb)
            from beta_rates r where r.effective_from < (m + interval '1 month')),
         auth.uid()
  from beta_summary(m) s;
  insert into beta_months (month, status, finalised_by, finalised_at)
  values (m, 'finalised', auth.uid(), now())
  on conflict (month) do update set status = 'finalised', finalised_by = auth.uid(), finalised_at = now();
end $$;

create function reopen_beta_month(p_month date, p_reason text) returns void language plpgsql security definer set search_path = public as $$
declare m date := date_trunc('month', p_month)::date;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if coalesce(length(trim(p_reason)), 0) = 0 then raise exception 'A reason is required to reopen a month'; end if;
  update beta_months set status = 'draft', reopened_by = auth.uid(), reopened_at = now(), reopen_reason = p_reason
  where month = m and status = 'finalised';
  if not found then raise exception 'This month is not finalised'; end if;
  delete from beta_statements where month = m;
end $$;

-- ───────────── Duty import ─────────────
-- import_duties(batch): validates again and inserts in ONE transaction.
-- batch = { file_name, driver_id, month:'YYYY-MM-01', mode:'replace'|'fill', issues:[...],
--           rows:[{entry_date, entry_type, duty_type, vehicle, guest_name, guest_area, pickup_point, drop_point,
--                  start_km, end_km, start_time, end_time, total_km, total_minutes, fuel_litres, fuel_amount, notes}] }
create function import_duties(batch jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_driver uuid := (batch ->> 'driver_id')::uuid;
  v_month date := date_trunc('month', (batch ->> 'month')::date)::date;
  v_mode text := coalesce(batch ->> 'mode', 'fill');
  v_batch uuid; v_row jsonb; v_date date; v_type text; v_label text; v_vid uuid; v_src text;
  v_duties int := 0; v_offs int := 0; v_leaves int := 0; v_replaced int := 0; v_read int := 0;
  v_seen jsonb := '{}'::jsonb;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if not exists (select 1 from profiles where id = v_driver and role = 'driver') then raise exception 'Choose a driver'; end if;
  if v_mode not in ('replace','fill') then raise exception 'Invalid import mode'; end if;

  -- pass 1: validate (errors block the whole import)
  for v_row in select * from jsonb_array_elements(batch -> 'rows') loop
    v_read := v_read + 1;
    begin v_date := (v_row ->> 'entry_date')::date; exception when others then v_date := null; end;
    if v_date is null then raise exception 'Row %: unreadable date', v_read; end if;
    v_type := coalesce(v_row ->> 'entry_type', 'duty');
    if v_type not in ('duty','week_off','leave') then raise exception 'Row %: invalid entry type', v_read; end if;
    if v_type <> 'duty' and (v_seen ->> v_date::text) = 'duty' or v_type = 'duty' and (v_seen ->> v_date::text) in ('week_off','leave') then
      raise exception 'Row %: duty and week off/leave on the same date (%)', v_read, v_date;
    end if;
    v_seen := v_seen || jsonb_build_object(v_date::text, v_type);
  end loop;

  if v_mode = 'replace' then
    with d as (delete from driver_day_entries where driver_id = v_driver
               and entry_date >= v_month and entry_date < (v_month + interval '1 month') returning 1)
    select count(*) into v_replaced from d;
  end if;

  insert into duty_import_batches (file_name, driver_id, driver_name, month, mode, replaced_count, issues, created_by)
  values (batch ->> 'file_name', v_driver, (select full_name from profiles where id = v_driver), v_month, v_mode,
          v_replaced, coalesce(batch -> 'issues', '[]'::jsonb), auth.uid())
  returning id into v_batch;

  -- pass 2: insert
  for v_row in select * from jsonb_array_elements(batch -> 'rows') loop
    v_date := (v_row ->> 'entry_date')::date;
    v_type := coalesce(v_row ->> 'entry_type', 'duty');
    if v_mode = 'fill' and exists (select 1 from driver_day_entries where driver_id = v_driver and entry_date = v_date
                                   and coalesce(leave_status, '') <> 'rejected') then
      continue;
    end if;

    if v_type = 'duty' then
      v_label := nullif(trim(v_row ->> 'vehicle'), ''); v_vid := null; v_src := null;
      if v_label is not null then
        if lower(v_label) in ('own', 'own (guest vehicle)') then
          v_src := 'own'; v_label := 'Own (guest vehicle)';
        else
          select id, name || ' ' || right(vehicle_number, 4) into v_vid, v_label
          from vehicles where lower(name || ' ' || right(vehicle_number, 4)) = lower(v_label) limit 1;
          if v_vid is not null then v_src := 'fleet';
          else v_src := 'other'; v_label := 'Others · ' || trim(v_row ->> 'vehicle'); end if;
        end if;
      end if;
      insert into driver_day_entries (driver_id, entry_date, entry_type, duty_type, vehicle_source, vehicle_id, vehicle_label,
        guest_name, guest_area, pickup_point, drop_point, start_km, end_km, start_time, end_time, total_km, total_minutes,
        fuel_litres, fuel_amount, duty_status, entry_source, import_batch_id, notes)
      values (v_driver, v_date, 'duty', coalesce(nullif(v_row ->> 'duty_type', ''), 'Local'), v_src, v_vid, v_label,
        nullif(v_row ->> 'guest_name', ''), nullif(v_row ->> 'guest_area', ''), nullif(v_row ->> 'pickup_point', ''),
        nullif(v_row ->> 'drop_point', ''), (v_row ->> 'start_km')::int, (v_row ->> 'end_km')::int,
        (v_row ->> 'start_time')::time, (v_row ->> 'end_time')::time, (v_row ->> 'total_km')::int,
        (v_row ->> 'total_minutes')::int, (v_row ->> 'fuel_litres')::numeric, (v_row ->> 'fuel_amount')::numeric,
        'closed', 'import', v_batch, nullif(v_row ->> 'notes', ''));
      v_duties := v_duties + 1;
    else
      insert into driver_day_entries (driver_id, entry_date, entry_type, leave_status, entry_source, import_batch_id, notes)
      values (v_driver, v_date, v_type, case when v_type = 'leave' then 'approved' end, 'import', v_batch, nullif(v_row ->> 'notes', ''));
      if v_type = 'week_off' then v_offs := v_offs + 1; else v_leaves := v_leaves + 1; end if;
    end if;
  end loop;

  update duty_import_batches set rows_read = v_read, duties = v_duties, week_offs = v_offs, leaves = v_leaves where id = v_batch;
  return jsonb_build_object('batch_id', v_batch, 'rows_read', v_read, 'duties', v_duties,
                            'week_offs', v_offs, 'leaves', v_leaves, 'replaced', v_replaced);
end $$;

create function undo_duty_import(p_batch uuid) returns int language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if exists (select 1 from duty_import_batches where id = p_batch and undone_at is not null) then
    raise exception 'This import was already undone';
  end if;
  with d as (delete from driver_day_entries where import_batch_id = p_batch returning 1) select count(*) into v_n from d;
  update duty_import_batches set undone_at = now() where id = p_batch;
  return v_n;
end $$;
