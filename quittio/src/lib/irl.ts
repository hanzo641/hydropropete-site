/**
 * Indice de référence des loyers (IRL) — France métropolitaine.
 * Source : INSEE, série 001515333 (reprise par l'ANIL).
 * ⚠️ Mise à jour trimestrielle manuelle (mi-janvier, mi-avril, mi-juillet,
 * mi-octobre) : ajouter la nouvelle valeur en tête de tableau. Voir BUSINESS.md.
 */
export interface IrlEntry {
  /** Clé au format "2026-T2". */
  quarter: string;
  value: number;
  /** Date de publication au Journal officiel / INSEE (AAAA-MM-JJ). */
  published: string;
}

export const IRL_VALUES: IrlEntry[] = [
  { quarter: "2026-T2", value: 148.37, published: "2026-07-10" },
  { quarter: "2026-T1", value: 146.6, published: "2026-04-16" },
  { quarter: "2025-T4", value: 145.78, published: "2026-01-16" },
  { quarter: "2025-T3", value: 145.77, published: "2025-10-17" },
  { quarter: "2025-T2", value: 146.68, published: "2025-07-13" },
  { quarter: "2025-T1", value: 145.47, published: "2025-04-16" },
  { quarter: "2024-T4", value: 144.64, published: "2025-01-16" },
  { quarter: "2024-T3", value: 144.51, published: "2024-10-16" },
  { quarter: "2024-T2", value: 145.17, published: "2024-07-18" },
  { quarter: "2024-T1", value: 143.46, published: "2024-04-12" },
  { quarter: "2023-T4", value: 142.06, published: "2024-01-18" },
  { quarter: "2023-T3", value: 141.03, published: "2023-10-14" },
  { quarter: "2023-T2", value: 140.59, published: "2023-07-16" },
  { quarter: "2023-T1", value: 138.61, published: "2023-04-16" },
  { quarter: "2022-T4", value: 137.26, published: "2023-01-31" },
  { quarter: "2022-T3", value: 136.27, published: "2022-10-14" },
  { quarter: "2022-T2", value: 135.84, published: "2022-07-14" },
  { quarter: "2022-T1", value: 133.93, published: "2022-04-16" },
  { quarter: "2021-T4", value: 132.62, published: "2022-01-15" },
  { quarter: "2021-T3", value: 131.67, published: "2021-10-16" },
  { quarter: "2021-T2", value: 131.12, published: "2021-07-16" },
  { quarter: "2021-T1", value: 130.69, published: "2021-04-17" },
  { quarter: "2020-T4", value: 130.52, published: "2021-01-17" },
  { quarter: "2020-T3", value: 130.59, published: "2020-10-16" },
  { quarter: "2020-T2", value: 130.57, published: "2020-07-17" },
  { quarter: "2020-T1", value: 130.57, published: "2020-06-25" },
  { quarter: "2019-T4", value: 130.26, published: "2020-01-16" },
  { quarter: "2019-T3", value: 129.99, published: "2019-10-16" },
  { quarter: "2019-T2", value: 129.72, published: "2019-07-17" },
  { quarter: "2019-T1", value: 129.38, published: "2019-04-12" },
];

export const LATEST_IRL = IRL_VALUES[0];

const QUARTER_RE = /^(\d{4})-T([1-4])$/;

export function parseQuarter(q: string): { year: number; quarter: number } | null {
  const m = QUARTER_RE.exec(q);
  return m ? { year: Number(m[1]), quarter: Number(m[2]) } : null;
}

export function formatQuarter(q: string): string {
  const p = parseQuarter(q);
  if (!p) return q;
  return `${p.quarter === 1 ? "1er" : `${p.quarter}e`} trimestre ${p.year}`;
}

export function getIrl(q: string): IrlEntry | undefined {
  return IRL_VALUES.find((e) => e.quarter === q);
}

/** Dernier indice publié pour un trimestre donné (T1..T4), à une date donnée. */
export function latestForQuarter(quarter: number, asOf: Date = new Date()): IrlEntry | undefined {
  const iso = asOf.toISOString().slice(0, 10);
  return IRL_VALUES.find((e) => parseQuarter(e.quarter)?.quarter === quarter && e.published <= iso);
}

export interface RevisionInput {
  /** Loyer hors charges actuel, en centimes. */
  rentCents: number;
  /** Trimestre de référence figurant dans le bail (ou utilisé lors de la dernière révision). */
  referenceQuarter: string;
  /** Classe énergie du DPE : les logements F et G ne peuvent plus être révisés (loi Climat et résilience). */
  dpeClass?: string | null;
  asOf?: Date;
}

export type RevisionResult =
  | {
      ok: true;
      oldIndex: IrlEntry;
      newIndex: IrlEntry;
      newRentCents: number;
      increaseCents: number;
      /** Variation en pourcentage (2 décimales). */
      percent: number;
    }
  | { ok: false; reason: "unknown_reference" | "no_new_index" | "dpe_frozen" };

/**
 * Révision annuelle (art. 17-1 de la loi du 6 juillet 1989) :
 * nouveau loyer = loyer actuel × (IRL du même trimestre de l'année suivante / IRL de référence).
 * Le résultat est arrondi au centime inférieur (on ne dépasse jamais le plafond légal).
 */
export function computeRevision(input: RevisionInput): RevisionResult {
  if (input.dpeClass && ["F", "G"].includes(input.dpeClass.toUpperCase())) {
    return { ok: false, reason: "dpe_frozen" };
  }
  const oldIndex = getIrl(input.referenceQuarter);
  const ref = parseQuarter(input.referenceQuarter);
  if (!oldIndex || !ref) return { ok: false, reason: "unknown_reference" };
  const newIndex = latestForQuarter(ref.quarter, input.asOf);
  if (!newIndex || newIndex.quarter <= oldIndex.quarter) return { ok: false, reason: "no_new_index" };
  const newRentCents = Math.floor((input.rentCents * newIndex.value) / oldIndex.value);
  return {
    ok: true,
    oldIndex,
    newIndex,
    newRentCents,
    increaseCents: newRentCents - input.rentCents,
    percent: Math.round(((newIndex.value / oldIndex.value - 1) * 100) * 100) / 100,
  };
}
