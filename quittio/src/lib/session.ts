import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { randomBytes } from "node:crypto";
import { adminAuth, adminDb } from "./firebase/admin";
import { col, type UserDoc } from "./db";
import { getPlan, hasAccess, type Plan } from "./plans";

export const SESSION_COOKIE = "__session";
export const REFERRAL_COOKIE = "qref";
export const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export interface Account {
  uid: string;
  email: string;
  user: UserDoc;
  active: boolean;
  plan: Plan | undefined;
}

export const getSessionUser = cache(async (): Promise<{ uid: string; email: string } | null> => {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(cookie, true);
    return { uid: decoded.uid, email: decoded.email ?? "" };
  } catch {
    return null;
  }
});

export const getAccount = cache(async (): Promise<Account | null> => {
  const session = await getSessionUser();
  if (!session) return null;
  const snap = await adminDb().collection(col.users).doc(session.uid).get();
  const user = (snap.data() as UserDoc | undefined) ?? (await ensureUserDoc(session.uid, session.email));
  const status = user.subscription?.status;
  return {
    uid: session.uid,
    email: session.email || user.email,
    user,
    active: hasAccess(status),
    plan: hasAccess(status) ? getPlan(user.subscription?.plan) : undefined,
  };
});

export async function requireAccount(next = "/espace"): Promise<Account> {
  const account = await getAccount();
  if (!account) redirect(`/connexion?next=${encodeURIComponent(next)}`);
  return account;
}

/** Bloque l'accès aux fonctionnalités si l'abonnement n'est pas actif. */
export async function requireActiveAccount(next = "/espace"): Promise<Account & { plan: Plan }> {
  const account = await requireAccount(next);
  if (!account.active || !account.plan) redirect("/espace/abonnement?inactive=1");
  return account as Account & { plan: Plan };
}

function newReferralCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(7);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/** Crée le document utilisateur au premier login (idempotent). */
export async function ensureUserDoc(uid: string, email: string, displayName?: string, referralCode?: string): Promise<UserDoc> {
  const db = adminDb();
  const ref = db.collection(col.users).doc(uid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) return snap.data() as UserDoc;
    let referredBy: string | undefined;
    if (referralCode) {
      const codeSnap = await tx.get(db.collection(col.referralCodes).doc(referralCode.toUpperCase()));
      const referrer = codeSnap.data()?.uid as string | undefined;
      if (referrer && referrer !== uid) referredBy = referrer;
    }
    const code = newReferralCode();
    const doc: UserDoc = {
      email,
      displayName,
      ownerName: displayName,
      createdAt: Date.now(),
      referralCode: code,
      referredBy,
    };
    tx.set(ref, doc);
    tx.set(db.collection(col.referralCodes).doc(code), { uid });
    return doc;
  });
}
