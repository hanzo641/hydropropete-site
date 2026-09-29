import type { RawPoint } from '@conquete/core';
import * as Location from 'expo-location';
import { emitPoints } from './events';
import { appendPoints, getActiveRun } from './storage';

/**
 * Version web (aperçu navigateur) : pas de tâche d'arrière-plan ; suivi GPS au premier plan
 * avec watchPositionAsync, même chemin d'ingestion que sur mobile.
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

export function ingest(pts: readonly RawPoint[]): void {
  const run = getActiveRun();
  if (!run) return;
  appendPoints(run.id, pts);
  emitPoints(pts);
}

export async function requestPermissions(): Promise<'granted' | 'foreground-only' | 'denied'> {
  const fg = await Location.requestForegroundPermissionsAsync();
  return fg.status === 'granted' ? 'foreground-only' : 'denied';
}

let sub: Location.LocationSubscription | null = null;

export async function startTracking(): Promise<void> {
  if (sub) return;
  sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 }, (l) =>
    ingest([toRawPoint(l)]),
  );
}

export async function stopTracking(): Promise<void> {
  sub?.remove();
  sub = null;
}

export async function isTracking(): Promise<boolean> {
  return sub != null;
}
