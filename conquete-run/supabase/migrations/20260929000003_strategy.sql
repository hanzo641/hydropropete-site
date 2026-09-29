-- Conquête Run — couche stratégique : combat atomique, érosion, régions, saisons,
-- fil d'actualité, classements. Mêmes règles que packages/core (parité vérifiée par
-- supabase/tests/database/10_parity_vectors.test.sql, généré depuis test-data/vectors).
set search_path = public, extensions;

-- ─────────────────────────────────────────────────────────────────────────────
-- Règles pures (miroir de core/game/combat.ts)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.effective_troops(p_troops int, p_controls_region boolean)
returns numeric language sql stable as $$
  select round(case when p_controls_region then p_troops * (1 + public.cfg_num('region.troopBonus')) else p_troops end, 4)
$$;

-- Résout un envoi de troupes : renfort (allié) ou attaque (ennemi / sauvage / neutre).
create or replace function public.apply_attack(
  p_owner smallint, p_garrison numeric, p_attacker smallint, p_troops numeric,
  out outcome text, out owner smallint, out garrison numeric
) language plpgsql stable as $$
declare
  def numeric := public.cfg_num('combat.defenseMultiplier');
  g numeric := round(p_garrison, 4);
  needed numeric;
  left_ numeric;
begin
  if p_owner is not distinct from p_attacker then
    outcome := 'reinforced';
    owner := p_attacker;
    garrison := round(least(public.cfg_num('combat.maxGarrison'), g + p_troops), 4);
    return;
  end if;
  needed := g * def;
  if p_troops >= needed then
    outcome := 'captured';
    owner := p_attacker;
    garrison := round(least(public.cfg_num('combat.maxGarrison'),
                            greatest(public.cfg_num('combat.minGarrisonAfterCapture'), p_troops - needed)), 4);
    return;
  end if;
  left_ := round(greatest(0, g - p_troops / def), 4);
  outcome := 'damaged';
  owner := case when left_ < public.cfg_num('erosion.abandonThreshold') then null else p_owner end;
  garrison := left_;
end $$;

-- Contrôle d'une région : ≥ seuil des 49 territoires ET strictement plus que toute autre faction.
create or replace function public.region_controller_of(p_season bigint, p_region text)
returns smallint language sql stable as $$
  with counts as (
    select owner_faction as f, count(*) as n
    from public.hex_state
    where season_id = p_season and region = p_region and owner_faction is not null
    group by owner_faction
  ), ranked as (
    select f, n, rank() over (order by n desc) as r, count(*) over (partition by n) as ties from counts
  )
  select f from ranked
  where r = 1 and ties = 1
    and n::numeric / power(7, public.cfg_num('h3.territoryRes') - public.cfg_num('h3.regionRes'))
        >= public.cfg_num('region.controlThreshold')
$$;

-- Recalcule le contrôle d'une région ; renvoie (ancienne, nouvelle) faction.
create or replace function public.recompute_region(p_season bigint, p_region text, out old_faction smallint, out new_faction smallint)
language plpgsql as $$
begin
  select faction_id into old_faction from public.region_control where season_id = p_season and region = p_region;
  new_faction := public.region_controller_of(p_season, p_region);
  if new_faction is null then
    delete from public.region_control where season_id = p_season and region = p_region;
  elsif old_faction is distinct from new_faction then
    insert into public.region_control (season_id, region, faction_id, since) values (p_season, p_region, new_faction, now())
    on conflict (season_id, region) do update set faction_id = excluded.faction_id, since = excluded.since;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Déploiement
-- ─────────────────────────────────────────────────────────────────────────────

-- État courant d'un territoire (érosion appliquée ; garnison sauvage sinon).
create or replace function public.hex_now(p_season bigint, p_h3 text, out owner smallint, out garrison numeric)
language plpgsql stable as $$
#variable_conflict use_column
begin
  select hs.owner_faction, public.eroded(hs.garrison, hs.updated_at) into owner, garrison
  from public.hex_state hs where hs.season_id = p_season and hs.h3 = p_h3;
  if not found then
    owner := null;
    select w.garrison into garrison from public.wild_cells w where w.season_id = p_season and w.h3 = p_h3;
    garrison := coalesce(garrison, public.cfg_num('wild.base'));
  end if;
end $$;

