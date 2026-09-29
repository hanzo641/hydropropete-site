-- Lectures joueur : équipe, classements, défis, confidentialité
begin;
select plan(9);
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d4', 'd@test.local'), ('00000000-0000-0000-0000-0000000000e5', 'e@test.local');
insert into public.profiles (id, username, faction_id, home_zone, level) values
  ('00000000-0000-0000-0000-0000000000d4', 'dora', 1, 'Z9', 4), ('00000000-0000-0000-0000-0000000000e5', 'eli', 1, 'Z9', 7);
insert into public.private_settings (user_id, birth_year) values ('00000000-0000-0000-0000-0000000000d4', 2000);
insert into public.cells (h3, region, zone, center) values ('x1', 'RX', 'Z9', st_setsrid(st_makepoint(1, 45), 4326)::geography);
insert into public.hex_state (season_id, h3, region, zone, owner_faction, garrison) values (public.current_season_id(), 'x1', 'RX', 'Z9', 1, 4);
insert into public.player_season_stats (season_id, user_id, zone, faction_id, points, captures) values
  (public.current_season_id(), '00000000-0000-0000-0000-0000000000d4', 'Z9', 1, 40, 3),
  (public.current_season_id(), '00000000-0000-0000-0000-0000000000e5', 'Z9', 1, 70, 5);
insert into public.runs (user_id, season_id, client_run_id, source, status, started_at, counted_km, counted_dplus_m)
values ('00000000-0000-0000-0000-0000000000d4', public.current_season_id(), 'w1', 'gps', 'validated', now(), 7.5, 120);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}';
select is((select username from public.zone_leaderboard('Z9', 10) where rank = 1), 'eli', 'classement de zone par points');
select is((select count(*) from public.zone_leaderboard('Z9', 10)), 2::bigint, 'deux joueurs classés');
select is((public.team_overview('Z9') ->> 'hexes')::int, 1, 'territoires de mon équipe dans la zone');
select is(jsonb_array_length(public.team_overview('Z9') -> 'members'), 2, 'membres de ma zone');
select is((select hexes_now from public.faction_scores('Z9') where faction_id = 1), 1::bigint, 'score de faction (zone)');
select is((select count(*) from public.faction_scores(null)), 2::bigint, '2 factions actives (Braise contre Marée)');
select is((public.my_weekly_progress() ->> 'distance')::numeric, 7.5, 'défi distance de la semaine');
select is((select has_zone from public.my_privacy_settings()), false, 'pas de zone de confidentialité par défaut');
select throws_ok($$ select * from public.admin_deploy_troops(auth.uid(), gen_random_uuid(), '[]') $$, '42501', null, 'outil admin interdit aux joueurs');
select * from finish();
rollback;
