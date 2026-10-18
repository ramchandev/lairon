-- Minimal stand-ins for the parts of Supabase our migrations touch, so migrations + tests run on a plain Postgres 16.
-- NOT for real Supabase projects. Used by scripts/test-sql.sh.
create role anon nologin; create role authenticated nologin;
create schema auth; create schema storage;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
grant usage on schema public, auth to anon, authenticated;
create role service_role nologin;
create table auth.sessions (id uuid default gen_random_uuid(), user_id uuid);
create table auth.refresh_tokens (id bigserial, user_id varchar, session_id uuid);
