-- LAIRON EZ — Phase 7a: driver helpers.

-- The last closing KM recorded for a vehicle by ANY driver, so the start-KM check works even though a driver
-- can only read their own entries. Returns only the number, never another driver's data.
create function last_vehicle_km(p_vehicle uuid) returns int
language sql stable security definer set search_path = public as $$
  select end_km from driver_day_entries
  where vehicle_id = p_vehicle and duty_status = 'closed' and end_km is not null
    and auth_role() in ('driver', 'admin')
  order by entry_date desc, end_time desc nulls last, created_at desc
  limit 1
$$;
revoke execute on function last_vehicle_km(uuid) from public, anon;
grant execute on function last_vehicle_km(uuid) to authenticated;
revoke execute on function driver_edit_window_days() from public, anon;
grant execute on function driver_edit_window_days() to authenticated;
