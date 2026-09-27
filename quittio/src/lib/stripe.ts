import "server-only";
import Stripe from "stripe";
import type { BillingInterval, PlanId } from "./plans";

let client: Stripe | undefined;

export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY manquant.");
  client ??= new Stripe(key, { appInfo: { name: "Quittio" } });
  return client;
}

const PRICE_ENV: Record<PlanId, Record<BillingInterval, string>> = {
  essentiel: { month: "STRIPE_PRICE_ESSENTIEL_MONTHLY", year: "STRIPE_PRICE_ESSENTIEL_YEARLY" },
  serenite: { month: "STRIPE_PRICE_SERENITE_MONTHLY", year: "STRIPE_PRICE_SERENITE_YEARLY" },
  patrimoine: { month: "STRIPE_PRICE_PATRIMOINE_MONTHLY", year: "STRIPE_PRICE_PATRIMOINE_YEARLY" },
};

export function priceIdFor(plan: PlanId, interval: BillingInterval): string {
  const id = process.env[PRICE_ENV[plan][interval]];
  if (!id) throw new Error(`${PRICE_ENV[plan][interval]} manquant.`);
  return id;
}

export function planFromPriceId(priceId: string): { plan: PlanId; interval: BillingInterval } | null {
  for (const [plan, intervals] of Object.entries(PRICE_ENV) as [PlanId, Record<BillingInterval, string>][]) {
    for (const [interval, env] of Object.entries(intervals) as [BillingInterval, string][]) {
      if (process.env[env] === priceId) return { plan, interval };
    }
  }
  return null;
}
