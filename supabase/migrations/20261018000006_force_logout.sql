-- Force-logout: delete a user's sessions + refresh tokens. Callable by the service role only
-- (Edge Function admin-user-action). Not exposed to any signed-in user.
create function admin_force_logout(p_user uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  delete from auth.refresh_tokens where user_id = p_user::text;
  delete from auth.sessions where user_id = p_user;
end $$;
revoke all on function admin_force_logout(uuid) from public, anon, authenticated;
grant execute on function admin_force_logout(uuid) to service_role;
