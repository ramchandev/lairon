-- Managers are LAIRON people (migration 16): doctor phone is mandatory + unique, accountability defaults to the manager,
-- and monthly doctor revenue freezes when the month ends (admin can still change it). Rolls back.
begin;
create function pg_temp.assert_eq(a anyelement, b anyelement, l text) returns void language plpgsql as $$
begin if a is distinct from b then raise exception 'ASSERT FAILED %: got %, expected %', l, a, b; end if; end $$;
create function pg_temp.expect_error(p_sql text, p_label text) returns void language plpgsql as $$
begin begin execute p_sql; exception when others then return; end; raise exception 'EXPECTED ERROR but succeeded: %', p_label; end $$;
create function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', u::text, true); end $$;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','a@t'),('00000000-0000-0000-0000-0000000000c1','m1@t'),('00000000-0000-0000-0000-0000000000c2','m2@t');
insert into profiles (id, role, full_name, phone, email) values
  ('00000000-0000-0000-0000-0000000000a1','admin','Admin','+919000000001','a@t'),
  ('00000000-0000-0000-0000-0000000000c1','manager','Mgr One','+919000000002','m1@t'),
  ('00000000-0000-0000-0000-0000000000c2','manager','Mgr Two','+919000000003','m2@t');
grant all on all tables in schema public to authenticated;
set local role authenticated;

do $$
declare d uuid; cur date := date_trunc('month', now() at time zone 'Asia/Kolkata')::date; prev date; r doctor_revenue; b uuid;
begin
  prev := (cur - interval '1 month')::date;
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
  -- phone is mandatory and unique across managers
  perform pg_temp.expect_error($q$insert into doctors (manager_id, name) values ('00000000-0000-0000-0000-0000000000c1', 'No phone')$q$, 'phone required');
  insert into doctors (manager_id, name, phone) values ('00000000-0000-0000-0000-0000000000c1', 'Dr One', '+919111111101') returning id into d;
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
  perform pg_temp.expect_error($q$insert into doctors (manager_id, name, phone) values ('00000000-0000-0000-0000-0000000000c2', 'Dr Dupe', '+919111111101')$q$, 'duplicate phone');
  -- ...and they can see it, but not change it
  perform pg_temp.assert_eq((select count(*)::int from doctors where id = d), 1, 'another manager sees the doctor');
  update doctors set name = 'Hacked' where id = d;
  perform pg_temp.assert_eq((select name from doctors where id = d), 'Dr One', 'but cannot edit it');

  -- the manager is accountable for their own request without picking anyone
  b := get_or_create_draft_batch();
  perform pg_temp.assert_eq((select accountability_staff_id from service_request_batches where id = b), '00000000-0000-0000-0000-0000000000c2'::uuid, 'accountable = the manager');

  -- revenue: current month editable (twice), previous month locked for a manager
  r := set_doctor_revenue(d, cur, 50000);
  perform pg_temp.assert_eq(r.amount, 50000::numeric, 'revenue saved');
  r := set_doctor_revenue(d, cur + 5, 65000);  -- any day in the month maps to the month
  perform pg_temp.assert_eq((select count(*)::int from doctor_revenue where doctor_id = d), 1, 'one row per doctor and month');
  perform pg_temp.assert_eq((select amount from doctor_revenue where doctor_id = d and month = cur), 65000::numeric, 'edited while the month is open');
  -- a past month with no entry can still be filled in once; after that it is frozen for managers
  r := set_doctor_revenue(d, prev, 1000);
  perform pg_temp.assert_eq(r.amount, 1000::numeric, 'a missing past month can be entered once');
  perform pg_temp.expect_error(format('select set_doctor_revenue(%L, %L, 2000)', d, prev), 'a past month with an entry is locked for a manager');
  perform pg_temp.expect_error(format('select set_doctor_revenue(%L, %L, -5)', d, cur), 'negative amount');
  perform pg_temp.expect_error($q$insert into doctor_revenue (doctor_id, month, amount) values ((select id from doctors limit 1), date_trunc('month', now())::date, 1)$q$, 'no direct writes');

  -- admin can still fix a past month
  reset role; perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a1'); set local role authenticated;
  r := set_doctor_revenue(d, prev, 42000);
  perform pg_temp.assert_eq(r.amount, 42000::numeric, 'admin can set a lapsed month');
  r := set_doctor_revenue(d, prev, 43000);
  perform pg_temp.assert_eq(r.amount, 43000::numeric, 'and edit it');
end $$;
rollback;
