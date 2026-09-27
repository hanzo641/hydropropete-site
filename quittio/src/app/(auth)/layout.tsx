import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div aria-hidden className="bg-grid absolute inset-0 -z-10 opacity-50" />
      <header className="container-page flex h-16 items-center justify-between">
        <Link href="/" aria-label="Retour à l'accueil de Quittio" className="rounded-md">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>
      <main id="contenu" className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:items-center sm:pt-0">
        {children}
      </main>
    </div>
  );
}
