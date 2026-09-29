-- Déploiement, combat, confidentialité, régions, érosion, fin de saison
begin;
select plan(31);

-- acteurs
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@test.local');
insert into public.profiles (id, username, faction_id, home_zone) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice', 1, 'Z1'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob', 2, 'Z1');
insert into public.private_settings (user_id, birth_year) values
  ('00000000-0000-0000-0000-0000000000a1', 1990), ('00000000-0000-0000-0000-0000000000b2', 1985);

-- cellules connues (région R1) et garnisons sauvages de la saison
insert into public.cells (h3, region, zone, center, elevation_m) values
  ('c1', 'R1', 'Z1', st_setsrid(st_makepoint(-0.370, 43.295), 4326)::geography, 200),
  ('c2', 'R1', 'Z1', st_setsrid(st_makepoint(-0.360, 43.296), 4326)::geography, 210),
  ('c3', 'R1', 'Z1', st_setsrid(st_makepoint(-0.350, 43.297), 4326)::geography, 2100);
insert into public.wild_cells (season_id, h3, garrison)
select public.current_season_id(), x.h, x.g from (values ('c1', 1.4), ('c2', 1.8), ('c3', 2.0)) x(h, g);

insert into public.runs (id, user_id, season_id, client_run_id, source, status, started_at, troops_earned, troops_remaining, deploy_deadline, cells)
values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-0000000000a1', public.current_season_id(), 'run-a', 'gps', 'validated',
        now() - interval '1 hour', 12, 12, now() + interval '47 hours',
        '[{"cell":"c1","region":"R1","zone":"Z1","meters":300},{"cell":"c2","region":"R1","zone":"Z1","meters":200},{"cell":"c3","region":"R1","zone":"Z1","meters":150}]');

-- alice attaque deux territoires sauvages
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select is((select count(*) from public.deploy_targets('11111111-1111-1111-1111-111111111111')), 3::bigint, 'cibles = cases traversées');
select is((select garrison from public.deploy_targets('11111111-1111-1111-1111-111111111111') where h3 = 'c1'), 1.4, 'garnison sauvage de saison');

create temp table r1 as
select * from public.deploy_troops('11111111-1111-1111-1111-111111111111', '[{"cell":"c1","troops":3},{"cell":"c2","troops":2}]');
select is((select outcome from r1 where h3 = 'c1'), 'captured', 'sauvage 1,4 pris avec 3 troupes (3 ≥ 1,68)');
select is((select after_garrison from r1 where h3 = 'c1'), 1.3200, 'surplus 3 − 1,68 = 1,32');
select is((select outcome from r1 where h3 = 'c2'), 'damaged', 'sauvage 1,8 résiste à 2 troupes (2 < 2,16)');
select is((select after_owner from r1 where h3 = 'c2'), null::smallint, 'reste neutre');
select is((select troops_remaining from public.runs where id = '11111111-1111-1111-1111-111111111111'), 7, 'troupes restantes');
select is((select actor_name from public.events where kind = 'capture' order by id desc limit 1), 'alice', 'fil : « alice a pris … »');
select is((select captures_count from public.profiles where username = 'alice'), 1, 'compteur de prises');
select is((select xp from public.profiles where username = 'alice'), 15::bigint, 'XP de prise');

-- refus
select throws_ok($$ select * from public.deploy_troops('11111111-1111-1111-1111-111111111111', '[{"cell":"zz","troops":1}]') $$,
  'P0001', 'not_crossed', 'case non traversée refusée');
select throws_ok($$ select * from public.deploy_troops('11111111-1111-1111-1111-111111111111', '[{"cell":"c1","troops":8}]') $$,
  'P0001', 'too_many_troops', 'plus de troupes que disponibles');
select throws_ok($$ select * from public.deploy_troops('11111111-1111-1111-1111-111111111111', '[{"cell":"c1","troops":1.5}]') $$,
  'P0001', 'invalid_troops', 'troupes entières uniquement');
select throws_ok($$ select * from public.deploy_troops('11111111-1111-1111-1111-111111111111', '[{"cell":"c1","troops":1},{"cell":"c1","troops":1}]') $$,
  'P0001', 'duplicate_cell', 'une seule ligne par case');

