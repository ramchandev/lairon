-- LAIRON EZ — managers are LAIRON people: they see every doctor, are accountable for their own requests,
-- doctors are unique by phone, and each doctor gets a monthly revenue figure that freezes when the month ends.

-- ───────────── Managers read every doctor (they still edit/delete only their own) ─────────────
drop policy doctors_manager_select on doctors;
create policy doctors_manager_select on doctors for select to authenticated using (auth_role() = 'manager');

-- ───────────── Doctor phone: mandatory and unique ─────────────
-- A trigger (not a table constraint) so older rows without a phone, or with duplicates, do not block the migration.
create function doctor_phone_rules() returns trigger language plpgsql security definer set search_path = public as $$
declare v_other uuid;
begin
  if tg_op = 'INSERT' or new.phone is distinct from old.phone then
    if new.phone is null or length(trim(new.phone)) = 0 then
      raise exception 'The doctor''s phone number is required';
    end if;
    select id into v_other from doctors where phone = new.phone and id <> new.id limit 1;
    if v_other is not null then
      raise exception 'A doctor with this phone number already exists' using errcode = '23505', detail = v_other::text;
    end if;
  end if;
  return new;
end $$;
create trigger trg_doctor_phone before insert or update on doctors for each row execute function doctor_phone_rules();
do $$ begin
  if not exists (select 1 from doctors where phone is not null group by phone having count(*) > 1) then
    create unique index doctors_phone_unique on doctors (phone) where phone is not null;
  end if;
end $$;

-- ───────────── Manager = accountable for their own requests ─────────────
create or replace function batch_before_write() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.manager_name is null and new.manager_id is not null then
    select full_name into new.manager_name from profiles where id = new.manager_id;
  end if;
  -- Managers are LAIRON staff themselves: unless someone else is named, they are the accountable person.
  if new.accountability_staff_id is null and new.manager_id is not null then
    new.accountability_staff_id := new.manager_id;
  end if;
  if new.accountability_staff_id is not null and
     (new.accountability_staff_name is null or tg_op = 'UPDATE' and new.accountability_staff_id is distinct from old.accountability_staff_id) then
    select full_name into new.accountability_staff_name from profiles where id = new.accountability_staff_id;
  end if;
  if new.status <> 'draft' and new.ref_no is null then new.ref_no := next_ref('SR'); end if;
  if new.status = 'submitted' and new.submitted_at is null then new.submitted_at := now(); end if;
  return new;
end $$;

create or replace function get_or_create_draft_batch() returns uuid language plpgsql security invoker set search_path = public as $$
declare v uuid;
begin
  if auth_role() is distinct from 'manager' then
    raise exception 'Only a Manager can start a service request';
  end if;
  select id into v from service_request_batches where manager_id = auth.uid() and status = 'draft';
  if v is null then
    insert into service_request_batches (manager_id, status) values (auth.uid(), 'draft')
    on conflict (manager_id) where status = 'draft' do nothing returning id into v;
    if v is null then
      select id into v from service_request_batches where manager_id = auth.uid() and status = 'draft';
    end if;
  end if;
  return v;
end $$;

-- Existing drafts / requests without a named accountable person: the manager.
update service_request_batches set accountability_staff_id = manager_id where accountability_staff_id is null and manager_id is not null;

