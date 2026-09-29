-- v2 : front du jour, points doublés sur le front, némésis, vue guerre
begin;
select plan(7);
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a7', 'a7@test.local'), ('00000000-0000-0000-0000-0000000000b8', 'b8@test.local');
insert into public.profiles (id, username, faction_id, home_zone) values
  ('00000000-0000-0000-0000-0000000000a7', 'rouge', 1, 'ZF'), ('00000000-0000-0000-0000-0000000000b8', 'bleu', 2, 'ZF');
insert into public.cells (h3, region, zone, center) values
  ('f1', 'RF', 'ZF', st_setsrid(st_makepoint(1, 44), 4326)::geography),
  ('f2', 'RF', 'ZF', st_setsrid(st_makepoint(1, 44), 4326)::geography),
  ('g1', 'RG', 'ZF', st_setsrid(st_makepoint(1, 44), 4326)::geography);
insert into public.hex_state (season_id, h3, region, zone, owner_faction, garrison) values
  (public.current_season_id(), 'f2', 'RF', 'ZF', 2, 1),
  (public.current_season_id(), 'g1', 'RG', 'ZF', 1, 3);
-- RF est disputée (Braise sur f1 bientôt, Marée sur f2) ; RG ne l'est pas
insert into public.hex_state (season_id, h3, region, zone, owner_faction, garrison) values (public.current_season_id(), 'f1', 'RF', 'ZF', 1, 1);
select is(public.front_of_day('ZF'), 'RF', 'le front du jour est la région disputée');

insert into public.runs (id, user_id, season_id, client_run_id, source, status, started_at, troops_earned, troops_remaining, deploy_deadline, cells)
values ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-0000000000a7', public.current_season_id(), 'r-front', 'gps', 'validated',
        now(), 10, 10, now() + interval '1 day', '[{"cell":"f2","region":"RF","zone":"ZF","meters":200}]');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a7","role":"authenticated"}';
select is((select outcome from public.deploy_troops('33333333-3333-3333-3333-333333333333', '[{"cell":"f2","troops":3}]')), 'captured', 'prise sur le front');
select is((select points from public.player_season_stats where user_id = auth.uid()), 23, 'points : 10 × 2 (front) + 3 troupes');
select is((select (payload ->> 'front')::int from public.events where kind = 'capture' order by id desc limit 1), 1, 'le fil signale une prise sur le front');

-- bleu reprend f2 à rouge : il devient sa némésis
reset role;
insert into public.runs (id, user_id, season_id, client_run_id, source, status, started_at, troops_earned, troops_remaining, deploy_deadline, cells)
values ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-0000000000b8', public.current_season_id(), 'r-back', 'gps', 'validated',
        now(), 10, 10, now() + interval '1 day', '[{"cell":"f2","region":"RF","zone":"ZF","meters":200}]');
select public.admin_deploy_troops('00000000-0000-0000-0000-0000000000b8', '44444444-4444-4444-4444-444444444444', '[{"cell":"f2","troops":8}]');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a7","role":"authenticated"}';
select is((select username from public.my_nemesis()), 'bleu', 'némésis : celui qui m''a repris un territoire');
select is(jsonb_array_length(public.war_overview('ZF') -> 'factions'), 2, 'vue guerre : deux factions');
select is((public.war_overview('ZF') -> 'factions' -> 0 ->> 'hexes_zone')::int, 2, 'Braise tient 2 territoires dans la zone');
select * from finish();
rollback;
