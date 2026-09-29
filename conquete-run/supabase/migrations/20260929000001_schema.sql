-- Conquête Run — schéma initial
-- Postgres + PostGIS (Supabase). Les index H3 sont stockés en texte ; les calculs H3 sont
-- faits dans les Edge Functions (h3-js), l'extension h3 n'étant pas disponible sur Supabase.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists postgis with schema extensions;

set search_path = public, extensions;

-- Les fonctions ne sont pas exécutables par défaut : chaque migration ouvre explicitement
-- les droits nécessaires (voir la fin des migrations).
alter default privileges in schema public revoke execute on functions from public;

-- ─────────────────────────────────────────────────────────────────────────────
-- Paramètres de jeu (modifiables sans redéployer l'app)
-- ─────────────────────────────────────────────────────────────────────────────

-- Valeurs par défaut : DOIVENT être identiques à DEFAULT_GAME_CONFIG (packages/core).
-- Un test Vitest le vérifie ; pour les changer, créer une nouvelle migration qui redéfinit
-- cette fonction.
create or replace function public.game_defaults() returns jsonb
language sql immutable as $$
  select '{"h3":{"territoryRes":8,"regionRes":6,"zoneRes":4},"troops":{"perKm":1,"perDplus100m":1,"deployWindowHours":48,"dailyKmCap":42,"dailyDplusCap":3000},"territory":{"minMetersInCell":30},"combat":{"defenseMultiplier":1.2,"minGarrisonAfterCapture":1,"maxGarrison":60},"erosion":{"dailyRate":0.05,"abandonThreshold":1},"region":{"controlThreshold":0.5,"troopBonus":0.1},"wild":{"base":1,"altitudeStartM":300,"altitudeStepM":400,"jitter":1,"max":6},"factions":{"count":3,"balanceMargin":0.1,"balanceMinPlayers":6},"season":{"lengthDays":28},"xp":{"perKm":10,"per10mDplus":1,"perActiveMinute":2,"perCapture":15,"perReinforce":3},"score":{"perCapture":10,"perTroopDeployed":1,"perKm":1},"privacy":{"defaultRadiusM":300,"minRadiusM":200,"maxRadiusM":1000,"trimStartEndM":200},"gps":{"baseAccuracyM":20,"adaptiveAccuracyMaxM":35,"maxAccuracyM":50,"maxRunnerSpeedMps":9,"processNoise":1.2,"accuracyToSigma":0.5,"gapS":15,"reanchorAfter":5,"marginSigmaK":1,"minStepM":2.5,"stationarySpeedMps":0.35,"paceWindowS":30,"liveDplusHysteresisM":10,"liveSmoothingLag":10},"antiCheat":{"vehicleSpeedKmh":20,"vehicleWindowS":180,"maxAccelerationMps2":6,"maxAccelerationEvents":20,"maxRejectedRatio":0.4,"maxDurationH":12,"maxUploadDelayDays":7,"maxFutureSkewS":300,"minPoints":30,"maxPoints":60000,"minDistanceM":300,"maxRunnerSpeedMps":9,"teleportMinM":300,"allowSimulatedRuns":false,"rawTraceRetentionDays":90}}'::jsonb
$$;

create table public.game_config (
  id smallint primary key default 1 check (id = 1),
  -- surcharges : seules les clés présentes remplacent les valeurs par défaut
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.game_config (id) values (1);

-- ─────────────────────────────────────────────────────────────────────────────
-- Factions, saisons
-- ─────────────────────────────────────────────────────────────────────────────

create table public.factions (
  id smallint primary key,
  slug text not null unique,
  color text not null,
  name_fr text not null,
  name_en text not null
);
insert into public.factions values
  (1, 'braise', '#E4572E', 'Braise', 'Ember'),
  (2, 'sylve', '#2BA84A', 'Sylve', 'Grove'),
  (3, 'maree', '#2E86DE', 'Marée', 'Tide'),
  (4, 'ambre', '#F2B705', 'Ambre', 'Amber');

create table public.seasons (
  id bigint generated always as identity primary key,
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  status text not null default 'upcoming' check (status in ('upcoming', 'active', 'closed')),
  -- graine de la variation des garnisons sauvages (re-tirée à chaque saison)
  wild_seed text not null default encode(extensions.gen_random_bytes(8), 'hex'),
  config_overrides jsonb not null default '{}'::jsonb,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index seasons_one_active on public.seasons ((true)) where status = 'active';

create or replace function public.current_season_id() returns bigint
language sql stable as $$
  select id from public.seasons where status = 'active' limit 1
$$;

-- Valeur de config effective : saison active > game_config > défauts. Chemin « a.b ».
create or replace function public.cfg(path text) returns jsonb
language sql stable as $$
  select coalesce(
    (select config_overrides #> string_to_array(path, '.') from public.seasons where status = 'active' limit 1),
    (select config #> string_to_array(path, '.') from public.game_config where id = 1),
    public.game_defaults() #> string_to_array(path, '.')
  )
$$;

create or replace function public.cfg_num(path text) returns numeric
language sql stable as $$ select (public.cfg(path) #>> '{}')::numeric $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Joueurs
-- ─────────────────────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[A-Za-z0-9_.À-ÖØ-öø-ÿ-]{3,20}$'),
  faction_id smallint references public.factions (id),
  -- cellule H3 de zone (rés. 4, ~1 770 km²) : seule donnée de localisation publique
  home_zone text,
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  xp bigint not null default 0,
  level int not null default 1,
  runs_count int not null default 0,
  total_km numeric(10, 3) not null default 0,
  total_dplus_m numeric(10, 1) not null default 0,
  captures_count int not null default 0,
  regions_taken int not null default 0,
  max_altitude_captured_m int not null default 0,
  best_pace_s_per_km numeric(8, 2),
  early_runs int not null default 0,
  night_runs int not null default 0,
  distinct_cells int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_zone_faction on public.profiles (home_zone, faction_id);

-- Données privées : visibles uniquement par leur propriétaire.
create table public.private_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  birth_year int not null,
  -- zone de confidentialité (domicile), arrondie à ~100 m côté app
  privacy_center extensions.geography(Point, 4326),
  privacy_radius_m int not null default 300 check (privacy_radius_m between 200 and 1000),
  gps_consent_at timestamptz,
  terms_accepted_at timestamptz,
  terms_version text,
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Carte
-- ─────────────────────────────────────────────────────────────────────────────

-- Registre des cellules connues (traversées au moins une fois) : centre et altitude.
create table public.cells (
  h3 text primary key,
  region text not null,
  zone text not null,
  center extensions.geography(Point, 4326) not null,
  elevation_m real,
  elevation_source text,
  updated_at timestamptz not null default now()
);
create index cells_center_gix on public.cells using gist (center);
create index cells_region on public.cells (region);

-- Garnisons sauvages connues (calculées par l'Edge Function : altitude + graine de saison).
create table public.wild_cells (
  season_id bigint not null references public.seasons (id) on delete cascade,
  h3 text not null references public.cells (h3) on delete cascade,
  garrison numeric(10, 4) not null,
  primary key (season_id, h3)
);

-- État des territoires : SEULS les territoires conquis / modifiés sont stockés.
create table public.hex_state (
  season_id bigint not null references public.seasons (id) on delete cascade,
  h3 text not null references public.cells (h3),
  region text not null,
  zone text not null,
  owner_faction smallint references public.factions (id),
  garrison numeric(10, 4) not null check (garrison >= 0),
  updated_at timestamptz not null default now(),
  captured_at timestamptz,
  last_attacked_at timestamptz,
  primary key (season_id, h3)
);
create index hex_state_region on public.hex_state (season_id, region);
create index hex_state_zone on public.hex_state (season_id, zone);

create table public.region_control (
  season_id bigint not null references public.seasons (id) on delete cascade,
  region text not null,
  faction_id smallint not null references public.factions (id),
  since timestamptz not null default now(),
  primary key (season_id, region)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Courses
-- ─────────────────────────────────────────────────────────────────────────────

create table public.runs (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  season_id bigint references public.seasons (id) on delete set null,
  client_run_id text not null,
  source text not null check (source in ('gps', 'simulation', 'healthkit', 'health_connect')),
  status text not null check (status in ('validated', 'rejected')),
  rejection_code text,
  rejection_details jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  duration_s int,
  moving_s int,
  distance_m int,
  dplus_m int,
  dplus_source text,
  counted_km numeric(8, 3) not null default 0,
  counted_dplus_m numeric(8, 1) not null default 0,
  troops_earned int not null default 0,
  troops_remaining int not null default 0 check (troops_remaining >= 0),
  deploy_deadline timestamptz,
  -- cases traversées : [{"cell","region","zone","meters"}]
  cells jsonb not null default '[]'::jsonb,
  xp_earned int not null default 0,
  flags text[] not null default '{}',
  fingerprint text,
  raw_points int,
  created_at timestamptz not null default now(),
  unique (user_id, client_run_id)
);
create index runs_user_started on public.runs (user_id, started_at desc);
create index runs_fingerprint on public.runs (fingerprint);

-- Trace brute (données sensibles) : propriétaire uniquement, purgée après N jours.
create table public.run_traces (
  run_id uuid primary key references public.runs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  points jsonb not null,
  device jsonb,
  created_at timestamptz not null default now()
);

create table public.player_cells (
  user_id uuid not null references public.profiles (id) on delete cascade,
  h3 text not null,
  first_seen timestamptz not null default now(),
  primary key (user_id, h3)
);

create table public.deployments (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.runs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  season_id bigint not null references public.seasons (id) on delete cascade,
  h3 text not null,
  troops int not null check (troops > 0),
  effective numeric(10, 4) not null,
  outcome text not null check (outcome in ('reinforced', 'captured', 'damaged')),
  before_owner smallint,
  before_garrison numeric(10, 4),
  after_owner smallint,
  after_garrison numeric(10, 4),
  created_at timestamptz not null default now()
);
create index deployments_user on public.deployments (user_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Social, saisons
-- ─────────────────────────────────────────────────────────────────────────────

create table public.events (
  id bigint generated always as identity primary key,
  season_id bigint not null references public.seasons (id) on delete cascade,
  zone text not null,
  kind text not null check (kind in ('capture', 'region_gained', 'region_lost', 'defense', 'season_end')),
  faction_id smallint references public.factions (id),
  -- null si l'action a eu lieu dans la zone de confidentialité de l'acteur
  actor_id uuid references public.profiles (id) on delete set null,
  actor_name text,
  h3 text,
  region text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index events_zone on public.events (season_id, zone, created_at desc);

create table public.zone_daily_scores (
  season_id bigint not null references public.seasons (id) on delete cascade,
  day date not null,
  zone text not null,
  faction_id smallint not null references public.factions (id),
  hexes int not null,
  primary key (season_id, day, zone, faction_id)
);

create table public.player_season_stats (
  season_id bigint not null references public.seasons (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  zone text not null,
  faction_id smallint references public.factions (id),
  points int not null default 0,
  captures int not null default 0,
  troops_deployed int not null default 0,
  reinforcements int not null default 0,
  regions_taken int not null default 0,
  km numeric(10, 3) not null default 0,
  dplus_m numeric(10, 1) not null default 0,
  distinct_cells int not null default 0,
  primary key (season_id, user_id)
);
create index player_season_stats_zone on public.player_season_stats (season_id, zone, points desc);

create table public.trophies_earned (
  user_id uuid not null references public.profiles (id) on delete cascade,
  trophy_id text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, trophy_id)
);

create table public.season_awards (
  season_id bigint not null references public.seasons (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  zone text not null,
  faction_id smallint references public.factions (id),
  title text not null,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Sécurité : RLS partout. Aucune écriture directe du client sur les tables de jeu.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.game_config enable row level security;
alter table public.factions enable row level security;
alter table public.seasons enable row level security;
alter table public.profiles enable row level security;
alter table public.private_settings enable row level security;
alter table public.cells enable row level security;
alter table public.wild_cells enable row level security;
alter table public.hex_state enable row level security;
alter table public.region_control enable row level security;
alter table public.runs enable row level security;
alter table public.run_traces enable row level security;
alter table public.player_cells enable row level security;
alter table public.deployments enable row level security;
alter table public.events enable row level security;
alter table public.zone_daily_scores enable row level security;
alter table public.player_season_stats enable row level security;
alter table public.trophies_earned enable row level security;
alter table public.season_awards enable row level security;

-- Lecture publique (même sans compte) : paramètres, factions, saisons.
create policy "lecture publique" on public.game_config for select to anon, authenticated using (true);
create policy "lecture publique" on public.factions for select to anon, authenticated using (true);
create policy "lecture publique" on public.seasons for select to anon, authenticated using (true);

-- Lecture pour les joueurs connectés : carte, classements, fil, profils publics.
create policy "joueurs" on public.profiles for select to authenticated using (true);
create policy "joueurs" on public.cells for select to authenticated using (true);
create policy "joueurs" on public.wild_cells for select to authenticated using (true);
create policy "joueurs" on public.hex_state for select to authenticated using (true);
create policy "joueurs" on public.region_control for select to authenticated using (true);
create policy "joueurs" on public.events for select to authenticated using (true);
create policy "joueurs" on public.zone_daily_scores for select to authenticated using (true);
create policy "joueurs" on public.player_season_stats for select to authenticated using (true);
create policy "joueurs" on public.trophies_earned for select to authenticated using (true);
create policy "joueurs" on public.season_awards for select to authenticated using (true);

-- Données personnelles : propriétaire uniquement.
create policy "propriétaire" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "propriétaire" on public.private_settings for select to authenticated using (user_id = auth.uid());
create policy "propriétaire (maj)" on public.private_settings for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "propriétaire" on public.runs for select to authenticated using (user_id = auth.uid());
create policy "propriétaire" on public.run_traces for select to authenticated using (user_id = auth.uid());
create policy "propriétaire" on public.player_cells for select to authenticated using (user_id = auth.uid());
create policy "propriétaire" on public.deployments for select to authenticated using (user_id = auth.uid());

-- Privilèges de table (en plus des politiques) : lecture, et seules colonnes modifiables.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.game_config, public.factions, public.seasons to anon, authenticated;
grant select on public.profiles, public.private_settings, public.cells, public.wild_cells, public.hex_state,
  public.region_control, public.runs, public.run_traces, public.player_cells, public.deployments,
  public.events, public.zone_daily_scores, public.player_season_stats, public.trophies_earned,
  public.season_awards to authenticated;
grant update (username, locale, updated_at) on public.profiles to authenticated;
grant update (privacy_center, privacy_radius_m, updated_at) on public.private_settings to authenticated;
grant all on all tables in schema public to service_role;
grant usage on all sequences in schema public to service_role;

-- Carte en direct
alter publication supabase_realtime add table public.hex_state, public.events, public.region_control;