-- Cibles possibles d'une course : ses cases traversées et leur état actuel.
create or replace function public.deploy_targets(p_run uuid)
returns table (h3 text, region text, owner_faction smallint, garrison numeric, region_controller smallint)
language sql stable security definer set search_path = public, extensions as $$
  select c ->> 'cell', c ->> 'region', h.owner, h.garrison, rc.faction_id
  from public.runs r
  cross join lateral jsonb_array_elements(r.cells) c
  cross join lateral public.hex_now(r.season_id, c ->> 'cell') h
  left join public.region_control rc on rc.season_id = r.season_id and rc.region = c ->> 'region'
  where r.id = p_run and r.user_id = auth.uid()
$$;

-- Déploie les troupes d'une course, de façon atomique (verrou par territoire).
create or replace function public.deploy_troops(p_run uuid, p_allocations jsonb)
returns table (h3 text, troops int, effective numeric, outcome text,
               before_owner smallint, before_garrison numeric, after_owner smallint, after_garrison numeric)
language plpgsql security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  v_run public.runs;
  v_profile public.profiles;
  v_total int;
  a record;
  cell jsonb;
  cur record;
  res record;
  eff numeric;
  v_controls boolean;
  v_captures int := 0;
  v_reinforcements int := 0;
  v_wild_captures int := 0;
  v_troops int := 0;
  v_first_capture text;
  v_regions text[] := '{}';
  v_private boolean := false;
  v_max_alt int := 0;
  v_zone text;
  rr record;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into v_run from public.runs where id = p_run and user_id = uid for update;
  if not found then raise exception 'run_not_found' using errcode = 'P0001'; end if;
  if v_run.status <> 'validated' or v_run.season_id is null
     or not exists (select 1 from public.seasons s where s.id = v_run.season_id and s.status = 'active') then
    raise exception 'no_active_season' using errcode = 'P0001';
  end if;
  if v_run.deploy_deadline is null or v_run.deploy_deadline < now() then
    raise exception 'deadline_passed' using errcode = 'P0001';
  end if;
  select * into v_profile from public.profiles where id = uid;

  -- validation des allocations (mêmes règles que validateAllocations côté app)
  if jsonb_typeof(p_allocations) <> 'array' or jsonb_array_length(p_allocations) = 0 then
    raise exception 'empty' using errcode = 'P0001';
  end if;
  if exists (select 1 from jsonb_array_elements(p_allocations) e
             where jsonb_typeof(e -> 'troops') <> 'number' or (e ->> 'troops')::numeric <= 0
                or (e ->> 'troops')::numeric <> floor((e ->> 'troops')::numeric)) then
    raise exception 'invalid_troops' using errcode = 'P0001';
  end if;
  if (select count(*) <> count(distinct e ->> 'cell') from jsonb_array_elements(p_allocations) e) then
    raise exception 'duplicate_cell' using errcode = 'P0001';
  end if;
  if exists (select 1 from jsonb_array_elements(p_allocations) e
             where not exists (select 1 from jsonb_array_elements(v_run.cells) c where c ->> 'cell' = e ->> 'cell')) then
    raise exception 'not_crossed' using errcode = 'P0001';
  end if;
  select sum((e ->> 'troops')::int) into v_total from jsonb_array_elements(p_allocations) e;
  if v_total > v_run.troops_remaining then raise exception 'too_many_troops' using errcode = 'P0001'; end if;

  -- résolution, case par case, dans un ordre stable (évite les interblocages)
  for a in
    select e ->> 'cell' as cell, (e ->> 'troops')::int as n
    from jsonb_array_elements(p_allocations) e order by e ->> 'cell'
  loop
    select c into cell from jsonb_array_elements(v_run.cells) c where c ->> 'cell' = a.cell limit 1;
    perform pg_advisory_xact_lock(hashtextextended(v_run.season_id::text || ':' || a.cell, 0));
    select * into cur from public.hex_now(v_run.season_id, a.cell);
    v_controls := exists (select 1 from public.region_control rc
                          where rc.season_id = v_run.season_id and rc.region = cell ->> 'region'
                            and rc.faction_id = v_profile.faction_id);
    eff := public.effective_troops(a.n, v_controls);
    select * into res from public.apply_attack(cur.owner, cur.garrison, v_profile.faction_id, eff);

    insert into public.hex_state as hs (season_id, h3, region, zone, owner_faction, garrison, updated_at, captured_at, last_attacked_at)
    values (v_run.season_id, a.cell, cell ->> 'region', cell ->> 'zone', res.owner, res.garrison, now(),
            case when res.outcome = 'captured' then now() end,
            case when res.outcome <> 'reinforced' then now() end)
    on conflict (season_id, h3) do update set
      owner_faction = excluded.owner_faction,
      garrison = excluded.garrison,
      updated_at = now(),
      captured_at = coalesce(excluded.captured_at, hs.captured_at),
      last_attacked_at = coalesce(excluded.last_attacked_at, hs.last_attacked_at);

    insert into public.deployments (run_id, user_id, season_id, h3, troops, effective, outcome,
                                    before_owner, before_garrison, after_owner, after_garrison)
    values (p_run, uid, v_run.season_id, a.cell, a.n, eff, res.outcome, cur.owner, cur.garrison, res.owner, res.garrison);

    v_troops := v_troops + a.n;
    if res.outcome = 'captured' then
      v_captures := v_captures + 1;
      if cur.owner is null then v_wild_captures := v_wild_captures + 1; end if;
      v_first_capture := coalesce(v_first_capture, a.cell);
      v_max_alt := greatest(v_max_alt, coalesce((select elevation_m::int from public.cells where cells.h3 = a.cell), 0));
      if exists (select 1 from public.private_settings ps join public.cells c2 on c2.h3 = a.cell
                 where ps.user_id = uid and ps.privacy_center is not null
                   and st_dwithin(ps.privacy_center, c2.center, ps.privacy_radius_m + 600)) then
        v_private := true;
      end if;
    elsif res.outcome = 'reinforced' then
      v_reinforcements := v_reinforcements + 1;
    end if;
    if not (cell ->> 'region' = any (v_regions)) then v_regions := v_regions || (cell ->> 'region'); end if;
    v_zone := coalesce(v_zone, cell ->> 'zone');

    h3 := a.cell; troops := a.n; effective := eff; outcome := res.outcome;
    before_owner := cur.owner; before_garrison := cur.garrison; after_owner := res.owner; after_garrison := res.garrison;
    return next;
  end loop;

  update public.runs set troops_remaining = troops_remaining - v_total where id = p_run;

  -- contrôle des régions touchées + événements
  for rr in select r.region, x.old_faction, x.new_faction
            from unnest(v_regions) as r(region), lateral public.recompute_region(v_run.season_id, r.region) x loop
    if rr.new_faction is distinct from rr.old_faction then
      if rr.new_faction is not null then
        insert into public.events (season_id, zone, kind, faction_id, actor_id, actor_name, region, payload)
        values (v_run.season_id, v_zone, 'region_gained', rr.new_faction, null, null, rr.region, '{}'::jsonb);
        if rr.new_faction = v_profile.faction_id then
          update public.profiles set regions_taken = regions_taken + 1 where id = uid;
          update public.player_season_stats set regions_taken = regions_taken + 1 where season_id = v_run.season_id and user_id = uid;
        end if;
      end if;
      if rr.old_faction is not null then
        insert into public.events (season_id, zone, kind, faction_id, region, payload)
        values (v_run.season_id, v_zone, 'region_lost', rr.old_faction, rr.region, '{}'::jsonb);
      end if;
    end if;
  end loop;

  if v_captures > 0 then
    insert into public.events (season_id, zone, kind, faction_id, actor_id, actor_name, h3, payload)
    values (v_run.season_id, v_zone, 'capture', v_profile.faction_id,
            case when v_private then null else uid end,
            case when v_private then null else v_profile.username end,
            case when v_private then null else v_first_capture end,
            jsonb_build_object('count', v_captures));
  elsif v_reinforcements >= 3 then
    insert into public.events (season_id, zone, kind, faction_id, actor_id, actor_name, payload)
    values (v_run.season_id, v_zone, 'defense', v_profile.faction_id,
            case when v_private then null else uid end,
            case when v_private then null else v_profile.username end,
            jsonb_build_object('count', v_reinforcements));
  end if;

  update public.profiles set
    captures_count = captures_count + v_captures,
    max_altitude_captured_m = greatest(max_altitude_captured_m, v_max_alt),
    xp = xp + v_captures * public.cfg_num('xp.perCapture')::int + v_reinforcements * public.cfg_num('xp.perReinforce')::int,
    level = public.level_from_xp(xp + v_captures * public.cfg_num('xp.perCapture')::int
                                    + v_reinforcements * public.cfg_num('xp.perReinforce')::int)
  where id = uid;

  insert into public.player_season_stats (season_id, user_id, zone, faction_id, captures, troops_deployed, reinforcements, points)
  values (v_run.season_id, uid, coalesce(v_profile.home_zone, v_zone), v_profile.faction_id, v_captures, v_troops, v_reinforcements,
          v_captures * public.cfg_num('score.perCapture')::int + v_troops * public.cfg_num('score.perTroopDeployed')::int)
  on conflict (season_id, user_id) do update set
    captures = player_season_stats.captures + excluded.captures,
    troops_deployed = player_season_stats.troops_deployed + excluded.troops_deployed,
    reinforcements = player_season_stats.reinforcements + excluded.reinforcements,
    points = player_season_stats.points + excluded.points;

  -- trace de la progression hebdomadaire des défis « territoires sauvages »
  if v_wild_captures > 0 then
    update public.runs set flags = array_append(flags, 'wild_captures:' || v_wild_captures) where id = p_run;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Érosion quotidienne, saisons