-- confidentialité : une prise près du domicile n'est pas nominative
select public.set_privacy_zone(43.297, -0.350, 300);
select is((select outcome from public.deploy_troops('11111111-1111-1111-1111-111111111111', '[{"cell":"c3","troops":5}]')), 'captured',
  'prise en montagne (2,0 → 5 troupes)');
select is((select actor_name from public.events where kind = 'capture' order by id desc limit 1), null, 'fil anonymisé en zone de confidentialité');
select is((select h3 from public.events where kind = 'capture' order by id desc limit 1), null, 'case non révélée');
select is((select max_altitude_captured_m from public.profiles where username = 'alice'), 2100, 'altitude max prise (trophée Sommet)');

-- bob ne peut pas utiliser la course d'alice
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
select throws_ok($$ select * from public.deploy_troops('11111111-1111-1111-1111-111111111111', '[{"cell":"c1","troops":1}]') $$,
  'P0001', 'run_not_found', 'course d''autrui inutilisable');
select is((select count(*) from public.deploy_targets('11111111-1111-1111-1111-111111111111')), 0::bigint, 'cibles d''autrui invisibles');

-- région : bob tient 24 cases de R2 ; sa 25e (50 % de 49) lui donne le contrôle
reset role;
insert into public.cells (h3, region, zone, center)
select 'r2-' || g, 'R2', 'Z1', st_setsrid(st_makepoint(-0.3, 43.3), 4326)::geography from generate_series(1, 25) g;
insert into public.hex_state (season_id, h3, region, zone, owner_faction, garrison)
select public.current_season_id(), 'r2-' || g, 'R2', 'Z1', 2, 5 from generate_series(1, 24) g;
insert into public.runs (id, user_id, season_id, client_run_id, source, status, started_at, troops_earned, troops_remaining, deploy_deadline, cells)
values ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-0000000000b2', public.current_season_id(), 'run-b', 'gps', 'validated',
        now(), 10, 10, now() + interval '1 day',
        '[{"cell":"r2-25","region":"R2","zone":"Z1","meters":300},{"cell":"r2-1","region":"R2","zone":"Z1","meters":300}]');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
select is((select outcome from public.deploy_troops('22222222-2222-2222-2222-222222222222', '[{"cell":"r2-25","troops":4}]')), 'captured', 'prise de la 25e case');
select is((select faction_id from public.region_control where region = 'R2'), 2::smallint, 'région R2 contrôlée par Sylve');
select ok(exists (select 1 from public.events where kind = 'region_gained' and region = 'R2' and faction_id = 2), 'événement « nouvelle région »');
select is((select effective from public.deploy_troops('22222222-2222-2222-2222-222222222222', '[{"cell":"r2-1","troops":5}]')), 5.5000,
  'bonus de région +10 % sur les renforts');
select is((select regions_taken from public.profiles where username = 'bob'), 1, 'stat « régions prises »');

-- érosion quotidienne : 30 jours sans renfort ⇒ 1,32 × 0,95^30 < 1 ⇒ c1 redevient sauvage
reset role;
update public.hex_state set updated_at = now() - interval '30 days' where h3 = 'c1';
select is((public.daily_tick() ->> 'abandoned')::int >= 1, true, 'territoires abandonnés libérés');
select ok(not exists (select 1 from public.hex_state where h3 = 'c1'), 'c1 redevenu sauvage');
select ok(exists (select 1 from public.zone_daily_scores where zone = 'Z1' and faction_id = 2 and hexes = 25), 'score du jour figé (territoire-jours)');

-- troupes expirées
update public.runs set deploy_deadline = now() - interval '1 minute' where id = '11111111-1111-1111-1111-111111111111';
select public.daily_tick();
select is((select troops_remaining from public.runs where id = '11111111-1111-1111-1111-111111111111'), 0, 'troupes non déployées perdues après 48 h');

-- fin de saison : titres et faction gagnante
select lives_ok($$ select public.close_season(public.current_season_id()) $$, 'clôture de saison');
select ok(exists (select 1 from public.season_awards where title = 'zone_winner' and zone = 'Z1' and faction_id = 2), 'Sylve gagne la zone Z1');

select * from finish();
rollback;
