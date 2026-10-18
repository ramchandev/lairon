-- Admin dashboard KPIs (PLAN §6.10). Run after migrations + seed. Rolls back.
begin;
create function pg_temp.assert_eq(a anyelement, b anyelement, l text) returns void language plpgsql as $$
begin if a is distinct from b then raise exception 'ASSERT FAILED %: got %, expected %', l, a, b; end if; end $$;
create function pg_temp.expect_error(p_sql text, p_label text) returns void language plpgsql as $$
begin begin execute p_sql; exception when others then return; end; raise exception 'EXPECTED ERROR but succeeded: %', p_label; end $$;
create function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), true); execute 'set local role authenticated'; end $$;

insert into auth.users (id, email) select x, x::text || '@t' from (values
  ('00000000-0000-0000-0000-0000000000a1'::uuid), ('00000000-0000-0000-0000-0000000000b1'), ('00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-0000000000d1'), ('00000000-0000-0000-0000-0000000000d2')) v(x);
insert into profiles (id, role, full_name, phone, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin', 'Admin', '+919000000001', 'a@t'),
  ('00000000-0000-0000-0000-0000000000b1', 'staff', 'Staff', '+919000000004', 's@t'),
  ('00000000-0000-0000-0000-0000000000c1', 'manager', 'Mgr', '+919000000005', null),
  ('00000000-0000-0000-0000-0000000000d1', 'driver', 'DRV ONE', '+919000000002', 'd1@t'),
  ('00000000-0000-0000-0000-0000000000d2', 'driver', 'DRV TWO', '+919000000003', 'd2@t');
grant all on all tables in schema public to authenticated;

do $$
declare
  today date := (now() at time zone 'Asia/Kolkata')::date;
  m date := date_trunc('month', (now() at time zone 'Asia/Kolkata')::date)::date;
  b uuid; k jsonb;
begin
  -- service requests: 1 submitted, 1 draft, 1 approved
  insert into service_request_batches (manager_id, accountability_staff_id, status) values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'draft') returning id into b;
  insert into service_requests (batch_id, doctor_name, area, hospital_name, hq, division, qualification, speciality, service_amount, service_type, expected_business_value, current_business_value, offer_type, offer_percent)
    values (b, 'Dr', 'A', 'H', 'CHN', 'OL', 'MD', 'X', 100, 'Camp', 1, 1, 'Offer', 5);
  update service_request_batches set status = 'submitted' where id = b;
  insert into service_request_batches (manager_id, status) values ('00000000-0000-0000-0000-0000000000c1', 'draft');
  -- starter packs: submitted, processing, fulfilled
  insert into starter_pack_requests (doctor_name, qualification, doctor_area, staff_id, staff_name, staff_area, division, status) values
    ('Dr1', 'MD', 'A', '00000000-0000-0000-0000-0000000000b1', 'S', 'A', 'OL', 'submitted'),
    ('Dr2', 'MD', 'A', '00000000-0000-0000-0000-0000000000b1', 'S', 'A', 'OL', 'processing'),
    ('Dr3', 'MD', 'A', '00000000-0000-0000-0000-0000000000b1', 'S', 'A', 'OL', 'fulfilled');
  -- duties this month: d1 has a CLOSED duty today (93 km, ₹1,000 fuel) and an OPEN duty today; d2 has a closed duty today (Out Station)
  insert into driver_day_entries (driver_id, entry_date, entry_type, duty_type, vehicle_source, duty_status, entry_source, start_time, end_time, total_km, fuel_amount, fuel_litres) values
    ('00000000-0000-0000-0000-0000000000d1', today, 'duty', 'Local', 'own', 'closed', 'import', '09:00', '12:00', 93, 1000, 10),
    ('00000000-0000-0000-0000-0000000000d2', today, 'duty', 'Out Station', 'own', 'closed', 'import', '09:00', '19:00', 200, 2500.50, 25.5);
  insert into driver_day_entries (driver_id, entry_date, entry_type, duty_type, vehicle_source, duty_status, entry_source, start_time) values
    ('00000000-0000-0000-0000-0000000000d1', today, 'duty', 'Local', 'own', 'open', 'import', '14:00');
  -- leave: d1 asks for 3 consecutive days (ONE request) and, separately, 1 day with another reason (a 2nd request); one approved day doesn't count
  insert into driver_day_entries (driver_id, entry_date, entry_type, leave_type, leave_reason, leave_status, entry_source) values
    ('00000000-0000-0000-0000-0000000000d1', today + 10, 'leave', 'Casual', 'Family', 'pending', 'app'),
    ('00000000-0000-0000-0000-0000000000d1', today + 11, 'leave', 'Casual', 'Family', 'pending', 'app'),
    ('00000000-0000-0000-0000-0000000000d1', today + 12, 'leave', 'Casual', 'Family', 'pending', 'app'),
    ('00000000-0000-0000-0000-0000000000d1', today + 20, 'leave', 'Sick', 'Fever', 'pending', 'app'),
    ('00000000-0000-0000-0000-0000000000d2', today + 30, 'leave', 'Casual', 'Trip', 'approved', 'app');

  perform pg_temp.expect_error('select admin_dashboard()', 'superuser has no admin profile -> blocked');
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
  perform pg_temp.expect_error('select admin_dashboard()', 'staff cannot read the dashboard');
  reset role;
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
  k := admin_dashboard();
  perform pg_temp.assert_eq((k ->> 'pending_service_requests')::int, 1, 'pending service requests (draft excluded)');
  perform pg_temp.assert_eq((k ->> 'pending_starter_packs')::int, 2, 'pending starter packs = submitted + processing');
  perform pg_temp.assert_eq((k ->> 'drivers_on_duty_now')::int, 1, 'one driver has an open duty');
  perform pg_temp.assert_eq((k ->> 'drivers_with_duty_today')::int, 2, 'two drivers had duties today');
  perform pg_temp.assert_eq((k ->> 'pending_leave_requests')::int, 2, '3 consecutive days = 1 request, +1 other request');
  perform pg_temp.assert_eq((k ->> 'pending_leave_days')::int, 4, 'four pending days');
  perform pg_temp.assert_eq((k ->> 'total_km')::int, 293, 'total km this month');
  perform pg_temp.assert_eq((k ->> 'fuel_amount')::numeric, 3500.50, 'fuel spend this month');
  perform pg_temp.assert_eq((k ->> 'fuel_litres')::numeric, 35.5, 'fuel litres this month');
  -- beta this month = same function as the Trip Duty screen: closed duties only. d1 Local (250) + d2 Outstation (300); the open duty adds nothing
  perform pg_temp.assert_eq((k ->> 'beta_total')::numeric, 550::numeric, 'beta this month from beta_summary');
  perform pg_temp.assert_eq((k ->> 'beta_payable_days')::int, 2, 'payable days');
  perform pg_temp.assert_eq(k ->> 'month', to_char(m, 'YYYY-MM'), 'month label');
  -- content blocks used by the prototype-style dashboard
  perform pg_temp.assert_eq(jsonb_array_length(k -> 'sr_value_by_month'), 6, 'six months of request value');
  perform pg_temp.assert_eq(k -> 'sr_value_by_month' -> 5 ->> 'm', to_char(m, 'YYYY-MM'), 'chart ends on the current month');
  perform pg_temp.assert_eq((k ->> 'drivers_total')::int >= 2, true, 'active drivers counted');
  perform pg_temp.assert_eq((k ->> 'attention_total')::int, 5, '1 request + 2 packs + 2 leave requests need attention');
  perform pg_temp.assert_eq(jsonb_array_length(k -> 'attention'), 5, 'attention list rows');
  perform pg_temp.assert_eq(jsonb_array_length(k -> 'drivers_today') >= 2, true, 'drivers today list');
  -- another month is empty
  perform pg_temp.assert_eq((admin_dashboard((m - interval '2 month')::date) ->> 'total_km')::int, 0, 'other month has no km');
  reset role;
end $$;
rollback;
\echo PHASE 9 TESTS PASSED
