import type { RawPoint } from '@conquete/core';

/**
 * Import futur des séances de montres (v2) : Apple Santé (HealthKit) et Google Health
 * Connect. Non implémenté en v1 (Strava exclu : conditions d'API depuis nov. 2024).
 *
 * Une séance importée est envoyée à `submit-run` avec `source: 'healthkit' | 'health_connect'`
 * et passe EXACTEMENT par la même validation qu'une course enregistrée dans l'app. Seules
 * les séances avec une route GPS rapportent des troupes (il faut savoir quelles cases ont
 * été traversées).
 *
 * Implémentations prévues : un module natif (config plugin) par plateforme, par exemple
 * via @kingstinct/react-native-healthkit (HKWorkoutRoute) et react-native-health-connect
 * (ExerciseRoute), à valider au moment du développement.
 */
export interface ImportedWorkout {
  externalId: string;
  source: 'healthkit' | 'health_connect';
  startedAt: number;
  endedAt: number;
  activity: 'running' | 'trail' | 'walking' | 'other';
  hasRoute: boolean;
}

export interface ActivityImporter {
  readonly source: ImportedWorkout['source'];
  isAvailable(): Promise<boolean>;
  requestPermissions(): Promise<boolean>;
  /** Séances depuis une date (course à pied uniquement). */
  listWorkouts(since: number): Promise<ImportedWorkout[]>;
  /** Route GPS brute de la séance (même format que l'enregistrement de l'app). */
  getRoute(workout: ImportedWorkout): Promise<RawPoint[]>;
}

/** v1 : aucun importeur disponible. */
export function availableImporters(): ActivityImporter[] {
  return [];
}
