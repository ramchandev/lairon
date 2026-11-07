-- Stockists (migration 22): who can add them, see them and enter their values. Rolls back.
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
grant all on all tables in schema public to authenticated;
insert into manager_locations select '00000000-0000-0000-0000-0000000000c1', id from locations where code = 'MDU';
insert into manager_locations select '00000000-0000-0000-0000-0000000000c2', id from locations where code = 'NGL';

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',true);
set local role authenticated;
do $$
declare mdu uuid := (select id from locations where code = 'MDU'); ngl uuid := (select id from locations where code = 'NGL');
  cur date := date_trunc('month', now() at time zone 'Asia/Kolkata')::date; s uuid;
begin
  insert into stockists (name, location_id, created_by) values ('Vaccine Park', mdu, auth.uid()) returning id into s;
  perform pg_temp.assert_err(format('insert into stockists (name, location_id) values (''X'', %L)', ngl), 'row-level security', 'cannot add a stockist to a location they do not cover');
  perform pg_temp.assert_err(format('insert into stockists (name, location_id) values (''vaccine park'', %L)', mdu), 'duplicate key', 'one name per location, ignoring case');
  perform save_stockist_entry(s, cur, 5.25, 4.11, 0);
  perform save_stockist_entry(s, cur, 5.5, 4.0, 0.5);
  perform pg_temp.assert_eq((select sales_value from stockist_entries where stockist_id = s and month = cur), 5.5::numeric, 'current month can be updated');
  perform pg_temp.assert_err(format('select save_stockist_entry(%L, %L, 1, 1, 1)', s, (cur + interval '1 month')::date), 'current month', 'no future months');
  perform pg_temp.assert_err(format('select save_stockist_entry(%L, %L, -1, 1, 1)', s, cur), 'Enter 0 or more', 'no negatives');
  perform save_stockist_entry(s, (cur - interval '1 month')::date, 3, 2, 0);
  perform pg_temp.assert_err(format('select save_stockist_entry(%L, %L, 1, 1, 1)', s, (cur - interval '1 month')::date), 'locked', 'an ended month is locked once it has values');
  perform pg_temp.assert_err('insert into stockist_entries (stockist_id, month) select id, date_trunc(''month'', now())::date from stockists', 'row-level security', 'no direct writes');
end $$;
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c2',true);
set local role authenticated;
do $$
declare s uuid := (select id from stockists limit 1);
begin
  perform pg_temp.assert_eq((select count(*)::int from stockists), 0, 'a manager does not see other locations'' stockists');
  perform pg_temp.assert_eq((select count(*)::int from stockist_entries), 0, 'nor their values');
end $$;
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',true);
set local role authenticated;
do $$
declare s uuid := (select id from stockists limit 1); prev date := (date_trunc('month', now() at time zone 'Asia/Kolkata') - interval '1 month')::date;
begin
  perform pg_temp.assert_eq((select count(*)::int from stockists), 1, 'admin sees all stockists');
  perform save_stockist_entry(s, prev, 9, 9, 9);
  perform pg_temp.assert_eq((select sales_value from stockist_entries where stockist_id = s and month = prev), 9::numeric, 'admin can change a locked month');
end $$;
rollback;
