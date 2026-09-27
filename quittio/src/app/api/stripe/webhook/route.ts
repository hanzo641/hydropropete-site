import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { adminDb } from "@/lib/firebase/admin";
import { col, type UserDoc } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { rewardReferrer, syncSubscription, uidForCustomer } from "@/lib/billing";
import { sendEmail, templates } from "@/lib/email";
import { formatDateFr } from "@/lib/utils";

const fmt = (unix: number | null | undefined) => (unix ? formatDateFr(new Date(unix * 1000)) : null);

async function emailFor(uid: string): Promise<string | null> {
  const doc = (await adminDb().collection(col.users).doc(uid).get()).data() as UserDoc | undefined;
  return doc?.email ?? null;
}

function subscriptionIdOfInvoice(invoice: Stripe.Invoice): string | null {
  const s = invoice.parent?.subscription_details?.subscription;
  return !s ? null : typeof s === "string" ? s : s.id;
}

async function handle(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode === "subscription" && session.subscription) {
        await syncSubscription(typeof session.subscription === "string" ? session.subscription : session.subscription.id);
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed": {
      const result = await syncSubscription(event.data.object.id);
      if (!result) break;
      const { uid, before, after } = result;
      const justScheduledCancel = after.cancelAtPeriodEnd && !(before?.id === after.id && before.cancelAtPeriodEnd);
      const endedNow = event.type === "customer.subscription.deleted" && !(before?.id === after.id && before.cancelAtPeriodEnd);
      if (justScheduledCancel || endedNow) {
        const email = await emailFor(uid);
        if (email) await sendEmail({ to: email, ...templates.cancellationConfirmed({ endDate: justScheduledCancel ? fmt(after.currentPeriodEnd) : null }) });
      }
      break;
    }

    case "customer.subscription.trial_will_end": {
      const sub = event.data.object;
      if (sub.cancel_at_period_end) break;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const uid = sub.metadata.uid || (await uidForCustomer(customerId));
      const email = uid ? await emailFor(uid) : null;
      if (email && sub.trial_end) await sendEmail({ to: email, ...templates.trialEnding({ endDate: fmt(sub.trial_end)! }) });
      break;
    }

    case "invoice.paid": {
      // Renouvellement ou premier paiement : on resynchronise la période en cours.
      const invoice = event.data.object;
      const subId = subscriptionIdOfInvoice(invoice);
      if (!subId) break;
      const result = await syncSubscription(subId);
      if (result && invoice.amount_paid > 0) {
        const referrerEmail = await rewardReferrer(result.uid);
        if (referrerEmail) await sendEmail({ to: referrerEmail, ...templates.referralReward() });
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const subId = subscriptionIdOfInvoice(invoice);
      if (subId) await syncSubscription(subId);
      if (invoice.customer_email) await sendEmail({ to: invoice.customer_email, ...templates.paymentFailed() });
      break;
    }

    default:
      break;
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!secret || !signature) return NextResponse.json({ error: "Signature manquante" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), signature, secret);
  } catch (e) {
    console.error("[stripe/webhook] signature invalide", e);
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  // Idempotence : Stripe peut livrer plusieurs fois le même événement.
  const marker = adminDb().collection(col.stripeEvents).doc(event.id);
  try {
    await marker.create({ type: event.type, receivedAt: Date.now() });
  } catch {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await handle(event);
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error(`[stripe/webhook] ${event.type} ${event.id}`, e);
    await marker.delete().catch(() => {});
    return NextResponse.json({ error: "Erreur de traitement" }, { status: 500 });
  }
}
