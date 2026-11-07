-- Sale report, release A (migration 24): admin only; replace keeps history; one live upload per stockist/division/month. Rolls back.
begin;
create function pg_temp.assert_eq(a anyelement, b anyelement, l text) returns void language plpgsql as $$
begin if a is distinct from b then raise exception 'ASSERT FAILED %: got %, expected %', l, a, b; end if; end $$;
create function pg_temp.assert_err(q text, l text) returns void language plpgsql as $$
begin begin execute q; exception when others then return; end; raise exception 'ASSERT FAILED %: expected an error', l; end $$;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','a@t'),('00000000-0000-0000-0000-0000000000c1','m@t');
insert into profiles (id, role, full_name, phone, email) values
  ('00000000-0000-0000-0000-0000000000a1','admin','Admin','+919000000001','a@t'),
  ('00000000-0000-0000-0000-0000000000c1','manager','Mgr One','+919000000003','m@t');
grant all on all tables in schema public to authenticated;
insert into products (id, name) values ('00000000-0000-0000-0000-00000000f001', 'Elvion XT');
insert into stockists (id, name, location_id) select '00000000-0000-0000-0000-00000000e001', 'Akash Agencies', id from locations limit 1;
insert into divisions (id, name) values ('00000000-0000-0000-0000-00000000d001', 'Oral');

select pg_temp.assert_eq((select count(*)::int from import_fields where role = 'core'), 6, 'six core headings seeded');
select pg_temp.assert_eq((select cover_months from sale_report_settings), 1.5, 'cover months default');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',true);
set local role authenticated;
select pg_temp.assert_eq((select count(*)::int from import_fields), 0, 'a manager sees no import fields');
select pg_temp.assert_err($$select commit_stockist_upload('00000000-0000-0000-0000-00000000e001', null, '2026-05-01', 'f.xlsx', 'h', null, null, '{}', '[{"raw_name":"x"}]', false)$$, 'a manager cannot upload');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',true);
set local role authenticated;
select commit_stockist_upload('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000d001', '2026-05-17', 'a.xlsx', 'h1', '2026-05-01', '2026-05-31', '{}',
  '[{"product_id":"00000000-0000-0000-0000-00000000f001","raw_name":"ELVION XT TAB","opening":92,"purchase":0,"sales":44,"free":8,"closing":40}]', false);
select pg_temp.assert_eq((select count(*)::int from stockist_uploads where status = 'active'), 1, 'one live upload');
select pg_temp.assert_eq((select sales from stockist_sales_lines), 44::numeric, 'line stored');
select pg_temp.assert_eq((select month from stockist_uploads), '2026-05-01'::date, 'month normalised to the 1st');
select pg_temp.assert_err($$select commit_stockist_upload('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000d001', '2026-05-01', 'b.xlsx', 'h2', null, null, '{}', '[{"raw_name":"x"}]', false)$$, 'a second upload needs replace');
select commit_stockist_upload('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000d001', '2026-05-01', 'b.xlsx', 'h2', null, null, '{}',
  '[{"product_id":"00000000-0000-0000-0000-00000000f001","raw_name":"ELVION XT","sales":50}]', true);
select pg_temp.assert_eq((select count(*)::int from stockist_uploads where status = 'active'), 1, 'still one live upload');
select pg_temp.assert_eq((select count(*)::int from stockist_uploads where status = 'replaced'), 1, 'old upload kept as history');
select pg_temp.assert_eq((select count(*)::int from stockist_uploads where status = 'replaced' and replaced_by is not null), 1, 'history points at the replacement');
select pg_temp.assert_eq((select count(*)::int from stockist_sales_lines), 2, 'old lines kept');
select pg_temp.assert_err($$select commit_stockist_upload('00000000-0000-0000-0000-00000000e001', null, '2026-06-01', 'c.xlsx', null, null, null, '{}', '[]', false)$$, 'empty file refused');
select commit_stockist_upload('00000000-0000-0000-0000-00000000e001', null, '2026-05-01', 'all.xlsx', null, null, null, '{}', '[{"raw_name":"x"}]', false);
select pg_temp.assert_eq((select count(*)::int from stockist_uploads where status = 'active'), 2, 'a file for all divisions is separate from a division file');
select delete_stockist_upload((select id from stockist_uploads where file_name = 'all.xlsx'));
select pg_temp.assert_eq((select count(*)::int from stockist_uploads where status = 'active'), 1, 'delete works');
rollback;
