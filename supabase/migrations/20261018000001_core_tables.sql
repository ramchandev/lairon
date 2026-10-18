-- LAIRON EZ — Phase 1: core tables. See docs/PLAN.md §5.
-- Dropdown values are stored as plain TEXT snapshots in transactional tables (PLAN §4).

create type user_role as enum ('admin', 'staff', 'driver', 'manager');

create function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ───────────── People ─────────────
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role user_role not null,
  full_name text not null check (length(trim(full_name)) > 0),
  phone text not null unique check (phone ~ '^\+91[6-9][0-9]{9}$'),
  email text,
  area text,
  hq text,
  bio text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- email required for admin/staff/driver; optional for manager
  constraint profiles_email_required check (role = 'manager' or (email is not null and length(trim(email)) > 0))
);

-- Role helpers used by RLS. security definer so policies on profiles don't recurse.
create function auth_role() returns user_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and is_active
$$;
create function is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from profiles where id = auth.uid() and is_active), false)
$$;

-- ───────────── Masters ─────────────
create table vehicles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  vehicle_number text not null unique check (vehicle_number = upper(vehicle_number) and vehicle_number !~ '\s'),
  color text, make text, model text,
  year int check (year between 1990 and extract(year from now())::int + 1),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table divisions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  description text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index products_name_ci on products (lower(name));

create table product_divisions (
  product_id uuid not null references products (id) on delete cascade,
  division_id uuid not null references divisions (id) on delete cascade,
  primary key (product_id, division_id)
);
create index on product_divisions (division_id);

