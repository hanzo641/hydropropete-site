import { t, type TKey } from '@/i18n';
import type { RunRow } from '@/lib/api';

/** Raison de rejet lisible par le joueur (journal des courses rejetées). */
export function rejectionText(run: Pick<RunRow, 'rejection_code' | 'rejection_details'>): string {
  const key = `summary.rejection.${run.rejection_code}` as TKey;
  const txt = t(key, (run.rejection_details ?? {}) as Record<string, string | number>);
  return txt === key ? (run.rejection_code ?? '') : txt;
}
