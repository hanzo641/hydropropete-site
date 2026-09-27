import "server-only";
import { stripe } from "./stripe";
import { syncSubscription } from "./billing";

/** Filet de sécurité au retour de Checkout si le webhook n'est pas encore arrivé. */
export async function syncLatestSubscription(customerId: string): Promise<boolean> {
  try {
    const subs = await stripe().subscriptions.list({ customer: customerId, status: "all", limit: 1 });
    if (!subs.data[0]) return false;
    return !!(await syncSubscription(subs.data[0].id));
  } catch (e) {
    console.error("[syncLatestSubscription]", e);
    return false;
  }
}
