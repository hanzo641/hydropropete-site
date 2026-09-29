-- Planification (pg_cron, disponible sur Supabase : Database → Extensions → pg_cron).
-- Tâche quotidienne à 04:00 UTC : érosion, abandons, scores du jour, fin/début de saison,
-- expiration des troupes non déployées, purge des traces brutes anciennes.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('conquete-daily-tick', '0 4 * * *', 'select public.daily_tick()');
  else
    raise notice 'pg_cron indisponible : planifier public.daily_tick() autrement (voir README).';
  end if;
end $$;
