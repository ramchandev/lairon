-- LAIRON EZ Phase 1 tests. Run AFTER migrations + seed:  psql -v ON_ERROR_STOP=1 -f supabase/tests/phase1.sql
-- Everything runs in one transaction and is rolled back, so it leaves no data behind.
begin;

create function pg_temp.expect_error(p_sql text, p_label text) returns void language plpgsql as $$
begin
  begin execute p_sql; exception when others then return; end;
  raise exception 'EXPECTED ERROR but succeeded: %', p_label;
end $$;
create function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.assert_eq(a anyelement, b anyelement, p_label text) returns void language plpgsql as $$
begin
  if a is distinct from b then raise exception 'ASSERT FAILED %: got %, expected %', p_label, a, b; end if;
end $$;

-- fixtures (as superuser)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@t'), ('00000000-0000-0000-0000-0000000000d1', 'd1@t'),
  ('00000000-0000-0000-0000-0000000000d2', 'd2@t'), ('00000000-0000-0000-0000-0000000000b1', 's1@t'),
  ('00000000-0000-0000-0000-0000000000c1', 'm1@t'), ('00000000-0000-0000-0000-0000000000c2', 'm2@t');
insert into profiles (id, role, full_name, phone, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin',   'Admin',  '+919000000001', 'admin@t'),
  ('00000000-0000-0000-0000-0000000000d1', 'driver',  'DRIVER A', '+919000000002', 'd1@t'),
  ('00000000-0000-0000-0000-0000000000d2', 'driver',  'DRIVER B', '+919000000003', 'd2@t'),
  ('00000000-0000-0000-0000-0000000000b1', 'staff',   'Staff One','+919000000004', 's1@t'),
  ('00000000-0000-0000-0000-0000000000c1', 'manager', 'Mgr One', '+919000000005', null),
  ('00000000-0000-0000-0000-0000000000c2', 'manager', 'Mgr Two', '+919000000006', null);
grant all on all tables in schema public to authenticated;
grant usage on schema storage to authenticated;

-- ═════════ Chauffeur beta rules (PLAN §6.11) ═════════
insert into beta_rates (effective_from, local_rate, outstation_rate) values ('2026-10-15', 300, 350);
insert into driver_day_entries (driver_id, entry_date, entry_type, duty_type, vehicle_source, duty_status, entry_source) values
  ('00000000-0000-0000-0000-0000000000d1', '2026-10-01', 'duty', 'Local', 'own', 'closed', 'import'),
  ('00000000-0000-0000-0000-0000000000d1', '2026-10-01', 'duty', 'Local', 'own', 'closed', 'import'),      -- 2 duties, 1 day
  ('00000000-0000-0000-0000-0000000000d1', '2026-10-02', 'duty', 'Local', 'own', 'closed', 'import'),
  ('00000000-0000-0000-0000-0000000000d1', '2026-10-02', 'duty', 'Out Station', 'own', 'closed', 'import'), -- outstation wins
  ('00000000-0000-0000-0000-0000000000d1', '2026-10-03', 'duty', 'Local', 'own', 'open', 'import'),        -- open pays nothing
  ('00000000-0000-0000-0000-0000000000d1', '2026-10-20', 'duty', 'Local', 'own', 'closed', 'import'),      -- new rate 300
  ('00000000-0000-0000-0000-0000000000d1', '2026-10-21', 'duty', 'Out Station', 'own', 'closed', 'import');-- new rate 350
insert into driver_day_entries (driver_id, entry_date, entry_type) values ('00000000-0000-0000-0000-0000000000d1', '2026-10-04', 'week_off');

do $$
declare r record;
begin
  select * into r from beta_summary('2026-10-01', '00000000-0000-0000-0000-0000000000d1');
  perform pg_temp.assert_eq(r.local_days, 2, 'local days');
  perform pg_temp.assert_eq(r.outstation_days, 2, 'outstation days (outstation wins)');
  perform pg_temp.assert_eq(r.payable_days, 4, 'payable days (2 duties same day = 1)');
  perform pg_temp.assert_eq(r.local_amount, 550::numeric, 'local amount 250 + 300 (mid-month rate change)');
  perform pg_temp.assert_eq(r.outstation_amount, 650::numeric, 'outstation amount 300 + 350');
  perform pg_temp.assert_eq(r.total_amount, 1200::numeric, 'total beta');
  -- zero-duty driver still listed
  select * into r from beta_summary('2026-10-01', '00000000-0000-0000-0000-0000000000d2');
  perform pg_temp.assert_eq(r.payable_days, 0, 'zero-duty driver listed');
  perform pg_temp.assert_eq((select count(*)::int from beta_summary('2026-10-01')), 2, 'all active drivers listed');
  -- day-wise
  perform pg_temp.assert_eq((select duties_logged from beta_days('2026-10-01', '00000000-0000-0000-0000-0000000000d1') where entry_date = '2026-10-01'), 2, 'day-wise duties logged');
  -- rate cannot start inside a finalised month, and finalised months are frozen
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
  perform finalise_beta_month('2026-10-01');
  reset role;
  insert into driver_day_entries (driver_id, entry_date, entry_type, duty_type, vehicle_source, duty_status, entry_source)
    values ('00000000-0000-0000-0000-0000000000d1', '2026-10-25', 'duty', 'Local', 'own', 'closed', 'import');
  select * into r from beta_summary('2026-10-01', '00000000-0000-0000-0000-0000000000d1');
  perform pg_temp.assert_eq(r.total_amount, 1200::numeric, 'finalised month ignores later edits');
  perform pg_temp.expect_error($q$insert into beta_rates (effective_from, local_rate, outstation_rate) values ('2026-10-28', 1, 1)$q$, 'rate in finalised month');
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
  perform pg_temp.expect_error($q$select reopen_beta_month('2026-10-01', '')$q$, 'reopen needs reason');
  perform reopen_beta_month('2026-10-01', 'test');
  reset role;
  select * into r from beta_summary('2026-10-01', '00000000-0000-0000-0000-0000000000d1');
  perform pg_temp.assert_eq(r.total_amount, 1500::numeric, 'reopened month recalculates (extra day at 300)');
end $$;

-- ═════════ Duty rules ═════════
do $$
declare v uuid;
begin
  perform pg_temp.expect_error($q$insert into driver_day_entries (driver_id, entry_date, entry_type, duty_type, vehicle_source, duty_status, entry_source, start_time)
    values ('00000000-0000-0000-0000-0000000000d1', '2026-10-04', 'duty', 'Local', 'own', 'open', 'app', '09:00')$q$, 'duty on a week-off date');
  perform pg_temp.expect_error($q$insert into driver_day_entries (driver_id, entry_date, entry_type) values ('00000000-0000-0000-0000-0000000000d1', '2026-10-01', 'week_off')$q$, 'week off on a duty date');
  select id into v from vehicles where name = 'AMAZE';
  perform pg_temp.expect_error(format($q$insert into driver_day_entries (driver_id, entry_date, entry_type, duty_type, vehicle_source, vehicle_id, duty_status, entry_source, start_time)
    values ('00000000-0000-0000-0000-0000000000d2', '2026-10-10', 'duty', 'Local', 'fleet', %L, 'open', 'app', '09:00')$q$, v), 'fleet duty needs start KM');
  insert into driver_day_entries (driver_id, entry_date, entry_type, duty_type, vehicle_source, vehicle_id, duty_status, entry_source, start_time, start_km, end_time, end_km)
    values ('00000000-0000-0000-0000-0000000000d2', '2026-10-10', 'duty', 'Local', 'fleet', v, 'closed', 'app', '22:00', 100, '01:30', 152);
  perform pg_temp.assert_eq((select total_km from driver_day_entries where driver_id = '00000000-0000-0000-0000-0000000000d2' and entry_date = '2026-10-10'), 52, 'total km');
  perform pg_temp.assert_eq((select total_minutes from driver_day_entries where driver_id = '00000000-0000-0000-0000-0000000000d2' and entry_date = '2026-10-10'), 210, 'minutes across midnight');
  perform pg_temp.assert_eq((select vehicle_label from driver_day_entries where driver_id = '00000000-0000-0000-0000-0000000000d2' and entry_date = '2026-10-10'), 'AMAZE 6960', 'vehicle snapshot label');
  -- own vehicle: no KM needed
  insert into driver_day_entries (driver_id, entry_date, entry_type, duty_type, vehicle_source, duty_status, entry_source, start_time)
    values ('00000000-0000-0000-0000-0000000000d2', '2026-10-11', 'duty', 'Local', 'own', 'open', 'app', '09:00');
end $$;

-- ═════════ Snapshot rule: editing a dropdown never changes history ═════════
do $$
begin
  insert into service_request_batches (manager_id, status) values ('00000000-0000-0000-0000-0000000000c1', 'draft');
  insert into service_requests (batch_id, doctor_name, area, hospital_name, hq, division, qualification, speciality, service_amount,
    service_type, expected_business_value, current_business_value, offer_type, offer_percent)
    select id, 'Dr X', 'A', 'H', 'CHN', 'OL', 'MD', 'Cardiologist', 100, 'Camp', 1, 1, 'Offer', 5 from service_request_batches limit 1;
  update lookup_items set value = 'Cardiologist (renamed)' where list_key = 'speciality' and value = 'Cardiologist';
  delete from lookup_items where list_key = 'speciality' and value = 'Cardiologist (renamed)';
  perform pg_temp.assert_eq((select speciality from service_requests limit 1), 'Cardiologist', 'history keeps text after dropdown edit/delete');
  perform pg_temp.expect_error($q$insert into service_requests (batch_id, doctor_name, area, hospital_name, hq, division, qualification, speciality,
    service_amount, service_type, expected_business_value, current_business_value, offer_type)
    select id, 'Dr Y', 'A', 'H', 'CHN', 'OL', 'MD', 'X', 1, 'Camp', 1, 1, 'Offer' from service_request_batches limit 1$q$, 'Offer needs percent');
  delete from service_request_batches;
end $$;

-- ═════════ RLS per role ═════════
do $$
declare n int;
begin
  -- driver: only own entries
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000d2');
  select count(*) into n from driver_day_entries; perform pg_temp.assert_eq(n > 0 and n = (select count(*) from driver_day_entries where driver_id = auth.uid()), true, 'driver sees only own entries');
  perform pg_temp.assert_eq((select count(*)::int from doctors), 0, 'driver cannot read doctors');
  perform pg_temp.expect_error($q$update profiles set role = 'admin' where id = auth.uid()$q$, 'driver cannot change own role');
  perform pg_temp.expect_error($q$update profiles set phone = '+919111111111' where id = auth.uid()$q$, 'driver cannot change own phone');
  perform pg_temp.expect_error($q$insert into beta_rates (effective_from, local_rate, outstation_rate) values ('2027-01-01', 1, 1)$q$, 'driver cannot write rates');
  perform pg_temp.assert_eq((select count(*)::int from beta_summary('2026-10-01')), 1, 'driver sees only own beta');
  -- driver leave goes in as pending even if they try approved
  insert into driver_day_entries (driver_id, entry_date, entry_type, leave_type, leave_status, entry_source)
    values (auth.uid(), current_date, 'leave', 'Casual', 'approved', 'app');
  perform pg_temp.assert_eq((select leave_status from driver_day_entries where entry_type = 'leave' and driver_id = auth.uid() limit 1), 'pending', 'leave forced to pending');
  perform pg_temp.expect_error($q$update driver_day_entries set leave_status = 'approved' where entry_type = 'leave'$q$, 'driver cannot approve own leave');
  perform pg_temp.expect_error($q$insert into driver_day_entries (driver_id, entry_date, entry_type, leave_type, entry_source)
    values (auth.uid(), current_date - 30, 'leave', 'Casual', 'app')$q$, 'outside edit window');
  reset role;

  -- manager: only own doctors; cannot approve own batch
  insert into doctors (manager_id, name) values ('00000000-0000-0000-0000-0000000000c1', 'Dr One'), ('00000000-0000-0000-0000-0000000000c2', 'Dr Two');
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
  perform pg_temp.assert_eq((select count(*)::int from doctors), 1, 'manager sees only own doctors');
  perform pg_temp.expect_error($q$insert into doctors (manager_id, name) values ('00000000-0000-0000-0000-0000000000c2', 'Sneaky')$q$, 'manager cannot add doctor for another manager');
  insert into service_request_batches (manager_id, accountability_staff_id) values (auth.uid(), '00000000-0000-0000-0000-0000000000b1');
  perform pg_temp.assert_eq((select count(*)::int from profiles where role = 'staff'), 1, 'manager reads staff directory');
  perform pg_temp.assert_eq((select count(*)::int from profiles), 2, 'manager sees self + staff only');
  perform pg_temp.expect_error($q$update service_request_batches set status = 'approved'$q$, 'manager cannot approve');
  perform pg_temp.expect_error($q$select submit_service_batch(id) from service_request_batches$q$, 'cannot submit empty batch');
  reset role;
  delete from service_request_batches;

  -- staff: starter pack needs >=1 item, gets a ref no, cannot fulfil
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
  perform pg_temp.expect_error($q$select create_starter_pack('{"doctor_name":"D","qualification":"MD","doctor_area":"A","staff_name":"S","staff_area":"A","division":"OL","items":[]}'::jsonb)$q$, 'no items');
  perform create_starter_pack('{"doctor_name":"D","qualification":"MD","doctor_area":"A","staff_name":"S","staff_area":"A","division":"OL","items":[{"product_name":"Lairobon","quantity":"1 box"}]}'::jsonb);
  perform pg_temp.assert_eq((select ref_no like 'SP-____-0001' from starter_pack_requests), true, 'starter pack ref no');
  perform pg_temp.expect_error($q$update starter_pack_requests set status = 'fulfilled'$q$, 'staff cannot fulfil');
  perform pg_temp.assert_eq((select count(*)::int from vehicles), 0, 'staff cannot read vehicles');
  reset role;
end $$;

-- ═════════ Import (PLAN §6.12) ═════════
do $$
declare res jsonb;
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
  res := import_duties('{"file_name":"t.xlsx","driver_id":"00000000-0000-0000-0000-0000000000d2","month":"2026-09-01","mode":"replace","rows":[
    {"entry_date":"2026-09-01","vehicle":"AMAZE 6960","guest_name":"Dr A","total_km":93,"total_minutes":570},
    {"entry_date":"2026-09-02","vehicle":"Own","guest_name":"Dr R"},
    {"entry_date":"2026-09-02","vehicle":"AMAZE 6960","guest_name":"Dr J"},
    {"entry_date":"2026-09-03","vehicle":"Audi","guest_name":"Dr K"},
    {"entry_date":"2026-09-06","entry_type":"week_off"}]}'::jsonb);
  perform pg_temp.assert_eq((res ->> 'duties')::int, 4, 'import duties');
  perform pg_temp.assert_eq((res ->> 'week_offs')::int, 1, 'import week offs');
  perform pg_temp.assert_eq((select count(distinct entry_date)::int from beta_days('2026-09-01', '00000000-0000-0000-0000-0000000000d2')), 3, 'payable days');
  perform pg_temp.assert_eq((select vehicle_label from driver_day_entries where entry_date = '2026-09-03' and driver_id = '00000000-0000-0000-0000-0000000000d2'), 'Others · Audi', 'other vehicle label');
  perform pg_temp.assert_eq((select vehicle_source from driver_day_entries where entry_date = '2026-09-01' and driver_id = '00000000-0000-0000-0000-0000000000d2'), 'fleet', 'fleet vehicle linked');
  perform pg_temp.expect_error($q$select import_duties('{"driver_id":"00000000-0000-0000-0000-0000000000d2","month":"2026-09-01","mode":"fill","rows":[
    {"entry_date":"2026-09-09"},{"entry_date":"2026-09-09","entry_type":"week_off"}]}'::jsonb)$q$, 'duty + week off same date blocks the import');
  perform pg_temp.assert_eq(undo_duty_import((res ->> 'batch_id')::uuid), 5, 'undo removes only the batch');
  reset role;
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
  perform pg_temp.expect_error($q$select import_duties('{"driver_id":"00000000-0000-0000-0000-0000000000d1","month":"2026-09-01","rows":[]}'::jsonb)$q$, 'driver cannot import');
  reset role;
end $$;

-- ═════════ Every public table has RLS on ═════════
do $$
begin
  perform pg_temp.assert_eq((select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity), 0, 'RLS enabled on every table');
end $$;

rollback;
\echo ALL PHASE 1 TESTS PASSED
