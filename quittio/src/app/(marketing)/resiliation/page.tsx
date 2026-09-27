import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/marketing/page-hero";
import { ContactForm } from "@/components/marketing/contact-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Résilier mon abonnement",
  description: "Résiliez votre abonnement Quittio en quelques clics, sans frais ni justification.",
  alternates: { canonical: "/resiliation" },
};

/**
 * Fonctionnalité de résiliation « en 3 clics » (loi n° 2022-1158 du 16 août 2022,
 * décret n° 2023-417) : accessible depuis toutes les pages via le pied de page.
 */
export default function CancelPage() {
  return (
    <>
      <PageHero title="Résilier mon abonnement" intro="Sans frais, sans justification. La résiliation prend effet à la fin de la période en cours et vous recevez une confirmation par e-mail." />
      <section className="py-16">
        <div className="container-page grid max-w-5xl gap-8 lg:grid-cols-2">
          <div className="rounded-2xl border bg-card p-6 sm:p-8">
            <h2 className="text-lg font-semibold">Le plus rapide : depuis votre espace</h2>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-muted-foreground">
              <li>Cliquez sur « Résilier en ligne » (connexion si nécessaire)</li>
              <li>Cliquez sur « Résilier mon abonnement »</li>
              <li>Confirmez : c&apos;est fait, un e-mail de confirmation vous est envoyé</li>
            </ol>
            <Button asChild variant="destructive" className="mt-6">
              <Link href="/espace/abonnement#resilier">Résilier en ligne</Link>
            </Button>
          </div>
          <div className="rounded-2xl border bg-card p-6 sm:p-8">
            <h2 className="text-lg font-semibold">Vous n&apos;arrivez pas à vous connecter ?</h2>
            <p className="mt-2 text-sm text-muted-foreground">Envoyez-nous votre demande avec l&apos;e-mail de votre compte : accusé de réception immédiat, traitement sous 48 h ouvrées.</p>
            <div className="mt-6">
              <ContactForm defaultSubject="resiliation" lockSubject />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
