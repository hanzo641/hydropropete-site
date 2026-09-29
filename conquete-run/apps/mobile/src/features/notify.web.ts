import type { StreakState } from '@conquete/core';

/** Version web : pas de rappels locaux. */
export function remindersEnabled(): boolean {
  return false;
}
export function setRemindersEnabled(_on: boolean): void {}
export async function ensureNotificationPermission(_ask: boolean): Promise<boolean> {
  return false;
}
export async function scheduleReminders(_s: {
  streak: StreakState;
  factionId: number | null;
  enemyId: number | null;
  lastRunAt: number | null;
  pendingTroops: { n: number; deadline: number } | null;
}): Promise<void> {}
