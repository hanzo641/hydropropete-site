/**
 * Logique métier des échéances de loyer. Toutes les dates sont manipulées
 * sous forme de chaînes "AAAA-MM-JJ" en heure de Paris pour éviter les
 * décalages de fuseau horaire entre le serveur (UTC) et l'utilisateur.
 */

export type PaymentStatus = "upcoming" | "due" | "late" | "partial" | "paid";

export function todayParis(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function periodOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Date d'échéance d'une période "AAAA-MM" pour un jour de paiement donné (borné à la fin du mois). */
export function dueDateFor(period: string, dueDay: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = Math.min(Math.max(1, dueDay), daysInMonth(y, m));
  return `${period}-${String(d).padStart(2, "0")}`;
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
}

export function addMonths(period: string, n: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export function periodBounds(period: string): { start: string; end: string } {
  const [y, m] = period.split("-").map(Number);
  return { start: `${period}-01`, end: `${period}-${String(daysInMonth(y, m)).padStart(2, "0")}` };
}

export function formatPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
}

export function paymentStatus(opts: { amountDue: number; amountPaid: number; dueDate: string; today: string }): PaymentStatus {
  if (opts.amountPaid >= opts.amountDue && opts.amountDue > 0) return "paid";
  if (opts.amountPaid > 0) return "partial";
  if (opts.today < opts.dueDate) return "upcoming";
  if (diffDays(opts.today, opts.dueDate) <= 2) return "due";
  return "late";
}

/** Prochaine date anniversaire du bail à partir d'aujourd'hui (incluse). */
export function nextAnniversary(startDate: string, today: string): string {
  const [, sm, sd] = startDate.split("-").map(Number);
  const year = Number(today.slice(0, 4));
  for (const y of [year, year + 1]) {
    const d = Math.min(sd, daysInMonth(y, sm));
    const candidate = `${y}-${String(sm).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (candidate >= today && candidate > startDate) return candidate;
  }
  return `${year + 1}-${startDate.slice(5)}`;
}

export type AutomationAction = "notice" | "auto_quittance" | "reminder1" | "reminder2";

export interface AutomationInput {
  today: string;
  dueDate: string;
  status: PaymentStatus;
  noticeDaysBefore: number;
  autoQuittance: boolean;
  remindersEnabled: boolean;
  sent: { notice?: boolean; reminder1?: boolean; reminder2?: boolean };
}

/** Détermine les actions automatiques à exécuter aujourd'hui pour une échéance (idempotent grâce à `sent`). */
export function automationActions(i: AutomationInput): AutomationAction[] {
  const actions: AutomationAction[] = [];
  if (i.status === "paid") return actions;
  const late = diffDays(i.today, i.dueDate);
  if (!i.sent.notice && late >= -i.noticeDaysBefore && late < 0) actions.push("notice");
  if (i.autoQuittance && late >= 0 && i.status !== "partial") {
    actions.push("auto_quittance");
    return actions;
  }
  if (i.remindersEnabled) {
    if (!i.sent.reminder1 && late >= 5 && late < 15) actions.push("reminder1");
    if (!i.sent.reminder2 && late >= 15) actions.push("reminder2");
  }
  return actions;
}

/**
 * Date d'effet d'une révision demandée aujourd'hui. Depuis la loi ALUR, la
 * révision n'est pas rétroactive : si la date anniversaire est passée sans
 * révision, le nouveau loyer s'applique à compter de la demande.
 */
export function revisionEffectiveDate(startDate: string, lastRevisionDate: string | null | undefined, today: string): string {
  const next = nextAnniversary(startDate, today);
  const prev = `${Number(next.slice(0, 4)) - 1}${next.slice(4)}`;
  const firstYear = prev <= startDate;
  const alreadyRevised = !!lastRevisionDate && lastRevisionDate >= prev;
  if (firstYear || alreadyRevised || next === today) return next;
  return today;
}
