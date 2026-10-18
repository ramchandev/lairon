-- Doctors access rules (PLAN §5.9 / §6.6). Run after migrations + seed. Rolls back.
begin;
create function pg_temp.expect_error(p_sql text, p_label text) returns void language plpgsql as $$
begin begin execute p_sql; exception when others then return; end; raise exception 'EXPECTED ERROR but succeeded: %', p_label; end $$;
create function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), true); execute 'set local role authenticated'; end $$;
create function pg_temp.assert_eq(a anyelement, b anyelement, l text) returns void language plpgsql as $$
begin if a is distinct from b then raise exception 'ASSERT FAILED %: got %, expected %', l, a, b; end if; end $$;

insert into auth.users (id, email) select x, x::text || '@t' from (values
  ('00000000-0000-0000-0000-0000000000a1'::uuid), ('00000000-0000-0000-0000-0000000000b1'), ('00000000-0000-0000-0000-0000000000c1'), ('00000000-0000-0000-0000-0000000000c2')) v(x);
insert into profiles (id, role, full_name, phone, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin',   'Admin',   '+919000000001', 'a@t'),
  ('00000000-0000-0000-0000-0000000000b1', 'staff',   'Staff',   '+919000000004', 's@t'),
  ('00000000-0000-0000-0000-0000000000c1', 'manager', 'Mgr One', '+919000000005', null),
  ('00000000-0000-0000-0000-0000000000c2', 'manager', 'Mgr Two', '+919000000006', null);
grant all on all tables in schema public to authenticated;

do $$
declare d1 uuid;
begin
  -- manager adds a doctor for themselves
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
  insert into doctors (manager_id, name, speciality) values (auth.uid(), 'Dr One', 'Cardiologist') returning id into d1;
  perform pg_temp.expect_error($q$insert into doctors (manager_id, name) values ('00000000-0000-0000-0000-0000000000c2', 'Sneaky')$q$, 'cannot create for another manager');
  perform pg_temp.expect_error($q$insert into doctors (manager_id, name) values ('00000000-0000-0000-0000-0000000000b1', 'Wrong role')$q$, 'doctor must belong to a manager-role profile');
  perform pg_temp.expect_error($q$update doctors set manager_id = '00000000-0000-0000-0000-0000000000c2'$q$, 'manager cannot hand a doctor to someone else');
  update doctors set hospital_name = 'Apollo' where id = d1;   -- normal edit works
  reset role;

  -- other manager cannot see, edit or delete it
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
  perform pg_temp.assert_eq((select count(*)::int from doctors), 0, 'other manager sees nothing');
  update doctors set name = 'Hacked' where id = d1;
  delete from doctors where id = d1;
  reset role;
  perform pg_temp.assert_eq((select name from doctors where id = d1), 'Dr One', 'other manager could not change or delete');

  -- staff can read (starter-pack search) but not write
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
  perform pg_temp.assert_eq((select count(*)::int from doctors), 1, 'staff can read doctors');
  perform pg_temp.expect_error($q$insert into doctors (manager_id, name) values ('00000000-0000-0000-0000-0000000000c1', 'x')$q$, 'staff cannot create');
  update doctors set name = 'Hacked';
  reset role;
  perform pg_temp.assert_eq((select name from doctors where id = d1), 'Dr One', 'staff could not edit');

  -- admin reassigns
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
  update doctors set manager_id = '00000000-0000-0000-0000-0000000000c2' where id = d1;
  reset role;
  perform pg_temp.assert_eq((select manager_id from doctors where id = d1), '00000000-0000-0000-0000-0000000000c2'::uuid, 'admin reassigned');
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
  perform pg_temp.assert_eq((select count(*)::int from doctors), 0, 'previous manager loses access after reassign');
  reset role;

  -- deleting a manager keeps the doctor (set null) so admin can reassign
  delete from profiles where id = '00000000-0000-0000-0000-0000000000c2';
  perform pg_temp.assert_eq((select manager_id from doctors where id = d1), null::uuid, 'doctor survives manager deletion');
end $$;
rollback;
\echo PHASE 4 TESTS PASSED
