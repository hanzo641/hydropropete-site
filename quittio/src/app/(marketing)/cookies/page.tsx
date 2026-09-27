import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { ManageCookiesButton } from "@/components/cookie-consent";

export const metadata: Metadata = { title: "Politique cookies", alternates: { canonical: "/cookies" } };

const rows = [
  ["__session", "Cookie", "Maintien de la connexion à l'espace client", "14 jours", "Indispensable"],
  ["qref", "Cookie", "Mémorisation du code de parrainage après un clic sur un lien de parrainage", "30 jours", "Indispensable (service demandé)"],
  ["quittio-consent", "Stockage local", "Mémorisation de vos choix de cookies", "6 mois", "Indispensable"],
  ["theme", "Stockage local", "Mémorisation du thème clair / sombre", "Persistant", "Indispensable (préférence)"],
  ["Vercel Web Analytics", "Aucun cookie", "Mesure d'audience anonyme (pages vues)", "—", "Soumis à consentement"],
  ["Stripe (checkout.stripe.com)", "Cookies tiers", "Sécurité et prévention de la fraude lors du paiement, sur le domaine de Stripe", "Selon Stripe", "Indispensable"],
];

export default function CookiesPage() {
  return (
    <LegalPage title="Politique cookies" updated="27 septembre 2026">
      <p>
        Nous limitons au strict nécessaire les traceurs déposés sur votre appareil. Aucun cookie publicitaire ni réseau social n&apos;est utilisé. Conformément aux lignes
        directrices de la CNIL, les traceurs non indispensables ne sont activés qu&apos;après votre consentement, que vous pouvez retirer à tout moment.
      </p>
      <div className="not-prose overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              {["Nom", "Type", "Finalité", "Durée", "Catégorie"].map((h) => (
                <th key={h} scope="col" className="p-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y align-top">
            {rows.map((r) => (
              <tr key={r[0]}>
                {r.map((c, i) => (
                  <td key={i} className="p-3">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>Modifier vos choix</h2>
      <p>
        <ManageCookiesButton className="font-medium text-primary underline underline-offset-2" />. Votre choix est conservé 6 mois, après quoi nous vous le redemandons.
      </p>
    </LegalPage>
  );
}
