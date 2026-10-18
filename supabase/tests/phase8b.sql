-- Bulk import of service requests and starter packs (migration 15). Rolls back.
begin;
create function pg_temp.assert_eq(a anyelement, b anyelement, l text) returns void language plpgsql as $$
begin if a is distinct from b then raise exception 'ASSERT FAILED %: got %, expected %', l, a, b; end if; end $$;
create function pg_temp.expect_error(p_sql text, p_label text) returns void language plpgsql as $$
begin begin execute p_sql; exception when others then return; end; raise exception 'EXPECTED ERROR but succeeded: %', p_label; end $$;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','a@t'),('00000000-0000-0000-0000-0000000000b1','s@t'),('00000000-0000-0000-0000-0000000000c1','m@t');
insert into profiles (id, role, full_name, phone, email) values
  ('00000000-0000-0000-0000-0000000000a1','admin','Admin','+919000000001','a@t'),
  ('00000000-0000-0000-0000-0000000000b1','staff','Staff One','+919000000002','s@t'),
  ('00000000-0000-0000-0000-0000000000c1','manager','Mgr One','+919000000003','m@t');
grant all on all tables in schema public to authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',true);
set local role authenticated;
do $$
begin
  perform pg_temp.expect_error($q$select import_service_requests('{"requests":[]}'::jsonb)$q$, 'staff cannot import');
  perform pg_temp.expect_error($q$select import_starter_packs('{"packs":[]}'::jsonb)$q$, 'staff cannot import packs');
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',true);
set local role authenticated;
do $$
declare r jsonb;
  svc text := '{"request_date":"2026-09-10","doctor_name":"Dr A","area":"Adyar","hospital_name":"H","hq":"CHN","division":"OL","qualification":"MBBS","speciality":"GP","service_amount":5000,"service_type":"CME","expected_business_value":20000,"current_business_value":10000,"offer_type":"Offer","offer_percent":10}';
begin
  r := import_service_requests(('{"requests":[
    {"ref_no":"SR-2609-0100","manager_id":"00000000-0000-0000-0000-0000000000c1","staff_id":"00000000-0000-0000-0000-0000000000b1","status":"fulfilled","submitted_on":"2026-09-10","services":['||svc||','||svc||']},
    {"manager_id":"00000000-0000-0000-0000-0000000000c1","staff_id":"00000000-0000-0000-0000-0000000000b1","status":"submitted","services":['||svc||']}]}')::jsonb);
  perform pg_temp.assert_eq((r ->> 'requests')::int, 2, '2 requests'); perform pg_temp.assert_eq((r ->> 'services')::int, 3, '3 services');
  perform pg_temp.assert_eq((select status from service_request_batches where ref_no = 'SR-2609-0100'), 'fulfilled', 'status kept');
  perform pg_temp.assert_eq((select submitted_at::date from service_request_batches where ref_no = 'SR-2609-0100'), '2026-09-10'::date, 'submitted date kept');
  perform pg_temp.assert_eq((select count(*)::int from service_request_batches where ref_no like 'SR-%' and status = 'submitted'), 1, 'ref generated for the second');
  perform pg_temp.expect_error($q$select import_service_requests('{"requests":[{"ref_no":"SR-2609-0100","manager_id":"00000000-0000-0000-0000-0000000000c1","staff_id":"00000000-0000-0000-0000-0000000000b1","services":[{}]}]}'::jsonb)$q$, 'duplicate ref blocks');
  perform pg_temp.expect_error($q$select import_service_requests('{"requests":[{"manager_id":"00000000-0000-0000-0000-0000000000c1","staff_id":"00000000-0000-0000-0000-0000000000b1","status":"rejected","services":[{}]}]}'::jsonb)$q$, 'rejected needs a note');

  r := import_starter_packs('{"packs":[{"request_date":"2026-09-11","doctor_name":"Dr B","qualification":"MD","doctor_area":"T Nagar","staff_id":"00000000-0000-0000-0000-0000000000b1","staff_area":"Adyar","division":"OL","status":"fulfilled",
     "items":[{"product_name":"Rosvalar-10","quantity":"2 boxes"},{"product_name":"Xyz","quantity":"1"}]}]}'::jsonb);
  perform pg_temp.assert_eq((r ->> 'packs')::int, 1, '1 pack'); perform pg_temp.assert_eq((r ->> 'products')::int, 2, '2 products');
  perform pg_temp.assert_eq((select status from starter_pack_requests where doctor_name = 'Dr B'), 'fulfilled', 'pack status kept');
  perform pg_temp.assert_eq((select staff_name from starter_pack_requests where doctor_name = 'Dr B'), 'Staff One', 'staff name snapshot');
  perform pg_temp.assert_eq((select ref_no like 'SP-%' from starter_pack_requests where doctor_name = 'Dr B'), true, 'ref generated');
  perform pg_temp.expect_error($q$select import_starter_packs('{"packs":[{"request_date":"2026-09-11","doctor_name":"Z","staff_id":"00000000-0000-0000-0000-0000000000b1","division":"OL","status":"cancelled","items":[{"product_name":"a","quantity":"1"}]}]}'::jsonb)$q$, 'cancelled needs a note');
end $$;
rollback;