-- ─────────────────────────────────────────────────────────────────────────────

-- Matérialise l'érosion, libère les territoires abandonnés, fige le score du jour.
create or replace function public.daily_tick(p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  s public.seasons;
  v_abandoned int := 0;
  v_regions text[];
  r text;
begin
  -- ouverture / fermeture des saisons
  for s in select * from public.seasons where status = 'active' and ends_at <= p_now loop
    perform public.close_season(s.id);
  end loop;
  update public.seasons set status = 'active'
   where id = (select id from public.seasons where status = 'upcoming' and starts_at <= p_now order by starts_at limit 1)
     and not exists (select 1 from public.seasons where status = 'active');

  select * into s from public.seasons where status = 'active' limit 1;
  if s.id is not null then
    update public.hex_state set garrison = public.eroded(garrison, updated_at, p_now), updated_at = p_now
     where season_id = s.id;
    with gone as (
      delete from public.hex_state
       where season_id = s.id and garrison < public.cfg_num('erosion.abandonThreshold')
      returning region
    )
    select count(*), array_agg(distinct region) into v_abandoned, v_regions from gone;
    foreach r in array coalesce(v_regions, '{}') loop
      perform public.recompute_region(s.id, r);
    end loop;
    insert into public.zone_daily_scores (season_id, day, zone, faction_id, hexes)
    select s.id, (p_now at time zone 'UTC')::date, zone, owner_faction, count(*)
      from public.hex_state where season_id = s.id and owner_faction is not null
     group by zone, owner_faction
    on conflict (season_id, day, zone, faction_id) do update set hexes = excluded.hexes;
  end if;

  -- troupes non déployées dans les délais : perdues
  update public.runs set troops_remaining = 0 where troops_remaining > 0 and deploy_deadline < p_now;
  -- minimisation RGPD : purge des traces brutes anciennes
  delete from public.run_traces
   where created_at < p_now - make_interval(days => public.cfg_num('antiCheat.rawTraceRetentionDays')::int);

  return jsonb_build_object('season', s.id, 'abandoned', v_abandoned);
end $$;

-- Clôture d'une saison : titres par zone, faction gagnante par zone, événement de fin.
create or replace function public.close_season(p_season bigint)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  update public.seasons set status = 'closed' where id = p_season;
  insert into public.season_awards (season_id, user_id, zone, faction_id, title)
  select p_season, x.user_id, x.zone, x.faction_id, x.title from (
    select distinct on (zone, title) zone, title, user_id, faction_id from (
      select zone, 'conqueror' as title, user_id, faction_id, points::numeric as v from public.player_season_stats where season_id = p_season
      union all select zone, 'strategist', user_id, faction_id, regions_taken from public.player_season_stats where season_id = p_season
      union all select zone, 'builder', user_id, faction_id, reinforcements from public.player_season_stats where season_id = p_season
      union all select zone, 'explorer', user_id, faction_id, distinct_cells from public.player_season_stats where season_id = p_season
      union all select zone, 'sherpa', user_id, faction_id, dplus_m from public.player_season_stats where season_id = p_season
    ) c where v > 0
    order by zone, title, v desc, user_id
  ) x;
  insert into public.season_awards (season_id, user_id, zone, faction_id, title)
  select distinct on (zone) p_season, null::uuid, zone, faction_id, 'zone_winner'
    from (select zone, faction_id, sum(hexes) as pts from public.zone_daily_scores where season_id = p_season group by zone, faction_id) z
   order by zone, pts desc, faction_id;
  insert into public.events (season_id, zone, kind, faction_id, payload)
  select p_season, zone, 'season_end', faction_id, '{}'::jsonb from public.season_awards
   where season_id = p_season and title = 'zone_winner';
end $$;

-- Création d'une saison (administration, via service_role ou SQL editor).
create or replace function public.create_season(p_name text, p_starts_at timestamptz, p_is_demo boolean default false,
                                                p_overrides jsonb default '{}'::jsonb)
returns public.seasons language plpgsql security definer set search_path = public, extensions as $$
declare
  s public.seasons;
begin
  insert into public.seasons (name, starts_at, ends_at, status, is_demo, config_overrides)
  values (p_name, p_starts_at, p_starts_at + make_interval(days => public.cfg_num('season.lengthDays')::int),
          case when p_starts_at <= now() and not exists (select 1 from public.seasons where status = 'active')
               then 'active' else 'upcoming' end,
          p_is_demo, p_overrides)
  returning * into s;
  return s;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Classements, équipe, défis, confidentialité (lecture)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.zone_leaderboard(p_zone text, p_limit int default 30)
returns table (user_id uuid, username text, faction_id smallint, points int, captures int, rank bigint)
language sql stable security definer set search_path = public as $$
  select ps.user_id, p.username, ps.faction_id, ps.points, ps.captures,
         rank() over (order by ps.points desc)
  from public.player_season_stats ps join public.profiles p on p.id = ps.user_id
  where ps.season_id = public.current_season_id() and ps.zone = p_zone
  order by ps.points desc, p.username
  limit least(p_limit, 100)
$$;

-- Score des factions (territoire-jours) et territoires tenus, pour une zone ou le monde (null).
create or replace function public.faction_scores(p_zone text default null)
returns table (faction_id smallint, territory_days bigint, hexes_now bigint)
language sql stable security definer set search_path = public as $$
  select f.id,
         coalesce((select sum(z.hexes) from public.zone_daily_scores z
                   where z.season_id = public.current_season_id() and z.faction_id = f.id
                     and (p_zone is null or z.zone = p_zone)), 0)::bigint,
         (select count(*) from public.hex_state h
           where h.season_id = public.current_season_id() and h.owner_faction = f.id
             and (p_zone is null or h.zone = p_zone))
  from public.factions f
  where f.id <= public.cfg_num('factions.count')
  order by 2 desc, 3 desc, f.id
$$;

create or replace function public.team_overview(p_zone text)
returns jsonb language sql stable security definer set search_path = public as $$
  with me as (select faction_id from public.profiles where id = auth.uid())
  select jsonb_build_object(
    'members', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username, 'level', p.level)
                                          order by p.level desc, p.username)
                         from public.profiles p, me where p.home_zone = p_zone and p.faction_id = me.faction_id), '[]'::jsonb),
    'hexes', (select count(*) from public.hex_state h, me
              where h.season_id = public.current_season_id() and h.zone = p_zone and h.owner_faction = me.faction_id),
    'regions', (select count(distinct rc.region) from public.region_control rc
                join public.hex_state h on h.season_id = rc.season_id and h.region = rc.region, me
                where rc.season_id = public.current_season_id() and h.zone = p_zone and rc.faction_id = me.faction_id)
  )
