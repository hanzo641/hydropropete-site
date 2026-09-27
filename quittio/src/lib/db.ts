import type { BillingInterval, PlanId } from "./plans";

/** Documents Firestore. Tous les montants sont en centimes. */

export interface SubscriptionInfo {
  id: string;
  status: string;
  plan: PlanId;
  interval: BillingInterval;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  trialEnd: number | null;
  updatedAt: number;
}

export interface UserDoc {
  email: string;
  displayName?: string;
  /** Identité du bailleur imprimée sur les quittances. */
  ownerName?: string;
  ownerAddress?: string;
  createdAt: number;
  stripeCustomerId?: string;
  subscription?: SubscriptionInfo;
  /** L'utilisateur a déjà bénéficié d'un essai (pas de second essai gratuit). */
  hadTrial?: boolean;
  referralCode: string;
  referredBy?: string;
  /** Parrainages récompensés (identifiants des filleuls). */
  referralRewards?: string[];
}

export interface LeaseDoc {
  propertyLabel: string;
  propertyAddress: string;
  tenantName: string;
  tenantEmail: string;
  rentCents: number;
  chargesCents: number;
  dueDay: number;
  startDate: string;
  furnished: boolean;
  dpeClass?: string | null;
  irlReferenceQuarter: string;
  lastRevisionDate?: string | null;
  autoQuittance: boolean;
  remindersEnabled: boolean;
  noticeDaysBefore: number;
  /** Date anniversaire pour laquelle le rappel de révision a déjà été envoyé au bailleur. */
  revisionReminderFor?: string | null;
  active: boolean;
  createdAt: number;
}

export interface PaymentDoc {
  period: string;
  dueDate: string;
  amountDue: number;
  rentCents: number;
  chargesCents: number;
  amountPaid: number;
  paidAt?: string | null;
  quittanceSentAt?: number | null;
  noticeSentAt?: number | null;
  reminder1SentAt?: number | null;
  reminder2SentAt?: number | null;
  updatedAt: number;
}

export const col = {
  users: "users",
  leases: "leases",
  payments: "payments",
  referralCodes: "referralCodes",
  stripeEvents: "stripeEvents",
} as const;
