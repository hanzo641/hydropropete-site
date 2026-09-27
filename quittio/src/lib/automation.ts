import "server-only";
import { adminDb } from "./firebase/admin";
import { col, type UserDoc } from "./db";
import { ACTIVE_STATUSES, getPlan } from "./plans";
import { addMonths, automationActions, diffDays, formatPeriod, nextAnniversary, periodOf, todayParis } from "./rent";
import { computeRevision } from "./irl";
import { getPayment, leasesCol, listLeases, sendNotice, sendQuittance, sendReminder, upsertPayment, type Lease } from "./leases";
import { sendEmail, templates } from "./email";
import { absoluteUrl } from "./site";
import { formatDateFr, formatEuros } from "./utils";

export interface RunReport {
  today: string;
  users: number;
  leases: number;
  actions: Record<string, number>;
  errors: string[];
}

async function processLease(uid: string, user: UserDoc, lease: Lease, automation: boolean, today: string, report: RunReport) {
  const bump = (k: string) => (report.actions[k] = (report.actions[k] ?? 0) + 1);

  if (automation) {
    const current = periodOf(today);
    for (const period of [addMonths(current, -1), current, addMonths(current, 1)]) {
      if (period < periodOf(lease.startDate)) continue;
      const payment = await getPayment(uid, lease, period);
      const actions = automationActions({
        today,
        dueDate: payment.dueDate,
        status: payment.status,
        noticeDaysBefore: lease.noticeDaysBefore,
        autoQuittance: lease.autoQuittance,
        remindersEnabled: lease.remindersEnabled,
        sent: { notice: !!payment.noticeSentAt, reminder1: !!payment.reminder1SentAt, reminder2: !!payment.reminder2SentAt },
      });
      for (const action of actions) {
        if (action === "notice" && lease.remindersEnabled) {
          await sendNotice(uid, user, lease, payment);
        } else if (action === "auto_quittance") {
          await upsertPayment(uid, lease, period, { amountPaid: payment.amountDue, paidAt: payment.dueDate });
          await sendQuittance(uid, user, lease, period);
        } else if (action === "reminder1") {
          await sendReminder(uid, user, lease, payment, 1);
        } else if (action === "reminder2") {
          await sendReminder(uid, user, lease, payment, 2);
          if (user.email) {
            await sendEmail({
              to: user.email,
              ...templates.ownerAlert({
                title: `Loyer impayé depuis 15 jours — ${lease.propertyLabel}`,
                lines: [
                  `Le loyer de ${formatPeriod(period)} de ${lease.tenantName} (${formatEuros(payment.amountDue - payment.amountPaid)}) n'est toujours pas marqué comme payé.`,
                  "Une seconde relance vient d'être envoyée. Si le paiement n'arrive pas sous 8 jours, une mise en demeure par lettre recommandée est l'étape suivante : elle est prête dans votre espace.",
                ],
                cta: { label: "Voir le logement", href: absoluteUrl(`/espace/logements/${lease.id}`) },
              }),
            });
          }
        } else continue;
        bump(action);
      }
    }
  }

  // Rappel de révision IRL au bailleur, 30 jours avant la date anniversaire (toutes formules).
  const anniversary = nextAnniversary(lease.startDate, today);
  const days = diffDays(anniversary, today);
  if (days <= 30 && lease.revisionReminderFor !== anniversary && user.email) {
    const r = computeRevision({ rentCents: lease.rentCents, referenceQuarter: lease.irlReferenceQuarter, dpeClass: lease.dpeClass });
    if (r.ok && r.increaseCents > 0) {
      await sendEmail({
        to: user.email,
        ...templates.ownerAlert({
          title: `Révision de loyer possible le ${formatDateFr(anniversary)} — ${lease.propertyLabel}`,
          lines: [
            `La date anniversaire du bail de ${lease.tenantName} approche. Avec le nouvel IRL, le loyer hors charges peut passer de ${formatEuros(lease.rentCents)} à ${formatEuros(r.newRentCents)} (+${String(r.percent).replace(".", ",")} %).`,
            "La révision n'est pas rétroactive : pensez à envoyer la lettre à votre locataire. Elle est prête à télécharger.",
          ],
          cta: { label: "Préparer la révision", href: absoluteUrl(`/espace/logements/${lease.id}#revision`) },
        }),
      });
      bump("revision_reminder");
    }
    await leasesCol(uid).doc(lease.id).update({ revisionReminderFor: anniversary });
  }
}

export async function runDailyAutomation(now = new Date()): Promise<RunReport> {
  const today = todayParis(now);
  const report: RunReport = { today, users: 0, leases: 0, actions: {}, errors: [] };
  const users = await adminDb().collection(col.users).where("subscription.status", "in", [...ACTIVE_STATUSES]).get();

  for (const doc of users.docs) {
    const user = doc.data() as UserDoc;
    const plan = getPlan(user.subscription?.plan);
    if (!plan) continue;
    report.users++;
    const leases = await listLeases(doc.id);
    for (const lease of leases) {
      report.leases++;
      try {
        await processLease(doc.id, user, lease, plan.automation, today, report);
      } catch (e) {
        const msg = `${doc.id}/${lease.id}: ${e instanceof Error ? e.message : String(e)}`;
        console.error("[cron]", msg);
        report.errors.push(msg);
      }
    }
  }
  return report;
}
