-- LAIRON EZ — monthly revenue is tracked per SERVICE (month on month), and a manager's requests can be handed over to
-- another manager so the follow-up (monthly revenue) continues when someone leaves.

-- Revenue used to be per doctor (migration 16); it is per service now.
drop function if exists set_doctor_revenue(uuid, date, numeric);
drop table if exists doctor_revenue;

-- ───────────── Handover history ─────────────
create table request_handovers (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references service_request_batches (id) on delete cascade,
  from_manager_id uuid references profiles (id) on delete set null,
  from_manager_name text,
  to_manager_id uuid references profiles (id) on delete set null,
  to_manager_name text,
  note text,
  changed_by uuid references profiles (id) on delete set null,
  changed_by_name text,
  changed_at timestamptz not null default now()
);
create index on request_handovers (batch_id, changed_at desc);
alter table request_handovers enable row level security;
create policy handovers_admin_read on request_handovers for select to authenticated using (is_admin());
create policy handovers_manager_read on request_handovers for select to authenticated
  using (exists (select 1 from service_request_batches b where b.id = batch_id and b.manager_id = auth.uid()));
grant select on request_handovers to authenticated;

-- ───────────── Monthly revenue per service ─────────────
create table service_revenue (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references service_requests (id) on delete cascade,
  month date not null check (month = date_trunc('month', month)::date),
  amount numeric(14,2) not null check (amount >= 0),
  entered_by uuid references profiles (id) on delete set null,
  entered_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_id, month)
);
create trigger trg_service_revenue_updated before update on service_revenue for each row execute function set_updated_at();
create trigger trg_log_service_revenue after insert or update or delete on service_revenue for each row execute function log_activity();
alter table service_revenue enable row level security;
create policy service_revenue_admin_read on service_revenue for select to authenticated using (is_admin());
-- the manager who currently handles the request (after a handover: the new one) sees and enters its revenue
create policy service_revenue_manager_read on service_revenue for select to authenticated
  using (exists (select 1 from service_requests s join service_request_batches b on b.id = s.batch_id
                 where s.id = service_id and b.manager_id = auth.uid()));
grant select on service_revenue to authenticated;
-- no insert/update policies: every write goes through set_service_revenue()

-- Admin: any month. Manager: only for services of requests they handle, for submitted/approved/fulfilled requests, up to the current
-- month. A month that has ended is frozen for managers once it has an entry (an admin can still change it); a past month
-- with no entry can be filled in once.
create function set_service_revenue(p_service uuid, p_month date, p_amount numeric) returns service_revenue
language plpgsql security definer set search_path = public as $$
declare
  v_role user_role := auth_role();
  v_month date := date_trunc('month', p_month)::date;
  v_now date := date_trunc('month', now() at time zone 'Asia/Kolkata')::date;
  s record; r service_revenue;
begin
  if v_role is null or v_role not in ('admin', 'manager') then raise exception 'Not allowed'; end if;
  if p_amount is null or p_amount < 0 then raise exception 'Enter the revenue as an amount of 0 or more'; end if;
  select s2.id, s2.request_date, b.manager_id, b.status into s
    from service_requests s2 join service_request_batches b on b.id = s2.batch_id where s2.id = p_service;
  if not found then raise exception 'Service not found'; end if;
  if v_role = 'manager' and s.manager_id is distinct from auth.uid() then
    raise exception 'Only the manager who handles this request can enter its revenue';
  end if;
  if s.status not in ('submitted', 'approved', 'fulfilled') then
    raise exception 'Revenue can be entered once the request is submitted (and not rejected)';
  end if;
  if v_month > v_now then raise exception 'Revenue can only be entered up to the current month'; end if;
  if v_month < date_trunc('month', s.request_date)::date then
    raise exception 'That month is before this service started';
  end if;
  if v_role <> 'admin' and v_month < v_now
     and exists (select 1 from service_revenue where service_id = p_service and month = v_month) then
    raise exception 'This month has ended, so its revenue is locked. Ask an admin to change it.';
  end if;
  insert into service_revenue (service_id, month, amount, entered_by, entered_by_name)
  values (p_service, v_month, p_amount, auth.uid(), (select full_name from profiles where id = auth.uid()))
  on conflict (service_id, month) do update
    set amount = excluded.amount, entered_by = excluded.entered_by, entered_by_name = excluded.entered_by_name
  returning * into r;
  return r;
end $$;
revoke execute on function set_service_revenue(uuid, date, numeric) from public, anon;
grant execute on function set_service_revenue(uuid, date, numeric) to authenticated;

