import { describe, expect, it } from "vitest";
import { addMonths, automationActions, dueDateFor, nextAnniversary, paymentStatus, todayParis } from "./rent";

describe("échéances", () => {
  it("borne le jour d'échéance à la fin du mois", () => {
    expect(dueDateFor("2026-02", 31)).toBe("2026-02-28");
    expect(dueDateFor("2028-02", 30)).toBe("2028-02-29");
    expect(dueDateFor("2026-09", 5)).toBe("2026-09-05");
  });

  it("ajoute des mois en changeant d'année", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });

  it("calcule le statut de paiement", () => {
    const base = { amountDue: 80000, dueDate: "2026-09-05" };
    expect(paymentStatus({ ...base, amountPaid: 0, today: "2026-09-01" })).toBe("upcoming");
    expect(paymentStatus({ ...base, amountPaid: 0, today: "2026-09-06" })).toBe("due");
    expect(paymentStatus({ ...base, amountPaid: 0, today: "2026-09-10" })).toBe("late");
    expect(paymentStatus({ ...base, amountPaid: 30000, today: "2026-09-10" })).toBe("partial");
    expect(paymentStatus({ ...base, amountPaid: 80000, today: "2026-09-10" })).toBe("paid");
  });

  it("utilise le fuseau de Paris", () => {
    expect(todayParis(new Date("2026-09-27T22:30:00Z"))).toBe("2026-09-28");
  });

  it("trouve la prochaine date anniversaire", () => {
    expect(nextAnniversary("2023-10-15", "2026-09-27")).toBe("2026-10-15");
    expect(nextAnniversary("2023-03-01", "2026-09-27")).toBe("2027-03-01");
    expect(nextAnniversary("2026-09-01", "2026-09-27")).toBe("2027-09-01");
  });
});

describe("automatisations", () => {
  const base = { dueDate: "2026-09-05", noticeDaysBefore: 5, autoQuittance: false, remindersEnabled: true, sent: {} };

  it("envoie l'avis d'échéance dans la fenêtre", () => {
    expect(automationActions({ ...base, today: "2026-08-31", status: "upcoming" })).toEqual(["notice"]);
    expect(automationActions({ ...base, today: "2026-08-29", status: "upcoming" })).toEqual([]);
    expect(automationActions({ ...base, today: "2026-09-01", status: "upcoming", sent: { notice: true } })).toEqual([]);
  });

  it("relance à J+5 puis J+15, une seule fois", () => {
    expect(automationActions({ ...base, today: "2026-09-10", status: "late" })).toEqual(["reminder1"]);
    expect(automationActions({ ...base, today: "2026-09-11", status: "late", sent: { reminder1: true } })).toEqual([]);
    expect(automationActions({ ...base, today: "2026-09-20", status: "late", sent: { reminder1: true } })).toEqual(["reminder2"]);
  });

  it("émet la quittance automatique à l'échéance et ne relance pas", () => {
    expect(automationActions({ ...base, autoQuittance: true, today: "2026-09-05", status: "due" })).toEqual(["auto_quittance"]);
  });

  it("ne fait rien si le loyer est payé", () => {
    expect(automationActions({ ...base, today: "2026-09-20", status: "paid" })).toEqual([]);
  });
});
