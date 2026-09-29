-- Conquête Run v2 — la Guerre des Foulées : Braise contre Marée, série, front du jour,
-- némésis, score de guerre éternelle.
set search_path = public, extensions;

-- Valeurs par défaut v2 (DOIVENT être identiques à DEFAULT_GAME_CONFIG ; test de cohérence).
create or replace function public.game_defaults() returns jsonb
language sql immutable as $$
  select '{"h3":{"territoryRes":8,"regionRes":6,"zoneRes":4},"troops":{"perKm":1,"perDplus100m":1,"deployWindowHours":48,"dailyKmCap":42,"dailyDplusCap":3000},"territory":{"minMetersInCell":30},"combat":{"defenseMultiplier":1.2,"minGarrisonAfterCapture":1,"maxGarrison":60},"erosion":{"dailyRate":0.05,"abandonThreshold":1},"region":{"controlThreshold":0.5,"troopBonus":0.1},"wild":{"base":1,"altitudeStartM":300,"altitudeStepM":400,"jitter":1,"max":6},"factions":{"count":2,"balanceMargin":0.1,"balanceMinPlayers":6},"streak":{"minKm":2,"bonusPerDay":0.1,"maxBonus":0.5},"front":{"pointsMultiplier":2,"xpMultiplier":1.5},"season":{"lengthDays":28},"xp":{"perKm":10,"per10mDplus":1,"perActiveMinute":2,"perCapture":15,"perReinforce":3},"score":{"perCapture":10,"perTroopDeployed":1,"perKm":1},"privacy":{"defaultRadiusM":300,"minRadiusM":200,"maxRadiusM":1000,"trimStartEndM":200},"gps":{"baseAccuracyM":20,"adaptiveAccuracyMaxM":35,"maxAccuracyM":50,"maxRunnerSpeedMps":9,"processNoise":1.2,"accuracyToSigma":0.5,"gapS":15,"reanchorAfter":5,"marginSigmaK":1,"minStepM":2.5,"stationarySpeedMps":0.35,"paceWindowS":30,"liveDplusHysteresisM":10,"liveSmoothingLag":10},"antiCheat":{"vehicleSpeedKmh":20,"vehicleWindowS":180,"maxAccelerationMps2":6,"maxAccelerationEvents":20,"maxRejectedRatio":0.4,"maxDurationH":12,"maxUploadDelayDays":7,"maxFutureSkewS":300,"minPoints":30,"maxPoints":60000,"minDistanceM":300,"maxRunnerSpeedMps":9,"teleportMinM":300,"allowSimulatedRuns":false,"rawTraceRetentionDays":90}}'::jsonb
$$;

-- Deux factions actives : Braise (1, rouge) et Marée (2, bleu). Sylve et Ambre en réserve.
update public.factions set slug = 'tmp-3' where id = 3;
update public.factions set slug = 'maree', color = '#2E7DFF', name_fr = 'Marée', name_en = 'Tide' where id = 2;
update public.factions set slug = 'sylve', color = '#22C55E', name_fr = 'Sylve', name_en = 'Grove' where id = 3;
update public.factions set color = '#FF4D2E' where id = 1;
update public.factions set color = '#F5B400' where id = 4;

-- Série 🔥 (calculée par submit-run avec le core, stockée ici)
alter table public.profiles add column streak_days int not null default 0;
alter table public.profiles add column streak_last_day date;
alter table public.runs add column bonus_troops int not null default 0;

-- Front du jour ⚔️ : une région disputée de la zone, la même pour tous ce jour-là.
create or replace function public.front_of_day(p_zone text, p_day date default (now() at time zone 'Europe/Paris')::date)
returns text language sql stable security definer set search_path = public, extensions as $$
  select region from (
    select region, count(distinct owner_faction) as n
    from public.hex_state
    where season_id = public.current_season_id() and zone = p_zone and owner_faction is not null
    group by region
  ) r
  order by (n >= 2) desc, md5(p_day::text || ':' || region)
  limit 1
