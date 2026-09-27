import { NextResponse, type NextRequest } from "next/server";
import { getAccount } from "@/lib/session";
import { getLease, ownerOf } from "@/lib/leases";
import { computeRevision } from "@/lib/irl";
import { revisionLetterPdf } from "@/lib/pdf";
import { revisionEffectiveDate, todayParis } from "@/lib/rent";
import { pdfResponse } from "@/lib/pdf-response";

export async function GET(req: NextRequest) {
  const account = await getAccount();
  if (!account?.active) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const lease = await getLease(account.uid, req.nextUrl.searchParams.get("lease") ?? "");
  if (!lease) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const r = computeRevision({ rentCents: lease.rentCents, referenceQuarter: lease.irlReferenceQuarter, dpeClass: lease.dpeClass });
  if (!r.ok) return NextResponse.json({ error: "Aucune révision applicable" }, { status: 400 });
  const today = todayParis();
  const bytes = await revisionLetterPdf({
    owner: ownerOf(account.user),
    tenantName: lease.tenantName,
    propertyAddress: lease.propertyAddress,
    oldRentCents: lease.rentCents,
    newRentCents: r.newRentCents,
    oldIndex: r.oldIndex,
    newIndex: r.newIndex,
    effectiveDate: revisionEffectiveDate(lease.startDate, lease.lastRevisionDate, today),
  });
  return pdfResponse(bytes, "lettre-revision-loyer.pdf");
}
