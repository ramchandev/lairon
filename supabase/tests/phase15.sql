-- ROI plans (migration 21): conversion plan and core-doctor coverage belong to their manager. Rolls back.
begin;
create function pg_temp.assert_eq(a anyelement, b anyelement, l text) returns void language plpgsql as $$
begin if a is distinct from b then raise exception 'ASSERT FAILED %: got %, expected %', l, a, b; end if; end $$;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','a@t'),('00000000-0000-0000-0000-0000000000c1','m@t'),('00000000-0000-0000-0000-0000000000c2','m2@t');
insert into profiles (id, role, full_name, phone, email) values
  ('00000000-0000-0000-0000-0000000000a1','admin','Admin','+919000000001','a@t'),
  ('00000000-0000-0000-0000-0000000000c1','manager','Mgr One','+919000000003','m@t'),
  ('00000000-0000-0000-0000-0000000000c2','manager','Mgr Two','+919000000004','m2@t');
grant all on all tables in schema public to authenticated;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',true);
set local role authenticated;
do $$
declare cd uuid;
begin
  insert into conversion_plans (manager_id, month, doctor_name, visits) values (auth.uid(), '2026-11-01', 'Dr A', 2);
  update conversion_plans set converted_on = '2026-11-20' where doctor_name = 'Dr A';
  insert into core_doctors (manager_id, doctor_name) values (auth.uid(), 'Dr Core') returning id into cd;
  insert into core_coverage values (cd, '2026-11-01', 'MR', 'Nowfal');
  insert into core_coverage values (cd, '2026-11-01', 'RBM', 'Ram') on conflict do nothing;
  perform pg_temp.assert_eq((select count(*)::int from core_coverage), 2, 'own coverage rows');
  begin
    insert into core_coverage values (cd, '2026-11-01', 'XYZ', 'n');
    raise exception 'ASSERT FAILED: unknown role accepted';
  exception when check_violation then null; end;
  begin
    insert into conversion_plans (manager_id, month, doctor_name) values ('00000000-0000-0000-0000-0000000000c2', '2026-11-01', 'Dr X');
    raise exception 'ASSERT FAILED: wrote for another manager';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c2',true);
set local role authenticated;
select pg_temp.assert_eq((select count(*)::int from conversion_plans) + (select count(*)::int from core_doctors) + (select count(*)::int from core_coverage), 0, 'managers do not see each other''s plans');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',true);
set local role authenticated;
select pg_temp.assert_eq((select count(*)::int from conversion_plans), 1, 'admin sees every plan');
update core_doctors set speciality = 'MS';
select pg_temp.assert_eq((select speciality from core_doctors), 'MS', 'admin can correct a core doctor');
rollback;