-- ───────────── Dropdowns ─────────────
create table lookup_lists (
  key text primary key,
  label text not null,
  icon text,
  allow_other boolean not null default false,
  is_system boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table lookup_items (
  id uuid primary key default gen_random_uuid(),
  list_key text not null references lookup_lists (key) on delete cascade on update cascade,
  value text not null check (length(trim(value)) > 0),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index lookup_items_unique on lookup_items (list_key, lower(value));

-- Configuration (not transactional), so real FKs are fine here.
create table division_qual_spec_map (
  id uuid primary key default gen_random_uuid(),
  division_id uuid not null references divisions (id) on delete cascade,
  qualification_item_id uuid not null references lookup_items (id) on delete cascade,
  speciality_item_id uuid not null references lookup_items (id) on delete cascade,
  unique (division_id, qualification_item_id, speciality_item_id)
);

-- ───────────── Doctors ─────────────
create table doctors (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid references profiles (id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  phone text, email text,
  qualification text, speciality text, division text,
  area text, hospital_name text, pharmacy_name text, hq text, notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on doctors (manager_id);
create index on doctors (lower(name));

-- ───────────── Reference numbers ─────────────
create table ref_counters (
  prefix text not null, ym text not null, n int not null default 0,
  primary key (prefix, ym)
);

-- ───────────── Service requests ─────────────
create table service_request_batches (
  id uuid primary key default gen_random_uuid(),
  ref_no text unique,
  manager_id uuid references profiles (id) on delete set null,
  manager_name text,
  accountability_staff_id uuid references profiles (id) on delete set null,
  accountability_staff_name text,
  status text not null default 'draft' check (status in ('draft','submitted','approved','rejected','fulfilled')),
  submitted_at timestamptz,
  decided_by uuid references profiles (id) on delete set null,
  decided_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on service_request_batches (manager_id);
create index on service_request_batches (status, created_at);
-- one open draft per manager
create unique index one_draft_per_manager on service_request_batches (manager_id) where status = 'draft';

create table service_requests (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references service_request_batches (id) on delete cascade,
  request_date date not null default current_date,
  doctor_id uuid references doctors (id) on delete set null,
  doctor_name text not null,
  area text not null,
  hospital_name text not null,
  pharmacy_name text,
  hq text not null,
  division text not null,
  qualification text not null,
  speciality text not null,
  service_amount numeric(12,2) not null check (service_amount >= 0),
  service_type text not null,
  expected_business_value numeric(12,2) not null check (expected_business_value >= 0),
  current_business_value numeric(12,2) not null check (current_business_value >= 0),
  offer_type text not null,
  offer_percent numeric(5,2) check (offer_percent between 0 and 100),
  netrate_amount numeric(12,2) check (netrate_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offer_needs_percent check (lower(offer_type) <> 'offer' or offer_percent is not null),
  constraint netrate_needs_amount check (lower(offer_type) <> 'netrate' or netrate_amount is not null)
);
create index on service_requests (batch_id);
create index on service_requests (doctor_id);

-- ───────────── Starter packs ─────────────
create table starter_pack_requests (
  id uuid primary key default gen_random_uuid(),
  ref_no text unique,
  request_date date not null default current_date,
  doctor_id uuid references doctors (id) on delete set null,
  doctor_name text not null,
  qualification text not null,
  doctor_area text not null,
  staff_id uuid references profiles (id) on delete set null,
  staff_name text not null,
  staff_area text not null,
  division text not null,
  status text not null default 'submitted' check (status in ('submitted','processing','fulfilled','cancelled')),
  fulfilled_by uuid references profiles (id) on delete set null,
  fulfilled_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on starter_pack_requests (staff_id);
create index on starter_pack_requests (status, created_at);

create table starter_pack_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references starter_pack_requests (id) on delete cascade,
  product_id uuid references products (id) on delete set null,
  product_name text not null check (length(trim(product_name)) > 0),
  quantity text not null check (length(trim(quantity)) > 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on starter_pack_items (request_id);

-- ───────────── Trip duty ─────────────
create table duty_import_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text,
  driver_id uuid references profiles (id) on delete set null,
  driver_name text,
  month date not null,
  rows_read int not null default 0,
  duties int not null default 0,
  week_offs int not null default 0,
  leaves int not null default 0,
  mode text not null check (mode in ('replace','fill')),
  replaced_count int not null default 0,
  issues jsonb not null default '[]'::jsonb,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  undone_at timestamptz
);

create table driver_day_entries (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid references profiles (id) on delete set null,
  driver_name text,
  entry_date date not null,
  entry_type text not null check (entry_type in ('duty','week_off','leave')),
  duty_type text check (duty_type in ('Local','Out Station')),
  vehicle_source text check (vehicle_source in ('fleet','own','other')),
  vehicle_id uuid references vehicles (id) on delete set null,
  vehicle_label text,
  guest_name text, guest_area text, pickup_point text, drop_point text,
  start_km int check (start_km >= 0), start_time time,
  end_km int check (end_km >= 0), end_time time,
  total_km int check (total_km >= 0),
  total_minutes int check (total_minutes >= 0),
  fuel_litres numeric(7,2) check (fuel_litres >= 0),
  fuel_amount numeric(10,2) check (fuel_amount >= 0),
  duty_status text check (duty_status in ('open','closed')),
  leave_type text, leave_reason text,
  leave_status text check (leave_status in ('pending','approved','rejected')),
  decided_by uuid references profiles (id) on delete set null,
  decided_at timestamptz,
  entry_source text not null default 'app' check (entry_source in ('app','import')),
  import_batch_id uuid references duty_import_batches (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint duty_has_status check (entry_type <> 'duty' or duty_status is not null)
);
create index on driver_day_entries (driver_id, entry_date);
create index on driver_day_entries (import_batch_id);
create index on driver_day_entries (entry_type, leave_status);

-- ───────────── Settings & logs ─────────────
create table beta_rates (
  id uuid primary key default gen_random_uuid(),
  effective_from date not null unique,
  local_rate numeric(10,2) not null check (local_rate > 0),
  outstation_rate numeric(10,2) not null check (outstation_rate > 0),
  note text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table beta_months (
  month date primary key check (month = date_trunc('month', month)::date),
  status text not null default 'draft' check (status in ('draft','finalised')),
  finalised_by uuid references profiles (id) on delete set null,
  finalised_at timestamptz,
  reopened_by uuid references profiles (id) on delete set null,
  reopened_at timestamptz,
  reopen_reason text
);

create table beta_statements (
  id uuid primary key default gen_random_uuid(),
  month date not null check (month = date_trunc('month', month)::date),
  driver_id uuid references profiles (id) on delete set null,
  driver_name text not null,
  local_days int not null, outstation_days int not null, payable_days int not null,
  local_amount numeric(12,2) not null, outstation_amount numeric(12,2) not null, total_amount numeric(12,2) not null,
  rates_used jsonb,
  finalised_by uuid references profiles (id) on delete set null,
  finalised_at timestamptz not null default now(),
  unique (month, driver_id)
);

create table app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table login_attempts (
  id uuid primary key default gen_random_uuid(),
  phone text, ip text,
  created_at timestamptz not null default now()
);
create index on login_attempts (phone, created_at);
create index on login_attempts (ip, created_at);

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  entity text not null,
  entity_id uuid,
  action text not null,
  diff jsonb,
  created_at timestamptz not null default now()
);
create index on activity_log (created_at desc);

create table email_log (
  id uuid primary key default gen_random_uuid(),
  "to" text, template text, status text, error text, payload jsonb,
  created_at timestamptz not null default now()
);

-- updated_at triggers on every table that has the column
do $$
declare t text;
begin
  for t in select table_name from information_schema.columns
           where table_schema = 'public' and column_name = 'updated_at'
  loop
    execute format('create trigger trg_%1$s_updated_at before update on %1$I for each row execute function set_updated_at()', t);
  end loop;
end $$;
