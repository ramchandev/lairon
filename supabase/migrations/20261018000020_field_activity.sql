-- Manager performance, release 2: daily log (tour plan vs actual), doctors met each day, and the monthly field-activity figures.

-- One row per manager and day: what was planned, what happened, and the chemist calls made.
create table daily_logs (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references profiles (id) on delete cascade,
  day date not null,
  day_type text not null default 'field' check (day_type in ('field', 'meeting', 'weekoff', 'holiday', 'leave')),
  location_id uuid references locations (id) on delete set null,
  tp_planned text,
  actual_work text,
  deviation boolean not null default false,
  reason text,
  prior_approval boolean,
  remarks text,
  chemist_calls int not null default 0 check (chemist_calls >= 0),
  entered_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (manager_id, day)
);
create trigger trg_daily_logs_updated before update on daily_logs for each row execute function set_updated_at();

-- The doctors met (or missed) on a day.
create table daily_doctor_calls (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references profiles (id) on delete cascade,
  day date not null,
  location_id uuid references locations (id) on delete set null,
  doctor_id uuid references doctors (id) on delete set null,
  doctor_name text not null check (length(trim(doctor_name)) > 0),
  speciality text,
  place text,
  kind text not null default 'planned_met' check (kind in ('planned_met', 'missed', 'unplanned_met')),
  activity_type text check (activity_type in ('camp', 'cme', 'other')),
  activity_name text,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  status text not null default 'done' check (status in ('planned', 'done')),
  discussion text,
  instructions text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index on daily_doctor_calls (manager_id, day);

-- Figures a manager types over the calculated ones for a month (null = use the calculated value), plus POB and the MCL size.
create table monthly_activity (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references profiles (id) on delete cascade,
  month date not null check (month = date_trunc('month', month)::date),
  working_days int check (working_days >= 0),
  holidays int check (holidays >= 0),
  leave_days int check (leave_days >= 0),
  days_worked int check (days_worked >= 0),
  meeting_days int check (meeting_days >= 0),
  dr_calls int check (dr_calls >= 0),
  ch_calls int check (ch_calls >= 0),
  pob numeric(12,2) check (pob >= 0),
  mcl_total int check (mcl_total >= 0),
  mcl_met int check (mcl_met >= 0),
  missed_calls int check (missed_calls >= 0),
  three_visit int check (three_visit >= 0),
  two_visit int check (two_visit >= 0),
  one_visit int check (one_visit >= 0),
  camps int check (camps >= 0),
  cmes int check (cmes >= 0),
  entered_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (manager_id, month)
);
create trigger trg_monthly_activity_updated before update on monthly_activity for each row execute function set_updated_at();

alter table daily_logs enable row level security;
alter table daily_doctor_calls enable row level security;
alter table monthly_activity enable row level security;
create policy daily_logs_own_read on daily_logs for select to authenticated using (manager_id = auth.uid());
create policy daily_logs_admin_read on daily_logs for select to authenticated using (is_admin());
create policy daily_calls_own_read on daily_doctor_calls for select to authenticated using (manager_id = auth.uid());
create policy daily_calls_admin_read on daily_doctor_calls for select to authenticated using (is_admin());
create policy monthly_activity_own_read on monthly_activity for select to authenticated using (manager_id = auth.uid());
create policy monthly_activity_admin_read on monthly_activity for select to authenticated using (is_admin());
grant select on daily_logs, daily_doctor_calls, monthly_activity to authenticated;
-- no write policies: every write goes through save_day_entry() / save_monthly_activity()

-- Saves a whole day: the log row and the full list of doctor calls (replacing that day's earlier calls).
-- Manager: own days only, locations they cover, up to today (a future day takes the tour plan only). A day in a month that has
-- ended is frozen once it has a log (a day with none can be filled in once). Admin: any manager, any day.
create function save_day_entry(p_manager uuid, p_day date, p_log jsonb, p_calls jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_role user_role := auth_role();
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_mgr uuid;
  v_loc uuid := nullif(p_log ->> 'location_id', '')::uuid;
  v_calls jsonb := coalesce(p_calls, '[]'::jsonb);
  c jsonb; i int := 0; l uuid;
begin
  if v_role is null or v_role not in ('admin', 'manager') then raise exception 'Not allowed'; end if;
  v_mgr := case when v_role = 'admin' then p_manager else auth.uid() end;
  if v_mgr is null or not exists (select 1 from profiles where id = v_mgr and role = 'manager') then
    raise exception 'Choose a manager';
  end if;
  if jsonb_typeof(v_calls) <> 'array' or jsonb_array_length(v_calls) > 80 then raise exception 'Too many doctors for one day'; end if;
  if p_day > v_today and (coalesce(p_log ->> 'actual_work', '') <> '' or jsonb_array_length(v_calls) > 0) then
    raise exception 'Only the tour plan can be entered for a future day';
  end if;
  if v_role <> 'admin' and date_trunc('month', p_day) < date_trunc('month', v_today)
     and exists (select 1 from daily_logs where manager_id = v_mgr and day = p_day) then
    raise exception 'This month has ended, so the day is locked. Ask an admin to change it.';
  end if;
  for l in select distinct x from (
      select v_loc as x union all select nullif(e ->> 'location_id', '')::uuid from jsonb_array_elements(v_calls) e) s where x is not null loop
    if not exists (select 1 from manager_locations where manager_id = v_mgr and location_id = l) then
      raise exception 'This manager does not cover that location. Ask an admin to assign it.';
    end if;
  end loop;

  insert into daily_logs (manager_id, day, day_type, location_id, tp_planned, actual_work, deviation, reason, prior_approval, remarks, chemist_calls, entered_by)
  values (v_mgr, p_day, coalesce(nullif(p_log ->> 'day_type', ''), 'field'), v_loc,
          nullif(trim(p_log ->> 'tp_planned'), ''), nullif(trim(p_log ->> 'actual_work'), ''),
          coalesce((p_log ->> 'deviation')::boolean, false), nullif(trim(p_log ->> 'reason'), ''),
          (p_log ->> 'prior_approval')::boolean, nullif(trim(p_log ->> 'remarks'), ''),
          coalesce(nullif(p_log ->> 'chemist_calls', '')::int, 0), auth.uid())
  on conflict (manager_id, day) do update
    set day_type = excluded.day_type, location_id = excluded.location_id, tp_planned = excluded.tp_planned,
        actual_work = excluded.actual_work, deviation = excluded.deviation, reason = excluded.reason,
        prior_approval = excluded.prior_approval, remarks = excluded.remarks, chemist_calls = excluded.chemist_calls,
        entered_by = excluded.entered_by;

  delete from daily_doctor_calls where manager_id = v_mgr and day = p_day;
  for c in select * from jsonb_array_elements(v_calls) loop
    i := i + 1;
    insert into daily_doctor_calls (manager_id, day, location_id, doctor_id, doctor_name, speciality, place, kind,
                                    activity_type, activity_name, amount, status, discussion, instructions, sort_order)
    values (v_mgr, p_day, nullif(c ->> 'location_id', '')::uuid, nullif(c ->> 'doctor_id', '')::uuid,
            trim(c ->> 'doctor_name'), nullif(trim(c ->> 'speciality'), ''), nullif(trim(c ->> 'place'), ''),
            coalesce(nullif(c ->> 'kind', ''), 'planned_met'), nullif(c ->> 'activity_type', ''),
            nullif(trim(c ->> 'activity_name'), ''), coalesce(nullif(c ->> 'amount', '')::numeric, 0),
            coalesce(nullif(c ->> 'status', ''), 'done'), nullif(trim(c ->> 'discussion'), ''),
            nullif(trim(c ->> 'instructions'), ''), i);
  end loop;
end $$;
revoke execute on function save_day_entry(uuid, date, jsonb, jsonb) from public, anon;
grant execute on function save_day_entry(uuid, date, jsonb, jsonb) to authenticated;

-- The monthly figures a manager overrides (blank = calculated), POB and MCL size. An ended month is frozen once it has a row.
create function save_monthly_activity(p_manager uuid, p_month date, p_values jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_role user_role := auth_role();
  v_month date := date_trunc('month', p_month)::date;
  v_now date := date_trunc('month', now() at time zone 'Asia/Kolkata')::date;
  v_mgr uuid;
begin
  if v_role is null or v_role not in ('admin', 'manager') then raise exception 'Not allowed'; end if;
  v_mgr := case when v_role = 'admin' then p_manager else auth.uid() end;
  if v_mgr is null or not exists (select 1 from profiles where id = v_mgr and role = 'manager') then
    raise exception 'Choose a manager';
  end if;
  if v_month > v_now then raise exception 'Figures can only be entered up to the current month'; end if;
  if v_role <> 'admin' and v_month < v_now and exists (select 1 from monthly_activity where manager_id = v_mgr and month = v_month) then
    raise exception 'This month has ended, so it is locked. Ask an admin to change it.';
  end if;
  insert into monthly_activity (manager_id, month, working_days, holidays, leave_days, days_worked, meeting_days, dr_calls, ch_calls,
                                pob, mcl_total, mcl_met, missed_calls, three_visit, two_visit, one_visit, camps, cmes, entered_by)
  values (v_mgr, v_month,
          nullif(p_values ->> 'working_days', '')::int, nullif(p_values ->> 'holidays', '')::int, nullif(p_values ->> 'leave_days', '')::int,
          nullif(p_values ->> 'days_worked', '')::int, nullif(p_values ->> 'meeting_days', '')::int, nullif(p_values ->> 'dr_calls', '')::int,
          nullif(p_values ->> 'ch_calls', '')::int, nullif(p_values ->> 'pob', '')::numeric, nullif(p_values ->> 'mcl_total', '')::int,
          nullif(p_values ->> 'mcl_met', '')::int, nullif(p_values ->> 'missed_calls', '')::int, nullif(p_values ->> 'three_visit', '')::int,
          nullif(p_values ->> 'two_visit', '')::int, nullif(p_values ->> 'one_visit', '')::int, nullif(p_values ->> 'camps', '')::int,
          nullif(p_values ->> 'cmes', '')::int, auth.uid())
  on conflict (manager_id, month) do update set
    working_days = excluded.working_days, holidays = excluded.holidays, leave_days = excluded.leave_days, days_worked = excluded.days_worked,
    meeting_days = excluded.meeting_days, dr_calls = excluded.dr_calls, ch_calls = excluded.ch_calls, pob = excluded.pob,
    mcl_total = excluded.mcl_total, mcl_met = excluded.mcl_met, missed_calls = excluded.missed_calls, three_visit = excluded.three_visit,
    two_visit = excluded.two_visit, one_visit = excluded.one_visit, camps = excluded.camps, cmes = excluded.cmes, entered_by = excluded.entered_by;
end $$;
revoke execute on function save_monthly_activity(uuid, date, jsonb) from public, anon;
grant execute on function save_monthly_activity(uuid, date, jsonb) to authenticated;
