-- Performance foundation (migration 19): locations, manager coverage, sales entry rules. Rolls back.
begin;
create function pg_temp.assert_eq(a anyelement, b anyelement, l text) returns void language plpgsql as $$
begin if a is distinct from b then raise exception 'ASSERT FAILED %: got %, expected %', l, a, b; end if; end $$;
create function pg_temp.assert_err(q text, frag text, l text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then
    if sqlerrm like '%' || frag || '%' then return; end if;
    raise exception 'ASSERT FAILED %: wrong error "%"', l, sqlerrm;
  end;
  raise exception 'ASSERT FAILED %: expected an error', l;
end $$;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','a@t'),('00000000-0000-0000-0000-0000000000c1','m@t'),('00000000-0000-0000-0000-0000000000c2','m2@t');
insert into profiles (id, role, full_name, phone, email) values
  ('00000000-0000-0000-0000-0000000000a1','admin','Admin','+919000000001','a@t'),
  ('00000000-0000-0000-0000-0000000000c1','manager','Mgr One','+919000000003','m@t'),
  ('00000000-0000-0000-0000-0000000000c2','manager','Mgr Two','+919000000004','m2@t');
insert into products (id, name, tag, pts, kdp_group) values ('00000000-0000-0000-0000-00000000f001','Test Core Product','core',115.45,'LAIROBON');
grant all on all tables in schema public to authenticated;

select pg_temp.assert_eq((select count(*)::int from locations), 3, 'three seeded locations');

-- admin assigns Madurai to manager one
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',true);
set local role authenticated;
insert into manager_locations select '00000000-0000-0000-0000-0000000000c1', id from locations where code = 'MDU';
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',true);
set local role authenticated;
do $$
declare mdu uuid := (select id from locations where code = 'MDU'); ngl uuid := (select id from locations where code = 'NGL');
  p uuid := '00000000-0000-0000-0000-00000000f001'; cur date := date_trunc('month', now() at time zone 'Asia/Kolkata')::date;
begin
  perform pg_temp.assert_eq((select count(*)::int from manager_locations), 1, 'manager sees only own locations');
  perform save_sales_entry(null, mdu, p, cur, 1700, 1700, 1500, 2352, 0);
  perform save_sales_entry(null, mdu, p, cur, 1700, 1700, 1600, 2400, 5);
  perform pg_temp.assert_eq((select primary_ach from sales_entries where month = cur), 1600::numeric, 'current month can be updated as it goes');
  perform pg_temp.assert_eq((select count(*)::int from sales_entries), 1, 'one row per product, location and month');
  perform pg_temp.assert_err(format('select save_sales_entry(null, %L, %L, %L, 1,1,1,1,0)', ngl, p, cur), 'does not cover', 'a location the manager does not cover');
  perform pg_temp.assert_err(format('select save_sales_entry(null, %L, %L, %L, 1,1,1,1,0)', mdu, p, cur + interval '1 month'), 'up to the current month', 'no future months');
  perform pg_temp.assert_err(format('select save_sales_entry(null, %L, %L, %L, -1,1,1,1,0)', mdu, p, cur), 'Enter 0 or more', 'no negatives');
  -- a past month with no entry can be filled once, then it is locked
  perform save_sales_entry(null, mdu, p, (cur - interval '1 month')::date, 1000, 1000, 900, 800, 0);
  perform pg_temp.assert_err(format('select save_sales_entry(null, %L, %L, %L, 1,1,1,1,0)', mdu, p, (cur - interval '1 month')::date), 'locked', 'an ended month is locked once it has an entry');
  perform pg_temp.assert_err('insert into sales_entries (manager_id, location_id, product_id, month) select auth.uid(), id, ''00000000-0000-0000-0000-00000000f001'', date_trunc(''month'', now())::date from locations limit 1', 'row-level security', 'no direct writes');
end $$;
reset role;

-- another manager sees none of it
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c2',true);
set local role authenticated;
select pg_temp.assert_eq((select count(*)::int from sales_entries), 0, 'managers cannot see each other''s entries');
reset role;

-- admin: any month, on behalf of a manager
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',true);
set local role authenticated;
do $$
declare mdu uuid := (select id from locations where code = 'MDU'); p uuid := '00000000-0000-0000-0000-00000000f001';
  prev date := (date_trunc('month', now() at time zone 'Asia/Kolkata') - interval '1 month')::date;
begin
  perform save_sales_entry('00000000-0000-0000-0000-0000000000c1', mdu, p, prev, 1000, 1000, 950, 850, 0);
  perform pg_temp.assert_eq((select primary_ach from sales_entries where month = prev), 950::numeric, 'admin can change a locked month');
  perform pg_temp.assert_err(format('select save_sales_entry(null, %L, %L, %L, 1,1,1,1,0)', mdu, p, prev), 'Choose a manager', 'admin must name the manager');
end $$;
rollback;
