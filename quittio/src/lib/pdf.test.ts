import { describe, expect, it } from "vitest";
import { pdfSafe, quittancePdf } from "./pdf";

describe("PDF", () => {
  it("nettoie les caractères non encodables", () => {
    expect(pdfSafe("Loyer 1 250,00 € 🏠 œuvre")).toBe("Loyer 1 250,00 €  œuvre");
  });

  it("génère une quittance valide", async () => {
    const bytes = await quittancePdf({
      owner: { name: "Sophie Martin", address: "12 rue des Lilas, 64000 Pau" },
      tenantName: "Léa Dupont",
      propertyAddress: "3 place Clemenceau, 64000 Pau",
      period: "2026-09",
      rentCents: 62000,
      chargesCents: 4500,
      amountPaidCents: 66500,
      paidAt: "2026-09-03",
    });
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(1500);
  });
});
