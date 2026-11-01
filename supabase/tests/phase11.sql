-- Monthly revenue per service + handover of requests between managers (migration 17). Rolls back.
begin;
create function pg_temp.assert_eq(a anyelement, b anyelement, l text) returns void language plpgsql as $$
begin if a is distinct from b then raise exception 'ASSERT FAILED %: got %, expected %', l, a, b; end if; end $$;
create function pg_temp.expect_error(p_sql text, p_label text) returns void language plpgsql as $$
begin begin execute p_sql; exception when others then return; end; raise exception 'EXPECTED ERROR but succeeded: %', p_label; end $$;
create function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', u::text, true); end $$;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','a@t'),('00000000-0000-0000-0000-0000000000c1','m1@t'),('00000000-0000-0000-0000-0000000000c2','m2@t'),('00000000-0000-0000-0000-0000000000c3','m3@t');
insert into profiles (id, role, full_name, phone, email) values
  ('00000000-0000-0000-0000-0000000000a1','admin','Admin','+919000000001','a@t'),
  ('00000000-0000-0000-0000-0000000000c1','manager','Ram','+919000000002','m1@t'),
  ('00000000-0000-0000-0000-0000000000c2','manager','Priya','+919000000003','m2@t'),
  ('00000000-0000-0000-0000-0000000000c3','manager','Arun','+919000000004','m3@t');
grant all on all tables in schema public to authenticated;
set local role authenticated;

do $$
declare b uuid; s uuid; d uuid; cur date := date_trunc('month', now() at time zone 'Asia/Kolkata')::date; prev date; r service_revenue; res jsonb;
begin
  prev := (cur - interval '1 month')::date;
  -- Ram creates a doctor, a request with one service (dated last month) and submits it
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
  insert into doctors (manager_id, name, phone) values ('00000000-0000-0000-0000-0000000000c1', 'Dr One', '+919111111101') returning id into d;
  b := get_or_create_draft_batch();
  insert into service_requests (batch_id, request_date, doctor_id, doctor_name, area, hospital_name, hq, division, qualification, speciality,
    service_amount, service_type, expected_business_value, current_business_value, offer_type, offer_percent)
  values (b, prev, d, 'Dr One', 'Adyar', 'Apollo', 'CHN', 'OL', 'MD', 'Cardiologist', 5000, 'Camp', 100000, 50000, 'Offer', 10) returning id into s;
  -- revenue only after the request is submitted
  perform pg_temp.expect_error(format('select set_service_revenue(%L, %L, 1000)', s, cur), 'draft has no revenue yet');
  perform submit_service_batch(b);

  -- month on month: current month editable, before the service started is not, the future is not
  r := set_service_revenue(s, cur, 50000);
  perform pg_temp.assert_eq(r.amount, 50000::numeric, 'current month saved');
  r := set_service_revenue(s, cur + 3, 65000);
  perform pg_temp.assert_eq((select amount from service_revenue where service_id = s and month = cur), 65000::numeric, 'edited while the month is open');
  perform pg_temp.expect_error(format('select set_service_revenue(%L, %L, 1)', s, (cur + interval '1 month')::date), 'no future months');
  perform pg_temp.expect_error(format('select set_service_revenue(%L, %L, 1)', s, (prev - interval '1 month')::date), 'before the service started');
  -- a past month with no entry can be filled once, then it is frozen for the manager
  r := set_service_revenue(s, prev, 40000);
  perform pg_temp.expect_error(format('select set_service_revenue(%L, %L, 41000)', s, prev), 'lapsed month is locked');

  -- another manager cannot enter revenue for Ram's service
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
  perform pg_temp.expect_error(format('select set_service_revenue(%L, %L, 1)', s, cur), 'not their request');
  perform pg_temp.assert_eq((select count(*)::int from revenue_by_doctor(prev, cur)), 0, 'a manager gets no report rows');
  perform pg_temp.assert_eq((select count(*)::int from service_revenue), 0, 'and cannot see it');

  -- admin: can fix the lapsed month; doctor summary adds up the services
  reset role; perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a1'); set local role authenticated;
  r := set_service_revenue(s, prev, 42000);
  perform pg_temp.assert_eq(r.amount, 42000::numeric, 'admin edits a lapsed month');
  perform pg_temp.assert_eq((select amount from doctor_revenue_summary(d) where month = cur), 65000::numeric, 'doctor summary by month');

  -- Ram leaves: his work moves to Priya (one request first, then everything)
  -- (migration 18) the report adds up a doctor's monthly figures; only admins can run it
  perform pg_temp.assert_eq((select sum(amount) from revenue_by_doctor(prev, cur) where doctor_id = d), 42000::numeric + 65000::numeric, 'report totals the months');
  perform pg_temp.assert_eq((select count(*)::int from revenue_by_doctor(cur, cur)), 1, 'period filter');
  perform pg_temp.assert_eq((manager_workload('00000000-0000-0000-0000-0000000000c1') ->> 'requests')::int, 1, 'workload counts requests');
  perform reassign_request(b, '00000000-0000-0000-0000-0000000000c2', 'Ram resigned');
  perform pg_temp.assert_eq((select manager_name from service_request_batches where id = b), 'Priya', 'new manager name');
  perform pg_temp.assert_eq((select accountability_staff_id from service_request_batches where id = b), '00000000-0000-0000-0000-0000000000c2'::uuid, 'accountability follows');
  perform pg_temp.assert_eq((select count(*)::int from request_handovers where batch_id = b), 1, 'history row written');
  perform pg_temp.expect_error(format('select reassign_request(%L, %L)', b, '00000000-0000-0000-0000-0000000000c2'), 'same manager');

  -- Priya now continues the monthly revenue; Ram no longer can
  reset role; perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c2'); set local role authenticated;
  perform pg_temp.assert_eq((select count(*)::int from service_revenue where service_id = s), 2, 'Priya sees the history');
  r := set_service_revenue(s, cur, 70000);
  perform pg_temp.assert_eq(r.entered_by_name, 'Priya', 'entered by the new manager');
  reset role; perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c1'); set local role authenticated;
  perform pg_temp.expect_error(format('select set_service_revenue(%L, %L, 1)', s, cur), 'previous manager can no longer enter');

  -- hand over everything: doctors move too; only an admin may do it
  perform pg_temp.expect_error($q$select transfer_manager_work('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c3')$q$, 'managers cannot transfer');
  reset role; perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a1'); set local role authenticated;
  res := transfer_manager_work('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c3', 'Priya moved teams');
  perform pg_temp.assert_eq((res ->> 'requests')::int, 1, 'one request transferred');
  perform pg_temp.assert_eq((select manager_name from service_request_batches where id = b), 'Arun', 'now Arun');
  perform pg_temp.assert_eq((select count(*)::int from request_handovers where batch_id = b), 2, 'two handovers on record');
  res := transfer_manager_work('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c3');
  perform pg_temp.assert_eq((res ->> 'doctors')::int, 1, 'the doctor moved with the work');
  perform pg_temp.assert_eq((select manager_id from doctors where id = d), '00000000-0000-0000-0000-0000000000c3'::uuid, 'doctor now Arun’s');
end $$;
rollback;
