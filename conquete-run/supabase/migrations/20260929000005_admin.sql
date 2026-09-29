-- Outils d'administration (service_role uniquement) : saison de démo, modération.
set search_path = public, extensions;

-- Déploiement au nom d'un joueur (script de démo). Réservé au service_role.
create or replace function public.admin_deploy_troops(p_user uuid, p_run uuid, p_allocations jsonb)
returns table (h3 text, troops int, effective numeric, outcome text,
               before_owner smallint, before_garrison numeric, after_owner smallint, after_garrison numeric)
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  return query select * from public.deploy_troops(p_run, p_allocations);
end $$;

-- Modération : invalider une course a posteriori (triche signalée). Les territoires déjà
-- pris ne sont pas rendus (la carte a continué de vivre) mais la course ne compte plus.
create or replace function public.admin_reject_run(p_run uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.runs
     set status = 'rejected', rejection_code = coalesce(p_reason, 'moderation'), troops_remaining = 0
   where id = p_run;
end $$;

revoke execute on function public.admin_deploy_troops(uuid, uuid, jsonb), public.admin_reject_run(uuid, text)
  from public, anon, authenticated;
grant execute on function public.admin_deploy_troops(uuid, uuid, jsonb), public.admin_reject_run(uuid, text) to service_role;
