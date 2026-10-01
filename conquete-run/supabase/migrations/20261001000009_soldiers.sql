-- Soldiers on the map: each territory shows the outfit of its "captain", the last player
-- who captured or reinforced it. Purely cosmetic (no effect on combat). Only the level is
-- exposed, never the player's identity.

create index if not exists deployments_cell on public.deployments (season_id, h3, created_at desc);

create or replace function public.captain_level(p_h3 text, p_season bigint)
returns int
language sql stable security definer set search_path = public as $$
  select p.level
  from public.deployments d
  join public.profiles p on p.id = d.user_id
  where d.season_id = p_season and d.h3 = p_h3 and d.outcome in ('captured', 'reinforced')
  order by d.created_at desc
  limit 1
$$;
revoke execute on function public.captain_level(text, bigint) from public, anon, authenticated;
grant execute on function public.captain_level(text, bigint) to authenticated, service_role;

drop function if exists public.hexes_in_bbox(double precision, double precision, double precision, double precision, int);
create function public.hexes_in_bbox(
  p_south double precision, p_west double precision, p_north double precision, p_east double precision,
  p_limit int default 5000
) returns table (
  h3 text, region text, zone text, owner_faction smallint, garrison numeric,
  wild_garrison numeric, elevation_m real, last_attacked_at timestamptz, contested boolean, region_faction smallint,
  captain_level int
)
language sql stable security invoker set search_path = public, extensions as $$
  select c.h3, c.region, c.zone, hs.owner_faction,
         case when hs.h3 is null then null else public.eroded(hs.garrison, hs.updated_at) end,
         w.garrison, c.elevation_m, hs.last_attacked_at,
         coalesce(hs.last_attacked_at > now() - interval '24 hours', false),
         rc.faction_id,
         case when hs.owner_faction is null then null
              else coalesce(public.captain_level(c.h3, hs.season_id), 1) end
  from public.cells c
  left join public.hex_state hs on hs.h3 = c.h3 and hs.season_id = public.current_season_id()
  left join public.wild_cells w on w.h3 = c.h3 and w.season_id = public.current_season_id()
  left join public.region_control rc on rc.region = c.region and rc.season_id = public.current_season_id()
  where c.center && st_makeenvelope(p_west, p_south, p_east, p_north, 4326)::geography
  limit least(p_limit, 5000)
$$;
revoke execute on function public.hexes_in_bbox(double precision, double precision, double precision, double precision, int) from public, anon;
grant execute on function public.hexes_in_bbox(double precision, double precision, double precision, double precision, int) to authenticated, service_role;
