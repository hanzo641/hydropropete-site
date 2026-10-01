-- Avatars = the game's soldiers, one outfit per rank (replaces the animal avatars).
-- Unlock levels identical to packages/core/src/game/avatars.ts (consistency test).
set search_path = public, extensions;

-- existing players get the best outfit their level unlocks
update public.profiles set avatar_id = case
  when level >= 91 then 'legende' when level >= 71 then 'garde' when level >= 46 then 'chevalier'
  when level >= 26 then 'eclaireur' when level >= 11 then 'fantassin' else 'recrue' end;

create or replace function public.avatar_unlock_level(p_avatar text)
returns int language sql immutable as $$
  select case p_avatar
    when 'recrue' then 1 when 'fantassin' then 11 when 'eclaireur' then 26
    when 'chevalier' then 46 when 'garde' then 71 when 'legende' then 91
  end
$$;

alter table public.profiles alter column avatar_id set default 'recrue';
