-- Email notification triggers (PLAN §7). pg_net isn't available outside Supabase, so a stand-in net.http_post
-- records the calls. Run after migrations + seed. Rolls back.
begin;
create function pg_temp.assert_eq(a anyelement, b anyelement, l text) returns void language plpgsql as $$
begin if a is distinct from b then raise exception 'ASSERT FAILED %: got %, expected %', l, a, b; end if; end $$;

create table public.net_calls (id serial, url text, body jsonb, headers jsonb);
create schema if not exists net;
create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds integer default 5000)
returns bigint language plpgsql as $$
begin insert into public.net_calls (url, body, headers) values (url, body, headers); return 1; end $$;

insert into auth.users (id, email) select x, x::text || '@t' from (values
  ('00000000-0000-0000-0000-0000000000a1'::uuid), ('00000000-0000-0000-0000-0000000000b1'), ('00000000-0000-0000-0000-0000000000c1'), ('00000000-0000-0000-0000-0000000000d1')) v(x);
insert into profiles (id, role, full_name, phone, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin', 'Admin', '+919000000001', 'a@t'),
  ('00000000-0000-0000-0000-0000000000b1', 'staff', 'Staff', '+919000000004', 's@t'),
  ('00000000-0000-0000-0000-0000000000c1', 'manager', 'Mgr', '+919000000005', null),
  ('00000000-0000-0000-0000-0000000000d1', 'driver', 'DRV', '+919000000002', 'd@t');
grant all on all tables in schema public to authenticated;
grant usage on schema net to authenticated;
grant execute on function net.http_post(text, jsonb, jsonb, jsonb, integer) to authenticated;

do $$
declare b uuid; p uuid; ids uuid[];
begin
  -- 1. without config nothing is sent and nothing breaks
  insert into starter_pack_requests (doctor_name, qualification, doctor_area, staff_id, staff_name, staff_area, division)
    values ('Dr 0', 'MD', 'A', '00000000-0000-0000-0000-0000000000b1', 'Staff', 'A', 'OL');
  perform pg_temp.assert_eq((select count(*)::int from net_calls), 0, 'no config: no calls, no error');

  insert into edge_config values ('notify_url', 'https://x.test/functions/v1/notify'), ('notify_secret', 's3cret');

  -- 2. starter pack submitted / fulfilled
  insert into starter_pack_requests (doctor_name, qualification, doctor_area, staff_id, staff_name, staff_area, division)
    values ('Dr 1', 'MD', 'A', '00000000-0000-0000-0000-0000000000b1', 'Staff', 'A', 'OL') returning id into p;
  perform pg_temp.assert_eq((select body ->> 'event' from net_calls order by id desc limit 1), 'starter_pack.submitted', 'starter pack submitted');
  perform pg_temp.assert_eq((select body ->> 'id' from net_calls order by id desc limit 1), p::text, 'carries the id');
  perform pg_temp.assert_eq((select headers ->> 'x-webhook-secret' from net_calls order by id desc limit 1), 's3cret', 'secret header sent');
  perform pg_temp.assert_eq((select url from net_calls order by id desc limit 1), 'https://x.test/functions/v1/notify', 'url from config');
  update starter_pack_requests set status = 'processing' where id = p;
  perform pg_temp.assert_eq((select count(*)::int from net_calls where body ->> 'event' = 'starter_pack.fulfilled'), 0, 'processing sends nothing');
  update starter_pack_requests set status = 'fulfilled' where id = p;
  perform pg_temp.assert_eq((select body ->> 'event' from net_calls order by id desc limit 1), 'starter_pack.fulfilled', 'starter pack fulfilled');

  -- 3. service request submitted + decided
  insert into service_request_batches (manager_id, accountability_staff_id) values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1') returning id into b;
  perform pg_temp.assert_eq((select count(*)::int from net_calls where body ->> 'event' like 'service_request.%'), 0, 'a draft sends nothing');
  insert into service_requests (batch_id, doctor_name, area, hospital_name, hq, division, qualification, speciality, service_amount, service_type, expected_business_value, current_business_value, offer_type, offer_percent)
    values (b, 'Dr X', 'A', 'H', 'CHN', 'OL', 'MD', 'X', 100, 'Camp', 1, 1, 'Offer', 5);
  update service_request_batches set status = 'submitted' where id = b;
  perform pg_temp.assert_eq((select body ->> 'event' from net_calls order by id desc limit 1), 'service_request.submitted', 'service request submitted');
  update service_request_batches set status = 'rejected', admin_note = 'No budget' where id = b;
  perform pg_temp.assert_eq((select body ->> 'event' || ':' || (body ->> 'status') from net_calls order by id desc limit 1), 'service_request.decided:rejected', 'service request rejected');
  update service_request_batches set admin_note = 'edited note' where id = b;
  perform pg_temp.assert_eq((select count(*)::int from net_calls where body ->> 'event' = 'service_request.decided'), 1, 'a note edit sends nothing');

  -- 4. leave: ONE event for a 3-day request, one for its decision; imports and duties send nothing
  delete from net_calls;
  insert into driver_day_entries (driver_id, entry_date, entry_type, leave_type, leave_reason, entry_source) values
    ('00000000-0000-0000-0000-0000000000d1', date '2026-12-10', 'leave', 'Casual', 'x', 'app'),
    ('00000000-0000-0000-0000-0000000000d1', date '2026-12-11', 'leave', 'Casual', 'x', 'app'),
    ('00000000-0000-0000-0000-0000000000d1', date '2026-12-12', 'leave', 'Casual', 'x', 'app');
  perform pg_temp.assert_eq((select count(*)::int from net_calls), 1, 'one leave.applied for a 3-day request');
  perform pg_temp.assert_eq((select body ->> 'event' from net_calls), 'leave.applied', 'event name');
  perform pg_temp.assert_eq((select jsonb_array_length(body -> 'ids') from net_calls), 3, 'carries all 3 ids');
  select array_agg(id) into ids from driver_day_entries where entry_type = 'leave';
  delete from net_calls;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
  set local role authenticated;
  perform decide_leave(ids, 'approved', 'Enjoy');
  reset role;
  perform pg_temp.assert_eq((select count(*)::int from net_calls), 1, 'one leave.decided for the whole request');
  perform pg_temp.assert_eq((select body ->> 'status' from net_calls), 'approved', 'decision status');
  delete from net_calls;
  insert into driver_day_entries (driver_id, entry_date, entry_type, duty_type, vehicle_source, duty_status, entry_source) values ('00000000-0000-0000-0000-0000000000d1', '2026-12-20', 'duty', 'Local', 'own', 'closed', 'import');
  update driver_day_entries set guest_name = 'x' where entry_type = 'duty';
  insert into driver_day_entries (driver_id, entry_date, entry_type, leave_status, entry_source) values ('00000000-0000-0000-0000-0000000000d1', '2026-12-25', 'leave', 'approved', 'import');
  perform pg_temp.assert_eq((select count(*)::int from net_calls), 0, 'duties, edits and imported (already approved) leave send nothing');

  -- 5. a failing HTTP call never breaks the user's transaction
  create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds integer default 5000)
  returns bigint language plpgsql as $f$ begin raise exception 'network down'; end $f$;
  insert into starter_pack_requests (doctor_name, qualification, doctor_area, staff_id, staff_name, staff_area, division)
    values ('Dr 2', 'MD', 'A', '00000000-0000-0000-0000-0000000000b1', 'Staff', 'A', 'OL');
  perform pg_temp.assert_eq((select count(*)::int from starter_pack_requests where doctor_name = 'Dr 2'), 1, 'insert survived a failing webhook');

  -- 6. email_log: a notification is only recorded as SENT once
  insert into email_log ("to", template, status, dedupe_key) values ('a@t', 'x', 'sent', 'k1');
  insert into email_log ("to", template, status, dedupe_key) values ('a@t', 'x', 'failed', 'k1');   -- failures may repeat
  begin
    insert into email_log ("to", template, status, dedupe_key) values ('a@t', 'x', 'sent', 'k1');
    raise exception 'EXPECTED unique violation';
  exception when unique_violation then null; end;
end $$;
rollback;
\echo PHASE 8 TESTS PASSED
