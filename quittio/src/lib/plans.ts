export type PlanId = "essentiel" | "serenite" | "patrimoine";
export type BillingInterval = "month" | "year";

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  /** Prix en centimes TTC. */
  price: { month: number; year: number };
  maxLeases: number;
  automation: boolean;
  exportCsv: boolean;
  highlighted?: boolean;
  features: string[];
}

export const TRIAL_DAYS = 14;
export const REFERRAL_TRIAL_DAYS = 30;

export const PLANS: Plan[] = [
  {
    id: "essentiel",
    name: "Essentiel",
    tagline: "Pour un seul logement loué",
    price: { month: 490, year: 4900 },
    maxLeases: 1,
    automation: false,
    exportCsv: false,
    features: [
      "1 logement",
      "Quittances PDF envoyées au locataire en 1 clic",
      "Suivi des loyers et historique",
      "Calcul et lettre de révision IRL",
    ],
  },
  {
    id: "serenite",
    name: "Sérénité",
    tagline: "Le pilote automatique complet",
    price: { month: 990, year: 9900 },
    maxLeases: 5,
    automation: true,
    exportCsv: false,
    highlighted: true,
    features: [
      "Jusqu'à 5 logements",
      "Tout Essentiel, plus :",
      "Avis d'échéance envoyés automatiquement",
      "Quittance automatique à l'échéance",
      "Relances d'impayés automatiques (J+5, J+15)",
      "Modèle de mise en demeure prêt à envoyer",
    ],
  },
  {
    id: "patrimoine",
    name: "Patrimoine",
    tagline: "Pour les investisseurs multi-biens",
    price: { month: 1990, year: 19900 },
    maxLeases: 20,
    automation: true,
    exportCsv: true,
    features: [
      "Jusqu'à 20 logements",
      "Tout Sérénité, plus :",
      "Export annuel des revenus fonciers (CSV)",
      "Support prioritaire < 24 h ouvrées",
    ],
  },
];

export function getPlan(id: string | undefined | null): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

export function isPlanId(id: unknown): id is PlanId {
  return typeof id === "string" && PLANS.some((p) => p.id === id);
}

export function isInterval(v: unknown): v is BillingInterval {
  return v === "month" || v === "year";
}

/** Statuts Stripe qui donnent accès au service. `past_due` = période de grâce pendant les relances de paiement. */
export const ACTIVE_STATUSES = ["active", "trialing", "past_due"] as const;

export function hasAccess(status: string | undefined | null): boolean {
  return !!status && (ACTIVE_STATUSES as readonly string[]).includes(status);
}
