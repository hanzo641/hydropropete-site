-- Conquête Run — joueurs, inscription, enregistrement des courses, lecture de la carte
set search_path = public, extensions;

-- Niveau à partir de l'XP totale (même formule que packages/core : 100 + 50 × (n − 1)).
create or replace function public.level_from_xp(total bigint) returns int
language plpgsql immutable as $$
declare
  lvl int := 1;
  rest bigint := greatest(total, 0);
begin
  while rest >= 100 + 50 * (lvl - 1) and lvl < 200 loop
    rest := rest - (100 + 50 * (lvl - 1));
    lvl := lvl + 1;
  end loop;
  return lvl;
end $$;

-- Garnison après érosion continue : G × (1 − taux)^jours.
create or replace function public.eroded(garrison numeric, updated_at timestamptz, at_time timestamptz default now())
returns numeric language sql stable as $$
  select round(
    garrison * power(1 - public.cfg_num('erosion.dailyRate'),
                     greatest(extract(epoch from (at_time - updated_at)), 0) / 86400.0),
    4)
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Inscription et équipes
-- ─────────────────────────────────────────────────────────────────────────────

-- Répartition des joueurs par faction dans une zone (écran de choix d'équipe).
create or replace function public.zone_faction_counts(p_zone text)
returns table (faction_id smallint, players bigint)
language sql stable security definer set search_path = public as $$
  select f.id, count(p.id)
  from public.factions f
  left join public.profiles p on p.faction_id = f.id and p.home_zone = p_zone
  where f.id <= public.cfg_num('factions.count')
  group by f.id order by f.id
$$;

-- Factions fermées dans une zone (surreprésentées), même règle que assignFaction (core).
create or replace function public.locked_factions(p_zone text)
returns smallint[] language sql stable security definer set search_path = public as $$
  with c as (select * from public.zone_faction_counts(p_zone)),
       t as (select sum(players) as total, count(*) as n from c)
  select coalesce(array_agg(c.faction_id order by c.faction_id), '{}')
  from c, t
  where t.total + 1 >= public.cfg_num('factions.balanceMinPlayers')
    and (c.players + 1)::numeric / (t.total + 1) > 1.0 / t.n + public.cfg_num('factions.balanceMargin')
$$;

create or replace function public.complete_onboarding(
  p_username text,
  p_faction smallint,
  p_zone text,
  p_birth_year int,
  p_locale text,
  p_gps_consent boolean,
  p_terms_version text
) returns public.profiles
language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := auth.uid();
  locked smallint[];
  chosen smallint;
  result public.profiles;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if exists (select 1 from public.profiles where id = uid) then
    raise exception 'already_onboarded' using errcode = 'P0001';
  end if;
  if p_birth_year is null or extract(year from now())::int - p_birth_year < 15 then
    raise exception 'too_young' using errcode = 'P0001';
  end if;
  if p_zone !~ '^84[0-9a-f]{13}$' then raise exception 'invalid_zone' using errcode = 'P0001'; end if;
  if not coalesce(p_gps_consent, false) or p_terms_version is null then
    raise exception 'consent_required' using errcode = 'P0001';
  end if;
  locked := public.locked_factions(p_zone);
  if p_faction is not null and p_faction <= public.cfg_num('factions.count') and not (p_faction = any (locked)) then
    chosen := p_faction;
  else
    -- la moins représentée dans la zone (départage déterministe par identifiant)
    select c.faction_id into chosen
    from public.zone_faction_counts(p_zone) c
    order by c.players, abs(hashtext(uid::text || c.faction_id::text)) limit 1;
  end if;
  insert into public.profiles (id, username, faction_id, home_zone, locale)
  values (uid, p_username, chosen, p_zone, coalesce(nullif(p_locale, ''), 'fr'))
  returning * into result;
  insert into public.private_settings (user_id, birth_year, gps_consent_at, terms_accepted_at, terms_version)
  values (uid, p_birth_year, now(), now(), p_terms_version);
  return result;
end $$;

-- Zone de confidentialité (arrondie à ~100 m par l'app ; rayon borné).
create or replace function public.set_privacy_zone(p_lat double precision, p_lng double precision, p_radius_m int)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  update public.private_settings
     set privacy_center = case when p_lat is null then null
                               else st_setsrid(st_makepoint(round(p_lng::numeric, 3), round(p_lat::numeric, 3)), 4326)::geography end,
         privacy_radius_m = least(greatest(coalesce(p_radius_m, 300), 200), 1000),
         updated_at = now()
   where user_id = auth.uid();
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Enregistrement d'une course (appelé par l'Edge Function submit-run, service_role)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.record_run(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_user uuid := (p ->> 'user_id')::uuid;
  v_started timestamptz := (p ->> 'started_at')::timestamptz;
  v_season public.seasons;
  v_run public.runs;
  v_troops int := coalesce((p ->> 'troops')::int, 0);
  v_validated boolean := p ->> 'status' = 'validated';
  v_new_cells int := 0;
  v_zone text;
  c jsonb;
begin
  select * into v_run from public.runs where user_id = v_user and client_run_id = p ->> 'client_run_id';
  if found then
    return jsonb_build_object('run_id', v_run.id, 'duplicate', true);
  end if;

  select * into v_season from public.seasons
   where status = 'active' and v_started between starts_at and ends_at limit 1;
  if v_season.id is null then v_troops := 0; end if;

  insert into public.runs (
    user_id, season_id, client_run_id, source, status, rejection_code, rejection_details,
    started_at, ended_at, duration_s, moving_s, distance_m, dplus_m, dplus_source,
    counted_km, counted_dplus_m, troops_earned, troops_remaining, deploy_deadline,
    cells, xp_earned, flags, fingerprint, raw_points)
  values (
    v_user, v_season.id, p ->> 'client_run_id', p ->> 'source', p ->> 'status',
    p ->> 'rejection_code', p -> 'rejection_details',
    v_started, (p ->> 'ended_at')::timestamptz, (p ->> 'duration_s')::int, (p ->> 'moving_s')::int,
    (p ->> 'distance_m')::int, (p ->> 'dplus_m')::int, p ->> 'dplus_source',
    coalesce((p ->> 'counted_km')::numeric, 0), coalesce((p ->> 'counted_dplus_m')::numeric, 0),
    v_troops, v_troops,
    case when v_troops > 0 then now() + make_interval(hours => public.cfg_num('troops.deployWindowHours')::int) end,
    coalesce((select jsonb_agg(jsonb_build_object('cell', e ->> 'cell', 'region', e ->> 'region',
                                                   'zone', e ->> 'zone', 'meters', (e ->> 'meters')::int))
              from jsonb_array_elements(p -> 'cells') e), '[]'::jsonb),
    case when v_validated then coalesce((p ->> 'xp')::int, 0) else 0 end,
    coalesce((select array_agg(x) from jsonb_array_elements_text(p -> 'flags') x), '{}'),
    p ->> 'fingerprint', (p ->> 'raw_points')::int)
  returning * into v_run;

  if p ? 'points' then
    insert into public.run_traces (run_id, user_id, points, device) values (v_run.id, v_user, p -> 'points', p -> 'device');
  end if;

  if not v_validated then
    return jsonb_build_object('run_id', v_run.id, 'status', 'rejected', 'duplicate', false);
  end if;

  for c in select * from jsonb_array_elements(coalesce(p -> 'cells', '[]'::jsonb)) loop
    insert into public.cells (h3, region, zone, center, elevation_m, elevation_source)
    values (c ->> 'cell', c ->> 'region', c ->> 'zone',
            st_setsrid(st_makepoint((c ->> 'lng')::float8, (c ->> 'lat')::float8), 4326)::geography,
            (c ->> 'elevationM')::real, c ->> 'elevationSource')
    on conflict (h3) do update
      set elevation_m = coalesce(public.cells.elevation_m, excluded.elevation_m),
          elevation_source = coalesce(public.cells.elevation_source, excluded.elevation_source);
    if v_season.id is not null and c ? 'wild' then
      insert into public.wild_cells (season_id, h3, garrison) values (v_season.id, c ->> 'cell', (c ->> 'wild')::numeric)
      on conflict do nothing;
    end if;
    insert into public.player_cells (user_id, h3) values (v_user, c ->> 'cell') on conflict do nothing;
    if found then v_new_cells := v_new_cells + 1; end if;
    v_zone := coalesce(v_zone, c ->> 'zone');
  end loop;

  update public.profiles set
    xp = xp + v_run.xp_earned,
    level = public.level_from_xp(xp + v_run.xp_earned),
    runs_count = runs_count + 1,
    total_km = total_km + coalesce(v_run.distance_m, 0) / 1000.0,
    total_dplus_m = total_dplus_m + coalesce(v_run.dplus_m, 0),
    best_pace_s_per_km = case
      when (p ->> 'pace_s_per_km') is null or coalesce(v_run.distance_m, 0) < 1000 then best_pace_s_per_km
      else least(coalesce(best_pace_s_per_km, 1e6), (p ->> 'pace_s_per_km')::numeric) end,
    early_runs = early_runs + case when (p ->> 'local_hour')::int < 7 then 1 else 0 end,
    night_runs = night_runs + case when (p ->> 'local_hour')::int >= 21 then 1 else 0 end,
    distinct_cells = distinct_cells + v_new_cells,
    updated_at = now()
  where id = v_user;

  if v_season.id is not null then
    insert into public.player_season_stats (season_id, user_id, zone, faction_id, km, dplus_m, distinct_cells, points)
    select v_season.id, v_user, coalesce(pr.home_zone, v_zone, ''), pr.faction_id,
           v_run.counted_km, v_run.counted_dplus_m, v_new_cells,
           round(v_run.counted_km * public.cfg_num('score.perKm'))
      from public.profiles pr where pr.id = v_user
    on conflict (season_id, user_id) do update set
      km = player_season_stats.km + excluded.km,
      dplus_m = player_season_stats.dplus_m + excluded.dplus_m,
      distinct_cells = player_season_stats.distinct_cells + excluded.distinct_cells,
      points = player_season_stats.points + excluded.points;
  end if;

  return jsonb_build_object(
    'run_id', v_run.id, 'status', 'validated', 'duplicate', false,
    'troops', v_run.troops_earned, 'deploy_deadline', v_run.deploy_deadline,
    'season_id', v_season.id, 'new_cells', v_new_cells);
end $$;

create or replace function public.award_trophies(p_user uuid, p_ids text[], p_xp int)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.trophies_earned (user_id, trophy_id)
  select p_user, unnest(p_ids) on conflict do nothing;
  update public.profiles set xp = xp + p_xp, level = public.level_from_xp(xp + p_xp) where id = p_user;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Lecture de la carte par zone visible
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.hexes_in_bbox(
  p_south double precision, p_west double precision, p_north double precision, p_east double precision,
  p_limit int default 5000
) returns table (
  h3 text, region text, zone text, owner_faction smallint, garrison numeric,
  wild_garrison numeric, elevation_m real, last_attacked_at timestamptz, contested boolean
)
language sql stable security invoker set search_path = public, extensions as $$
  select c.h3, c.region, c.zone, hs.owner_faction,
         case when hs.h3 is null then null else public.eroded(hs.garrison, hs.updated_at) end,
         w.garrison, c.elevation_m, hs.last_attacked_at,
         coalesce(hs.last_attacked_at > now() - interval '24 hours', false)
  from public.cells c
  left join public.hex_state hs on hs.h3 = c.h3 and hs.season_id = public.current_season_id()
  left join public.wild_cells w on w.h3 = c.h3 and w.season_id = public.current_season_id()
  where c.center && st_makeenvelope(p_west, p_south, p_east, p_north, 4326)::geography
  limit least(p_limit, 5000)
$$;

-- Droits d'exécution : tout est fermé par défaut, on ouvre au cas par cas.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.game_defaults(), public.cfg(text), public.cfg_num(text),
  public.current_season_id(), public.level_from_xp(bigint), public.eroded(numeric, timestamptz, timestamptz)
  to anon, authenticated;
grant execute on function public.zone_faction_counts(text), public.locked_factions(text),
  public.complete_onboarding(text, smallint, text, int, text, boolean, text),
  public.set_privacy_zone(double precision, double precision, int),
  public.hexes_in_bbox(double precision, double precision, double precision, double precision, int)
  to authenticated;
grant execute on all functions in schema public to service_role;
