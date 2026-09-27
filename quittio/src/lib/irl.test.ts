import { describe, expect, it } from "vitest";
import { computeRevision, formatQuarter, latestForQuarter } from "./irl";

describe("IRL", () => {
  it("renvoie le dernier indice publié pour un trimestre", () => {
    expect(latestForQuarter(2, new Date("2026-09-01"))?.quarter).toBe("2026-T2");
    // Avant la publication de juillet 2026, le T2 le plus récent est celui de 2025.
    expect(latestForQuarter(2, new Date("2026-07-01"))?.quarter).toBe("2025-T2");
  });

  it("calcule une révision conforme (arrondi au centime inférieur)", () => {
    const r = computeRevision({ rentCents: 75000, referenceQuarter: "2025-T2", asOf: new Date("2026-09-01") });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // 750 × 148.37 / 146.68 = 758.6412…
    expect(r.newRentCents).toBe(75864);
    expect(r.increaseCents).toBe(864);
    expect(r.percent).toBe(1.15);
  });

  it("bloque la révision des passoires thermiques (DPE F/G)", () => {
    expect(computeRevision({ rentCents: 50000, referenceQuarter: "2025-T1", dpeClass: "g" })).toEqual({ ok: false, reason: "dpe_frozen" });
  });

  it("signale l'absence de nouvel indice", () => {
    const r = computeRevision({ rentCents: 50000, referenceQuarter: "2026-T2", asOf: new Date("2026-09-01") });
    expect(r).toEqual({ ok: false, reason: "no_new_index" });
  });

  it("formate un trimestre", () => {
    expect(formatQuarter("2026-T1")).toBe("1er trimestre 2026");
    expect(formatQuarter("2025-T3")).toBe("3e trimestre 2025");
  });
});
