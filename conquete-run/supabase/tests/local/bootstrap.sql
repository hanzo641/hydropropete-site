-- Émulation minimale de l'environnement Supabase pour les tests locaux uniquement.
-- (Sur Supabase, tout ceci existe déjà : NE PAS appliquer en production.)
create schema if not exists extensions;
create schema if not exists auth;
do $$ begin
  create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin
  create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin
  create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
grant usage on schema public, extensions to anon, authenticated, service_role;
create table if not exists auth.users (
  id uuid primary key,
  email text,
  created_at timestamptz default now()
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', 'anon')
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists postgis with schema extensions;
create extension if not exists pgtap with schema extensions;
create publication supabase_realtime;
alter database test set search_path = public, extensions;
set search_path = public, extensions;
