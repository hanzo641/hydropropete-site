import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Comment Quittio collecte, utilise et protège vos données personnelles et celles de vos locataires (RGPD).",
  alternates: { canonical: "/confidentialite" },
};

export default function PrivacyPage() {
  const e = site.editor;
  return (
    <LegalPage title="Politique de confidentialité" updated="27 septembre 2026">
      <p>
        Cette politique explique comment {site.name} traite les données personnelles, conformément au Règlement (UE) 2016/679 (RGPD) et à la loi Informatique et Libertés.
      </p>

      <h2>1. Responsable du traitement</h2>
      <p>
        {e.legalName}, {e.address} — contact : {site.supportEmail}.
      </p>
      <p>
        <strong>Données de vos locataires :</strong> lorsque vous saisissez les informations de vos locataires, <em>vous</em> êtes responsable de ce traitement (gestion de
        votre location) et {site.name} agit en tant que <em>sous-traitant</em> au sens de l&apos;article 28 du RGPD : nous traitons ces données uniquement pour vous fournir le
        Service, sur vos instructions, et ne les utilisons jamais à d&apos;autres fins. Les présentes clauses, avec les CGV, valent contrat de sous-traitance.
      </p>

      <h2>2. Données traitées, finalités et bases légales</h2>
      <div className="not-prose overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th scope="col" className="p-3">Finalité</th>
              <th scope="col" className="p-3">Données</th>
              <th scope="col" className="p-3">Base légale</th>
              <th scope="col" className="p-3">Durée</th>
            </tr>
          </thead>
          <tbody className="divide-y align-top">
            <tr>
              <td className="p-3">Création et gestion du compte</td>
              <td className="p-3">E-mail, nom, identifiant, mot de passe (haché par Firebase)</td>
              <td className="p-3">Exécution du contrat</td>
              <td className="p-3">Durée du compte + 12 mois après la fin de l&apos;abonnement</td>
            </tr>
            <tr>
              <td className="p-3">Fourniture du Service (quittances, relances, révisions)</td>
              <td className="p-3">Identité et adresse du bailleur ; nom et e-mail du locataire ; adresse du logement ; montants et dates de paiement</td>
              <td className="p-3">Exécution du contrat</td>
              <td className="p-3">Idem</td>
            </tr>
            <tr>
              <td className="p-3">Facturation et paiement</td>
              <td className="p-3">Identifiant client Stripe, historique d&apos;abonnement, factures</td>
              <td className="p-3">Contrat et obligation légale</td>
              <td className="p-3">10 ans pour les pièces comptables</td>
            </tr>
            <tr>
              <td className="p-3">E-mails de service (confirmation, échec de paiement, rappel d&apos;essai)</td>
              <td className="p-3">E-mail</td>
              <td className="p-3">Exécution du contrat</td>
              <td className="p-3">Durée du compte</td>
            </tr>
            <tr>
              <td className="p-3">Réponse aux demandes de contact</td>
              <td className="p-3">Nom, e-mail, message</td>
              <td className="p-3">Intérêt légitime</td>
              <td className="p-3">3 ans</td>
            </tr>
            <tr>
              <td className="p-3">Mesure d&apos;audience</td>
              <td className="p-3">Pages vues, pays, type d&apos;appareil (anonymisés, sans cookie)</td>
              <td className="p-3">Consentement</td>
              <td className="p-3">24 mois</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Le générateur gratuit de quittance ne conserve aucune donnée : le PDF est produit à la volée. Nous ne vendons ni ne louons aucune donnée, et n&apos;utilisons aucun
        traceur publicitaire.
      </p>

      <h2>3. Destinataires et sous-traitants</h2>
      <ul>
        <li>Google Ireland Ltd (Firebase Authentication, Cloud Firestore) — hébergement des comptes et données, région Union européenne ;</li>
        <li>Stripe Payments Europe Ltd (Irlande) — paiement et facturation ;</li>
        <li>Resend (Plus Five Five Inc., États-Unis) — envoi des e-mails transactionnels ;</li>
        <li>Vercel Inc. (États-Unis) — hébergement du site et mesure d&apos;audience anonyme.</li>
      </ul>
      <p>
        Certains prestataires peuvent traiter des données hors de l&apos;Union européenne. Ces transferts sont encadrés par la décision d&apos;adéquation UE–États-Unis (Data
        Privacy Framework) lorsque le prestataire y est certifié, et à défaut par les clauses contractuelles types de la Commission européenne.
      </p>

      <h2>4. Sécurité</h2>
      <p>
        Données chiffrées en transit (TLS) et au repos ; accès cloisonné par compte ; sessions protégées par cookie httpOnly ; aucune donnée bancaire stockée par nos soins.
        En cas de violation de données, nous notifions la CNIL et les personnes concernées dans les conditions prévues par le RGPD.
      </p>

      <h2>5. Vos droits</h2>
      <p>
        Vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de limitation, d&apos;opposition et de portabilité, ainsi que du droit de définir des
        directives post-mortem. Depuis votre espace, vous pouvez exporter toutes vos données et supprimer votre compte en autonomie. Pour toute autre demande :{" "}
        {site.supportEmail}. Réponse sous un mois. Vous pouvez introduire une réclamation auprès de la CNIL (<a href="https://www.cnil.fr">www.cnil.fr</a>).
      </p>
      <p>
        Vos locataires peuvent exercer leurs droits auprès de vous (responsable du traitement) ; nous vous assistons pour y répondre.
      </p>

      <h2>6. Cookies</h2>
      <p>
        Voir notre <a href="/cookies">politique cookies</a>.
      </p>
    </LegalPage>
  );
}
