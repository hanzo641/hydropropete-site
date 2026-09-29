/** Point GPS brut tel que reçu du système (expo-location) ou d'un fichier GPX. */
export interface RawPoint {
  /** horodatage en ms depuis l'epoch */
  t: number;
  lat: number;
  lng: number;
  /** rayon d'incertitude horizontale (m), null si inconnu */
  acc: number | null;
  /** altitude (m, ellipsoïde WGS84 côté téléphone) */
  alt: number | null;
  /** précision verticale (m) */
  altAcc: number | null;
  /** vitesse instantanée (m/s) fournie par le système, indicative */
  speed: number | null;
  /** Android : position simulée */
  mocked?: boolean;
}

/** Raison pour laquelle un point brut a été écarté. */
export type PointRejection =
  | 'mocked'
  | 'time'
  | 'accuracy'
  | 'jump'
  | 'duplicate'
  | 'invalid';

/** Point retenu après filtrage. */
export interface FilteredPoint {
  t: number;
  lat: number;
  lng: number;
  /** écart-type de position estimé par le filtre (m) */
  sigma: number;
  /** vitesse estimée (m/s) */
  speed: number;
  /** altitude lissée (m) si disponible */
  alt: number | null;
  /** vrai si ce point suit une coupure de signal (pas de lissage à travers) */
  afterGap: boolean;
}

export interface GpsPipelineConfig {
  /** précision de base acceptée (m) */
  baseAccuracyM: number;
  /** précision maximale acceptée quand le signal est durablement dégradé (m) */
  adaptiveAccuracyMaxM: number;
  /** au-delà : toujours rejeté (m) */
  maxAccuracyM: number;
  /** vitesse maximale plausible d'un piéton pour un saut isolé (m/s) */
  maxRunnerSpeedMps: number;
  /** densité spectrale du bruit d'accélération du modèle (m²/s³) */
  processNoise: number;
  /**
   * σ de mesure par axe = accuracy × ce facteur. Le rayon annoncé (~68 %) donne ≈ 1/1,5 ;
   * une partie de l'erreur étant une dérive lente (sans effet sur la distance), on peut
   * donner plus de poids aux mesures.
   */
  accuracyToSigma: number;
  /** au-delà de cet écart (s) on considère une coupure */
  gapS: number;
  /** nombre de rejets consécutifs cohérents entre eux avant réancrage */
  reanchorAfter: number;
  /** distance comptée seulement si le déplacement dépasse k × sigma (et au moins minStepM) */
  marginSigmaK: number;
  minStepM: number;
  /** en dessous de cette vitesse estimée (m/s), on considère le coureur immobile */
  stationarySpeedMps: number;
  /** fenêtre d'allure (s) */
  paceWindowS: number;
  /** hystérésis du D+ live à partir de l'altitude GPS (m) */
  liveDplusHysteresisM: number;
  /** retard du lisseur live (nombre de points, ≈ secondes à 1 Hz) */
  liveSmoothingLag: number;
}

export const DEFAULT_GPS_CONFIG: GpsPipelineConfig = {
  baseAccuracyM: 20,
  adaptiveAccuracyMaxM: 35,
  maxAccuracyM: 50,
  maxRunnerSpeedMps: 9,
  processNoise: 1.2,
  accuracyToSigma: 0.5,
  gapS: 15,
  reanchorAfter: 5,
  marginSigmaK: 1,
  minStepM: 2.5,
  stationarySpeedMps: 0.35,
  paceWindowS: 30,
  liveDplusHysteresisM: 10,
  liveSmoothingLag: 10,
};
