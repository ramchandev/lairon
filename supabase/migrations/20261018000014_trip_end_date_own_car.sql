-- LAIRON EZ — trip end date + the driver's own car.
--  * driver_day_entries.end_date: the day the trip ended (optional; a trip can run past midnight or over several days).
--    Beta is still counted on the START date (entry_date), exactly as before.
--  * vehicle_source gains 'driver_own' (the driver's personal car; no KM is recorded, like a guest's own vehicle).
--  * duty_rules() uses end_date for the duration; import_duties() reads end_date and "Own car" vehicles.
alter table driver_day_entries add column end_date date;
alter table driver_day_entries add constraint driver_day_entries_end_date_check check (end_date is null or end_date >= entry_date);
alter table driver_day_entries drop constraint driver_day_entries_vehicle_source_check;
alter table driver_day_entries add constraint driver_day_entries_vehicle_source_check
  check (vehicle_source in ('fleet', 'own', 'driver_own', 'other'));

create or replace function duty_rules() returns trigger language plpgsql security definer set search_path = public as $$
declare v_min int;
begin
  if new.driver_name is null and new.driver_id is not null then
    select full_name into new.driver_name from profiles where id = new.driver_id;
  end if;

  -- drivers cannot approve their own leave
  if auth.uid() is not null and not is_admin() then
    if tg_op = 'INSERT' and new.entry_type = 'leave' then
      new.leave_status := 'pending'; new.decided_by := null; new.decided_at := null;
    elsif tg_op = 'UPDATE' and (new.leave_status is distinct from old.leave_status
          or new.decided_by is distinct from old.decided_by) then
      raise exception 'Only an admin can decide a leave request';
    end if;
  end if;

  if new.entry_type = 'leave' and new.leave_status is null then new.leave_status := 'pending'; end if;
  if new.entry_type <> 'leave' then new.leave_status := null; end if;

  if new.entry_type = 'duty' then
    if new.duty_type is null then raise exception 'Duty type is required'; end if;
    if exists (select 1 from driver_day_entries e
               where e.driver_id = new.driver_id and e.entry_date = new.entry_date and e.id <> new.id
                 and e.entry_type in ('week_off','leave') and coalesce(e.leave_status, '') <> 'rejected') then
      raise exception 'This date is already marked as week off or leave';
    end if;
    if new.vehicle_source = 'fleet' and new.vehicle_id is not null and new.vehicle_label is null then
      select name || ' ' || right(vehicle_number, 4) into new.vehicle_label from vehicles where id = new.vehicle_id;
    end if;
    -- KM only matters for fleet vehicles, and only for app entries (imports may lack KM)
    if new.entry_source = 'app' and new.vehicle_source = 'fleet' then
      if new.start_km is null then raise exception 'Starting KM is required for fleet vehicles'; end if;
      if new.duty_status = 'closed' and new.end_km is null then raise exception 'Ending KM is required for fleet vehicles'; end if;
    end if;
    if new.start_time is null and new.entry_source = 'app' then raise exception 'Starting time is required'; end if;
    if new.end_km is not null and new.start_km is not null then
      if new.end_km < new.start_km then raise exception 'Ending KM cannot be less than starting KM'; end if;
      if new.total_km is null then new.total_km := new.end_km - new.start_km; end if;
    end if;
    if new.end_date is not null and new.end_date < new.entry_date then
      raise exception 'The trip end date cannot be before the start date';
    end if;
    if new.total_minutes is null and new.start_time is not null and new.end_time is not null then
      v_min := (extract(epoch from (new.end_time - new.start_time)) / 60)::int;
      if new.end_date is not null then
        -- explicit trip end date: whole days between + the time difference
        v_min := v_min + (new.end_date - new.entry_date) * 1440;
        if v_min < 0 then raise exception 'The trip ends before it starts'; end if;
      elsif v_min < 0 then
        v_min := v_min + 1440; -- no end date given: a lower closing time means it ran past midnight
      end if;
      new.total_minutes := v_min;
    end if;
  else
    if new.entry_type = 'week_off' or new.leave_status <> 'rejected' then
      if exists (select 1 from driver_day_entries e
                 where e.driver_id = new.driver_id and e.entry_date = new.entry_date and e.id <> new.id
                   and (e.entry_type = 'duty' or (e.entry_type in ('week_off','leave') and coalesce(e.leave_status, '') <> 'rejected'))) then
        raise exception 'This date already has an entry';
      end if;
    end if;
  end if;
  return new;
end $$;

create or replace function import_duties(batch jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
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
        if lower(v_label) in ('own car', 'own car (driver)', 'driver own', 'driver''s own car', 'drivers own car') then
          v_src := 'driver_own'; v_label := 'Own car (driver)';
        elsif lower(v_label) in ('own', 'own (guest vehicle)') then
          v_src := 'own'; v_label := 'Own (guest vehicle)';
        else
          select id, name || ' ' || right(vehicle_number, 4) into v_vid, v_label
          from vehicles where lower(name || ' ' || right(vehicle_number, 4)) = lower(v_label) limit 1;
          if v_vid is not null then v_src := 'fleet';
          else v_src := 'other'; v_label := 'Others · ' || trim(v_row ->> 'vehicle'); end if;
        end if;
      end if;
      insert into driver_day_entries (driver_id, entry_date, entry_type, duty_type, vehicle_source, vehicle_id, vehicle_label,
        guest_name, guest_area, pickup_point, drop_point, start_km, end_km, start_time, end_time, end_date, total_km, total_minutes,
        fuel_litres, fuel_amount, duty_status, entry_source, import_batch_id, notes)
      values (v_driver, v_date, 'duty', coalesce(nullif(v_row ->> 'duty_type', ''), 'Local'), v_src, v_vid, v_label,
        nullif(v_row ->> 'guest_name', ''), nullif(v_row ->> 'guest_area', ''), nullif(v_row ->> 'pickup_point', ''),
        nullif(v_row ->> 'drop_point', ''), (v_row ->> 'start_km')::int, (v_row ->> 'end_km')::int,
        (v_row ->> 'start_time')::time, (v_row ->> 'end_time')::time, nullif(v_row ->> 'end_date', '')::date,
        (v_row ->> 'total_km')::int,
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
