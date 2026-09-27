import { NextResponse, type NextRequest } from "next/server";
import { getAccount } from "@/lib/session";
import { listLeases, listPayments } from "@/lib/leases";

const csvCell = (v: string | number) => {
  const s = String(v);
  // Neutralise les formules (injection CSV) et échappe les guillemets.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};
const euros = (c: number) => (c / 100).toFixed(2).replace(".", ",");

/** Récapitulatif annuel des loyers encaissés (aide à la déclaration 2044 / BIC LMNP). Formule Patrimoine. */
export async function GET(req: NextRequest) {
  const account = await getAccount();
  if (!account?.active || !account.plan?.exportCsv) return NextResponse.json({ error: "Réservé à la formule Patrimoine" }, { status: 403 });
  const year = Number(req.nextUrl.searchParams.get("annee") ?? new Date().getFullYear() - 1);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return NextResponse.json({ error: "Année invalide" }, { status: 400 });
  const periods = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const rows = [["Logement", "Adresse", "Locataire", "Type", "Période", "Loyer HC dû", "Charges dues", "Montant encaissé", "Date d'encaissement"]];
  const totals = new Map<string, { rent: number; charges: number; paid: number }>();
  for (const lease of await listLeases(account.uid, true)) {
    const payments = await listPayments(account.uid, lease, periods.filter((p) => p >= lease.startDate.slice(0, 7)));
    for (const p of payments.filter((x) => x.amountPaid > 0)) {
      rows.push([lease.propertyLabel, lease.propertyAddress, lease.tenantName, lease.furnished ? "Meublé" : "Nu", p.period, euros(p.rentCents), euros(p.chargesCents), euros(p.amountPaid), p.paidAt ?? ""]);
      const t = totals.get(lease.propertyLabel) ?? { rent: 0, charges: 0, paid: 0 };
      // Répartition loyer / charges au prorata du montant encaissé.
      const ratio = p.amountDue ? p.amountPaid / p.amountDue : 0;
      t.rent += Math.round(p.rentCents * ratio);
      t.charges += Math.round(p.chargesCents * ratio);
      t.paid += p.amountPaid;
      totals.set(lease.propertyLabel, t);
    }
  }
  rows.push([]);
  rows.push(["TOTAL PAR LOGEMENT", "", "", "", "", "Loyers HC encaissés", "Charges encaissées", "Total encaissé", ""]);
  for (const [label, t] of totals) rows.push([label, "", "", "", String(year), euros(t.rent), euros(t.charges), euros(t.paid), ""]);
  const csv = "﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n");
  return new NextResponse(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="revenus-locatifs-${year}.csv"`, "cache-control": "private, no-store" },
  });
}
