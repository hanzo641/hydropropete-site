-- Enregistrement des courses (record_run) et lecture de la carte
begin;
select plan(14);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c1', 'c@test.local');
insert into public.profiles (id, username, faction_id, home_zone)
values ('00000000-0000-0000-0000-0000000000c1', 'carla', 3, '841f91dffffffff');

-- une course validée qui traverse 2 cases près de Pau
select is(
  (public.record_run(('{
    "user_id":"00000000-0000-0000-0000-0000000000c1","client_run_id":"run-1","source":"gps","status":"validated",
    "started_at":"' || (now() - interval '1 hour')::text || '","ended_at":"' || now()::text || '",
    "duration_s":3000,"moving_s":2900,"distance_m":8200,"dplus_m":240,"dplus_source":"ign",
    "counted_km":8.2,"counted_dplus_m":240,"troops":10,"xp":150,"flags":[],"fingerprint":"fp1","raw_points":3000,
    "pace_s_per_km":365,"local_hour":6,
    "cells":[
      {"cell":"881f91d4b1fffff","region":"861f91d4fffffff","zone":"841f91dffffffff","meters":420,"lat":43.2951,"lng":-0.3708,"elevationM":205,"elevationSource":"ign","wild":1.4},
      {"cell":"881f91d4b3fffff","region":"861f91d4fffffff","zone":"841f91dffffffff","meters":380,"lat":43.2990,"lng":-0.3650,"elevationM":190,"elevationSource":"ign","wild":1.8}
    ],
    "points":[[1,2,3]]
  }')::jsonb) ->> 'troops')::int, 10, 'course validée : 10 troupes');

select is((select troops_remaining from public.runs where client_run_id = 'run-1'), 10, 'troupes à déployer');
select ok((select deploy_deadline between now() + interval '47 hours' and now() + interval '49 hours' from public.runs where client_run_id = 'run-1'),
  'délai de déploiement 48 h');
select is((select count(*) from public.cells), 2::bigint, 'cellules enregistrées');
select is((select count(*) from public.wild_cells), 2::bigint, 'garnisons sauvages de saison enregistrées');
select is((select xp from public.profiles where username = 'carla'), 150::bigint, 'XP ajoutée');
select is((select early_runs from public.profiles where username = 'carla'), 1, 'course matinale comptée');
select is((select distinct_cells from public.profiles where username = 'carla'), 2, 'cases distinctes');
select is((select km from public.player_season_stats where user_id = '00000000-0000-0000-0000-0000000000c1'), 8.200, 'stats de saison');

-- idempotence (renvoi du même envoi après une coupure réseau)
select is((public.record_run('{"user_id":"00000000-0000-0000-0000-0000000000c1","client_run_id":"run-1","status":"validated"}'::jsonb) ->> 'duplicate')::boolean,
  true, 'renvoi idempotent');

-- course rejetée : journalisée avec sa raison, sans effet de jeu
select is((public.record_run(('{
    "user_id":"00000000-0000-0000-0000-0000000000c1","client_run_id":"run-2","source":"gps","status":"rejected",
    "rejection_code":"vehicle","rejection_details":{"speedKmh":34.2,"from":"12:04","to":"12:09"},
    "started_at":"' || now()::text || '","troops":0,"cells":[]}')::jsonb) ->> 'status'), 'rejected', 'course rejetée journalisée');
select is((select xp from public.profiles where username = 'carla'), 150::bigint, 'rejet sans XP');

-- lecture de la carte par emprise (le joueur voit les garnisons sauvages connues)
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select is((select count(*) from public.hexes_in_bbox(43.28, -0.39, 43.31, -0.35)), 2::bigint, 'cases dans l’emprise');
select is((select count(*) from public.runs where rejection_code = 'vehicle'), 1::bigint, 'le joueur voit son rejet et sa raison');

select * from finish();
rollback;
