import type { Metadata } from "next";
import Link from "next/link";
import { IrlCalculator } from "@/components/marketing/irl-calculator";
import { PageHero } from "@/components/marketing/page-hero";
import { Faq } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/cta";
import { JsonLd } from "@/components/json-ld";
import { IRL_VALUES, LATEST_IRL, formatQuarter, parseQuarter } from "@/lib/irl";
import { formatDateFr } from "@/lib/utils";
import { absoluteUrl } from "@/lib/site";

const latest = formatQuarter(LATEST_IRL.quarter);

export const metadata: Metadata = {
  title: `Calcul de révision de loyer IRL ${parseQuarter(LATEST_IRL.quarter)?.year} — simulateur gratuit`,
  description: `Calculez gratuitement votre nouveau loyer avec l'IRL du ${latest} (${LATEST_IRL.value.toString().replace(".", ",")}). Formule officielle, tableau des indices INSEE, règles DPE F et G.`,
  alternates: { canonical: "/outils/calcul-revision-loyer-irl" },
};

const faq = [
  { q: "Comment calculer la révision d'un loyer avec l'IRL ?", a: "Nouveau loyer = loyer hors charges actuel × IRL du même trimestre de l'année suivante ÷ IRL de référence indiqué dans le bail. Les charges ne sont pas révisées par l'IRL." },
  { q: "Quel IRL utiliser pour réviser mon loyer ?", a: "Celui du trimestre mentionné dans votre bail. À défaut, c'est le dernier indice publié à la date de signature du bail. On compare ensuite avec l'indice du même trimestre, un an plus tard." },
  { q: "La révision du loyer est-elle rétroactive ?", a: "Non. Depuis la loi ALUR (2014), le bailleur dispose d'un an après la date anniversaire pour demander la révision, et celle-ci ne prend effet qu'à compter de sa demande. Un oubli se traduit donc par une perte définitive." },
  { q: "Peut-on augmenter le loyer d'un logement classé F ou G ?", a: "Non. Depuis le 24 août 2022 en métropole, les loyers des logements classés F ou G au DPE ne peuvent plus être révisés, majorés ni réévalués." },
];

export default function IrlToolPage() {
  return (
    <>
      <PageHero
        eyebrow="Outil gratuit"
        title="Calculez la révision de votre loyer en 10 secondes"
        intro={`Avec les indices INSEE officiels, dont l'IRL du ${latest} : ${LATEST_IRL.value.toString().replace(".", ",")}.`}
      >
        <div className="mx-auto mt-10 max-w-4xl">
          <IrlCalculator />
        </div>
      </PageHero>

      <article className="container-page prose prose-neutral max-w-3xl py-16 dark:prose-invert sm:py-20">
        <h2>Comment fonctionne la révision annuelle du loyer ?</h2>
        <p>
          Si votre bail contient une clause de révision, vous pouvez augmenter le loyer une fois par an, à la date anniversaire du bail (ou à la date prévue au contrat).
          L&apos;augmentation est plafonnée par la variation de l&apos;<strong>Indice de Référence des Loyers (IRL)</strong>, publié chaque trimestre par l&apos;INSEE.
        </p>
        <p>
          La formule légale (article 17-1 de la loi du 6 juillet 1989) est simple : <strong>loyer actuel × nouvel IRL ÷ IRL de référence</strong>. Le « nouvel IRL » est celui
          du même trimestre que l&apos;indice de référence, un an plus tard.
        </p>
        <h3>Exemple</h3>
        <p>
          Un bail avec un loyer de 750 € et une référence au 2e trimestre 2025 (146,68). Avec l&apos;IRL du 2e trimestre 2026 (148,37), le nouveau loyer maximum est 750 × 148,37
          ÷ 146,68 = <strong>758,64 €</strong>.
        </p>
        <h3>Les erreurs qui coûtent cher</h3>
        <ul>
          <li>
            <strong>Oublier la révision</strong> : elle n&apos;est pas rétroactive. Chaque mois de retard est perdu définitivement. Consultez notre guide{" "}
            <Link href="/blog/revision-loyer-oubliee">révision de loyer oubliée</Link>.
          </li>
          <li>
            <strong>Réviser les charges</strong> : seule la part hors charges suit l&apos;IRL.
          </li>
          <li>
            <strong>Augmenter un logement F ou G</strong> : c&apos;est interdit depuis août 2022.
          </li>
        </ul>
        <p>
          Avec <Link href="/tarifs">Quittio</Link>, la date anniversaire de chaque bail est suivie automatiquement : vous êtes prévenu 30 jours avant et la lettre de révision
          est générée pour vous.
        </p>

        <h2>Tableau des indices IRL (INSEE)</h2>
        <div className="not-prose overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <caption className="sr-only">Valeurs trimestrielles de l&apos;IRL en France métropolitaine</caption>
            <thead className="border-b bg-muted/50">
              <tr>
                <th scope="col" className="p-3 text-left">Trimestre</th>
                <th scope="col" className="p-3 text-right">IRL</th>
                <th scope="col" className="p-3 text-right">Variation sur un an</th>
                <th scope="col" className="p-3 text-right">Publication</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {IRL_VALUES.map((e, i) => {
                const prev = IRL_VALUES[i + 4];
                const variation = prev ? ((e.value / prev.value - 1) * 100).toFixed(2).replace(".", ",") : null;
                return (
                  <tr key={e.quarter}>
                    <th scope="row" className="p-3 text-left font-normal capitalize">{formatQuarter(e.quarter)}</th>
                    <td className="p-3 text-right font-medium tabular-nums">{e.value.toFixed(2).replace(".", ",")}</td>
                    <td className="p-3 text-right tabular-nums">{variation ? `+${variation} %` : "—"}</td>
                    <td className="p-3 text-right text-muted-foreground">{formatDateFr(e.published)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-sm">Source : INSEE, série 001515333 (France métropolitaine). Des valeurs spécifiques existent pour la Corse et l&apos;outre-mer.</p>
      </article>

      <section className="pb-8">
        <div className="container-page max-w-3xl">
          <h2 className="mb-8 text-2xl font-semibold tracking-tight">Questions fréquentes sur l&apos;IRL</h2>
          <Faq items={faq} />
        </div>
      </section>
      <FinalCta title="Ne ratez plus jamais une révision de loyer." />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Calculateur de révision de loyer IRL",
          url: absoluteUrl("/outils/calcul-revision-loyer-irl"),
          applicationCategory: "FinanceApplication",
          operatingSystem: "Web",
          offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
          publisher: { "@id": absoluteUrl("/#organization") },
        }}
      />
    </>
  );
}
