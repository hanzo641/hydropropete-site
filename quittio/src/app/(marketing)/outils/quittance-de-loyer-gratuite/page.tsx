import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { Faq } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/cta";
import { JsonLd } from "@/components/json-ld";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { absoluteUrl } from "@/lib/site";
import { periodOf, todayParis } from "@/lib/rent";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Quittance de loyer gratuite en PDF — modèle conforme 2026",
  description: "Générez gratuitement une quittance de loyer conforme à la loi de 1989, en PDF, en 1 minute. Sans inscription. Loyer et charges détaillés.",
  alternates: { canonical: "/outils/quittance-de-loyer-gratuite" },
};

const faq = [
  { q: "La quittance de loyer est-elle obligatoire ?", a: "Le bailleur doit la remettre gratuitement au locataire qui en fait la demande (article 21 de la loi du 6 juillet 1989). Elle ne peut être délivrée qu'après paiement intégral du loyer et des charges ; en cas de paiement partiel, on délivre un reçu." },
  { q: "Quelles mentions doit contenir une quittance ?", a: "L'identité du bailleur et du locataire, l'adresse du logement, la période concernée, et le détail des sommes versées en distinguant le loyer et les charges. La date de paiement et la signature du bailleur sont recommandées." },
  { q: "Peut-on envoyer la quittance par e-mail ?", a: "Oui, avec l'accord du locataire, la quittance peut être transmise par voie dématérialisée. C'est ce que fait Quittio automatiquement chaque mois." },
  { q: "Mes données sont-elles conservées ?", a: "Non. Ce générateur crée le PDF à la volée : rien n'est enregistré sur nos serveurs." },
];

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

export default function FreeReceiptPage() {
  const today = todayParis();
  return (
    <>
      <PageHero eyebrow="Outil gratuit" title="Quittance de loyer gratuite, en PDF, en 1 minute" intro="Modèle conforme à la loi du 6 juillet 1989. Sans inscription, rien n'est conservé.">
        <form action="/api/tools/quittance" method="post" className="mx-auto mt-10 grid max-w-3xl gap-5 rounded-2xl border bg-card p-6 text-left shadow-xl sm:grid-cols-2 sm:p-8">
          <Field id="ownerName" label="Nom du bailleur">
            <Input id="ownerName" name="ownerName" required autoComplete="name" />
          </Field>
          <Field id="tenantName" label="Nom du locataire">
            <Input id="tenantName" name="tenantName" required />
          </Field>
          <Field id="ownerAddress" label="Adresse du bailleur">
            <Textarea id="ownerAddress" name="ownerAddress" required className="min-h-20" />
          </Field>
          <Field id="propertyAddress" label="Adresse du logement loué">
            <Textarea id="propertyAddress" name="propertyAddress" required className="min-h-20" />
          </Field>
          <Field id="period" label="Mois concerné">
            <Input id="period" name="period" type="month" required defaultValue={periodOf(today)} />
          </Field>
          <Field id="paidAt" label="Date du paiement">
            <Input id="paidAt" name="paidAt" type="date" required defaultValue={today} />
          </Field>
          <Field id="rent" label="Loyer hors charges (€)">
            <Input id="rent" name="rent" inputMode="decimal" required placeholder="650,00" />
          </Field>
          <Field id="charges" label="Charges (€)">
            <Input id="charges" name="charges" inputMode="decimal" defaultValue="0" />
          </Field>
          <div aria-hidden className="hidden">
            <label htmlFor="website">Ne pas remplir</label>
            <input id="website" name="website" tabIndex={-1} autoComplete="off" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" size="lg" className="w-full sm:w-auto">
              <Download aria-hidden /> Télécharger ma quittance PDF
            </Button>
            <p className="mt-3 text-sm text-muted-foreground">
              Vous louez tous les mois ? <Link href="/inscription" className="font-medium text-primary underline-offset-2 hover:underline">Quittio l&apos;envoie automatiquement à votre locataire</Link>.
            </p>
          </div>
        </form>
      </PageHero>

      <article className="container-page prose prose-neutral max-w-3xl py-16 dark:prose-invert sm:py-20">
        <h2>Ce que dit la loi sur la quittance de loyer</h2>
        <p>
          La quittance est le document par lequel le bailleur atteste que le locataire a payé son loyer et ses charges pour une période donnée. L&apos;article 21 de la loi
          n° 89-462 du 6 juillet 1989 impose au bailleur de la <strong>transmettre gratuitement</strong> au locataire qui la demande. Facturer des « frais de quittance » est
          interdit.
        </p>
        <p>
          Elle doit détailler <strong>le loyer et les charges</strong> séparément. Si le locataire n&apos;a payé qu&apos;une partie, le bailleur délivre un{" "}
          <strong>reçu</strong>, et non une quittance : la quittance vaut preuve de paiement intégral. Pour tout comprendre, lisez notre guide{" "}
          <Link href="/blog/quittance-de-loyer-obligatoire">la quittance de loyer est-elle obligatoire ?</Link>
        </p>
        <h2>Pourquoi automatiser vos quittances ?</h2>
        <p>
          Une quittance par mois, c&apos;est 12 documents par an et par logement, à ne pas oublier. Avec <Link href="/tarifs">Quittio</Link>, un clic suffit quand le loyer
          arrive (ou zéro clic avec la quittance automatique), et votre locataire reçoit son PDF par e-mail. Les relances en cas de retard et la révision annuelle du loyer
          sont gérées au même endroit.
        </p>
      </article>
      <section className="pb-8">
        <div className="container-page max-w-3xl">
          <h2 className="mb-8 text-2xl font-semibold tracking-tight">Questions fréquentes</h2>
          <Faq items={faq} />
        </div>
      </section>
      <FinalCta title="Vos prochaines quittances, envoyées sans y penser." />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Générateur de quittance de loyer gratuit",
          url: absoluteUrl("/outils/quittance-de-loyer-gratuite"),
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
          publisher: { "@id": absoluteUrl("/#organization") },
        }}
      />
    </>
  );
}
