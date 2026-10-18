-- Trip end date + the driver's own car (migration 14). Rolls back.
begin;
create function pg_temp.assert_eq(a anyelement, b anyelement, l text) returns void language plpgsql as $$
begin if a is distinct from b then raise exception 'ASSERT FAILED %: got %, expected %', l, a, b; end if; end $$;
create function pg_temp.expect_error(p_sql text, p_label text) returns void language plpgsql as $$
begin begin execute p_sql; exception when others then return; end; raise exception 'EXPECTED ERROR but succeeded: %', p_label; end $$;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1','a@t'), ('00000000-0000-0000-0000-0000000000d1','d@t');
insert into profiles (id, role, full_name, phone, email) values
  ('00000000-0000-0000-0000-0000000000a1','admin','Admin','+919000000001','a@t'),
  ('00000000-0000-0000-0000-0000000000d1','driver','Driver One','+919000000002','d@t');
grant all on all tables in schema public to authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',true);
set local role authenticated;

do $$
declare res jsonb;
begin
  -- overnight trip with an explicit end date: 22:00 on the 18th -> 07:15 on the 19th = 9h15m
  insert into driver_day_entries (driver_id, entry_date, entry_type, duty_type, vehicle_source, vehicle_label, guest_name,
    start_time, end_time, end_date, duty_status, entry_source)
  values ('00000000-0000-0000-0000-0000000000d1', '2026-10-18', 'duty', 'Out Station', 'driver_own', 'Own car (driver)', 'G',
    '22:00', '07:15', '2026-10-19', 'closed', 'app');
  perform pg_temp.assert_eq((select total_minutes from driver_day_entries where entry_date = '2026-10-18'), 555, 'overnight minutes');
  -- a three-day trip: 09:00 on the 20th -> 18:00 on the 22nd = 2 days + 9h
  insert into driver_day_entries (driver_id, entry_date, entry_type, duty_type, vehicle_source, vehicle_label, guest_name,
    start_time, end_time, end_date, duty_status, entry_source)
  values ('00000000-0000-0000-0000-0000000000d1', '2026-10-20', 'duty', 'Out Station', 'own', 'Own (guest vehicle)', 'G',
    '09:00', '18:00', '2026-10-22', 'closed', 'app');
  perform pg_temp.assert_eq((select total_minutes from driver_day_entries where entry_date = '2026-10-20'), 2 * 1440 + 540, 'multi-day minutes');
  -- no end date: the old past-midnight rule still applies
  insert into driver_day_entries (driver_id, entry_date, entry_type, duty_type, vehicle_source, vehicle_label, guest_name,
    start_time, end_time, duty_status, entry_source)
  values ('00000000-0000-0000-0000-0000000000d1', '2026-10-25', 'duty', 'Local', 'own', 'Own (guest vehicle)', 'G',
    '22:00', '07:15', 'closed', 'app');
  perform pg_temp.assert_eq((select total_minutes from driver_day_entries where entry_date = '2026-10-25'), 555, 'legacy past-midnight');
  -- an end date before the start, or a trip that ends before it starts, is refused
  perform pg_temp.expect_error($q$insert into driver_day_entries (driver_id, entry_date, entry_type, duty_type, start_time, end_time, end_date, duty_status, entry_source)
    values ('00000000-0000-0000-0000-0000000000d1', '2026-10-27', 'duty', 'Local', '09:00', '10:00', '2026-10-26', 'closed', 'app')$q$, 'end before start');
  perform pg_temp.expect_error($q$insert into driver_day_entries (driver_id, entry_date, entry_type, duty_type, start_time, end_time, end_date, duty_status, entry_source)
    values ('00000000-0000-0000-0000-0000000000d1', '2026-10-28', 'duty', 'Local', '09:00', '07:00', '2026-10-28', 'closed', 'app')$q$, 'ends before it starts');
  -- beta stays on the start date
  perform pg_temp.assert_eq((select count(*)::int from beta_days('2026-10-01', '00000000-0000-0000-0000-0000000000d1') where entry_date = '2026-10-19'), 0, 'no beta day on the end date');
  perform pg_temp.assert_eq((select count(*)::int from beta_days('2026-10-01', '00000000-0000-0000-0000-0000000000d1') where entry_date = '2026-10-18'), 1, 'beta day on the start date');

  -- import: end_date column and "Own car" -> driver_own, "Own" -> own
  res := import_duties('{"driver_id":"00000000-0000-0000-0000-0000000000d1","month":"2026-11-01","mode":"fill","rows":[
     {"entry_date":"2026-11-02","entry_type":"duty","duty_type":"Out Station","vehicle":"Own car","guest_name":"A","start_time":"06:00","end_time":"07:15","end_date":"2026-11-03"},
     {"entry_date":"2026-11-05","entry_type":"duty","duty_type":"Local","vehicle":"Own","guest_name":"B"}]}'::jsonb);
  perform pg_temp.assert_eq((select vehicle_source from driver_day_entries where entry_date = '2026-11-02'), 'driver_own', 'Own car -> driver_own');
  perform pg_temp.assert_eq((select vehicle_label from driver_day_entries where entry_date = '2026-11-02'), 'Own car (driver)', 'driver-own label');
  perform pg_temp.assert_eq((select end_date from driver_day_entries where entry_date = '2026-11-02'), '2026-11-03'::date, 'imported end date');
  perform pg_temp.assert_eq((select total_minutes from driver_day_entries where entry_date = '2026-11-02'), 1515, 'imported overnight minutes');
  perform pg_temp.assert_eq((select vehicle_source from driver_day_entries where entry_date = '2026-11-05'), 'own', 'Own stays the guest vehicle');
end $$;
rollback;
