import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Montants stockés en centimes pour éviter les erreurs d'arrondi. */
export function formatEuros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })
    .format(cents / 100)
    // Espaces insécables fines → espaces simples (compatibilité polices PDF standard).
    .replace(/[  ]/g, " ");
}

export function formatDateFr(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }).format(d);
}

export function eurosToCents(input: string | number): number {
  const n = typeof input === "number" ? input : Number(String(input).replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) throw new Error("Montant invalide");
  return Math.round(n * 100);
}
