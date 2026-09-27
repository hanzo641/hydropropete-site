import "server-only";
import { adminDb } from "./firebase/admin";
import { col, type LeaseDoc, type PaymentDoc, type UserDoc } from "./db";
import { dueDateFor, formatPeriod, paymentStatus, todayParis, type PaymentStatus } from "./rent";
import { miseEnDemeurePdf, quittancePdf } from "./pdf";
import { sendEmail, templates } from "./email";
import { formatDateFr, formatEuros } from "./utils";

export type Lease = LeaseDoc & { id: string };
export type Payment = PaymentDoc & { status: PaymentStatus };

const usersCol = () => adminDb().collection(col.users);
export const leasesCol = (uid: string) => usersCol().doc(uid).collection(col.leases);
export const paymentsCol = (uid: string, leaseId: string) => leasesCol(uid).doc(leaseId).collection(col.payments);

export async function listLeases(uid: string, includeArchived = false): Promise<Lease[]> {
  const snap = await leasesCol(uid).orderBy("createdAt", "asc").get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as LeaseDoc) })).filter((l) => includeArchived || l.active);
}

export async function getLease(uid: string, id: string): Promise<Lease | null> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  const snap = await leasesCol(uid).doc(id).get();
  return snap.exists ? { id: snap.id, ...(snap.data() as LeaseDoc) } : null;
}

/** Échéance "virtuelle" tant qu'aucun document n'existe pour la période. */
export function blankPayment(lease: LeaseDoc, period: string): PaymentDoc {
  return {
    period,
    dueDate: dueDateFor(period, lease.dueDay),
    rentCents: lease.rentCents,
    chargesCents: lease.chargesCents,
    amountDue: lease.rentCents + lease.chargesCents,
    amountPaid: 0,
    updatedAt: Date.now(),
  };
}

export function withStatus(p: PaymentDoc, today = todayParis()): Payment {
  return { ...p, status: paymentStatus({ amountDue: p.amountDue, amountPaid: p.amountPaid, dueDate: p.dueDate, today }) };
}

export async function getPayment(uid: string, lease: Lease, period: string): Promise<Payment> {
  const snap = await paymentsCol(uid, lease.id).doc(period).get();
  return withStatus(snap.exists ? (snap.data() as PaymentDoc) : blankPayment(lease, period));
}

export async function listPayments(uid: string, lease: Lease, periods: string[]): Promise<Payment[]> {
  const refs = periods.map((p) => paymentsCol(uid, lease.id).doc(p));
  const snaps = refs.length ? await adminDb().getAll(...refs) : [];
  return snaps.map((s, i) => withStatus(s.exists ? (s.data() as PaymentDoc) : blankPayment(lease, periods[i])));
}

export async function upsertPayment(uid: string, lease: Lease, period: string, patch: Partial<PaymentDoc>): Promise<PaymentDoc> {
  const ref = paymentsCol(uid, lease.id).doc(period);
  const snap = await ref.get();
  const current = snap.exists ? (snap.data() as PaymentDoc) : blankPayment(lease, period);
  const next = { ...current, ...patch, updatedAt: Date.now() };
  await ref.set(next);
  return next;
}

export function ownerOf(user: UserDoc) {
  return { name: user.ownerName || user.displayName || user.email, address: user.ownerAddress || "" };
}

export async function buildQuittance(user: UserDoc, lease: Lease, payment: PaymentDoc) {
  return quittancePdf({
    owner: ownerOf(user),
    tenantName: lease.tenantName,
    propertyAddress: lease.propertyAddress,
    period: payment.period,
    rentCents: payment.rentCents,
    chargesCents: payment.chargesCents,
    amountPaidCents: payment.amountPaid,
    paidAt: payment.paidAt ?? payment.dueDate,
  });
}

/** Envoie la quittance (ou le reçu partiel) au locataire, propriétaire en copie. */
export async function sendQuittance(uid: string, user: UserDoc, lease: Lease, period: string): Promise<void> {
  const payment = await getPayment(uid, lease, period);
  if (payment.amountPaid <= 0) throw new Error("Aucun paiement enregistré pour cette période.");
  const pdf = await buildQuittance(user, lease, payment);
  const owner = ownerOf(user);
  const label = formatPeriod(period);
  await sendEmail({
    to: lease.tenantEmail,
    cc: user.email ? [user.email] : undefined,
    replyTo: user.email || undefined,
    ...templates.quittance({ tenantName: lease.tenantName, ownerName: owner.name, periodLabel: label, amount: formatEuros(payment.amountPaid), address: lease.propertyAddress }),
    attachments: [{ filename: `quittance-${period}.pdf`, content: Buffer.from(pdf) }],
  });
  await upsertPayment(uid, lease, period, { quittanceSentAt: Date.now() });
}

export async function sendNotice(uid: string, user: UserDoc, lease: Lease, payment: PaymentDoc) {
  const owner = ownerOf(user);
  await sendEmail({
    to: lease.tenantEmail,
    replyTo: user.email || undefined,
    ...templates.notice({
      tenantName: lease.tenantName,
      ownerName: owner.name,
      periodLabel: formatPeriod(payment.period),
      amount: formatEuros(payment.amountDue),
      dueDate: formatDateFr(payment.dueDate),
      rent: formatEuros(payment.rentCents),
      charges: formatEuros(payment.chargesCents),
    }),
  });
  await upsertPayment(uid, lease, payment.period, { noticeSentAt: Date.now() });
}

export async function sendReminder(uid: string, user: UserDoc, lease: Lease, payment: PaymentDoc, level: 1 | 2) {
  const owner = ownerOf(user);
  const common = { tenantName: lease.tenantName, ownerName: owner.name, periodLabel: formatPeriod(payment.period), amount: formatEuros(payment.amountDue - payment.amountPaid), dueDate: formatDateFr(payment.dueDate) };
  await sendEmail({ to: lease.tenantEmail, cc: user.email ? [user.email] : undefined, replyTo: user.email || undefined, ...templates.reminder({ level, ...common }) });
  await upsertPayment(uid, lease, payment.period, level === 1 ? { reminder1SentAt: Date.now() } : { reminder2SentAt: Date.now() });
}

export async function buildMiseEnDemeure(user: UserDoc, lease: Lease, unpaid: Payment[]) {
  return miseEnDemeurePdf({
    owner: ownerOf(user),
    tenantName: lease.tenantName,
    propertyAddress: lease.propertyAddress,
    items: unpaid.map((p) => ({ period: p.period, amountCents: p.amountDue - p.amountPaid })),
  });
}
