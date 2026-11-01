-- Starter pack: division per product line (migration 18). Rolls back.
begin;
create function pg_temp.assert_eq(a anyelement, b anyelement, l text) returns void language plpgsql as $$
begin if a is distinct from b then raise exception 'ASSERT FAILED %: got %, expected %', l, a, b; end if; end $$;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','a@t'),('00000000-0000-0000-0000-0000000000b1','s@t');
insert into profiles (id, role, full_name, phone, email) values
  ('00000000-0000-0000-0000-0000000000a1','admin','Admin','+919000000001','a@t'),
  ('00000000-0000-0000-0000-0000000000b1','staff','Staff One','+919000000002','s@t');
grant all on all tables in schema public to authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',true);
set local role authenticated;
do $$
declare pid uuid;
begin
  pid := create_starter_pack('{"request_date":"2026-10-01","doctor_name":"Dr A","qualification":"MD","doctor_area":"Adyar","staff_area":"Velachery","items":[
    {"division":"OL","product_name":"P1","quantity":"1"},{"division":"CC","product_name":"P2","quantity":"2"},{"division":"OL","product_name":"P3","quantity":"3"}]}'::jsonb);
  perform pg_temp.assert_eq((select division from starter_pack_requests where id = pid), 'CC, OL', 'pack division = the distinct line divisions');
  perform pg_temp.assert_eq((select string_agg(division, ',' order by sort_order) from starter_pack_items where request_id = pid), 'OL,CC,OL', 'each line keeps its division');
  pid := create_starter_pack('{"request_date":"2026-10-02","doctor_name":"Dr B","qualification":"MD","doctor_area":"X","staff_area":"Y","division":"OL","items":[{"product_name":"P1","quantity":"1"}]}'::jsonb);
  perform pg_temp.assert_eq((select division from starter_pack_items where request_id = pid), 'OL', 'a line without a division falls back to the pack division');
end $$;
rollback;
