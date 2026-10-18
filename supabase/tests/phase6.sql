-- Starter-pack rules (PLAN §6.8). Run after migrations + seed. Rolls back.
begin;
create function pg_temp.expect_error(p_sql text, p_label text) returns void language plpgsql as $$
begin begin execute p_sql; exception when others then return; end; raise exception 'EXPECTED ERROR but succeeded: %', p_label; end $$;
create function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), true); execute 'set local role authenticated'; end $$;
create function pg_temp.assert_eq(a anyelement, b anyelement, l text) returns void language plpgsql as $$
begin if a is distinct from b then raise exception 'ASSERT FAILED %: got %, expected %', l, a, b; end if; end $$;

insert into auth.users (id, email) select x, x::text || '@t' from (values
  ('00000000-0000-0000-0000-0000000000a1'::uuid), ('00000000-0000-0000-0000-0000000000b1'), ('00000000-0000-0000-0000-0000000000b2')) v(x);
insert into profiles (id, role, full_name, phone, email, area) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin', 'Admin',     '+919000000001', 'a@t', null),
  ('00000000-0000-0000-0000-0000000000b1', 'staff', 'Staff One', '+919000000004', 's1@t', 'Adyar'),
  ('00000000-0000-0000-0000-0000000000b2', 'staff', 'Staff Two', '+919000000007', 's2@t', 'Tambaram');
grant all on all tables in schema public to authenticated;

do $$
declare p1 uuid; p2 uuid; p3 uuid;
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
  p1 := create_starter_pack('{"doctor_name":"Dr A","qualification":"MD","doctor_area":"Adyar","staff_area":"Adyar","division":"OL",
      "items":[{"product_name":"Lairobon","quantity":"1 box"},{"product_name":"Free text product","quantity":"10 strips"}]}'::jsonb);
  perform pg_temp.assert_eq((select staff_name from starter_pack_requests where id = p1), 'Staff One', 'staff name snapshot from profile');
  perform pg_temp.assert_eq((select count(*)::int from starter_pack_items where request_id = p1), 2, 'two items saved (free text allowed)');
  perform pg_temp.expect_error($q$select create_starter_pack('{"doctor_name":"D","qualification":"MD","doctor_area":"A","staff_area":"A","division":"OL","items":[]}'::jsonb)$q$, 'needs an item');
  perform pg_temp.expect_error($q$select create_starter_pack('{"staff_id":"00000000-0000-0000-0000-0000000000b2","doctor_name":"D","qualification":"MD","doctor_area":"A","staff_area":"A","division":"OL","items":[{"product_name":"x","quantity":"1"}]}'::jsonb)$q$, 'staff cannot create for someone else');
  perform pg_temp.expect_error(format($q$update starter_pack_requests set status = 'fulfilled' where id = %L$q$, p1), 'staff cannot fulfil');
  -- staff cancels own submitted pack (no reason needed)
  p2 := create_starter_pack('{"doctor_name":"Dr B","qualification":"MD","doctor_area":"A","staff_area":"A","division":"CC","items":[{"product_name":"x","quantity":"1"}]}'::jsonb);
  update starter_pack_requests set status = 'cancelled' where id = p2;
  perform pg_temp.assert_eq((select status from starter_pack_requests where id = p2), 'cancelled', 'staff can cancel own');
  update starter_pack_requests set status = 'submitted' where id = p2;   -- RLS only lets staff touch submitted rows (0 rows)
  perform pg_temp.assert_eq((select status from starter_pack_requests where id = p2), 'cancelled', 'cancelled is final for staff');
  -- another staff sees nothing
  reset role; perform pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
  perform pg_temp.assert_eq((select count(*)::int from starter_pack_requests), 0, 'other staff sees nothing');
  perform pg_temp.assert_eq((select count(*)::int from starter_pack_items), 0, 'other staff sees no items');
  reset role;

  -- admin flow
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
  update starter_pack_requests set status = 'processing' where id = p1;
  perform pg_temp.expect_error(format($q$update starter_pack_requests set status = 'submitted' where id = %L$q$, p1), 'cannot go back');
  update starter_pack_requests set status = 'fulfilled' where id = p1;
  perform pg_temp.assert_eq((select fulfilled_by from starter_pack_requests where id = p1), '00000000-0000-0000-0000-0000000000a1'::uuid, 'fulfilled_by stamped');
  perform pg_temp.assert_eq((select fulfilled_at is not null from starter_pack_requests where id = p1), true, 'fulfilled_at stamped');
  perform pg_temp.expect_error(format($q$update starter_pack_requests set status = 'cancelled', admin_note = 'late' where id = %L$q$, p1), 'fulfilled is final');
  -- admin on behalf of a staff member, and cancel needs a reason
  p3 := create_starter_pack('{"staff_id":"00000000-0000-0000-0000-0000000000b2","doctor_name":"Dr C","qualification":"MD","doctor_area":"A","staff_area":"Tambaram","division":"CD","items":[{"product_name":"x","quantity":"2"}]}'::jsonb);
  perform pg_temp.assert_eq((select staff_name from starter_pack_requests where id = p3), 'Staff Two', 'admin created on behalf');
  perform pg_temp.expect_error(format($q$update starter_pack_requests set status = 'cancelled' where id = %L$q$, p3), 'admin cancel needs reason');
  update starter_pack_requests set status = 'cancelled', admin_note = 'Duplicate' where id = p3;
  perform pg_temp.assert_eq((select ref_no like 'SP-____-000_' from starter_pack_requests where id = p3), true, 'ref no format');
  reset role;
end $$;
rollback;
\echo PHASE 6 TESTS PASSED
