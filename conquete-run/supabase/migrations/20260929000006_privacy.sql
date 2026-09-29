-- Export des réglages privés (lisible : coordonnées en clair) pour l'Edge Function export-data.
set search_path = public, extensions;

create or replace function public.my_private_settings_export(p_user uuid)
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'birth_year', birth_year,
    'privacy_zone', case when privacy_center is null then null else jsonb_build_object(
      'lat', st_y(privacy_center::geometry), 'lng', st_x(privacy_center::geometry), 'radius_m', privacy_radius_m) end,
    'gps_consent_at', gps_consent_at,
    'terms_accepted_at', terms_accepted_at,
    'terms_version', terms_version)
  from public.private_settings where user_id = p_user
$$;

-- Retrait du consentement GPS : plus aucune nouvelle course acceptée (submit-run le vérifie).
create or replace function public.revoke_gps_consent()
returns void language sql security definer set search_path = public as $$
  update public.private_settings set gps_consent_at = null, updated_at = now() where user_id = auth.uid()
$$;

create or replace function public.grant_gps_consent()
returns void language sql security definer set search_path = public as $$
  update public.private_settings set gps_consent_at = now(), updated_at = now() where user_id = auth.uid()
$$;

create or replace function public.my_gps_consent()
returns boolean language sql stable security definer set search_path = public as $$
  select gps_consent_at is not null from public.private_settings where user_id = auth.uid()
$$;

revoke execute on function public.my_private_settings_export(uuid), public.revoke_gps_consent(),
  public.grant_gps_consent(), public.my_gps_consent() from public, anon, authenticated;
grant execute on function public.grant_gps_consent(), public.my_gps_consent() to authenticated, service_role;
grant execute on function public.my_private_settings_export(uuid) to service_role;
grant execute on function public.revoke_gps_consent() to authenticated, service_role;
