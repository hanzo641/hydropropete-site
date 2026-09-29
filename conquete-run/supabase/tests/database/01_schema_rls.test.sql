-- Schéma, paramètres, inscription, RLS
begin;
select plan(25);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

-- paramètres
select is(public.cfg_num('combat.defenseMultiplier'), 1.2, 'défaut : défense ×1,2');
update public.game_config set config = '{"combat":{"defenseMultiplier":1.5}}' where id = 1;
select is(public.cfg_num('combat.defenseMultiplier'), 1.5, 'surcharge game_config');
select is(public.cfg_num('erosion.dailyRate'), 0.05, 'clé non surchargée = défaut');
update public.seasons set config_overrides = '{"combat":{"defenseMultiplier":2}}' where status = 'active';
select is(public.cfg_num('combat.defenseMultiplier'), 2::numeric, 'surcharge de saison prioritaire');
update public.seasons set config_overrides = '{}' where status = 'active';
update public.game_config set config = '{}' where id = 1;

select is(public.level_from_xp(0), 1, 'niveau 1 à 0 XP');
select is(public.level_from_xp(250), 3, 'niveau 3 à 250 XP (100 + 150)');
select is(public.eroded(10, now() - interval '1 day'), 9.5000, 'érosion 5 % sur 1 jour');

-- inscription
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select throws_ok($$ select public.complete_onboarding('kid', 1::smallint, '841f91dffffffff', extract(year from now())::int - 12, 'fr', true, 'v1') $$,
  'P0001', 'too_young', 'moins de 15 ans refusé');
select throws_ok($$ select public.complete_onboarding('alice', 1::smallint, '841f91dffffffff', 1990, 'fr', false, 'v1') $$,
  'P0001', 'consent_required', 'consentement GPS obligatoire');
select throws_ok($$ select public.complete_onboarding('alice', 1::smallint, 'paris', 1990, 'fr', true, 'v1') $$,
  'P0001', 'invalid_zone', 'zone H3 invalide refusée');
select is((public.complete_onboarding('alice', 2::smallint, '841f91dffffffff', 1990, 'fr', true, 'v1')).faction_id, 2::smallint,
  'faction choisie attribuée');
select throws_ok($$ select public.complete_onboarding('alice2', 1::smallint, '841f91dffffffff', 1990, 'fr', true, 'v1') $$,
  'P0001', 'already_onboarded', 'une seule inscription');

-- écritures interdites côté client
select throws_ok($$ update public.profiles set xp = 999999 where id = auth.uid() $$, '42501', null, 'XP non modifiable par le client');
select lives_ok($$ update public.profiles set username = 'alice_run' where id = auth.uid() $$, 'pseudo modifiable');
select throws_ok($$ insert into public.hex_state (season_id, h3, region, zone, owner_faction, garrison) values (1, 'x', 'r', 'z', 1, 50) $$,
  '42501', null, 'aucune écriture directe sur la carte');
select throws_ok($$ insert into public.runs (user_id, client_run_id, source, status) values (auth.uid(), 'x', 'gps', 'validated') $$,
  '42501', null, 'aucune course insérée par le client');
select throws_ok($$ select public.record_run('{}'::jsonb) $$, '42501', null, 'record_run réservé au serveur');

-- zone de confidentialité : visible par soi seul
select lives_ok($$ select public.set_privacy_zone(43.29512, -0.37087, 5000) $$, 'zone de confidentialité enregistrée');
select is((select privacy_radius_m from public.private_settings where user_id = auth.uid()), 1000, 'rayon borné à 1 000 m');
select is((select round(st_y(privacy_center::geometry)::numeric, 3) from public.private_settings where user_id = auth.uid()), 43.295,
  'centre arrondi à ~100 m');

-- l'autre joueur ne voit ni la zone de confidentialité, ni les courses d'alice
reset role;
insert into public.profiles (id, username, faction_id, home_zone) values ('00000000-0000-0000-0000-00000000000b', 'bob', 1, '841f91dffffffff');
insert into public.runs (user_id, client_run_id, source, status) values ('00000000-0000-0000-0000-00000000000a', 'r1', 'gps', 'validated');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*) from public.private_settings), 0::bigint, 'réglages privés des autres invisibles');
select is((select count(*) from public.runs), 0::bigint, 'courses des autres invisibles');
select is((select count(*) from public.profiles), 2::bigint, 'profils publics visibles');

-- anonyme : rien sauf paramètres / factions / saisons
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($$ select count(*) from public.profiles $$, '42501', null, 'profils invisibles sans compte');
select is((select count(*) from public.factions), 4::bigint, 'factions lisibles sans compte');

select * from finish();
rollback;
