-- Données de développement (supabase db reset). Crée une saison active si aucune n'existe.
insert into public.seasons (name, starts_at, ends_at, status)
select 'Saison 1 — test', date_trunc('day', now()), date_trunc('day', now()) + interval '28 days', 'active'
where not exists (select 1 from public.seasons where status = 'active');