$$;

-- Progression des défis de la semaine (lundi 00:00 UTC).
create or replace function public.my_weekly_progress()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'distance', coalesce((select sum(counted_km) from public.runs where user_id = auth.uid() and status = 'validated'
                          and started_at >= date_trunc('week', now())), 0),
    'dplus', coalesce((select sum(counted_dplus_m) from public.runs where user_id = auth.uid() and status = 'validated'
                       and started_at >= date_trunc('week', now())), 0),
    'wild_captures', (select count(*) from public.deployments where user_id = auth.uid() and outcome = 'captured'
                      and before_owner is null and created_at >= date_trunc('week', now())),
    'new_cells', (select count(*) from public.player_cells where user_id = auth.uid() and first_seen >= date_trunc('week', now()))
  )
$$;

create or replace function public.my_privacy_settings()
returns table (privacy_radius_m int, has_zone boolean)
language sql stable security definer set search_path = public as $$
  select privacy_radius_m, privacy_center is not null from public.private_settings where user_id = auth.uid()
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Droits
-- ─────────────────────────────────────────────────────────────────────────────
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.game_defaults(), public.cfg(text), public.cfg_num(text),
  public.current_season_id(), public.level_from_xp(bigint), public.eroded(numeric, timestamptz, timestamptz),
  public.effective_troops(int, boolean), public.apply_attack(smallint, numeric, smallint, numeric),
  public.hex_now(bigint, text), public.region_controller_of(bigint, text)
  to anon, authenticated;
grant execute on function public.zone_faction_counts(text), public.locked_factions(text),
  public.complete_onboarding(text, smallint, text, int, text, boolean, text),
  public.set_privacy_zone(double precision, double precision, int),
  public.hexes_in_bbox(double precision, double precision, double precision, double precision, int),
  public.deploy_targets(uuid), public.deploy_troops(uuid, jsonb),
  public.zone_leaderboard(text, int), public.faction_scores(text), public.team_overview(text),
  public.my_weekly_progress(), public.my_privacy_settings()
  to authenticated;
grant execute on all functions in schema public to service_role;
