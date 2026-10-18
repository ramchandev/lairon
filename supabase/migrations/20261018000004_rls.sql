-- LAIRON EZ — Phase 1: Row Level Security (PLAN §5.9). RLS is on for EVERY public table.
-- The service role (Edge Functions) bypasses RLS; auth.uid() is null there.

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Admin: full access on every table
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename <> 'ref_counters' loop
    execute format('create policy admin_all on %I for all to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

-- profiles: self + active staff directory (staff, manager, driver can read it)
create policy profiles_self_read on profiles for select to authenticated using (id = auth.uid());
create policy profiles_self_update on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_staff_directory on profiles for select to authenticated
  using (role = 'staff' and is_active and auth_role() in ('staff', 'manager'));

-- masters & dropdowns: any signed-in user reads active rows
create policy vehicles_driver_read on vehicles for select to authenticated using (is_active and auth_role() = 'driver');
create policy divisions_read on divisions for select to authenticated using (is_active);
create policy products_read on products for select to authenticated using (is_active);
create policy product_divisions_read on product_divisions for select to authenticated using (true);
create policy lookup_lists_read on lookup_lists for select to authenticated using (true);
create policy lookup_items_read on lookup_items for select to authenticated using (is_active);
create policy map_read on division_qual_spec_map for select to authenticated using (true);

-- doctors: staff read (starter-pack search); manager CRUD own
create policy doctors_staff_read on doctors for select to authenticated using (auth_role() = 'staff' and is_active);
create policy doctors_manager_select on doctors for select to authenticated using (manager_id = auth.uid());
create policy doctors_manager_insert on doctors for insert to authenticated
  with check (manager_id = auth.uid() and auth_role() = 'manager');
create policy doctors_manager_update on doctors for update to authenticated
  using (manager_id = auth.uid()) with check (manager_id = auth.uid());
create policy doctors_manager_delete on doctors for delete to authenticated using (manager_id = auth.uid());

-- service request batches: manager CRUD own while draft, read own after; staff read where accountable
create policy batches_manager_select on service_request_batches for select to authenticated using (manager_id = auth.uid());
create policy batches_manager_insert on service_request_batches for insert to authenticated
  with check (manager_id = auth.uid() and status = 'draft' and auth_role() = 'manager');
create policy batches_manager_update on service_request_batches for update to authenticated
  using (manager_id = auth.uid() and status = 'draft') with check (manager_id = auth.uid() and status in ('draft', 'submitted'));
create policy batches_manager_delete on service_request_batches for delete to authenticated
  using (manager_id = auth.uid() and status = 'draft');
create policy batches_staff_read on service_request_batches for select to authenticated
  using (accountability_staff_id = auth.uid() and status <> 'draft');

create policy services_manager_select on service_requests for select to authenticated
  using (exists (select 1 from service_request_batches b where b.id = batch_id and b.manager_id = auth.uid()));
create policy services_manager_write on service_requests for all to authenticated
  using (exists (select 1 from service_request_batches b where b.id = batch_id and b.manager_id = auth.uid() and b.status = 'draft'))
  with check (exists (select 1 from service_request_batches b where b.id = batch_id and b.manager_id = auth.uid() and b.status = 'draft'));
create policy services_staff_read on service_requests for select to authenticated
  using (exists (select 1 from service_request_batches b where b.id = batch_id and b.accountability_staff_id = auth.uid() and b.status <> 'draft'));

-- starter packs: staff CRUD own while submitted, read own
create policy sp_staff_select on starter_pack_requests for select to authenticated using (staff_id = auth.uid());
create policy sp_staff_insert on starter_pack_requests for insert to authenticated
  with check (staff_id = auth.uid() and status = 'submitted' and auth_role() = 'staff');
create policy sp_staff_update on starter_pack_requests for update to authenticated
  using (staff_id = auth.uid() and status = 'submitted') with check (staff_id = auth.uid() and status in ('submitted', 'cancelled'));
create policy sp_staff_delete on starter_pack_requests for delete to authenticated
  using (staff_id = auth.uid() and status = 'submitted');

create policy spi_staff_select on starter_pack_items for select to authenticated
  using (exists (select 1 from starter_pack_requests r where r.id = request_id and r.staff_id = auth.uid()));
create policy spi_staff_write on starter_pack_items for all to authenticated
  using (exists (select 1 from starter_pack_requests r where r.id = request_id and r.staff_id = auth.uid() and r.status = 'submitted'))
  with check (exists (select 1 from starter_pack_requests r where r.id = request_id and r.staff_id = auth.uid() and r.status = 'submitted'));

-- driver entries: CRUD own within the edit window
create policy duties_driver_select on driver_day_entries for select to authenticated using (driver_id = auth.uid());
create policy duties_driver_insert on driver_day_entries for insert to authenticated
  with check (driver_id = auth.uid() and auth_role() = 'driver' and entry_source = 'app'
              and entry_date >= current_date - driver_edit_window_days());
create policy duties_driver_update on driver_day_entries for update to authenticated
  using (driver_id = auth.uid() and entry_date >= current_date - driver_edit_window_days())
  with check (driver_id = auth.uid() and entry_source = 'app');
create policy duties_driver_delete on driver_day_entries for delete to authenticated
  using (driver_id = auth.uid() and entry_source = 'app' and entry_date >= current_date - driver_edit_window_days());

-- beta: driver reads own finalised statements
create policy beta_statements_driver on beta_statements for select to authenticated using (driver_id = auth.uid());

-- Lock RPCs to signed-in users (default grants PUBLIC execute)
revoke execute on function import_duties(jsonb), undo_duty_import(uuid), finalise_beta_month(date),
  reopen_beta_month(date, text), next_ref(text) from public, anon;
grant execute on function import_duties(jsonb), undo_duty_import(uuid), finalise_beta_month(date),
  reopen_beta_month(date, text) to authenticated;
revoke execute on function beta_summary(date, uuid), beta_days(date, uuid) from public, anon;
grant execute on function beta_summary(date, uuid), beta_days(date, uuid) to authenticated;
