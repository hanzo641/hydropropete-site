import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { MobileNav } from "./mobile-nav";

export const NAV = [
  { href: "/#fonctionnement", label: "Fonctionnement" },
  { href: "/tarifs", label: "Tarifs" },
  { href: "/outils/calcul-revision-loyer-irl", label: "Calcul IRL" },
  { href: "/outils/quittance-de-loyer-gratuite", label: "Quittance gratuite" },
  { href: "/blog", label: "Blog" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2">
        Aller au contenu
      </a>
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label="Quittio, accueil" className="rounded-md">
          <Logo />
        </Link>
        <nav aria-label="Navigation principale" className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link href="/connexion">Connexion</Link>
          </Button>
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/inscription">Essai gratuit</Link>
          </Button>
          <MobileNav items={NAV} />
        </div>
      </div>
    </header>
  );
}
