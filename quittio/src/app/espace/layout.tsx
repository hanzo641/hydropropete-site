import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CreditCard, Gift, Home, LayoutDashboard, UserRound } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { NavLink } from "@/components/app/nav-link";
import { LogoutButton } from "@/components/app/logout-button";
import { requireAccount } from "@/lib/session";

export const metadata: Metadata = { title: "Espace propriétaire", robots: { index: false, follow: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const account = await requireAccount();
  const status = account.user.subscription?.status;
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-xl lg:h-dvh lg:border-b-0 lg:border-r">
        <div className="flex h-14 items-center justify-between px-4 lg:h-16">
          <Link href="/espace" aria-label="Tableau de bord" className="rounded-md">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>
        <nav aria-label="Espace propriétaire" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:pb-0">
          <NavLink href="/espace" exact>
            <LayoutDashboard className="size-4" aria-hidden /> Tableau de bord
          </NavLink>
          <NavLink href="/espace/logements">
            <Home className="size-4" aria-hidden /> Logements
          </NavLink>
          <NavLink href="/espace/abonnement">
            <CreditCard className="size-4" aria-hidden /> Abonnement
          </NavLink>
          <NavLink href="/espace/parrainage">
            <Gift className="size-4" aria-hidden /> Parrainage
          </NavLink>
          <NavLink href="/espace/compte">
            <UserRound className="size-4" aria-hidden /> Compte
          </NavLink>
        </nav>
        <div className="hidden px-3 pt-6 lg:block">
          <p className="truncate px-3 text-xs text-muted-foreground">{account.email}</p>
          <div className="mt-2">
            <LogoutButton />
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        {status === "past_due" ? (
          <div role="alert" className="flex items-center gap-2 border-b border-warning/40 bg-warning/10 px-4 py-3 text-sm lg:px-8">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            Le dernier paiement a échoué. <Link href="/espace/abonnement" className="font-medium underline underline-offset-2">Mettre à jour ma carte</Link>
          </div>
        ) : null}
        <main id="contenu" className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-8 lg:py-10">
          {children}
        </main>
        <div className="px-4 pb-8 lg:hidden">
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
