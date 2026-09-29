-- Avatars : choix libre parmi les débloqués, refus des verrouillés
begin;
select plan(6);
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f6', 'f@test.local');
insert into public.profiles (id, username, faction_id, home_zone, level) values ('00000000-0000-0000-0000-0000000000f6', 'fanny', 2, 'Z7', 12);
select is((select avatar_id from public.profiles where username = 'fanny'), 'renard', 'avatar par défaut : renard');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f6","role":"authenticated"}';
select lives_ok($$ select public.set_avatar('hibou') $$, 'avatar libre');
select lives_ok($$ select public.set_avatar('chevalier') $$, 'chevalier débloqué au niveau 11');
select throws_ok($$ select public.set_avatar('dragon') $$, 'P0001', 'avatar_locked', 'dragon verrouillé avant le niveau 46');
select throws_ok($$ select public.set_avatar('licorne') $$, 'P0001', 'unknown_avatar', 'avatar inconnu refusé');
select throws_ok($$ update public.profiles set avatar_id = 'titan' where id = auth.uid() $$, '42501', null, 'pas de contournement par mise à jour directe');
select * from finish();
rollback;
