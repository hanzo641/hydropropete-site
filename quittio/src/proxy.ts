import { NextResponse, type NextRequest } from "next/server";

/**
 * Redirection rapide vers la connexion si aucun cookie de session n'est
 * présent. La vérification cryptographique du cookie et du statut
 * d'abonnement est faite côté serveur dans chaque page de /espace.
 */
export function proxy(req: NextRequest) {
  if (!req.cookies.has("__session")) {
    const url = new URL("/connexion", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/espace/:path*"] };
