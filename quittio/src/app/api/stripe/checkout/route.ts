import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { col } from "@/lib/db";
import { getAccount } from "@/lib/session";
import { priceIdFor, stripe } from "@/lib/stripe";
import { REFERRAL_TRIAL_DAYS, TRIAL_DAYS, getPlan, isInterval, isPlanId } from "@/lib/plans";
import { baseUrl, jsonError, sameOrigin } from "@/lib/http";

/**
 * Crée une session Stripe Checkout (abonnement). Accepte JSON ou formulaire
 * HTML classique (redirection 303) pour fonctionner même sans JavaScript.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return jsonError("Origine refusée", 403);
  const isForm = req.headers.get("content-type")?.includes("form") ?? false;
  const input = isForm ? Object.fromEntries((await req.formData()).entries()) : await req.json().catch(() => ({}));
  const { plan, interval } = input as { plan?: unknown; interval?: unknown };
  if (!isPlanId(plan) || !isInterval(interval)) return jsonError("Formule invalide");

  const account = await getAccount();
  if (!account) {
    const login = `/connexion?plan=${plan}&interval=${interval}`;
    return isForm ? NextResponse.redirect(new URL(login, req.url), 303) : jsonError("Non connecté", 401);
  }
  const base = baseUrl(req);

  try {
    const s = stripe();
    let url: string;

    if (account.active && account.user.subscription && account.user.stripeCustomerId) {
      // Déjà abonné : on passe par le portail pour changer de formule (prorata géré par Stripe).
      const portal = await s.billingPortal.sessions.create({ customer: account.user.stripeCustomerId, return_url: `${base}/espace/abonnement`, locale: "fr" });
      url = portal.url;
    } else {
      let customerId = account.user.stripeCustomerId;
      if (!customerId) {
        const customer = await s.customers.create(
          { email: account.email, name: account.user.ownerName || account.user.displayName || undefined, metadata: { uid: account.uid }, preferred_locales: ["fr"] },
          { idempotencyKey: `customer-${account.uid}` },
        );
        customerId = customer.id;
        await adminDb().collection(col.users).doc(account.uid).set({ stripeCustomerId: customerId }, { merge: true });
      }
      const trialDays = account.user.hadTrial ? undefined : account.user.referredBy ? REFERRAL_TRIAL_DAYS : TRIAL_DAYS;
      const session = await s.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        client_reference_id: account.uid,
        line_items: [{ price: priceIdFor(plan, interval), quantity: 1 }],
        subscription_data: {
          trial_period_days: trialDays,
          metadata: { uid: account.uid, plan },
          description: `Quittio ${getPlan(plan)?.name}`,
        },
        metadata: { uid: account.uid, plan, interval },
        allow_promotion_codes: true,
        billing_address_collection: "auto",
        locale: "fr",
        success_url: `${base}/espace?checkout=success`,
        cancel_url: `${base}/tarifs?checkout=cancel`,
        custom_text: {
          submit: {
            message: trialDays
              ? `Aucun débit pendant ${trialDays} jours. Résiliable en 1 clic depuis votre espace. En confirmant, vous acceptez nos CGV (${base}/cgv).`
              : `Résiliable en 1 clic depuis votre espace. En confirmant, vous acceptez nos CGV (${base}/cgv).`,
          },
        },
      });
      if (!session.url) throw new Error("Session Checkout sans URL");
      url = session.url;
    }

    return isForm ? NextResponse.redirect(url, 303) : NextResponse.json({ url });
  } catch (e) {
    console.error("[stripe/checkout]", e);
    return jsonError("Le paiement est momentanément indisponible. Réessayez dans un instant.", 500);
  }
}
