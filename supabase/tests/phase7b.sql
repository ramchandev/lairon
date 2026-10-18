-- Admin trip duty + chauffeur beta (PLAN §6.9, §6.11, Appendix D). Run after migrations + seed. Rolls back.
begin;
create function pg_temp.expect_error(p_sql text, p_label text) returns void language plpgsql as $$
begin begin execute p_sql; exception when others then return; end; raise exception 'EXPECTED ERROR but succeeded: %', p_label; end $$;
create function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), true); execute 'set local role authenticated'; end $$;
create function pg_temp.assert_eq(a anyelement, b anyelement, l text) returns void language plpgsql as $$
begin if a is distinct from b then raise exception 'ASSERT FAILED %: got %, expected %', l, a, b; end if; end $$;

insert into auth.users (id, email) select x, x::text || '@t' from (values ('00000000-0000-0000-0000-0000000000a1'::uuid)) v(x);
insert into profiles (id, role, full_name, phone, email) values ('00000000-0000-0000-0000-0000000000a1', 'admin', 'Admin', '+919000000001', 'a@t');

-- Appendix D drivers (names exactly as LAIRON writes them)
create temp table drv (n text, id uuid default gen_random_uuid(), phone text, loc int, outs int);
insert into drv (n, phone, loc, outs) values
  ('RAVIKUMAR.N', '+919100000001', 10, 2), ('ELUMALAI.G', '+919100000002', 9, 3), ('PRAKALATHAN.M', '+919100000003', 10, 2),
  ('PACHAIYAPPAN.K', '+919100000004', 9, 2), ('VIGNESH.P', '+919100000005', 8, 1), ('THINAKARAN.M', '+919100000006', 5, 1), ('VIJAYA SIVASANKAR.P', '+919100000007', 5, 1);
insert into auth.users (id, email) select id, 'd' || phone || '@t' from drv;
insert into profiles (id, role, full_name, phone, email) select id, 'driver', n, phone, 'd' || phone || '@t' from drv;
grant all on all tables in schema public to authenticated;

-- October 2026 closed duties: `loc` local days then `outs` outstation days per driver
insert into driver_day_entries (driver_id, entry_date, entry_type, duty_type, vehicle_source, duty_status, entry_source)
select d.id, date '2026-10-01' + (g - 1), 'duty', case when g <= d.loc then 'Local' else 'Out Station' end, 'own', 'closed', 'import'
from drv d, generate_series(1, 20) g where g <= d.loc + d.outs;

do $$
declare r record; pend uuid[];
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
  -- Appendix D check: RAVIKUMAR 10L+2O = 3,100; ELUMALAI 9L+3O = 3,150; everyone 56L+12O = 17,600
  select * into r from beta_summary('2026-10-01') where driver_name = 'RAVIKUMAR.N';
  perform pg_temp.assert_eq(r.total_amount, 3100::numeric, 'RAVIKUMAR.N beta'); perform pg_temp.assert_eq(r.payable_days, 12, 'RAVIKUMAR.N payable days');
  select * into r from beta_summary('2026-10-01') where driver_name = 'ELUMALAI.G';
  perform pg_temp.assert_eq(r.total_amount, 3150::numeric, 'ELUMALAI.G beta');
  perform pg_temp.assert_eq((select sum(local_days)::int from beta_summary('2026-10-01')), 56, 'all drivers local days');
  perform pg_temp.assert_eq((select sum(outstation_days)::int from beta_summary('2026-10-01')), 12, 'all drivers outstation days');
  perform pg_temp.assert_eq((select sum(total_amount) from beta_summary('2026-10-01')), 17600::numeric, 'all drivers total beta');
  perform pg_temp.assert_eq((select count(*)::int from beta_summary('2026-10-01')), 7, 'seven drivers listed');

  -- finalise freezes; a later edit does not change paid amounts; reopen needs a reason and recalculates
  perform finalise_beta_month('2026-10-15');
  perform pg_temp.assert_eq((select status from beta_months where month = '2026-10-01'), 'finalised', 'month finalised');
  reset role;
  insert into driver_day_entries (driver_id, entry_date, entry_type, duty_type, vehicle_source, duty_status, entry_source)
    select id, '2026-10-30', 'duty', 'Local', 'own', 'closed', 'import' from drv where n = 'RAVIKUMAR.N';
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
  perform pg_temp.assert_eq((select sum(total_amount) from beta_summary('2026-10-01')), 17600::numeric, 'finalised total unchanged by later entry');
  perform pg_temp.expect_error($q$select finalise_beta_month('2026-10-01')$q$, 'cannot finalise twice');
  perform reopen_beta_month('2026-10-01', 'Added a missed duty');
  perform pg_temp.assert_eq((select sum(total_amount) from beta_summary('2026-10-01')), 17850::numeric, 'reopened month includes the new day');
  reset role;

  -- leave decisions
  insert into driver_day_entries (driver_id, entry_date, entry_type, leave_type, leave_reason, leave_status, entry_source)
    select id, d, 'leave', 'Casual', 'Family', 'pending', 'app' from drv, generate_series(date '2026-11-10', date '2026-11-12', interval '1 day') d where n = 'VIGNESH.P';
  select array_agg(id) into pend from driver_day_entries where entry_type = 'leave';
  perform pg_temp.as_user((select id from drv where n = 'VIGNESH.P'));
  perform pg_temp.expect_error(format('select decide_leave(%L, %L, null)', pend, 'approved'), 'driver cannot decide leave');
  perform pg_temp.expect_error($q$update driver_day_entries set decision_note = 'approved by me' where entry_type = 'leave'$q$, 'driver cannot write the decision note');
  reset role; perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
  perform pg_temp.expect_error(format('select decide_leave(%L, %L, null)', pend, 'rejected'), 'rejection needs a reason');
  perform pg_temp.assert_eq(decide_leave(pend, 'rejected', 'Peak week'), 3, 'three days rejected');
  perform pg_temp.assert_eq((select decision_note from driver_day_entries where id = pend[1]), 'Peak week', 'note saved');
  perform pg_temp.expect_error(format('select decide_leave(%L, %L, null)', pend, 'approved'), 'already handled');
  reset role;
  -- a rejected leave day no longer blocks a duty on that date
  insert into driver_day_entries (driver_id, entry_date, entry_type, duty_type, vehicle_source, duty_status, entry_source)
    select id, '2026-11-10', 'duty', 'Local', 'own', 'closed', 'import' from drv where n = 'VIGNESH.P';
end $$;
rollback;
\echo PHASE 7B TESTS PASSED
