-- Field activity (migration 20): daily log + doctor calls, monthly figures, locks. Rolls back.
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

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',true);
set local role authenticated;
do $$
declare mdu uuid := (select id from locations where code = 'MDU'); ngl uuid := (select id from locations where code = 'NGL');
  today date := (now() at time zone 'Asia/Kolkata')::date;
  old date := (date_trunc('month', now() at time zone 'Asia/Kolkata') - interval '1 month')::date + 9;
  cur date := date_trunc('month', now() at time zone 'Asia/Kolkata')::date;
begin
  perform save_day_entry(null, today, jsonb_build_object('location_id', mdu, 'tp_planned', 'MDU', 'actual_work', 'Chennai', 'deviation', true, 'reason', 'HO call', 'chemist_calls', 4),
    jsonb_build_array(jsonb_build_object('doctor_name','Dr A','kind','planned_met','location_id',mdu),
                      jsonb_build_object('doctor_name','Dr B','kind','missed'),
                      jsonb_build_object('doctor_name','Dr C','kind','unplanned_met','activity_type','camp','amount','500')));
  perform pg_temp.assert_eq((select count(*)::int from daily_doctor_calls where day = today), 3, 'three calls saved');
  perform pg_temp.assert_eq((select chemist_calls from daily_logs where day = today), 4, 'chemist calls');
  perform pg_temp.assert_eq((select amount from daily_doctor_calls where doctor_name = 'Dr C'), 500::numeric, 'amount parsed');
  -- saving the day again replaces its calls
  perform save_day_entry(null, today, jsonb_build_object('tp_planned','MDU','actual_work','MDU'), jsonb_build_array(jsonb_build_object('doctor_name','Dr A')));
  perform pg_temp.assert_eq((select count(*)::int from daily_doctor_calls where day = today), 1, 'the day''s calls are replaced');
  perform pg_temp.assert_eq((select count(*)::int from daily_logs where day = today), 1, 'one log per day');
  perform pg_temp.assert_err(format('select save_day_entry(null, %L, %L, ''[]'')', today, jsonb_build_object('location_id', ngl)::text), 'does not cover', 'uncovered location');
  perform pg_temp.assert_err(format('select save_day_entry(null, %L, %L, ''[]'')', today + 3, jsonb_build_object('actual_work','x')::text), 'future day', 'no actual work in the future');
  perform save_day_entry(null, today + 3, jsonb_build_object('tp_planned','Tirunelveli'), '[]');
  perform pg_temp.assert_eq((select tp_planned from daily_logs where day = today + 3), 'Tirunelveli', 'a future tour plan is allowed');
  -- an ended month: fill a day once, then it is locked
  perform save_day_entry(null, old, jsonb_build_object('tp_planned','MDU'), '[]');
  perform pg_temp.assert_err(format('select save_day_entry(null, %L, ''{}'', ''[]'')', old), 'locked', 'an ended day is locked once it has a log');
  perform pg_temp.assert_err('insert into daily_logs (manager_id, day) values (auth.uid(), current_date)', 'row-level security', 'no direct writes');
  -- monthly figures
  perform save_monthly_activity(null, cur, '{"pob":"1.5","camps":"1","dr_calls":""}');
  perform pg_temp.assert_eq((select pob from monthly_activity where month = cur), 1.5::numeric, 'pob saved');
  perform pg_temp.assert_eq((select dr_calls from monthly_activity where month = cur), null, 'blank = calculated');
  perform save_monthly_activity(null, cur, '{"pob":"2"}');
  perform pg_temp.assert_eq((select pob from monthly_activity where month = cur), 2::numeric, 'current month can be updated');
  perform pg_temp.assert_err(format('select save_monthly_activity(null, %L, ''{}'')', (cur + interval '1 month')::date), 'current month', 'no future months');
  perform save_monthly_activity(null, (cur - interval '1 month')::date, '{"pob":"3"}');
  perform pg_temp.assert_err(format('select save_monthly_activity(null, %L, ''{}'')', (cur - interval '1 month')::date), 'locked', 'an ended month is locked once saved');
end $$;
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c2',true);
set local role authenticated;
select pg_temp.assert_eq((select count(*)::int from daily_logs) + (select count(*)::int from daily_doctor_calls) + (select count(*)::int from monthly_activity), 0, 'managers do not see each other''s activity');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',true);
set local role authenticated;
do $$
declare old date := (date_trunc('month', now() at time zone 'Asia/Kolkata') - interval '1 month')::date + 9;
begin
  perform pg_temp.assert_eq((select count(*)::int from daily_logs), 3, 'admin sees everything');
  perform save_day_entry('00000000-0000-0000-0000-0000000000c1', old, jsonb_build_object('tp_planned','MDU','actual_work','Madurai'), '[]');
  perform pg_temp.assert_eq((select actual_work from daily_logs where day = old), 'Madurai', 'admin can change a locked day');
  perform pg_temp.assert_err(format('select save_day_entry(null, %L, ''{}'', ''[]'')', old), 'Choose a manager', 'admin must name the manager');
end $$;
rollback;
