import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminAuth } from "@/lib/firebase/admin";
import { REFERRAL_COOKIE, SESSION_COOKIE, SESSION_MAX_AGE_MS, ensureUserDoc } from "@/lib/session";
import { sendEmail, templates } from "@/lib/email";
import { jsonError, sameOrigin } from "@/lib/http";

const body = z.object({ idToken: z.string().min(10) });

/** Échange un ID token Firebase contre un cookie de session httpOnly (14 jours). */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return jsonError("Origine refusée", 403);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Requête invalide");

  try {
    const decoded = await adminAuth().verifyIdToken(parsed.data.idToken, true);
    // On n'accepte que des connexions récentes (< 5 min) pour limiter le rejeu d'un token volé.
    if (Date.now() / 1000 - decoded.auth_time > 5 * 60) return jsonError("Connexion expirée, veuillez réessayer", 401);

    const sessionCookie = await adminAuth().createSessionCookie(parsed.data.idToken, { expiresIn: SESSION_MAX_AGE_MS });
    const referral = req.cookies.get(REFERRAL_COOKIE)?.value;
    const { user, created } = await ensureUserDoc(decoded.uid, decoded.email ?? "", decoded.name as string | undefined, referral);

    if (created && user.email) {
      await sendEmail({ to: user.email, ...templates.welcome(user.displayName ?? "") }).catch((e) => console.error("[welcome]", e));
    }

    const res = NextResponse.json({ ok: true, created });
    res.cookies.set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_MS / 1000,
    });
    if (referral) res.cookies.delete(REFERRAL_COOKIE);
    return res;
  } catch (e) {
    console.error("[auth/session]", e);
    return jsonError("Authentification impossible", 401);
  }
}

export async function DELETE(req: NextRequest) {
  if (!sameOrigin(req)) return jsonError("Origine refusée", 403);
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (cookie) {
    try {
      const decoded = await adminAuth().verifySessionCookie(cookie);
      await adminAuth().revokeRefreshTokens(decoded.sub);
    } catch {
      /* session déjà invalide */
    }
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
