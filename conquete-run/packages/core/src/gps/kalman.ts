/**
 * Filtre de Kalman 1D « position + vitesse » (modèle à vitesse constante, bruit
 * d'accélération blanc) et lisseur arrière de Rauch-Tung-Striebel.
 *
 * Les axes est et nord sont indépendants (bruits de mesure non corrélés), on utilise donc
 * deux filtres 1D plutôt qu'un filtre 4D : même résultat, calcul plus simple.
 */

export interface AxisState {
  /** position (m) */
  p: number;
  /** vitesse (m/s) */
  v: number;
  /** covariance [[a, b], [b, d]] */
  a: number;
  b: number;
  d: number;
}

/** Trace d'une étape (pour le lissage arrière). */
export interface AxisStep {
  /** état filtré après mise à jour */
  filtered: AxisState;
  /** état prédit avant mise à jour */
  predicted: AxisState;
  /** pas de temps de la prédiction qui a mené à cette étape (s) */
  dt: number;
}

export function initAxis(p: number, posVar: number, velVar = 9): AxisState {
  return { p, v: 0, a: posVar, b: 0, d: velVar };
}

/** Prédiction sur dt secondes avec une densité spectrale q (m²/s³). */
export function predictAxis(s: AxisState, dt: number, q: number): AxisState {
  const dt2 = dt * dt;
  const dt3 = dt2 * dt;
  // P' = F P F^T + Q, F = [[1, dt], [0, 1]]
  const a = s.a + 2 * dt * s.b + dt2 * s.d + (q * dt3) / 3;
  const b = s.b + dt * s.d + (q * dt2) / 2;
  const d = s.d + q * dt;
  return { p: s.p + dt * s.v, v: s.v, a, b, d };
}

/** Mise à jour avec une mesure de position de variance r. */
export function updateAxis(s: AxisState, z: number, r: number): AxisState {
  const S = s.a + r;
  const k0 = s.a / S;
  const k1 = s.b / S;
  const y = z - s.p;
  return {
    p: s.p + k0 * y,
    v: s.v + k1 * y,
    a: (1 - k0) * s.a,
    b: (1 - k0) * s.b,
    d: s.d - k1 * s.b,
  };
}

/**
 * Lissage RTS sur une séquence d'étapes d'un même segment (sans coupure).
 * Renvoie les états lissés, dans l'ordre.
 */
export function rtsSmooth(steps: readonly AxisStep[]): AxisState[] {
  const n = steps.length;
  if (n === 0) return [];
  const out: AxisState[] = new Array<AxisState>(n);
  out[n - 1] = steps[n - 1]!.filtered;
  for (let k = n - 2; k >= 0; k--) {
    const f = steps[k]!.filtered;
    const next = steps[k + 1]!;
    const pr = next.predicted;
    const dt = next.dt;
    // C = P_k F^T P_pred^{-1}
    // P_k F^T = [[a + dt b, b], [b + dt d, d]]
    const m00 = f.a + dt * f.b;
    const m01 = f.b;
    const m10 = f.b + dt * f.d;
    const m11 = f.d;
    const det = pr.a * pr.d - pr.b * pr.b;
    if (!(det > 1e-12)) {
      out[k] = f;
      continue;
    }
    const i00 = pr.d / det;
    const i01 = -pr.b / det;
    const i11 = pr.a / det;
    const c00 = m00 * i00 + m01 * i01;
    const c01 = m00 * i01 + m01 * i11;
    const c10 = m10 * i00 + m11 * i01;
    const c11 = m10 * i01 + m11 * i11;
    const s = out[k + 1]!;
    const dp = s.p - pr.p;
    const dv = s.v - pr.v;
    // P_s = P + C (P_s_next - P_pred) C^T
    const ea = s.a - pr.a;
    const eb = s.b - pr.b;
    const ed = s.d - pr.d;
    const t00 = c00 * ea + c01 * eb;
    const t01 = c00 * eb + c01 * ed;
    const t10 = c10 * ea + c11 * eb;
    const t11 = c10 * eb + c11 * ed;
    out[k] = {
      p: f.p + c00 * dp + c01 * dv,
      v: f.v + c10 * dp + c11 * dv,
      a: f.a + t00 * c00 + t01 * c01,
      b: f.b + t00 * c10 + t01 * c11,
      d: f.d + t10 * c10 + t11 * c11,
    };
  }
  return out;
}

/** Filtre scalaire « marche aléatoire » (altitude). */
export interface ScalarState {
  x: number;
  p: number;
}

export function scalarStep(s: ScalarState | null, z: number, r: number, q: number, dt: number): ScalarState {
  if (!s) return { x: z, p: r };
  const p = s.p + q * dt;
  const k = p / (p + r);
  return { x: s.x + k * (z - s.x), p: (1 - k) * p };
}
