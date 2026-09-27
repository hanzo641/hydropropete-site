import Link from "next/link";
import { Logo } from "@/components/logo";
import { ManageCookiesButton } from "@/components/cookie-consent";
import { site } from "@/lib/site";

const columns = [
  {
    title: "Produit",
    links: [
      { href: "/#fonctionnement", label: "Fonctionnement" },
      { href: "/tarifs", label: "Tarifs" },
      { href: "/inscription", label: "Essai gratuit" },
      { href: "/connexion", label: "Espace client" },
    ],
  },
  {
    title: "Outils gratuits",
    links: [
      { href: "/outils/calcul-revision-loyer-irl", label: "Calculateur de révision IRL" },
      { href: "/outils/quittance-de-loyer-gratuite", label: "Quittance de loyer gratuite" },
      { href: "/blog", label: "Guides du bailleur" },
    ],
  },
  {
    title: "Entreprise",
    links: [
      { href: "/contact", label: "Contact" },
      { href: "/mentions-legales", label: "Mentions légales" },
      { href: "/cgv", label: "CGV" },
      { href: "/confidentialite", label: "Confidentialité" },
      { href: "/cookies", label: "Cookies" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-4 text-sm text-muted-foreground">{site.tagline}.</p>
          <p className="mt-4 text-sm text-muted-foreground">
            Une question ?{" "}
            <a href={`mailto:${site.supportEmail}`} className="font-medium text-foreground underline-offset-2 hover:underline">
              {site.supportEmail}
            </a>
          </p>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <p className="text-sm font-semibold">{col.title}</p>
            <ul className="mt-4 space-y-3 text-sm">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-muted-foreground transition-colors hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t">
        <div className="container-page flex flex-col gap-3 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {site.name}. Fait avec soin en France.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/resiliation" className="font-medium text-foreground underline-offset-2 hover:underline">
              Résilier mon abonnement
            </Link>
            <ManageCookiesButton className="hover:text-foreground" />
          </div>
        </div>
      </div>
    </footer>
  );
}
