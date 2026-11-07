-- Manager performance, release 1: locations, who covers them, product tags/price, monthly sales entry, saved report presets.

-- ───────────── Locations (e.g. Madurai) and the managers who cover them (admin assigns) ─────────────
create table locations (
  id uuid primary key default gen_random_uuid(),
  code text not null check (length(trim(code)) > 0),
  name text not null check (length(trim(name)) > 0),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index locations_code_ci on locations (upper(code));
create unique index locations_name_ci on locations (lower(name));
create trigger trg_locations_updated before update on locations for each row execute function set_updated_at();
alter table locations enable row level security;
create policy locations_read on locations for select to authenticated using (true);
create policy locations_admin_write on locations for all to authenticated using (is_admin()) with check (is_admin());
grant select, insert, update, delete on locations to authenticated;
insert into locations (code, name, sort_order) values ('MDU', 'Madurai', 1), ('NGL', 'Nagercoil', 2), ('TVL', 'Tirunelveli', 3);

create table manager_locations (
  manager_id uuid not null references profiles (id) on delete cascade,
  location_id uuid not null references locations (id) on delete cascade,
  primary key (manager_id, location_id)
);
create index on manager_locations (location_id);
alter table manager_locations enable row level security;
create policy manager_locations_own_read on manager_locations for select to authenticated using (manager_id = auth.uid());
create policy manager_locations_admin on manager_locations for all to authenticated using (is_admin()) with check (is_admin());
grant select, insert, update, delete on manager_locations to authenticated;

-- ───────────── Product tags: Core (KDP) / New, price to stockist, KDP group ─────────────
alter table products
  add column tag text check (tag in ('core', 'new')),
  add column pts numeric(10,2) check (pts >= 0),
  add column kdp_group text;

-- ───────────── Monthly sales entry: per manager, location, product and month (units) ─────────────
create table sales_entries (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references profiles (id) on delete cascade,
  location_id uuid not null references locations (id) on delete restrict,
  product_id uuid not null references products (id) on delete restrict,
  month date not null check (month = date_trunc('month', month)::date),
  primary_target numeric(12,2) not null default 0 check (primary_target >= 0),
  secondary_target numeric(12,2) not null default 0 check (secondary_target >= 0),
  primary_ach numeric(12,2) not null default 0 check (primary_ach >= 0),
  secondary_ach numeric(12,2) not null default 0 check (secondary_ach >= 0),
  sales_return numeric(12,2) not null default 0 check (sales_return >= 0),
  entered_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (manager_id, location_id, product_id, month)
);
create index on sales_entries (manager_id, month);
create trigger trg_sales_entries_updated before update on sales_entries for each row execute function set_updated_at();
alter table sales_entries enable row level security;
create policy sales_entries_own_read on sales_entries for select to authenticated using (manager_id = auth.uid());
create policy sales_entries_admin_read on sales_entries for select to authenticated using (is_admin());
grant select on sales_entries to authenticated;
-- no write policies: every write goes through save_sales_entry()

-- Manager: own entries, only in a location they cover, up to the current month. A month that has ended is frozen once the
-- product has an entry for it (a product with no entry yet can still be filled in once). Admin: any manager, any month.
create function save_sales_entry(
  p_manager uuid, p_location uuid, p_product uuid, p_month date,
  p_primary_target numeric, p_secondary_target numeric, p_primary_ach numeric, p_secondary_ach numeric, p_sales_return numeric
) returns sales_entries
language plpgsql security definer set search_path = public as $$
declare
  v_role user_role := auth_role();
  v_month date := date_trunc('month', p_month)::date;
  v_now date := date_trunc('month', now() at time zone 'Asia/Kolkata')::date;
  v_mgr uuid;
  r sales_entries;
begin
  if v_role is null or v_role not in ('admin', 'manager') then raise exception 'Not allowed'; end if;
  v_mgr := case when v_role = 'admin' then p_manager else auth.uid() end;
  if v_mgr is null or not exists (select 1 from profiles where id = v_mgr and role = 'manager') then
    raise exception 'Choose a manager';
  end if;
  if least(p_primary_target, p_secondary_target, p_primary_ach, p_secondary_ach, p_sales_return) < 0 then
    raise exception 'Enter 0 or more';
  end if;
  if not exists (select 1 from products where id = p_product) then raise exception 'Product not found'; end if;
  if not exists (select 1 from manager_locations where manager_id = v_mgr and location_id = p_location) then
    raise exception 'This manager does not cover that location. Ask an admin to assign it.';
  end if;
  if v_month > v_now then raise exception 'Sales can only be entered up to the current month'; end if;
  if v_role <> 'admin' and v_month < v_now
     and exists (select 1 from sales_entries where manager_id = v_mgr and location_id = p_location and product_id = p_product and month = v_month) then
    raise exception 'This month has ended, so it is locked. Ask an admin to change it.';
  end if;
  insert into sales_entries (manager_id, location_id, product_id, month, primary_target, secondary_target, primary_ach, secondary_ach, sales_return, entered_by)
  values (v_mgr, p_location, p_product, v_month, coalesce(p_primary_target, 0), coalesce(p_secondary_target, 0),
          coalesce(p_primary_ach, 0), coalesce(p_secondary_ach, 0), coalesce(p_sales_return, 0), auth.uid())
  on conflict (manager_id, location_id, product_id, month) do update
    set primary_target = excluded.primary_target, secondary_target = excluded.secondary_target,
        primary_ach = excluded.primary_ach, secondary_ach = excluded.secondary_ach,
        sales_return = excluded.sales_return, entered_by = excluded.entered_by
  returning * into r;
  return r;
end $$;
revoke execute on function save_sales_entry(uuid, uuid, uuid, date, numeric, numeric, numeric, numeric, numeric) from public, anon;
grant execute on function save_sales_entry(uuid, uuid, uuid, date, numeric, numeric, numeric, numeric, numeric) to authenticated;

-- ───────────── Saved report views (each person keeps their own) ─────────────
create table report_presets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  report text not null,
  name text not null check (length(trim(name)) > 0),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (owner_id, report, name)
);
alter table report_presets enable row level security;
create policy report_presets_own on report_presets for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
grant select, insert, update, delete on report_presets to authenticated;
