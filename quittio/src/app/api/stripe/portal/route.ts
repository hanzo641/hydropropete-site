import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getAccount } from "@/lib/session";
import { stripe } from "@/lib/stripe";
import { baseUrl, jsonError, sameOrigin } from "@/lib/http";

/**
 * Ouvre le Customer Portal Stripe. `flow=cancel` mène directement à l'écran
 * de résiliation (parcours « résiliation en 3 clics », loi n° 2022-1158).
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return jsonError("Origine refusée", 403);
  const isForm = req.headers.get("content-type")?.includes("form") ?? false;
  const input = isForm ? Object.fromEntries((await req.formData()).entries()) : await req.json().catch(() => ({}));
  const flow = (input as { flow?: string }).flow;

  const account = await getAccount();
  if (!account) return isForm ? NextResponse.redirect(new URL("/connexion?next=/espace/abonnement", req.url), 303) : jsonError("Non connecté", 401);
  const customer = account.user.stripeCustomerId;
  if (!customer) return isForm ? NextResponse.redirect(new URL("/tarifs", req.url), 303) : jsonError("Aucun abonnement", 404);

  const base = baseUrl(req);
  const sub = account.user.subscription;
  let flowData: Stripe.BillingPortal.SessionCreateParams.FlowData | undefined;
  if (flow === "cancel" && sub && !sub.cancelAtPeriodEnd && ["active", "trialing", "past_due"].includes(sub.status)) {
    flowData = {
      type: "subscription_cancel",
      subscription_cancel: { subscription: sub.id },
      after_completion: { type: "redirect", redirect: { return_url: `${base}/espace/abonnement?resiliation=ok` } },
    };
  } else if (flow === "payment") {
    flowData = { type: "payment_method_update" };
  }

  try {
    const session = await stripe().billingPortal.sessions.create({
      customer,
      return_url: `${base}/espace/abonnement`,
      locale: "fr",
      flow_data: flowData,
    });
    return isForm ? NextResponse.redirect(session.url, 303) : NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[stripe/portal]", e);
    return jsonError("Portail momentanément indisponible", 500);
  }
}
