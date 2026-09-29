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

/** « il y a 3 h » / « 3 h ago » */
export function timeAgo(d: Date | string, now = Date.now()): string {
  const s = Math.max(0, (now - new Date(d).getTime()) / 1000);
  const fr = locale === 'fr';
  const [n, unit] =
    s < 60 ? [0, ''] : s < 3600 ? [Math.floor(s / 60), 'min'] : s < 86_400 ? [Math.floor(s / 3600), 'h'] : [Math.floor(s / 86_400), fr ? 'j' : 'd'];
  if (n === 0) return fr ? 'à l’instant' : 'just now';
  return fr ? `il y a ${n} ${unit}` : `${n} ${unit} ago`;
}

const DIRS: Record<Locale, string[]> = {
  fr: ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'],
  en: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
};

/** « 2,3 km · NE » : où se trouve un point par rapport au joueur. */
export function whereIs(from: { lat: number; lng: number }, to: { lat: number; lng: number }): string {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  const km = (2 * R * Math.asin(Math.min(1, Math.sqrt(a)))) / 1000;
  const y = Math.sin(dLng) * Math.cos(toRad(to.lat));
  const x = Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) - Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(dLng);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  const dir = DIRS[locale][Math.round(((bearing + 360) % 360) / 45) % 8];
  return km < 0.5 ? (locale === 'fr' ? 'autour de toi' : 'around you') : `${formatNumber(km, km < 10 ? 1 : 0)} km · ${dir}`;
}
