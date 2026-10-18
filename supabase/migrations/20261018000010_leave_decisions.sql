-- LAIRON EZ — Phase 7b: leave decisions.

alter table driver_day_entries add column decision_note text;

-- Only an admin may set or change the decision note (drivers can update their own rows otherwise).
create function duty_note_guard() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and not is_admin()
     and new.decision_note is distinct from (case when tg_op = 'UPDATE' then old.decision_note else null end) then
    raise exception 'Only an admin can add a decision note';
  end if;
  return new;
end $$;
create trigger trg_duty_note_guard before insert or update on driver_day_entries
  for each row execute function duty_note_guard();

-- decide_leave: approve or reject every PENDING day in a request at once. A rejection needs a reason.
-- Returns how many days were decided. Rejected days stop blocking duties on those dates (duty_rules ignores them).
create function decide_leave(p_ids uuid[], p_status text, p_note text default null) returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if p_status not in ('approved', 'rejected') then raise exception 'Invalid decision'; end if;
  if p_status = 'rejected' and coalesce(length(trim(p_note)), 0) = 0 then raise exception 'A reason is required to reject leave'; end if;
  update driver_day_entries
     set leave_status = p_status, decided_by = auth.uid(), decided_at = now(), decision_note = nullif(trim(p_note), '')
   where id = any(p_ids) and entry_type = 'leave' and leave_status = 'pending';
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'Nothing to decide — the request may already have been handled'; end if;
  return v_n;
end $$;
revoke execute on function decide_leave(uuid[], text, text) from public, anon;
grant execute on function decide_leave(uuid[], text, text) to authenticated;
