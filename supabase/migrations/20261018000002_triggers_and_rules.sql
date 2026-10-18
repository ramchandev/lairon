-- LAIRON EZ — Phase 1: ref numbers, snapshots, duty rules, guards, activity log.

-- ───────────── Reference numbers: SR-2610-0001 ─────────────
create function next_ref(p_prefix text) returns text language plpgsql security definer set search_path = public as $$
declare v_ym text := to_char(now() at time zone 'Asia/Kolkata', 'YYMM'); v_n int;
begin
  insert into ref_counters (prefix, ym, n) values (p_prefix, v_ym, 1)
  on conflict (prefix, ym) do update set n = ref_counters.n + 1
  returning n into v_n;
  return p_prefix || '-' || v_ym || '-' || lpad(v_n::text, 4, '0');
end $$;

-- Batches get their number when first submitted (drafts don't burn numbers).
create function batch_before_write() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.manager_name is null and new.manager_id is not null then
    select full_name into new.manager_name from profiles where id = new.manager_id;
  end if;
  if new.accountability_staff_id is not null and
     (new.accountability_staff_name is null or tg_op = 'UPDATE' and new.accountability_staff_id is distinct from old.accountability_staff_id) then
    select full_name into new.accountability_staff_name from profiles where id = new.accountability_staff_id;
  end if;
  if new.status <> 'draft' and new.ref_no is null then new.ref_no := next_ref('SR'); end if;
  if new.status = 'submitted' and new.submitted_at is null then new.submitted_at := now(); end if;
  return new;
end $$;
create trigger trg_batch_before_write before insert or update on service_request_batches
  for each row execute function batch_before_write();

-- Starter packs: number + staff snapshot
create function starter_pack_before_write() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.ref_no is null then new.ref_no := next_ref('SP'); end if;
  return new;
end $$;
create trigger trg_sp_before_write before insert on starter_pack_requests
  for each row execute function starter_pack_before_write();

-- ───────────── Profile guards ─────────────
-- Users can never change their own role / is_active / phone (service role & admins can).
create function profiles_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_admin() then
    if new.role is distinct from old.role or new.is_active is distinct from old.is_active
       or new.phone is distinct from old.phone or new.id is distinct from old.id then
      raise exception 'You cannot change role, status or phone number';
    end if;
  end if;
  return new;
end $$;
create trigger trg_profiles_guard before update on profiles for each row execute function profiles_guard();

-- Doctors must belong to a manager-role profile
create function doctors_check_manager() returns trigger language plpgsql as $$
begin
  if new.manager_id is not null and not exists (select 1 from profiles where id = new.manager_id and role = 'manager') then
    raise exception 'Doctor must be assigned to a Doctor''s Manager';
  end if;
  return new;
end $$;
create trigger trg_doctors_check_manager before insert or update of manager_id on doctors
  for each row execute function doctors_check_manager();

-- Managers may only move a batch draft -> submitted; admin decides the rest.
create function batch_status_guard() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and not is_admin() and tg_op = 'UPDATE' then
    if new.status is distinct from old.status and not (old.status = 'draft' and new.status = 'submitted') then
      raise exception 'Only an admin can change this request status';
    end if;
    if new.admin_note is distinct from old.admin_note or new.decided_by is distinct from old.decided_by then
      raise exception 'Only an admin can decide a request';
    end if;
  end if;
  return new;
end $$;
create trigger trg_batch_status_guard before update on service_request_batches
  for each row execute function batch_status_guard();

create function starter_pack_status_guard() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and not is_admin() and tg_op = 'UPDATE' then
    if new.status is distinct from old.status and new.status <> 'cancelled' then
      raise exception 'Only an admin can process or fulfil a starter pack';
    end if;
    if new.fulfilled_by is distinct from old.fulfilled_by or new.admin_note is distinct from old.admin_note then
      raise exception 'Only an admin can fulfil a starter pack';
    end if;
  end if;
  return new;
end $$;
create trigger trg_sp_status_guard before update on starter_pack_requests
  for each row execute function starter_pack_status_guard();

-- ───────────── Driver duty rules (PLAN §5.7) ─────────────
create function driver_edit_window_days() returns int language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::int from app_settings where key = 'driver_edit_window_days'), 7)
$$;

