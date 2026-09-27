import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { site } from "./site";

/** Refuse les requêtes d'état envoyées depuis une autre origine (défense CSRF en plus de SameSite=Lax). */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    const o = new URL(origin);
    return o.host === host || o.origin === site.url;
  } catch {
    return false;
  }
}

export const jsonError = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export function baseUrl(req: NextRequest): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return site.url;
  return req.nextUrl.origin;
}
