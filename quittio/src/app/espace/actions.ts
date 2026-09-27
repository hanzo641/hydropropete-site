"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { col, type LeaseDoc } from "@/lib/db";
import { SESSION_COOKIE, requireAccount, requireActiveAccount } from "@/lib/session";
import { getLease, leasesCol, listLeases, sendQuittance, upsertPayment, getPayment } from "@/lib/leases";
import { IRL_VALUES, computeRevision } from "@/lib/irl";
import { eurosToCents } from "@/lib/utils";
import { todayParis } from "@/lib/rent";
import { stripe } from "@/lib/stripe";

export type ActionState = { ok?: boolean; error?: string; message?: string } | undefined;

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
const money = z.string().trim().min(1, "Montant requis").transform((v, ctx) => {
  try {
    return eurosToCents(v);
  } catch {
    ctx.addIssue({ code: "custom", message: "Montant invalide" });
    return z.NEVER;
  }
});

const leaseSchema = z.object({
  propertyLabel: z.string().trim().min(2, "Nom du logement requis").max(80),
  propertyAddress: z.string().trim().min(5, "Adresse requise").max(200),
  tenantName: z.string().trim().min(2, "Nom du locataire requis").max(120),
  tenantEmail: z.email("E-mail du locataire invalide").max(200),
  rent: money,
  charges: money,
  dueDay: z.coerce.number().int().min(1).max(31),
  startDate: z.iso.date("Date de début invalide"),
  dpeClass: z.enum(["", "A", "B", "C", "D", "E", "F", "G"]).optional(),
  irlReferenceQuarter: z.string().refine((q) => IRL_VALUES.some((e) => e.quarter === q), "Trimestre IRL invalide"),
  noticeDaysBefore: z.coerce.number().int().min(1).max(15).default(5),
});

function parseLease(form: FormData, automation: boolean): { data?: Omit<LeaseDoc, "createdAt" | "active">; error?: string } {
  const parsed = leaseSchema.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  const d = parsed.data;
  return {
    data: {
      propertyLabel: d.propertyLabel,
      propertyAddress: d.propertyAddress,
      tenantName: d.tenantName,
      tenantEmail: d.tenantEmail.toLowerCase(),
      rentCents: d.rent,
      chargesCents: d.charges,
      dueDay: d.dueDay,
      startDate: d.startDate,
      furnished: form.get("furnished") === "on",
      dpeClass: d.dpeClass || null,
      irlReferenceQuarter: d.irlReferenceQuarter,
      autoQuittance: automation && form.get("autoQuittance") === "on",
      remindersEnabled: automation && form.get("remindersEnabled") === "on",
      noticeDaysBefore: d.noticeDaysBefore,
    },
  };
}

export async function createLease(_prev: ActionState, form: FormData): Promise<ActionState> {
  const account = await requireActiveAccount();
  const existing = await listLeases(account.uid);
  if (existing.length >= account.plan.maxLeases) {
    return { error: `Votre formule ${account.plan.name} est limitée à ${account.plan.maxLeases} logement(s). Passez à la formule supérieure depuis « Abonnement ».` };
  }
  const { data, error } = parseLease(form, account.plan.automation);
  if (!data) return { error };
  const ref = await leasesCol(account.uid).add({ ...data, active: true, createdAt: Date.now(), revisionReminderFor: null, lastRevisionDate: null } satisfies LeaseDoc);
  revalidatePath("/espace", "layout");
  redirect(`/espace/logements/${ref.id}?cree=1`);
}

export async function updateLease(leaseId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const account = await requireActiveAccount();
  const lease = await getLease(account.uid, leaseId);
  if (!lease) return { error: "Logement introuvable" };
  const { data, error } = parseLease(form, account.plan.automation);
  if (!data) return { error };
  await leasesCol(account.uid).doc(leaseId).update(data);
  revalidatePath(`/espace/logements/${leaseId}`);
  return { ok: true, message: "Modifications enregistrées." };
}

export async function archiveLease(leaseId: string): Promise<void> {
  const account = await requireActiveAccount();
  if (await getLease(account.uid, leaseId)) await leasesCol(account.uid).doc(leaseId).update({ active: false });
  revalidatePath("/espace", "layout");
  redirect("/espace/logements");
}

const paidSchema = z.object({
  period: z.string().regex(PERIOD),
  amount: money,
  paidAt: z.iso.date(),
});

