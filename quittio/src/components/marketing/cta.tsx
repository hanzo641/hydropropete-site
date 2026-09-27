import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FinalCta({ title = "Votre prochaine quittance peut partir dans 3 minutes." }: { title?: string }) {
  return (
    <section className="py-20 sm:py-28">
      <div className="container-page">
        <div className="relative overflow-hidden rounded-3xl border bg-card px-6 py-16 text-center shadow-sm sm:px-16">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-64 max-w-3xl rounded-full bg-[var(--glow)] blur-3xl" />
          <h2 className="relative mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            14 jours pour tester, sans débit. Si Quittio ne vous fait pas gagner de temps, vous résiliez en un clic.
          </p>
          <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/inscription">
                Commencer l&apos;essai gratuit <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/tarifs">Voir les tarifs</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
