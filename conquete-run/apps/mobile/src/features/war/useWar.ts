import { currentStreak, enemyOf, localDay, streakAtRisk } from '@conquete/core';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { nemesis, type Nemesis, pendingDeployments, type RunRow, subscribeLive, warOverview, type WarOverview } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { currentConfig } from '@/lib/gameConfig';

export interface WarState {
  war: WarOverview | null;
  pending: RunRow[];
  rival: Nemesis | null;
  reload: () => Promise<void>;
  myFaction: number | null;
  enemyFaction: number | null;
  streak: number;
  streakRisk: boolean;
  troops: number;
  troopsDeadline: number | null;
  seasonDaysLeft: number | null;
}

/** L'état de la guerre vu par le joueur (rechargé au focus et à chaque changement en direct). */
export function useWar(): WarState {
  const { profile } = useAuth();
  const zone = profile?.home_zone ?? '';
  const [war, setWar] = useState<WarOverview | null>(null);
  const [pending, setPending] = useState<RunRow[]>([]);
  const [rival, setRival] = useState<Nemesis | null>(null);

  const reload = useCallback(async () => {
    const [w, p, n] = await Promise.allSettled([warOverview(zone), pendingDeployments(), nemesis()]);
    if (w.status === 'fulfilled') setWar(w.value);
    if (p.status === 'fulfilled') setPending(p.value);
    if (n.status === 'fulfilled') setRival(n.value);
  }, [zone]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );
  useEffect(() => subscribeLive(zone || null, () => void reload()), [zone, reload]);

  const myFaction = profile?.faction_id ?? null;
  const today = localDay(Date.now(), -new Date().getTimezoneOffset());
  const s = { days: profile?.streak_days ?? 0, lastDay: profile?.streak_last_day ?? null };
  const troops = pending.reduce((acc, r) => acc + r.troops_remaining, 0);
  const deadline = pending.reduce((m, r) => Math.min(m, r.deploy_deadline ? Date.parse(r.deploy_deadline) : Infinity), Infinity);
  const ends = war?.season?.ends_at ? Date.parse(war.season.ends_at) : null;
  return {
    war,
    pending,
    rival,
    reload,
    myFaction,
    enemyFaction: myFaction ? enemyOf(myFaction, currentConfig().factions) : null,
    streak: currentStreak(s, today),
    streakRisk: streakAtRisk(s, today),
    troops,
    troopsDeadline: Number.isFinite(deadline) ? deadline : null,
    seasonDaysLeft: ends ? Math.max(0, Math.ceil((ends - Date.now()) / 86_400_000)) : null,
  };
}
