import type { RawPoint } from '@conquete/core';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { t } from '@/i18n';
import { colors } from '@/ui/theme';
import { emitPoints } from './events';
import { appendPoints, getActiveRun } from './storage';

/**
 * UNE SEULE chaîne de réception GPS, premier plan comme arrière-plan :
 * startLocationUpdatesAsync → cette tâche → SQLite → écrans.
 * (L'ancien prototype ignorait les positions reçues écran verrouillé : plus jamais.)
 */
export const LOCATION_TASK = 'conquete-run.location';

export function toRawPoint(l: Location.LocationObject): RawPoint {
  return {
    t: l.timestamp,
    lat: l.coords.latitude,
    lng: l.coords.longitude,
    acc: l.coords.accuracy,
    alt: l.coords.altitude,
    altAcc: l.coords.altitudeAccuracy,
    speed: l.coords.speed,
    mocked: l.mocked === true,
  };
}

/** Point d'entrée commun : tâche système ET mode simulation. */
export function ingest(pts: readonly RawPoint[]): void {
  const run = getActiveRun();
  if (!run) return;
  appendPoints(run.id, pts);
  emitPoints(pts);
}

// Doit être défini à la racine du bundle (voir app/_layout.tsx) : l'OS peut relancer le JS
// en arrière-plan uniquement pour exécuter cette tâche.
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(LOCATION_TASK, ({ data, error }) => {
  if (error || !data?.locations?.length) return Promise.resolve();
  try {
    ingest(data.locations.map(toRawPoint));
  } catch (e) {
    console.warn('location task', e);
  }
  return Promise.resolve();
});

export async function requestPermissions(): Promise<'granted' | 'foreground-only' | 'denied'> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return 'denied';
  const bg = await Location.requestBackgroundPermissionsAsync();
  return bg.status === 'granted' ? 'granted' : 'foreground-only';
}

export async function startTracking(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) return;
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 1000,
    distanceInterval: 0,
    // iOS
    activityType: Location.ActivityType.Fitness,
    showsBackgroundLocationIndicator: true,
    pausesUpdatesAutomatically: false,
    // Android : service de premier plan avec notification permanente
    foregroundService: {
      notificationTitle: t('run.notificationTitle'),
      notificationBody: t('run.notificationBody'),
      notificationColor: colors.accent,
      killServiceOnDestroy: false,
    },
  });
}

export async function stopTracking(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
}

export async function isTracking(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
}
