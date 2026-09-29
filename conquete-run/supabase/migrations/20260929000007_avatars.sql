-- Avatars de jeu (remplacent les images de rang du prototype).
-- Niveaux de déblocage identiques à packages/core/src/game/avatars.ts (test de cohérence).
set search_path = public, extensions;

create or replace function public.avatar_unlock_level(p_avatar text)
returns int language sql immutable as $$
  select case p_avatar
    when 'renard' then 1 when 'loup' then 1 when 'aigle' then 1 when 'chamois' then 1
    when 'lynx' then 1 when 'ours' then 1 when 'hibou' then 1 when 'lievre' then 1
    when 'chevalier' then 11 when 'samourai' then 26 when 'dragon' then 46
    when 'phenix' then 71 when 'titan' then 91
  end
$$;

alter table public.profiles
  add column avatar_id text not null default 'renard'
  check (public.avatar_unlock_level(avatar_id) is not null);

-- Choix d'avatar : uniquement parmi ceux débloqués au niveau actuel du joueur.
create or replace function public.set_avatar(p_avatar text)
returns void language plpgsql security definer set search_path = public as $$
declare
  lvl int;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if public.avatar_unlock_level(p_avatar) is null then raise exception 'unknown_avatar' using errcode = 'P0001'; end if;
  select level into lvl from public.profiles where id = auth.uid();
  if lvl < public.avatar_unlock_level(p_avatar) then raise exception 'avatar_locked' using errcode = 'P0001'; end if;
  update public.profiles set avatar_id = p_avatar, updated_at = now() where id = auth.uid();
end $$;

-- Classement et vue équipe : on y affiche l'avatar.
drop function if exists public.zone_leaderboard(text, int);
create function public.zone_leaderboard(p_zone text, p_limit int default 30)
returns table (user_id uuid, username text, faction_id smallint, avatar_id text, points int, captures int, rank bigint)
language sql stable security definer set search_path = public as $$
  select ps.user_id, p.username, ps.faction_id, p.avatar_id, ps.points, ps.captures,
         rank() over (order by ps.points desc)
  from public.player_season_stats ps join public.profiles p on p.id = ps.user_id
  where ps.season_id = public.current_season_id() and ps.zone = p_zone
  order by ps.points desc, p.username
  limit least(p_limit, 100)
$$;

create or replace function public.team_overview(p_zone text)
returns jsonb language sql stable security definer set search_path = public as $$
  with me as (select faction_id from public.profiles where id = auth.uid())
  select jsonb_build_object(
    'members', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username, 'level', p.level,
                                                             'avatar_id', p.avatar_id)
                                          order by p.level desc, p.username)
                         from public.profiles p, me where p.home_zone = p_zone and p.faction_id = me.faction_id), '[]'::jsonb),
    'hexes', (select count(*) from public.hex_state h, me
              where h.season_id = public.current_season_id() and h.zone = p_zone and h.owner_faction = me.faction_id),
    'regions', (select count(distinct rc.region) from public.region_control rc
                join public.hex_state h on h.season_id = rc.season_id and h.region = rc.region, me
                where rc.season_id = public.current_season_id() and h.zone = p_zone and rc.faction_id = me.faction_id)
  )
$$;

revoke execute on function public.avatar_unlock_level(text), public.set_avatar(text),
  public.zone_leaderboard(text, int), public.team_overview(text) from public, anon, authenticated;
grant execute on function public.avatar_unlock_level(text) to anon, authenticated;
grant execute on function public.set_avatar(text), public.zone_leaderboard(text, int), public.team_overview(text)
  to authenticated;
grant execute on all functions in schema public to service_role;

-- Carte : la faction qui contrôle la région de chaque case (teinte de région dans l'app).
drop function if exists public.hexes_in_bbox(double precision, double precision, double precision, double precision, int);
create function public.hexes_in_bbox(
  p_south double precision, p_west double precision, p_north double precision, p_east double precision,
  p_limit int default 5000
) returns table (
  h3 text, region text, zone text, owner_faction smallint, garrison numeric,
  wild_garrison numeric, elevation_m real, last_attacked_at timestamptz, contested boolean, region_faction smallint
)
language sql stable security invoker set search_path = public, extensions as $$
  select c.h3, c.region, c.zone, hs.owner_faction,
         case when hs.h3 is null then null else public.eroded(hs.garrison, hs.updated_at) end,
         w.garrison, c.elevation_m, hs.last_attacked_at,
         coalesce(hs.last_attacked_at > now() - interval '24 hours', false),
         rc.faction_id
  from public.cells c
  left join public.hex_state hs on hs.h3 = c.h3 and hs.season_id = public.current_season_id()
  left join public.wild_cells w on w.h3 = c.h3 and w.season_id = public.current_season_id()
  left join public.region_control rc on rc.region = c.region and rc.season_id = public.current_season_id()
  where c.center && st_makeenvelope(p_west, p_south, p_east, p_north, 4326)::geography
  limit least(p_limit, 5000)
$$;
revoke execute on function public.hexes_in_bbox(double precision, double precision, double precision, double precision, int) from public, anon;
grant execute on function public.hexes_in_bbox(double precision, double precision, double precision, double precision, int) to authenticated, service_role;
