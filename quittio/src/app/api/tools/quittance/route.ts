import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { quittancePdf } from "@/lib/pdf";
import { pdfResponse } from "@/lib/pdf-response";
import { eurosToCents } from "@/lib/utils";
import { sameOrigin } from "@/lib/http";

const schema = z.object({
  ownerName: z.string().trim().min(2).max(120),
  ownerAddress: z.string().trim().min(5).max(250),
  tenantName: z.string().trim().min(2).max(120),
  propertyAddress: z.string().trim().min(5).max(250),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  rent: z.string().trim().min(1),
  charges: z.string().trim().default("0"),
  paidAt: z.iso.date(),
  website: z.string().max(0).optional(), // pot de miel anti-robots
});

/** Générateur public de quittance ponctuelle (outil gratuit, aucune donnée conservée). */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Origine refusée" }, { status: 403 });
  const parsed = schema.safeParse(Object.fromEntries((await req.formData()).entries()));
  if (!parsed.success) return NextResponse.json({ error: "Formulaire incomplet ou invalide." }, { status: 400 });
  const d = parsed.data;
  let rentCents: number, chargesCents: number;
  try {
    rentCents = eurosToCents(d.rent);
    chargesCents = eurosToCents(d.charges || "0");
  } catch {
    return NextResponse.json({ error: "Montant invalide." }, { status: 400 });
  }
  const bytes = await quittancePdf({
    owner: { name: d.ownerName, address: d.ownerAddress },
    tenantName: d.tenantName,
    propertyAddress: d.propertyAddress,
    period: d.period,
    rentCents,
    chargesCents,
    amountPaidCents: rentCents + chargesCents,
    paidAt: d.paidAt,
  });
  return pdfResponse(bytes, `quittance-${d.period}.pdf`);
}
