import { getLocales } from 'expo-localization';
import { useSyncExternalStore } from 'react';
import { en } from './en';
import { type Dictionary, fr } from './fr';

export type Locale = 'fr' | 'en';
const DICTS: Record<Locale, Dictionary> = { fr, en };

/** Clés « a.b.c » menant à une chaîne. */
type Paths<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : T[K] extends readonly unknown[]
      ? never
      : Paths<T[K], `${P}${K}.`>;
}[keyof T & string];
export type TKey = Paths<Dictionary>;

function detect(): Locale {
  const code = getLocales()[0]?.languageCode;
  return code === 'fr' ? 'fr' : 'en';
}

let locale: Locale = detect();
const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return locale;
}

export function setLocale(l: Locale): void {
  locale = l;
  for (const fn of listeners) fn();
}

export function dict(): Dictionary {
  return DICTS[locale];
}

/**
 * Traduction avec paramètres « {n} » et pluriel simple « un|plusieurs » (choisi par n).
 */
export function t(key: TKey, params: Record<string, string | number> = {}): string {
  let v: unknown = DICTS[locale];
  for (const part of key.split('.')) v = (v as Record<string, unknown>)[part];
  let s = typeof v === 'string' ? v : key;
  if (s.includes('|') && typeof params.n === 'number') {
    const [one, many] = s.split('|');
    s = (Math.abs(params.n) <= 1 && locale === 'fr') || params.n === 1 ? one! : many!;
  }
  return s.replace(/\{(\w+)\}/g, (_, k: string) => (params[k] != null ? String(params[k]) : `{${k}}`));
}

/** Rendu réactif au changement de langue. */
export function useLocale(): Locale {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => locale,
  );
}

export function formatNumber(n: number, digits = 0): string {
  return n.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatDate(d: Date | string): string {
  return new Date(d).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
