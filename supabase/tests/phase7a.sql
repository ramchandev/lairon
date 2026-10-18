-- Driver app rules (PLAN §6.9). Run after migrations + seed. Rolls back.
begin;
create function pg_temp.expect_error(p_sql text, p_label text) returns void language plpgsql as $$
begin begin execute p_sql; exception when others then return; end; raise exception 'EXPECTED ERROR but succeeded: %', p_label; end $$;
create function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), true); execute 'set local role authenticated'; end $$;
create function pg_temp.assert_eq(a anyelement, b anyelement, l text) returns void language plpgsql as $$
begin if a is distinct from b then raise exception 'ASSERT FAILED %: got %, expected %', l, a, b; end if; end $$;

insert into auth.users (id, email) select x, x::text || '@t' from (values
  ('00000000-0000-0000-0000-0000000000d1'::uuid), ('00000000-0000-0000-0000-0000000000d2'), ('00000000-0000-0000-0000-0000000000b1')) v(x);
insert into profiles (id, role, full_name, phone, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'driver', 'DRIVER A', '+919000000002', 'd1@t'),
  ('00000000-0000-0000-0000-0000000000d2', 'driver', 'DRIVER B', '+919000000003', 'd2@t'),
  ('00000000-0000-0000-0000-0000000000b1', 'staff',  'Staff',    '+919000000004', 's@t');
grant all on all tables in schema public to authenticated;

do $$
declare v uuid; n int;
begin
  select id into v from vehicles where name = 'AMAZE';

  -- driver A closes a duty on AMAZE ending at 1520 km
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
  insert into driver_day_entries (driver_id, entry_date, entry_type, duty_type, vehicle_source, vehicle_id, duty_status, entry_source, start_time, start_km, end_time, end_km)
    values (auth.uid(), current_date, 'duty', 'Local', 'fleet', v, 'closed', 'app', '09:00', 1450, '17:30', 1520);
  reset role;

  -- driver B can learn the last KM for the vehicle, but cannot read A's entries
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000d2');
  perform pg_temp.assert_eq(last_vehicle_km(v), 1520, 'last km visible across drivers');
  perform pg_temp.assert_eq((select count(*)::int from driver_day_entries), 0, 'driver B cannot read A entries');
  reset role;
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
  perform pg_temp.assert_eq(last_vehicle_km(v), null::int, 'staff gets nothing');
  reset role;

  -- open duty -> close it (UPDATE computes km + minutes)
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000d2');
  insert into driver_day_entries (driver_id, entry_date, entry_type, duty_type, vehicle_source, vehicle_id, duty_status, entry_source, start_time, start_km)
    values (auth.uid(), current_date, 'duty', 'Out Station', 'fleet', v, 'open', 'app', '22:00', 1520);
  update driver_day_entries set end_km = 1572, end_time = '07:15', duty_status = 'closed' where driver_id = auth.uid() and duty_status = 'open';
  perform pg_temp.assert_eq((select total_km from driver_day_entries where driver_id = auth.uid()), 52, 'km computed on close');
  perform pg_temp.assert_eq((select total_minutes from driver_day_entries where driver_id = auth.uid()), 555, '9h15m across midnight');
  perform pg_temp.expect_error($q$update driver_day_entries set end_km = 10 where driver_id = auth.uid()$q$, 'end km below start km');

  -- leave range is all-or-nothing: one conflicting day blocks the whole request
  perform pg_temp.expect_error($q$insert into driver_day_entries (driver_id, entry_date, entry_type, leave_type, entry_source) values
      (auth.uid(), current_date + 1, 'leave', 'Casual', 'app'), (auth.uid(), current_date, 'leave', 'Casual', 'app')$q$, 'leave on a duty day blocks the range');
  select count(*) into n from driver_day_entries where entry_type = 'leave';
  perform pg_temp.assert_eq(n, 0, 'no partial leave rows');
  insert into driver_day_entries (driver_id, entry_date, entry_type, leave_type, leave_reason, entry_source) values
      (auth.uid(), current_date + 1, 'leave', 'Casual', 'Family', 'app'), (auth.uid(), current_date + 2, 'leave', 'Casual', 'Family', 'app');
  perform pg_temp.assert_eq((select count(*)::int from driver_day_entries where entry_type = 'leave' and leave_status = 'pending'), 2, 'range creates a row per day, pending');
  -- a driver can cancel (delete) their pending leave
  delete from driver_day_entries where entry_type = 'leave';
  perform pg_temp.assert_eq((select count(*)::int from driver_day_entries where entry_type = 'leave'), 0, 'pending leave cancelled');

  -- edit window: cannot back-date beyond 7 days
  perform pg_temp.expect_error($q$insert into driver_day_entries (driver_id, entry_date, entry_type) values (auth.uid(), current_date - 10, 'week_off')$q$, 'outside the edit window');
  insert into driver_day_entries (driver_id, entry_date, entry_type) values (auth.uid(), current_date - 3, 'week_off');
  reset role;
end $$;
rollback;
\echo PHASE 7A TESTS PASSED
