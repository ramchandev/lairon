-- Managers are LAIRON people (migration 16): doctor phone is mandatory + unique, accountability defaults to the manager,
-- (monthly revenue moved to per-service in migration 17: see phase11). Rolls back.
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
declare d uuid; b uuid;
begin
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

end $$;
rollback;