create function duty_rules() returns trigger language plpgsql security definer set search_path = public as $$
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
    if new.total_minutes is null and new.start_time is not null and new.end_time is not null then
      v_min := (extract(epoch from (new.end_time - new.start_time)) / 60)::int;
      if v_min < 0 then v_min := v_min + 1440; end if; -- past midnight
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
create trigger trg_duty_rules before insert or update on driver_day_entries
  for each row execute function duty_rules();

-- Beta rates cannot start inside a finalised month
create function beta_rates_guard() returns trigger language plpgsql as $$
begin
  if exists (select 1 from beta_months where status = 'finalised' and month >= date_trunc('month', new.effective_from)::date) then
    raise exception 'A rate cannot start inside a finalised month';
  end if;
  return new;
end $$;
create trigger trg_beta_rates_guard before insert or update on beta_rates
  for each row execute function beta_rates_guard();

-- ───────────── Activity log ─────────────
create function log_activity() returns trigger language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  v_id := coalesce((to_jsonb(new) ->> 'id'), (to_jsonb(old) ->> 'id'))::uuid;
  insert into activity_log (actor_id, entity, entity_id, action, diff)
  values (auth.uid(), tg_table_name, v_id, lower(tg_op),
          case tg_op when 'INSERT' then jsonb_build_object('new', to_jsonb(new))
                     when 'UPDATE' then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
                     else jsonb_build_object('old', to_jsonb(old)) end);
  return coalesce(new, old);
end $$;
create trigger trg_log_batches after insert or update or delete on service_request_batches for each row execute function log_activity();
create trigger trg_log_starter_packs after insert or update or delete on starter_pack_requests for each row execute function log_activity();
create trigger trg_log_duties after insert or update or delete on driver_day_entries for each row execute function log_activity();

-- ───────────── RPCs that need several tables in one transaction ─────────────
-- create_starter_pack(payload): header + items, at least one item required.
create function create_starter_pack(payload jsonb) returns uuid language plpgsql security invoker set search_path = public as $$
declare v_id uuid; v_item jsonb; v_i int := 0;
begin
  if jsonb_typeof(payload -> 'items') <> 'array' or jsonb_array_length(payload -> 'items') = 0 then
    raise exception 'Add at least one product';
  end if;
  insert into starter_pack_requests (request_date, doctor_id, doctor_name, qualification, doctor_area,
                                     staff_id, staff_name, staff_area, division)
  values (coalesce((payload ->> 'request_date')::date, current_date), nullif(payload ->> 'doctor_id', '')::uuid,
          payload ->> 'doctor_name', payload ->> 'qualification', payload ->> 'doctor_area',
          coalesce(nullif(payload ->> 'staff_id', '')::uuid, auth.uid()), payload ->> 'staff_name',
          payload ->> 'staff_area', payload ->> 'division')
  returning id into v_id;
  for v_item in select * from jsonb_array_elements(payload -> 'items') loop
    insert into starter_pack_items (request_id, product_id, product_name, quantity, sort_order)
    values (v_id, nullif(v_item ->> 'product_id', '')::uuid, v_item ->> 'product_name', v_item ->> 'quantity', v_i);
    v_i := v_i + 1;
  end loop;
  return v_id;
end $$;

-- submit_service_batch(id): needs an accountability staff and at least one service.
create function submit_service_batch(p_batch uuid) returns text language plpgsql security invoker set search_path = public as $$
declare v_ref text;
begin
  if not exists (select 1 from service_requests where batch_id = p_batch) then
    raise exception 'Add at least one service before submitting';
  end if;
  if (select accountability_staff_id from service_request_batches where id = p_batch) is null then
    raise exception 'Choose the accountability staff';
  end if;
  update service_request_batches set status = 'submitted' where id = p_batch and status = 'draft'
  returning ref_no into v_ref;
  if v_ref is null then raise exception 'Request not found or already submitted'; end if;
  return v_ref;
end $$;
