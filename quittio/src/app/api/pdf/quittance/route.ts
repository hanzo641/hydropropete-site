import { NextResponse, type NextRequest } from "next/server";
import { getAccount } from "@/lib/session";
import { buildQuittance, getLease, getPayment } from "@/lib/leases";
import { pdfResponse } from "@/lib/pdf-response";

export async function GET(req: NextRequest) {
  const account = await getAccount();
  if (!account?.active) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const leaseId = req.nextUrl.searchParams.get("lease") ?? "";
  const period = req.nextUrl.searchParams.get("period") ?? "";
  const lease = await getLease(account.uid, leaseId);
  if (!lease || !/^\d{4}-\d{2}$/.test(period)) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const payment = await getPayment(account.uid, lease, period);
  if (payment.amountPaid <= 0) return NextResponse.json({ error: "Aucun paiement enregistré" }, { status: 400 });
  return pdfResponse(await buildQuittance(account.user, lease, payment), `quittance-${period}.pdf`);
}
