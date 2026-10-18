-- Service-request flow rules (PLAN §6.7). Run after migrations + seed. Rolls back.
begin;
create function pg_temp.expect_error(p_sql text, p_label text) returns void language plpgsql as $$
begin begin execute p_sql; exception when others then return; end; raise exception 'EXPECTED ERROR but succeeded: %', p_label; end $$;
create function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), true); execute 'set local role authenticated'; end $$;
create function pg_temp.assert_eq(a anyelement, b anyelement, l text) returns void language plpgsql as $$
begin if a is distinct from b then raise exception 'ASSERT FAILED %: got %, expected %', l, a, b; end if; end $$;

insert into auth.users (id, email) select x, x::text || '@t' from (values
  ('00000000-0000-0000-0000-0000000000a1'::uuid), ('00000000-0000-0000-0000-0000000000b1'), ('00000000-0000-0000-0000-0000000000b2'), ('00000000-0000-0000-0000-0000000000c1')) v(x);
insert into profiles (id, role, full_name, phone, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin',   'Admin',    '+919000000001', 'a@t'),
  ('00000000-0000-0000-0000-0000000000b1', 'staff',   'Staff One','+919000000004', 's1@t'),
  ('00000000-0000-0000-0000-0000000000b2', 'staff',   'Staff Two','+919000000007', 's2@t'),
  ('00000000-0000-0000-0000-0000000000c1', 'manager', 'Mgr One',  '+919000000005', null);
grant all on all tables in schema public to authenticated;

do $$
declare b uuid; b2 uuid; ref text;
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
  b := get_or_create_draft_batch();
  b2 := get_or_create_draft_batch();
  perform pg_temp.assert_eq(b, b2, 'draft is reused, one per manager');
  perform pg_temp.assert_eq((select manager_name from service_request_batches where id = b), 'Mgr One', 'manager name snapshot');
  perform pg_temp.assert_eq((select ref_no from service_request_batches where id = b), null::text, 'draft has no ref no yet');

  -- cannot submit empty or without accountability staff
  perform pg_temp.expect_error(format('select submit_service_batch(%L)', b), 'empty batch');
  insert into service_requests (batch_id, doctor_name, area, hospital_name, hq, division, qualification, speciality, service_amount,
    service_type, expected_business_value, current_business_value, offer_type, offer_percent)
  values (b, 'Dr X', 'Adyar', 'Apollo', 'CHN', 'OL', 'MD', 'Cardiologist', 5000, 'Camp', 100000, 50000, 'Offer', 10);
  perform pg_temp.expect_error(format('select submit_service_batch(%L)', b), 'no accountability staff');
  update service_request_batches set accountability_staff_id = '00000000-0000-0000-0000-0000000000b1' where id = b;
  perform pg_temp.assert_eq((select accountability_staff_name from service_request_batches where id = b), 'Staff One', 'staff name snapshot');

  -- staff cannot see a draft
  reset role; perform pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
  perform pg_temp.assert_eq((select count(*)::int from service_request_batches), 0, 'accountable staff cannot see drafts');
  reset role; perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');

  ref := submit_service_batch(b);
  perform pg_temp.assert_eq(ref like 'SR-____-0001', true, 'ref no assigned on submit');
  perform pg_temp.expect_error(format('select submit_service_batch(%L)', b), 'cannot submit twice');
  perform pg_temp.expect_error(format($q$insert into service_requests (batch_id, doctor_name, area, hospital_name, hq, division, qualification, speciality, service_amount,
    service_type, expected_business_value, current_business_value, offer_type, netrate_amount) values (%L,'Dr Y','A','H','CHN','OL','MD','X',1,'Camp',1,1,'Netrate',1)$q$, b), 'manager cannot add services after submit');
  update service_request_batches set status = 'approved' where id = b;   -- RLS hides submitted rows from manager updates (0 rows)
  perform pg_temp.assert_eq((select status from service_request_batches where id = b), 'submitted', 'manager cannot approve');
  -- a new draft can be started once the previous one is submitted
  perform pg_temp.assert_eq(get_or_create_draft_batch() <> b, true, 'new draft after submit');

  -- staff (accountable) sees the submitted batch and its services; other staff does not
  reset role; perform pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
  perform pg_temp.assert_eq((select count(*)::int from service_request_batches), 1, 'accountable staff sees submitted batch');
  perform pg_temp.assert_eq((select count(*)::int from service_requests), 1, 'accountable staff sees services');
  reset role; perform pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
  perform pg_temp.assert_eq((select count(*)::int from service_request_batches), 0, 'other staff sees nothing');

  -- admin decisions
  reset role; perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
  perform pg_temp.expect_error(format($q$update service_request_batches set status = 'rejected' where id = %L$q$, b), 'reject needs a reason');
  perform pg_temp.expect_error(format($q$update service_request_batches set status = 'fulfilled' where id = %L$q$, b), 'cannot skip approval');
  update service_request_batches set status = 'approved' where id = b;
  perform pg_temp.assert_eq((select decided_by from service_request_batches where id = b), '00000000-0000-0000-0000-0000000000a1'::uuid, 'decided_by stamped');
  update service_request_batches set status = 'fulfilled' where id = b;
  perform pg_temp.expect_error(format($q$update service_request_batches set status = 'rejected', admin_note = 'late' where id = %L$q$, b), 'fulfilled is final');
  perform pg_temp.assert_eq((select status from service_request_batches where id = b), 'fulfilled', 'final status');
  reset role;
end $$;
rollback;
\echo PHASE 5 TESTS PASSED
