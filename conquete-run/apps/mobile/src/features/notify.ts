import { addDays, factionById, localDay, streakBonus, type StreakState } from '@conquete/core';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getLocale, t } from '@/i18n';
import { currentConfig } from '@/lib/gameConfig';
import { kv } from '@/lib/kv';

/**
 * Rappels locaux (aucun serveur de push) : la série qui va s'éteindre, les troupes qui
 * attendent, l'ennemi qui avance après deux jours sans courir. Reprogrammés à chaque
 * ouverture de l'app et après chaque course.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

const CHANNEL = 'war';
const PREF = 'cr:pref:reminders';

export function remindersEnabled(): boolean {
  return kv.getItem(PREF) !== 'off';
}

export function setRemindersEnabled(on: boolean): void {
  kv.setItem(PREF, on ? 'on' : 'off');
}

/** Crée le canal Android et demande l'autorisation si `ask` (Android 13+ / iOS). */
export async function ensureNotificationPermission(ask: boolean): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: t('notify.channel'),
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: '#FF6A2E',
      });
    }
    const perm = await Notifications.getPermissionsAsync();
    if (perm.granted) return true;
    if (!ask || !perm.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** Instant local du jour `day` (AAAA-MM-JJ) à hh:mm. */
function at(day: string, hh: number, mm: number): Date {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, hh, mm, 0);
}

export async function scheduleReminders(s: {
  streak: StreakState;
  factionId: number | null;
  enemyId: number | null;
  lastRunAt: number | null;
  pendingTroops: { n: number; deadline: number } | null;
}): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!remindersEnabled()) return;
    const granted = await ensureNotificationPermission(false);
    if (!granted) return;
    const now = Date.now();
    const tz = -new Date().getTimezoneOffset();
    const today = localDay(now, tz);
    const plans: { title: string; body: string; date: Date }[] = [];

    // 1. série : rappel à 18 h 30 le jour où elle s'éteint
    if (s.streak.days > 0 && s.streak.lastDay) {
      const deadlineDay = addDays(s.streak.lastDay, 1);
      const date = at(deadlineDay, 18, 30);
      if (deadlineDay >= today && date.getTime() > now) {
        const p = Math.round(streakBonus(s.streak.days + 1, currentConfig().streak) * 100);
        plans.push({ title: t('notify.streakTitle', { n: s.streak.days }), body: t('notify.streakBody', { p }), date });
      }
    }
    // 2. troupes : 6 h avant l'expiration
    if (s.pendingTroops && s.pendingTroops.n > 0) {
      const date = new Date(s.pendingTroops.deadline - 6 * 3_600_000);
      if (date.getTime() > now + 60_000) plans.push({ title: t('notify.troopsTitle'), body: t('notify.troopsBody', { n: s.pendingTroops.n }), date });
    }
    // 3. l'ennemi avance : 2 jours sans course, à 12 h 15
    const base = s.lastRunAt ?? now;
    const comebackDay = addDays(localDay(base, tz), 2);
    const comeback = at(comebackDay, 12, 15);
    if (comeback.getTime() > now) {
      const enemy = factionById(s.enemyId)?.name[getLocale()] ?? '';
      plans.push({ title: t('notify.comebackTitle', { faction: enemy }), body: t('notify.comebackBody'), date: comeback });
    }

    for (const p of plans) {
      await Notifications.scheduleNotificationAsync({
        content: { title: p.title, body: p.body, color: '#FF6A2E' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.date, channelId: CHANNEL },
      });
    }
  } catch {
    /* les rappels sont un bonus : jamais bloquants */
  }
}
