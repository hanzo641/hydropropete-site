import { NextResponse, type NextRequest } from "next/server";
import { REFERRAL_COOKIE } from "@/lib/session";

/** Lien de parrainage /r/CODE : mémorise le code 30 jours puis redirige vers les tarifs. */
export async function GET(req: NextRequest, ctx: RouteContext<"/r/[code]">) {
  const { code } = await ctx.params;
  const res = NextResponse.redirect(new URL("/tarifs?parrainage=1", req.url));
  if (/^[A-Z2-9]{7}$/i.test(code)) {
    res.cookies.set(REFERRAL_COOKIE, code.toUpperCase(), { maxAge: 60 * 60 * 24 * 30, sameSite: "lax", path: "/", httpOnly: true });
  }
  return res;
}