create or replace function import_service_requests(batch jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_req jsonb; v_svc jsonb; v_id uuid; v_status text; v_when timestamptz; v_n int := 0; v_s int := 0; v_i int := 0;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  perform set_config('lairon.skip_notify', 'on', true);
  for v_req in select * from jsonb_array_elements(batch -> 'requests') loop
    v_i := v_i + 1;
    v_status := coalesce(v_req ->> 'status', 'submitted');
    if v_status not in ('submitted', 'approved', 'rejected', 'fulfilled') then
      raise exception 'Request %: invalid status "%"', v_i, v_status;
    end if;
    if not exists (select 1 from profiles where id = (v_req ->> 'manager_id')::uuid and role = 'manager') then
      raise exception 'Request %: unknown Doctor''s Manager', v_i;
    end if;
    -- accountability is optional: blank = the manager themself
    if nullif(v_req ->> 'staff_id', '') is not null
       and not exists (select 1 from profiles where id = (v_req ->> 'staff_id')::uuid and role in ('staff', 'manager')) then
      raise exception 'Request %: unknown accountability person', v_i;
    end if;
    if jsonb_array_length(coalesce(v_req -> 'services', '[]'::jsonb)) = 0 then
      raise exception 'Request %: no services', v_i;
    end if;
    if v_status = 'rejected' and coalesce(length(trim(v_req ->> 'admin_note')), 0) = 0 then
      raise exception 'Request %: a rejected request needs a note (reason)', v_i;
    end if;
    if nullif(v_req ->> 'ref_no', '') is not null and exists (select 1 from service_request_batches where ref_no = v_req ->> 'ref_no') then
      raise exception 'Request %: reference % already exists', v_i, v_req ->> 'ref_no';
    end if;
    v_when := coalesce(nullif(v_req ->> 'submitted_on', '')::date::timestamptz, now());
    insert into service_request_batches (ref_no, manager_id, accountability_staff_id, status, submitted_at, decided_by, decided_at, admin_note)
    values (nullif(v_req ->> 'ref_no', ''), (v_req ->> 'manager_id')::uuid, coalesce(nullif(v_req ->> 'staff_id', '')::uuid, (v_req ->> 'manager_id')::uuid), v_status, v_when,
            case when v_status <> 'submitted' then auth.uid() end, case when v_status <> 'submitted' then v_when end,
            nullif(v_req ->> 'admin_note', ''))
    returning id into v_id;
    for v_svc in select * from jsonb_array_elements(v_req -> 'services') loop
      insert into service_requests (batch_id, request_date, doctor_id, doctor_name, area, hospital_name, pharmacy_name, hq, division,
        qualification, speciality, service_amount, service_type, expected_business_value, current_business_value,
        offer_type, offer_percent, netrate_amount)
      values (v_id, (v_svc ->> 'request_date')::date, nullif(v_svc ->> 'doctor_id', '')::uuid, v_svc ->> 'doctor_name', v_svc ->> 'area',
        v_svc ->> 'hospital_name', nullif(v_svc ->> 'pharmacy_name', ''), v_svc ->> 'hq', v_svc ->> 'division',
        v_svc ->> 'qualification', v_svc ->> 'speciality', (v_svc ->> 'service_amount')::numeric, v_svc ->> 'service_type',
        coalesce((v_svc ->> 'expected_business_value')::numeric, 0), coalesce((v_svc ->> 'current_business_value')::numeric, 0),
        v_svc ->> 'offer_type', nullif(v_svc ->> 'offer_percent', '')::numeric, nullif(v_svc ->> 'netrate_amount', '')::numeric);
      v_s := v_s + 1;
    end loop;
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('requests', v_n, 'services', v_s);
end $$;

-- ───────────── Monthly revenue per doctor ─────────────
create table doctor_revenue (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references doctors (id) on delete cascade,
  month date not null check (month = date_trunc('month', month)::date),
  amount numeric(14,2) not null check (amount >= 0),
  entered_by uuid references profiles (id) on delete set null,
  entered_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (doctor_id, month)
);
create trigger trg_doctor_revenue_updated before update on doctor_revenue for each row execute function set_updated_at();
create trigger trg_log_doctor_revenue after insert or update or delete on doctor_revenue for each row execute function log_activity();
alter table doctor_revenue enable row level security;
create policy doctor_revenue_read on doctor_revenue for select to authenticated using (auth_role() in ('admin', 'manager'));
-- no insert/update policies: every write goes through set_doctor_revenue()
grant select on doctor_revenue to authenticated;

-- A manager may set the figure for the current or a future month, and fill a past month that has no entry; once an entry
-- exists and the month has passed, only an admin may change it.
create function set_doctor_revenue(p_doctor uuid, p_month date, p_amount numeric) returns doctor_revenue
language plpgsql security definer set search_path = public as $$
declare
  v_role user_role := auth_role();
  v_month date := date_trunc('month', p_month)::date;
  v_now date := date_trunc('month', now() at time zone 'Asia/Kolkata')::date;
  r doctor_revenue;
begin
  if v_role is null or v_role not in ('admin', 'manager') then raise exception 'Not allowed'; end if;
  if p_amount is null or p_amount < 0 then raise exception 'Enter the revenue as an amount of 0 or more'; end if;
  if not exists (select 1 from doctors where id = p_doctor) then raise exception 'Doctor not found'; end if;
  -- A month that has ended is frozen for managers: an entry that exists cannot change (an admin can), but a month with
  -- no entry yet can still be filled in once.
  if v_role <> 'admin' and v_month < v_now
     and exists (select 1 from doctor_revenue where doctor_id = p_doctor and month = v_month) then
    raise exception 'This month has ended, so its revenue is locked. Ask an admin to change it.';
  end if;
  insert into doctor_revenue (doctor_id, month, amount, entered_by, entered_by_name)
  values (p_doctor, v_month, p_amount, auth.uid(), (select full_name from profiles where id = auth.uid()))
  on conflict (doctor_id, month) do update
    set amount = excluded.amount, entered_by = excluded.entered_by, entered_by_name = excluded.entered_by_name
  returning * into r;
  return r;
end $$;
revoke execute on function set_doctor_revenue(uuid, date, numeric) from public, anon;
grant execute on function set_doctor_revenue(uuid, date, numeric) to authenticated;