-- A doctor's revenue by month = the sum over all of that doctor's services (totals only, so any manager can see them).
create function doctor_revenue_summary(p_doctor uuid) returns table (month date, amount numeric, services int)
language sql stable security definer set search_path = public as $$
  select r.month, sum(r.amount), count(distinct r.service_id)::int
  from service_revenue r join service_requests s on s.id = r.service_id
  where s.doctor_id = p_doctor and auth_role() in ('admin', 'manager')
  group by r.month order by r.month desc
$$;
revoke execute on function doctor_revenue_summary(uuid) from public, anon;
grant execute on function doctor_revenue_summary(uuid) to authenticated;

-- ───────────── Handover ─────────────
-- Moves ONE request to another manager. The accountable person follows when it was the previous manager.
create function reassign_request(p_batch uuid, p_to uuid, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare b record; v_to text; v_by text;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  select id, manager_id, manager_name, status, accountability_staff_id into b from service_request_batches where id = p_batch;
  if not found then raise exception 'Request not found'; end if;
  if b.status = 'draft' then raise exception 'A draft cannot be handed over'; end if;
  select full_name into v_to from profiles where id = p_to and role = 'manager' and is_active;
  if v_to is null then raise exception 'Choose an active manager'; end if;
  if b.manager_id = p_to then raise exception 'That manager already handles this request'; end if;
  select full_name into v_by from profiles where id = auth.uid();
  insert into request_handovers (batch_id, from_manager_id, from_manager_name, to_manager_id, to_manager_name, note, changed_by, changed_by_name)
  values (p_batch, b.manager_id, b.manager_name, p_to, v_to, nullif(trim(p_note), ''), auth.uid(), v_by);
  update service_request_batches
     set manager_id = p_to, manager_name = v_to,
         accountability_staff_id = case when accountability_staff_id is not distinct from b.manager_id then p_to else accountability_staff_id end
   where id = p_batch;
end $$;
revoke execute on function reassign_request(uuid, uuid, text) from public, anon;
grant execute on function reassign_request(uuid, uuid, text) to authenticated;

-- What a manager currently holds (for the hand-over screen).
create function manager_workload(p_manager uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when is_admin() then jsonb_build_object(
    'doctors', (select count(*) from doctors where manager_id = p_manager),
    'requests', (select count(*) from service_request_batches where manager_id = p_manager and status <> 'draft'),
    'open_requests', (select count(*) from service_request_batches where manager_id = p_manager and status in ('submitted', 'approved')),
    'drafts', (select count(*) from service_request_batches where manager_id = p_manager and status = 'draft')) end
$$;
revoke execute on function manager_workload(uuid) from public, anon;
grant execute on function manager_workload(uuid) to authenticated;

-- Hand over EVERYTHING a manager holds (when they leave): all their doctors and all their non-draft requests.
-- Drafts move only when the receiver has no draft of their own (one draft per manager).
create function transfer_manager_work(p_from uuid, p_to uuid, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_to text; v_from text; v_by text; v_doctors int; v_requests int := 0; v_drafts int := 0; b record;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if p_from = p_to then raise exception 'Choose a different manager'; end if;
  select full_name into v_from from profiles where id = p_from and role = 'manager';
  if v_from is null then raise exception 'The person leaving must be a manager'; end if;
  select full_name into v_to from profiles where id = p_to and role = 'manager' and is_active;
  if v_to is null then raise exception 'Choose an active manager to receive the work'; end if;
  select full_name into v_by from profiles where id = auth.uid();

  with d as (update doctors set manager_id = p_to where manager_id = p_from returning 1) select count(*) into v_doctors from d;

  for b in select id, manager_name from service_request_batches where manager_id = p_from and status <> 'draft' loop
    insert into request_handovers (batch_id, from_manager_id, from_manager_name, to_manager_id, to_manager_name, note, changed_by, changed_by_name)
    values (b.id, p_from, coalesce(b.manager_name, v_from), p_to, v_to, nullif(trim(p_note), ''), auth.uid(), v_by);
    update service_request_batches
       set manager_id = p_to, manager_name = v_to,
           accountability_staff_id = case when accountability_staff_id is not distinct from p_from then p_to else accountability_staff_id end
     where id = b.id;
    v_requests := v_requests + 1;
  end loop;

  select count(*) into v_drafts from service_request_batches where manager_id = p_from and status = 'draft';
  if v_drafts > 0 and not exists (select 1 from service_request_batches where manager_id = p_to and status = 'draft') then
    update service_request_batches set manager_id = p_to, manager_name = v_to,
           accountability_staff_id = case when accountability_staff_id is not distinct from p_from then p_to else accountability_staff_id end
     where manager_id = p_from and status = 'draft';
    v_drafts := 0;
  end if;
  return jsonb_build_object('doctors', v_doctors, 'requests', v_requests, 'drafts_left', v_drafts);
end $$;
revoke execute on function transfer_manager_work(uuid, uuid, text) from public, anon;
grant execute on function transfer_manager_work(uuid, uuid, text) to authenticated;
