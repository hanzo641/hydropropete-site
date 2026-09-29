import { enemyOf, type Profile } from '@conquete/core';
import { useSyncExternalStore } from 'react';
import { scheduleReminders } from '@/features/notify';
import { myRuns, pendingDeployments, tickWorld, zoneFeed } from '@/lib/api';
import { currentConfig } from '@/lib/gameConfig';
import { kv } from '@/lib/kv';

/**
 * « Pendant ton absence » : ce que l'ennemi et les alliés ont fait depuis la dernière
 * visite (le monde a tourné). C'est le crochet qui donne envie d'aller riposter.
 */
export interface WarReport {
  enemyCaptures: number;
  allyCaptures: number;
  regionsLost: number;
}

const LAST_SEEN = 'cr:pref:lastSeen';
let report: WarReport | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function useWarReport(): WarReport | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => report,
  );
}

export function dismissWarReport(): void {
  kv.setItem(LAST_SEEN, new Date().toISOString());
  report = null;
  emit();
}

let running: Promise<void> | null = null;

/** Fait avancer le monde, calcule le rapport et reprogramme les rappels. */
export function refreshWar(profile: Profile): Promise<void> {
  running ??= (async () => {
    try {
      await tickWorld();
      const last = kv.getItem(LAST_SEEN);
      if (!last) {
        kv.setItem(LAST_SEEN, new Date().toISOString());
      } else if (profile.home_zone && profile.faction_id) {
        const since = Date.parse(last);
        const feed = await zoneFeed(profile.home_zone, 100);
        const recent = feed.filter((e) => Date.parse(e.created_at) > since && e.actor_name !== profile.username);
        const count = (pred: (f: number | null) => boolean) =>
          recent.filter((e) => e.kind === 'capture' && pred(e.faction_id)).reduce((s, e) => s + Number(e.payload.count ?? 1), 0);
        const enemyCaptures = count((f) => f != null && f !== profile.faction_id);
        const allyCaptures = count((f) => f === profile.faction_id);
        const regionsLost = recent.filter((e) => e.kind === 'region_lost' && e.faction_id === profile.faction_id).length;
        report = enemyCaptures + allyCaptures + regionsLost > 0 ? { enemyCaptures, allyCaptures, regionsLost } : null;
        emit();
      }
      const [pending, runs] = await Promise.all([pendingDeployments(), myRuns(1)]);
      const troops = pending.reduce((s, r) => s + r.troops_remaining, 0);
      const deadline = pending.reduce((m, r) => Math.min(m, r.deploy_deadline ? Date.parse(r.deploy_deadline) : Infinity), Infinity);
      await scheduleReminders({
        streak: { days: profile.streak_days ?? 0, lastDay: profile.streak_last_day ?? null },
        factionId: profile.faction_id,
        enemyId: profile.faction_id ? enemyOf(profile.faction_id, currentConfig().factions) : null,
        lastRunAt: runs[0]?.started_at ? Date.parse(runs[0].started_at) : null,
        pendingTroops: troops > 0 && Number.isFinite(deadline) ? { n: troops, deadline } : null,
      });
    } catch {
      /* hors ligne : on réessaiera au prochain retour au premier plan */
    } finally {
      running = null;
    }
  })();
  return running;
}
