import "server-only";
import type Stripe from "stripe";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebase/admin";
import { col, type SubscriptionInfo, type UserDoc } from "./db";
import { planFromPriceId, stripe } from "./stripe";
import { getPlan, isInterval, isPlanId } from "./plans";

/** Retrouve l'utilisateur Firebase lié à un client Stripe. */
export async function uidForCustomer(customerId: string): Promise<string | null> {
  const snap = await adminDb().collection(col.users).where("stripeCustomerId", "==", customerId).limit(1).get();
  if (!snap.empty) return snap.docs[0].id;
  const customer = await stripe().customers.retrieve(customerId);
  if (customer.deleted) return null;
  return customer.metadata?.uid ?? null;
}

export function toSubscriptionInfo(sub: Stripe.Subscription): SubscriptionInfo {
  const item = sub.items.data[0];
  const fromPrice = item ? planFromPriceId(item.price.id) : null;
  const plan = fromPrice?.plan ?? (isPlanId(sub.metadata.plan) ? sub.metadata.plan : "essentiel");
  const interval = fromPrice?.interval ?? (isInterval(item?.price.recurring?.interval) ? item.price.recurring.interval : "month");
  return {
    id: sub.id,
    status: sub.status,
    plan,
    interval,
    currentPeriodEnd: item?.current_period_end ?? null,
    cancelAtPeriodEnd: sub.cancel_at_period_end || sub.cancel_at !== null,
    trialEnd: sub.trial_end,
    updatedAt: Date.now(),
  };
}

/**
 * Écrit l'état de l'abonnement dans Firestore. Idempotent et résistant au
 * désordre des webhooks : on relit toujours l'abonnement depuis Stripe.
 */
export async function syncSubscription(subscriptionId: string): Promise<{ uid: string; before?: SubscriptionInfo; after: SubscriptionInfo } | null> {
  const sub = await stripe().subscriptions.retrieve(subscriptionId);
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const uid = sub.metadata.uid || (await uidForCustomer(customerId));
  if (!uid) return null;
  const ref = adminDb().collection(col.users).doc(uid);
  const snap = await ref.get();
  // Compte supprimé entre-temps : on ne recrée pas de document fantôme.
  if (!snap.exists) return null;
  const before = (snap.data() as UserDoc).subscription;
  // Un client qui a plusieurs abonnements (ex. résiliation puis ré-abonnement) :
  // on ne remplace pas un abonnement actif par un ancien abonnement terminé.
  if (before && before.id !== sub.id && ["active", "trialing", "past_due"].includes(before.status) && ["canceled", "incomplete_expired"].includes(sub.status)) {
    return null;
  }
  const after = toSubscriptionInfo(sub);
  await ref.set(
    {
      stripeCustomerId: customerId,
      subscription: after,
      ...(sub.trial_end ? { hadTrial: true } : {}),
    },
    { merge: true },
  );
  return { uid, before, after };
}

/**
 * Parrainage : quand un filleul paie sa première facture, on crédite le
 * parrain d'un mois de son abonnement (solde client Stripe négatif).
 */
export async function rewardReferrer(refereeUid: string): Promise<string | null> {
  const db = adminDb();
  const referee = (await db.collection(col.users).doc(refereeUid).get()).data() as UserDoc | undefined;
  if (!referee?.referredBy) return null;
  const referrerRef = db.collection(col.users).doc(referee.referredBy);
  const referrer = (await referrerRef.get()).data() as UserDoc | undefined;
  if (!referrer?.stripeCustomerId || !referrer.subscription || referrer.referralRewards?.includes(refereeUid)) return null;
  const plan = getPlan(referrer.subscription.plan);
  if (!plan) return null;
  await stripe().customers.createBalanceTransaction(
    referrer.stripeCustomerId,
    { amount: -plan.price.month, currency: "eur", description: "Parrainage Quittio : 1 mois offert" },
    { idempotencyKey: `referral-${referee.referredBy}-${refereeUid}` },
  );
  await referrerRef.update({ referralRewards: FieldValue.arrayUnion(refereeUid) });
  return referrer.email;
}
