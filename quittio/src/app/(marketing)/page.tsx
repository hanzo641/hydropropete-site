import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  Calculator,
  CalendarClock,
  FileCheck2,
  FileSpreadsheet,
  Lock,
  MailCheck,
  Scale,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/reveal";
import { ProductMock } from "@/components/marketing/product-mock";
import { Section } from "@/components/marketing/section";
import { Pricing } from "@/components/marketing/pricing";
import { Faq } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/cta";
import { JsonLd } from "@/components/json-ld";
import { FAQ } from "@/lib/faq";
import { LATEST_IRL, formatQuarter } from "@/lib/irl";
import { PLANS } from "@/lib/plans";
import { absoluteUrl, site } from "@/lib/site";

const steps = [
  {
    title: "Ajoutez votre logement",
    text: "Adresse, locataire, loyer, date d'échéance. 3 minutes, une seule fois.",
    icon: Smartphone,
  },
  {
    title: "Quittio prévient votre locataire",
    text: "Avis d'échéance envoyé automatiquement quelques jours avant la date de paiement.",
    icon: BellRing,
  },
  {
    title: "Le loyer arrive, la quittance part",
    text: "Un clic pour confirmer le paiement : la quittance PDF est envoyée. En cas de retard, les relances partent seules.",
    icon: MailCheck,
  },
];

const benefits = [
  { title: "Quittances conformes en 1 clic", text: "PDF aux mentions légales, loyer et charges détaillés, reçu partiel automatique si besoin.", icon: FileCheck2 },
  { title: "Relances d'impayés sans malaise", text: "Rappel cordial à J+5, relance ferme à J+15, mise en demeure prête à imprimer. Vous restez en copie.", icon: CalendarClock },
  { title: "Révision IRL calculée pour vous", text: "Indices INSEE officiels, alerte avant la date anniversaire, lettre au locataire générée.", icon: Calculator },
  { title: "Revenus fonciers prêts pour les impôts", text: "Récapitulatif annuel des loyers et charges encaissés, exportable en CSV (formule Patrimoine).", icon: FileSpreadsheet },
  { title: "Conforme au droit français", text: "Loi du 6 juillet 1989, gel des loyers des logements F et G, résiliation en 3 clics.", icon: Scale },
  { title: "Données protégées", text: "Hébergement dans l'Union européenne, paiements Stripe, aucune revente de données.", icon: Lock },
];