$$;

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
  v_front text;
  v_front_captures int := 0;
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
  v_front := public.front_of_day(coalesce(v_profile.home_zone, (v_run.cells -> 0 ->> 'zone')));

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
      if cell ->> 'region' = v_front then v_front_captures := v_front_captures + 1; end if;
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
            jsonb_build_object('count', v_captures, 'front', v_front_captures));
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
    xp = xp + v_captures * public.cfg_num('xp.perCapture')::int + v_reinforcements * public.cfg_num('xp.perReinforce')::int
            + round(v_front_captures * public.cfg_num('xp.perCapture') * (public.cfg_num('front.xpMultiplier') - 1))::int,
    level = public.level_from_xp(xp + v_captures * public.cfg_num('xp.perCapture')::int
                                    + v_reinforcements * public.cfg_num('xp.perReinforce')::int
                                    + round(v_front_captures * public.cfg_num('xp.perCapture') * (public.cfg_num('front.xpMultiplier') - 1))::int)
  where id = uid;

  insert into public.player_season_stats (season_id, user_id, zone, faction_id, captures, troops_deployed, reinforcements, points)
  values (v_run.season_id, uid, coalesce(v_profile.home_zone, v_zone), v_profile.faction_id, v_captures, v_troops, v_reinforcements,
          v_captures * public.cfg_num('score.perCapture')::int + v_troops * public.cfg_num('score.perTroopDeployed')::int
          + round(v_front_captures * public.cfg_num('score.perCapture') * (public.cfg_num('front.pointsMultiplier') - 1))::int)
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


-- Némésis 😈 : l'ennemi qui t'a repris le plus de territoires cette saison.
create or replace function public.my_nemesis()
returns table (user_id uuid, username text, avatar_id text, faction_id smallint, taken bigint)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.avatar_id, p.faction_id, count(*) as taken
  from public.deployments d
  join public.profiles p on p.id = d.user_id
  where d.season_id = public.current_season_id()
    and d.outcome = 'captured'
    and d.user_id <> auth.uid()
    and exists (select 1 from public.deployments m
                where m.user_id = auth.uid() and m.h3 = d.h3 and m.outcome = 'captured'
                  and m.season_id = d.season_id and m.id < d.id)
  group by p.id, p.username, p.avatar_id, p.faction_id
  order by taken desc, p.username
  limit 1
$$;

-- Vue « Guerre » : territoires par faction (zone et monde), victoires de zone cumulées
-- sur toutes les saisons (la guerre éternelle), front du jour, saison.
create or replace function public.war_overview(p_zone text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'factions', (select jsonb_agg(jsonb_build_object(
        'faction_id', f.id,
        'hexes_zone', (select count(*) from public.hex_state h where h.season_id = public.current_season_id()
                        and h.zone = p_zone and h.owner_faction = f.id),
        'hexes_world', (select count(*) from public.hex_state h where h.season_id = public.current_season_id()
                        and h.owner_faction = f.id),
        'territory_days', (select coalesce(sum(z.hexes), 0) from public.zone_daily_scores z
                           where z.season_id = public.current_season_id() and z.zone = p_zone and z.faction_id = f.id),
        'victories', (select count(*) from public.season_awards a where a.title = 'zone_winner' and a.faction_id = f.id)
      ) order by f.id) from public.factions f where f.id <= public.cfg_num('factions.count')),
    'front', public.front_of_day(p_zone),
    'season', (select jsonb_build_object('id', id, 'name', name, 'ends_at', ends_at) from public.seasons where status = 'active' limit 1)
  )
$$;

revoke execute on function public.front_of_day(text, date), public.my_nemesis(), public.war_overview(text)
  from public, anon, authenticated;
grant execute on function public.front_of_day(text, date), public.my_nemesis(), public.war_overview(text),
  public.deploy_troops(uuid, jsonb) to authenticated;
grant execute on all functions in schema public to service_role;
