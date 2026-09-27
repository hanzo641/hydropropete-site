import { NextResponse, type NextRequest } from "next/server";
import { getAccount } from "@/lib/session";
import { buildMiseEnDemeure, getLease, listPayments } from "@/lib/leases";
import { addMonths, periodOf, todayParis } from "@/lib/rent";
import { pdfResponse } from "@/lib/pdf-response";

export async function GET(req: NextRequest) {
  const account = await getAccount();
  if (!account?.active) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const lease = await getLease(account.uid, req.nextUrl.searchParams.get("lease") ?? "");
  if (!lease) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const current = periodOf(todayParis());
  const periods = Array.from({ length: 12 }, (_, i) => addMonths(current, -i)).filter((p) => p >= periodOf(lease.startDate));
  const unpaid = (await listPayments(account.uid, lease, periods)).filter((p) => p.status === "late" || p.status === "partial").reverse();
  if (!unpaid.length) return NextResponse.json({ error: "Aucun impayé" }, { status: 400 });
  return pdfResponse(await buildMiseEnDemeure(account.user, lease, unpaid), "mise-en-demeure.pdf");
}
