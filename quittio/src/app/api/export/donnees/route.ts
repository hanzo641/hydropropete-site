import { NextResponse } from "next/server";
import { getAccount } from "@/lib/session";
import { listLeases, paymentsCol } from "@/lib/leases";

/** Export de toutes les données du compte (droit à la portabilité, art. 20 RGPD). Accessible même sans abonnement actif. */
export async function GET() {
  const account = await getAccount();
  if (!account) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const leases = await listLeases(account.uid, true);
  const data = {
    exportedAt: new Date().toISOString(),
    account: { email: account.email, ownerName: account.user.ownerName, ownerAddress: account.user.ownerAddress, createdAt: account.user.createdAt, subscription: account.user.subscription },
    leases: await Promise.all(
      leases.map(async (l) => ({ ...l, payments: (await paymentsCol(account.uid, l.id).get()).docs.map((d) => d.data()) })),
    ),
  };
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": 'attachment; filename="quittio-mes-donnees.json"', "cache-control": "private, no-store" },
  });
}
