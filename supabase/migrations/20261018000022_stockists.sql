-- Manager performance, release 4: stockists (added by hand for now, picked by location) and their monthly sales / closing / return values.
-- Values are in ₹ lakhs, as in the RBM workbook. A separate Stockist database can replace the manual list later.

create table stockists (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  location_id uuid not null references locations (id) on delete restrict,
  is_active boolean not null default true,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index stockists_name_per_location on stockists (location_id, lower(name));
create trigger trg_stockists_updated before update on stockists for each row execute function set_updated_at();

create table stockist_entries (
  stockist_id uuid not null references stockists (id) on delete cascade,
  month date not null check (month = date_trunc('month', month)::date),
  sales_value numeric(12,2) not null default 0 check (sales_value >= 0),
  closing_value numeric(12,2) not null default 0 check (closing_value >= 0),
  return_value numeric(12,2) not null default 0 check (return_value >= 0),
  entered_by uuid references profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (stockist_id, month)
);
create trigger trg_stockist_entries_updated before update on stockist_entries for each row execute function set_updated_at();

alter table stockists enable row level security;
alter table stockist_entries enable row level security;
-- a manager works with the stockists of the locations they cover; an admin with all of them
create policy stockists_read on stockists for select to authenticated
  using (is_admin() or exists (select 1 from manager_locations ml where ml.manager_id = auth.uid() and ml.location_id = stockists.location_id));
create policy stockists_add on stockists for insert to authenticated
  with check (is_admin() or (auth_role() = 'manager' and exists (select 1 from manager_locations ml where ml.manager_id = auth.uid() and ml.location_id = stockists.location_id)));
create policy stockists_edit on stockists for update to authenticated
  using (is_admin() or (auth_role() = 'manager' and exists (select 1 from manager_locations ml where ml.manager_id = auth.uid() and ml.location_id = stockists.location_id)))
  with check (is_admin() or (auth_role() = 'manager' and exists (select 1 from manager_locations ml where ml.manager_id = auth.uid() and ml.location_id = stockists.location_id)));
create policy stockists_delete on stockists for delete to authenticated using (is_admin());
create policy stockist_entries_read on stockist_entries for select to authenticated
  using (is_admin() or exists (select 1 from stockists s join manager_locations ml on ml.location_id = s.location_id
                               where s.id = stockist_id and ml.manager_id = auth.uid()));
grant select, insert, update, delete on stockists to authenticated;
grant select on stockist_entries to authenticated;
-- no write policies on entries: every write goes through save_stockist_entry()

-- Manager: stockists of a location they cover, up to the current month; a month that has ended is frozen once the stockist has
-- an entry for it (a stockist with none yet can still be filled in once). Admin: any stockist, any month.
create function save_stockist_entry(p_stockist uuid, p_month date, p_sales numeric, p_closing numeric, p_return numeric)
returns stockist_entries
language plpgsql security definer set search_path = public as $$
declare
  v_role user_role := auth_role();
  v_month date := date_trunc('month', p_month)::date;
  v_now date := date_trunc('month', now() at time zone 'Asia/Kolkata')::date;
  v_loc uuid;
  r stockist_entries;
begin
  if v_role is null or v_role not in ('admin', 'manager') then raise exception 'Not allowed'; end if;
  select location_id into v_loc from stockists where id = p_stockist;
  if not found then raise exception 'Stockist not found'; end if;
  if least(p_sales, p_closing, p_return) < 0 then raise exception 'Enter 0 or more'; end if;
  if v_role = 'manager' and not exists (select 1 from manager_locations where manager_id = auth.uid() and location_id = v_loc) then
    raise exception 'You do not cover this stockist''s location';
  end if;
  if v_month > v_now then raise exception 'Values can only be entered up to the current month'; end if;
  if v_role <> 'admin' and v_month < v_now and exists (select 1 from stockist_entries where stockist_id = p_stockist and month = v_month) then
    raise exception 'This month has ended, so it is locked. Ask an admin to change it.';
  end if;
  insert into stockist_entries (stockist_id, month, sales_value, closing_value, return_value, entered_by)
  values (p_stockist, v_month, coalesce(p_sales, 0), coalesce(p_closing, 0), coalesce(p_return, 0), auth.uid())
  on conflict (stockist_id, month) do update
    set sales_value = excluded.sales_value, closing_value = excluded.closing_value,
        return_value = excluded.return_value, entered_by = excluded.entered_by
  returning * into r;
  return r;
end $$;
revoke execute on function save_stockist_entry(uuid, date, numeric, numeric, numeric) from public, anon;
grant execute on function save_stockist_entry(uuid, date, numeric, numeric, numeric) to authenticated;
