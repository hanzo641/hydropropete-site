import type { Metadata } from "next";
import { Pricing } from "@/components/marketing/pricing";
import { Faq } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/cta";
import { PageHero } from "@/components/marketing/page-hero";
import { FAQ } from "@/lib/faq";
import { PLANS } from "@/lib/plans";
import { formatEuros } from "@/lib/utils";
import { Check, Minus } from "lucide-react";

export const metadata: Metadata = {
  title: "Tarifs — logiciel de quittance de loyer dès 4,90 €/mois",
  description: "Quittio dès 4,90 €/mois : quittances automatiques, relances d'impayés, révision IRL. 14 jours d'essai gratuit, sans engagement, résiliable en 1 clic.",
  alternates: { canonical: "/tarifs" },
};

const rows: { label: string; values: (boolean | string)[] }[] = [
  { label: "Nombre de logements", values: PLANS.map((p) => String(p.maxLeases)) },
  { label: "Quittances PDF + envoi par e-mail", values: [true, true, true] },
  { label: "Suivi des loyers et historique", values: [true, true, true] },
  { label: "Calcul et lettre de révision IRL", values: [true, true, true] },
  { label: "Rappel de révision avant la date anniversaire", values: [true, true, true] },
  { label: "Avis d'échéance automatiques", values: [false, true, true] },
  { label: "Quittance automatique à l'échéance", values: [false, true, true] },
  { label: "Relances d'impayés J+5 / J+15", values: [false, true, true] },
  { label: "Mise en demeure pré-remplie", values: [false, true, true] },
  { label: "Export annuel des revenus fonciers (CSV)", values: [false, false, true] },
  { label: "Support prioritaire", values: [false, false, true] },
];

export default async function PricingPage({ searchParams }: PageProps<"/tarifs">) {
  const sp = await searchParams;
  return (
    <>
      <PageHero eyebrow="Tarifs" title="Moins cher qu'une agence. Plus rapide qu'un tableur." intro="Toutes les formules incluent 14 jours d'essai gratuit. Sans engagement, résiliable en un clic depuis votre espace.">
        {sp.parrainage ? (
          <p role="status" className="mx-auto mt-6 max-w-md rounded-xl border border-success/30 bg-success/10 p-3 text-sm">
            🎁 Lien de parrainage activé : votre essai gratuit passe à 30 jours.
          </p>
        ) : null}
        {sp.checkout === "cancel" ? (
          <p role="status" className="mx-auto mt-6 max-w-md rounded-xl border p-3 text-sm">
            Paiement annulé, rien n&apos;a été débité. Une question avant de vous lancer ? Écrivez-nous.
          </p>
        ) : null}
      </PageHero>
      <section className="py-16 sm:py-20">
        <div className="container-page">
          <Pricing headingLevel="h2" />
        </div>
      </section>

      <section aria-labelledby="comparatif" className="pb-16 sm:pb-24">
        <div className="container-page">
          <h2 id="comparatif" className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            Comparatif détaillé
          </h2>
          <div className="mx-auto mt-10 max-w-4xl overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full min-w-[560px] text-sm">
              <caption className="sr-only">Fonctionnalités incluses par formule</caption>
              <thead>
                <tr className="border-b">
                  <th scope="col" className="p-4 text-left font-medium text-muted-foreground">Fonctionnalité</th>
                  {PLANS.map((p) => (
                    <th key={p.id} scope="col" className="p-4 text-center font-semibold">
                      {p.name}
                      <span className="block text-xs font-normal text-muted-foreground">{formatEuros(p.price.month)}/mois</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.label}>
                    <th scope="row" className="p-4 text-left font-normal">{r.label}</th>
                    {r.values.map((v, i) => (
                      <td key={i} className="p-4 text-center">
                        {typeof v === "string" ? (
                          v
                        ) : v ? (
                          <Check className="mx-auto size-4 text-primary" aria-label="Inclus" />
                        ) : (
                          <Minus className="mx-auto size-4 text-muted-foreground" aria-label="Non inclus" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section aria-labelledby="faq-tarifs" className="bg-muted/20 py-16 sm:py-24">
        <div className="container-page max-w-3xl">
          <h2 id="faq-tarifs" className="mb-10 text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            Questions fréquentes
          </h2>
          <Faq items={FAQ} />
        </div>
      </section>
      <FinalCta />
    </>
  );
}
