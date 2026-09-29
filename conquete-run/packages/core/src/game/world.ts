import { cellToLatLng, gridDisk, gridDistance, latLngToCell } from 'h3-js';
import type { LatLng } from '../geo/geodesy.ts';
import { neighbors } from '../geo/h3.ts';
import { resolveAttack, round4, type FactionId, type HexSnapshot, type Outcome } from './combat.ts';
import type { GameConfig } from './config.ts';
import { troopsToCapture } from './deployment.ts';
import { hash01 } from './wild.ts';

/**
 * Monde simulé du MODE LOCAL (entraînement, sans serveur) : la faction adverse et des
 * coéquipiers fictifs jouent chaque jour autour du joueur, pour que la guerre soit vivante
 * même quand on teste seul. Tout est déterministe à graine égale (testable).
 */

export interface WorldHex extends HexSnapshot {
  cell: string;
}

const angleDiff = (a: number, b: number): number => {
  const d = Math.abs(a - b) % (2 * Math.PI);
  return d > Math.PI ? 2 * Math.PI - d : d;
};

/**
 * Premier monde autour du joueur : son voisinage immédiat est sauvage (conquête facile),
 * un front ennemi d'un côté, des alliés de l'autre, des garnisons plus fortes au loin.
 */
export function seedWorld(
  opts: { center: LatLng; playerFaction: FactionId; enemyFaction: FactionId; seed: string; rings?: number },
  cfg: GameConfig,
): WorldHex[] {
  const res = cfg.h3.territoryRes;
  const center = latLngToCell(opts.center.lat, opts.center.lng, res);
  const [clat, clng] = cellToLatLng(center);
  const rings = opts.rings ?? 7;
  const enemyDir = hash01(`${opts.seed}:enemy-dir`) * 2 * Math.PI;
  const out: WorldHex[] = [];
  for (const cell of gridDisk(center, rings)) {
    const d = gridDistance(center, cell);
    if (d <= 1) continue;
    const [lat, lng] = cellToLatLng(cell);
    const angle = Math.atan2(lat - clat, (lng - clng) * Math.cos((clat * Math.PI) / 180));
    const r = hash01(`${opts.seed}:${cell}`);
    const r2 = hash01(`${opts.seed}:${cell}:g`);
    if (angleDiff(angle, enemyDir) < 1.35 && r < Math.min(0.9, 0.3 + 0.1 * d)) {
      out.push({ cell, owner: opts.enemyFaction, garrison: round4(Math.min(cfg.combat.maxGarrison, 1.5 + r2 * 2 + d * 0.7)) });
    } else if (d >= 3 && angleDiff(angle, enemyDir + Math.PI) < 1.0 && r < 0.25 + 0.06 * d) {
      out.push({ cell, owner: opts.playerFaction, garrison: round4(1 + r2 * 2.5 + d * 0.3) });
    }
  }
  return out;
}

export interface AiAction {
  cell: string;
  troops: number;
  outcome: Outcome;
  before: HexSnapshot;
  after: HexSnapshot;
}

/**
 * Un tour d'une faction pilotée par le jeu : elle attaque sa frontière (en visant d'abord
 * les prises bon marché et les territoires de la faction `rival`), puis renforce ses
 * territoires les plus faibles. `world` est mis à jour en place.
 */
export function aiTurn(
  world: Map<string, HexSnapshot>,
  faction: FactionId,
  budget: number,
  opts: { rival: FactionId | null; seed: string; wildOf: (cell: string) => number; aggression?: number },
  cfg: GameConfig,
): AiAction[] {
  const actions: AiAction[] = [];
  let left = Math.max(0, Math.floor(budget));
  if (left === 0) return actions;
  const own = [...world.entries()].filter(([, h]) => h.owner === faction).map(([c]) => c);
  const frontier = new Set<string>();
  for (const c of own) for (const n of neighbors(c)) if (world.get(n)?.owner !== faction) frontier.add(n);

  const stateOf = (cell: string): HexSnapshot => world.get(cell) ?? { owner: null, garrison: opts.wildOf(cell) };
  const aggression = opts.aggression ?? 0.6;
  const scored = [...frontier].map((cell) => {
    const st = stateOf(cell);
    const need = troopsToCapture({ cell, region: '', state: st, regionController: null }, faction, cfg);
    const vsRival = opts.rival != null && st.owner === opts.rival ? aggression * 3 : 0;
    return { cell, st, need, score: need - vsRival + hash01(`${opts.seed}:${cell}`) * 2 };
  });
  scored.sort((a, b) => a.score - b.score || a.cell.localeCompare(b.cell));

  const apply = (cell: string, troops: number): void => {
    const before = stateOf(cell);
    const r = resolveAttack(before, faction, troops, cfg.combat, cfg.erosion.abandonThreshold);
    if (r.after.owner == null && r.after.garrison < cfg.erosion.abandonThreshold) world.delete(cell);
    else world.set(cell, r.after);
    actions.push({ cell, troops, outcome: r.outcome, before, after: r.after });
    left -= troops;
  };

  // 1. prises
  for (const t of scored) {
    if (left <= 0) break;
    if (t.need <= left) apply(t.cell, t.need);
  }
  // 2. une attaque partielle sur une cible rivale (pression)
  const rivalTarget = scored.find((t) => t.st.owner === opts.rival && world.get(t.cell)?.owner === opts.rival);
  if (left >= 2 && rivalTarget && hash01(`${opts.seed}:harass`) < aggression) apply(rivalTarget.cell, Math.ceil(left / 2));
  // 3. renforts des territoires les plus faibles
  const weakest = [...world.entries()]
    .filter(([, h]) => h.owner === faction)
    .sort((a, b) => a[1].garrison - b[1].garrison || a[0].localeCompare(b[0]))
    .slice(0, 3);
  let i = 0;
  while (left > 0 && weakest.length > 0) {
    const cell = weakest[i % weakest.length]![0];
    apply(cell, 1);
    i++;
  }
  return actions;
}

/** Budget quotidien de l'IA, proportionné à l'activité récente du joueur (défi à sa mesure). */
export function aiDailyBudget(playerTroopsLast7Days: number, role: 'enemy' | 'ally'): number {
  const perDay = playerTroopsLast7Days / 7;
  return role === 'enemy'
    ? Math.round(Math.min(30, Math.max(6, 6 + 0.7 * perDay)))
    : Math.round(Math.min(15, Math.max(3, 3 + 0.3 * perDay)));
}

/** Coureurs fictifs du mode local (fil d'actualité, classement). */
export const NPC_NAMES: Record<number, readonly string[]> = {
  1: ['Tison', 'Étincelle', 'Fournaise', 'Brasero', 'Cendre_64', 'Flammèche', 'Pyro', 'Ardent'],
  2: ['Écume', 'Ressac', 'Houle_64', 'Embrun', 'Mascaret', 'Abysse', 'Mistral', 'Nautile'],
  3: ['Lierre', 'Fougère', 'Sylvain', 'Mousse'],
  4: ['Topaze', 'Miel', 'Soleil', 'Doré'],
};

export function npcName(faction: FactionId, key: string): string {
  const list = NPC_NAMES[faction] ?? ['Coureur'];
  return list[Math.floor(hash01(key) * list.length)]!;
}