export default function HomePage() {
  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${site.name} — gestion locative en ligne`,
    description: site.description,
    brand: { "@type": "Brand", name: site.name },
    url: site.url,
    offers: PLANS.map((p) => ({
      "@type": "Offer",
      name: `Formule ${p.name}`,
      price: (p.price.month / 100).toFixed(2),
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
      url: absoluteUrl("/tarifs"),
    })),
  };

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="bg-grid absolute inset-0 -z-10 opacity-60" />
        <div className="container-page grid items-center gap-16 pb-20 pt-14 sm:pt-20 lg:grid-cols-[1.1fr_1fr] lg:pb-28">
          <div>
            <Link
              href="/outils/calcul-revision-loyer-irl"
              className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">Nouveau</span>
              IRL du {formatQuarter(LATEST_IRL.quarter)} : {LATEST_IRL.value.toString().replace(".", ",")}
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Vos loyers gérés <span className="bg-gradient-to-r from-primary to-[oklch(0.62_0.17_220)] bg-clip-text text-transparent">en pilote automatique</span>.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground sm:text-xl">
              Quittances envoyées, loyers suivis, retards relancés et révisions IRL calculées automatiquement. Gérez vos locations en 5 minutes par mois,
              sans agence.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/inscription">
                  Essayer gratuitement 14 jours <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/#fonctionnement">Voir comment ça marche</Link>
              </Button>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><ShieldCheck className="size-4 text-success" aria-hidden /> Sans engagement</li>
              <li className="flex items-center gap-2"><ShieldCheck className="size-4 text-success" aria-hidden /> Résiliable en 1 clic</li>
              <li className="flex items-center gap-2"><ShieldCheck className="size-4 text-success" aria-hidden /> Dès 4,90 €/mois</li>
            </ul>
          </div>
          <div className="animate-[hero-in_0.7s_ease-out_0.1s_both] motion-reduce:animate-none">
            <ProductMock />
          </div>
        </div>
      </section>

      {/* Preuve */}
      <section aria-labelledby="preuve" className="border-y bg-muted/30">
        <div className="container-page py-14">
          <h2 id="preuve" className="sr-only">
            Pourquoi les propriétaires choisissent Quittio
          </h2>
          <dl className="grid grid-cols-2 gap-8 text-center lg:grid-cols-4">
            {[
              { k: "≈ 7 % du loyer", v: "de frais d'agence évités en gérant en direct" },
              { k: "5 min/mois", v: "pour suivre tous vos loyers depuis votre téléphone" },
              { k: "100 % conforme", v: "quittances selon la loi du 6 juillet 1989" },
              { k: "Indices INSEE", v: "officiels, mis à jour chaque trimestre" },
            ].map((s) => (
              <div key={s.k}>
                <dt className="text-2xl font-semibold tracking-tight sm:text-3xl">{s.k}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <Section id="fonctionnement" eyebrow="Fonctionnement" title="Trois étapes, puis plus rien à faire" intro="Vous configurez une fois. Ensuite, Quittio s'occupe du rythme mensuel à votre place.">
        <ol className="grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title}>
              <Reveal delay={i * 0.08} className="h-full">
                <div className="h-full rounded-2xl border bg-card p-6">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                      <s.icon className="size-5" aria-hidden />
                    </span>
                    <span className="text-sm font-medium text-muted-foreground">Étape {i + 1}</span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-muted-foreground">{s.text}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </Section>

      <Section eyebrow="Bénéfices" title="Tout ce qu'une agence fait pour vos loyers, pour le prix d'un café" intro="Sans les 6 à 8 % de frais de gestion. Et sans vous déposséder de la relation avec votre locataire." className="bg-muted/20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((b, i) => (
            <Reveal key={b.title} delay={(i % 3) * 0.06}>
              <div className="group h-full rounded-2xl border bg-card p-6 transition-shadow hover:shadow-lg">
                <b.icon className="size-6 text-primary transition-transform group-hover:-translate-y-0.5" aria-hidden />
                <h3 className="mt-4 font-semibold">{b.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.text}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <div className="mx-auto mt-12 grid max-w-3xl overflow-hidden rounded-2xl border bg-card sm:grid-cols-2">
            <div className="p-6">
              <p className="text-sm font-medium text-muted-foreground">Agence de gestion (≈ 7 % TTC)</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">≈ 52 €<span className="text-base font-normal text-muted-foreground">/mois</span></p>
              <p className="mt-1 text-sm text-muted-foreground">pour un loyer de 750 €, soit ≈ 630 € par an</p>
            </div>
            <div className="border-t bg-primary/5 p-6 sm:border-l sm:border-t-0">
              <p className="text-sm font-medium text-primary">Quittio Sérénité</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">8,25 €<span className="text-base font-normal text-muted-foreground">/mois</span></p>
              <p className="mt-1 text-sm text-muted-foreground">en annuel, jusqu&apos;à 5 logements</p>
            </div>
          </div>
        </Reveal>
      </Section>

      <Section id="tarifs" eyebrow="Tarifs" title="Un prix simple, un essai sans risque" intro="14 jours gratuits sur toutes les formules. Changez ou résiliez quand vous voulez.">
        <Pricing />
      </Section>

      <Section id="faq" eyebrow="FAQ" title="Vos questions, nos réponses" className="bg-muted/20">
        <div className="mx-auto max-w-3xl">
          <Faq items={FAQ} />
        </div>
      </Section>

      <FinalCta />
      <JsonLd data={productLd} />
    </>
  );
}
