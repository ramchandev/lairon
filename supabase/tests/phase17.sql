-- Appraisal settings (migration 23): admin only. Rolls back.
begin;
create function pg_temp.assert_eq(a anyelement, b anyelement, l text) returns void language plpgsql as $$
begin if a is distinct from b then raise exception 'ASSERT FAILED %: got %, expected %', l, a, b; end if; end $$;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','a@t'),('00000000-0000-0000-0000-0000000000c1','m@t');
insert into profiles (id, role, full_name, phone, email) values
  ('00000000-0000-0000-0000-0000000000a1','admin','Admin','+919000000001','a@t'),
  ('00000000-0000-0000-0000-0000000000c1','manager','Mgr One','+919000000003','m@t');
grant all on all tables in schema public to authenticated;

select pg_temp.assert_eq((select (config -> 'points' ->> 'sales')::int from appraisal_settings), 35, 'seeded defaults');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',true);
set local role authenticated;
select pg_temp.assert_eq((select count(*)::int from appraisal_settings), 0, 'a manager cannot read the appraisal setup');
do $$ begin
  update appraisal_settings set config = '{}';
  if exists (select 1 from appraisal_settings) then raise exception 'ASSERT FAILED: manager changed settings'; end if;
end $$;
reset role;
select pg_temp.assert_eq((select config ->> 'sales_basis' from appraisal_settings), 'primary', 'still unchanged after a manager tried');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',true);
set local role authenticated;
update appraisal_settings set config = jsonb_set(config, '{points,sales}', '40');
select pg_temp.assert_eq((select (config -> 'points' ->> 'sales')::int from appraisal_settings), 40, 'admin can change the setup');
rollback;
