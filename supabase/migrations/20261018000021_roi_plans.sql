-- Manager performance, release 3: a doctor's location (for ROI by location), the conversion plan, and core-doctor coverage.
-- ROI itself needs no new table: it is worked out from the service amount and monthly revenue already recorded on requests.

alter table doctors add column location_id uuid references locations (id) on delete set null;
create index on doctors (location_id);

-- ───────────── Conversion plan: doctors a manager plans to win over, the visits made, and when they converted ─────────────
create table conversion_plans (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references profiles (id) on delete cascade,
  month date not null check (month = date_trunc('month', month)::date),
  doctor_id uuid references doctors (id) on delete set null,
  doctor_name text not null check (length(trim(doctor_name)) > 0),
  hospital text,
  speciality text,
  location_id uuid references locations (id) on delete set null,
  visits int not null default 0 check (visits >= 0),
  visited_date date,
  pob numeric(12,2) check (pob >= 0),
  activities text,
  remarks text,
  converted_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on conversion_plans (manager_id, month);
create trigger trg_conversion_plans_updated before update on conversion_plans for each row execute function set_updated_at();

-- ───────────── Core doctors and who covered them each month (names for now) ─────────────
create table core_doctors (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references profiles (id) on delete cascade,
  doctor_id uuid references doctors (id) on delete set null,
  doctor_name text not null check (length(trim(doctor_name)) > 0),
  speciality text,
  area text,
  location_id uuid references locations (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on core_doctors (manager_id);

create table core_coverage (
  core_doctor_id uuid not null references core_doctors (id) on delete cascade,
  month date not null check (month = date_trunc('month', month)::date),
  role text not null check (role in ('MR', 'ABM', 'RBM', 'ZSM', 'SH')),
  covered_by text not null check (length(trim(covered_by)) > 0),
  primary key (core_doctor_id, month, role)
);

alter table conversion_plans enable row level security;
alter table core_doctors enable row level security;
alter table core_coverage enable row level security;
-- a manager keeps their own lists; an admin sees and can correct everyone's
create policy conversion_plans_own on conversion_plans for all to authenticated
  using (manager_id = auth.uid() and auth_role() = 'manager') with check (manager_id = auth.uid() and auth_role() = 'manager');
create policy conversion_plans_admin on conversion_plans for all to authenticated using (is_admin()) with check (is_admin());
create policy core_doctors_own on core_doctors for all to authenticated
  using (manager_id = auth.uid() and auth_role() = 'manager') with check (manager_id = auth.uid() and auth_role() = 'manager');
create policy core_doctors_admin on core_doctors for all to authenticated using (is_admin()) with check (is_admin());
create policy core_coverage_own on core_coverage for all to authenticated
  using (exists (select 1 from core_doctors d where d.id = core_doctor_id and d.manager_id = auth.uid() and auth_role() = 'manager'))
  with check (exists (select 1 from core_doctors d where d.id = core_doctor_id and d.manager_id = auth.uid() and auth_role() = 'manager'));
create policy core_coverage_admin on core_coverage for all to authenticated using (is_admin()) with check (is_admin());
grant select, insert, update, delete on conversion_plans, core_doctors, core_coverage to authenticated;