export async function recordPayment(leaseId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const account = await requireActiveAccount();
  const lease = await getLease(account.uid, leaseId);
  if (!lease) return { error: "Logement introuvable" };
  const parsed = paidSchema.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  const { period, amount, paidAt } = parsed.data;
  if (paidAt > todayParis()) return { error: "La date de paiement ne peut pas être dans le futur." };
  await upsertPayment(account.uid, lease, period, { amountPaid: amount, paidAt });
  let message = "Paiement enregistré.";
  if (form.get("send") === "on" && amount > 0) {
    try {
      await sendQuittance(account.uid, account.user, lease, period);
      message = amount >= lease.rentCents + lease.chargesCents ? "Paiement enregistré et quittance envoyée ✉️" : "Paiement partiel enregistré, reçu envoyé.";
    } catch (e) {
      console.error("[recordPayment]", e);
      return { error: "Paiement enregistré, mais l'e-mail n'a pas pu partir. Réessayez depuis l'historique." };
    }
  }
  revalidatePath("/espace", "layout");
  return { ok: true, message };
}

/** Raccourci « tout est payé » depuis le tableau de bord. */
export async function markPaidAndSend(leaseId: string, period: string): Promise<ActionState> {
  const account = await requireActiveAccount();
  const lease = await getLease(account.uid, leaseId);
  if (!lease || !PERIOD.test(period)) return { error: "Échéance introuvable" };
  const payment = await getPayment(account.uid, lease, period);
  await upsertPayment(account.uid, lease, period, { amountPaid: payment.amountDue, paidAt: todayParis() });
  try {
    await sendQuittance(account.uid, account.user, lease, period);
  } catch (e) {
    console.error("[markPaidAndSend]", e);
    revalidatePath("/espace", "layout");
    return { error: "Paiement enregistré mais e-mail non envoyé." };
  }
  revalidatePath("/espace", "layout");
  return { ok: true, message: "Quittance envoyée ✉️" };
}

export async function resendQuittance(leaseId: string, period: string): Promise<ActionState> {
  const account = await requireActiveAccount();
  const lease = await getLease(account.uid, leaseId);
  if (!lease || !PERIOD.test(period)) return { error: "Échéance introuvable" };
  try {
    await sendQuittance(account.uid, account.user, lease, period);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Envoi impossible" };
  }
  revalidatePath(`/espace/logements/${leaseId}`);
  return { ok: true, message: "Quittance renvoyée ✉️" };
}

export async function cancelPayment(leaseId: string, period: string): Promise<ActionState> {
  const account = await requireActiveAccount();
  const lease = await getLease(account.uid, leaseId);
  if (!lease || !PERIOD.test(period)) return { error: "Échéance introuvable" };
  await upsertPayment(account.uid, lease, period, { amountPaid: 0, paidAt: null });
  revalidatePath("/espace", "layout");
  return { ok: true, message: "Paiement annulé." };
}

export async function applyRevision(leaseId: string): Promise<ActionState> {
  const account = await requireActiveAccount();
  const lease = await getLease(account.uid, leaseId);
  if (!lease) return { error: "Logement introuvable" };
  const r = computeRevision({ rentCents: lease.rentCents, referenceQuarter: lease.irlReferenceQuarter, dpeClass: lease.dpeClass });
  if (!r.ok) return { error: "Aucune révision applicable pour le moment." };
  await leasesCol(account.uid).doc(leaseId).update({ rentCents: r.newRentCents, irlReferenceQuarter: r.newIndex.quarter, lastRevisionDate: todayParis() });
  revalidatePath("/espace", "layout");
  return { ok: true, message: "Nouveau loyer appliqué aux prochaines échéances." };
}

const profileSchema = z.object({
  ownerName: z.string().trim().min(2, "Nom requis").max(120),
  ownerAddress: z.string().trim().min(5, "Adresse requise").max(250),
});

export async function saveProfile(_prev: ActionState, form: FormData): Promise<ActionState> {
  const account = await requireAccount();
  const parsed = profileSchema.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  await adminDb().collection(col.users).doc(account.uid).set(parsed.data, { merge: true });
  revalidatePath("/espace", "layout");
  return { ok: true, message: "Profil enregistré. Ces informations apparaîtront sur vos quittances." };
}

/** Suppression définitive du compte (droit à l'effacement, art. 17 RGPD). */
export async function deleteAccount(_prev: ActionState, form: FormData): Promise<ActionState> {
  const account = await requireAccount();
  if (String(form.get("confirm") ?? "").trim().toUpperCase() !== "SUPPRIMER") return { error: "Tapez SUPPRIMER pour confirmer." };
  const sub = account.user.subscription;
  if (sub && !["canceled", "incomplete_expired"].includes(sub.status)) {
    try {
      await stripe().subscriptions.cancel(sub.id);
    } catch (e) {
      console.error("[deleteAccount] stripe", e);
      return { error: "Impossible d'annuler l'abonnement Stripe. Contactez le support." };
    }
  }
  const db = adminDb();
  await db.recursiveDelete(db.collection(col.users).doc(account.uid));
  await db.collection(col.referralCodes).doc(account.user.referralCode).delete().catch(() => {});
  await adminAuth().deleteUser(account.uid).catch(() => {});
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/?compte=supprime");
}
