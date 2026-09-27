import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { site } from "@/lib/site";
import { PLANS, REFERRAL_TRIAL_DAYS, TRIAL_DAYS } from "@/lib/plans";
import { formatEuros } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Conditions générales de vente (CGV)",
  description: "Conditions générales de vente des abonnements Quittio : prix, essai gratuit, droit de rétractation, résiliation en 3 clics.",
  alternates: { canonical: "/cgv" },
};

export default function CgvPage() {
  const e = site.editor;
  return (
    <LegalPage title="Conditions générales de vente" updated="27 septembre 2026">
      <h2>1. Objet et champ d&apos;application</h2>
      <p>
        Les présentes conditions générales de vente (CGV) régissent la souscription et l&apos;utilisation des abonnements au service en ligne {site.name} (le « Service »),
        édité par {e.legalName}, {e.status}, SIRET {e.siret}, {e.address} (l&apos;« Éditeur »), par toute personne physique ou morale (le « Client »). Elles prévalent sur tout
        autre document. Le Client les accepte en validant sa souscription.
      </p>

      <h2>2. Description du Service</h2>
      <p>
        {site.name} est un logiciel en ligne d&apos;aide à la gestion locative permettant notamment : l&apos;enregistrement de logements, baux et locataires ; la génération et
        l&apos;envoi par e-mail de quittances et reçus de loyer ; l&apos;envoi d&apos;avis d&apos;échéance et de relances ; le calcul de la révision annuelle des loyers selon
        l&apos;IRL ; la génération de modèles de courriers ; l&apos;export de données. Les fonctionnalités incluses dépendent de la formule choisie et sont décrites sur la page{" "}
        <a href="/tarifs">Tarifs</a>. Le Service est un outil : le Client reste seul responsable des informations saisies, des documents envoyés à ses locataires et du
        respect de ses obligations de bailleur. Les modèles fournis ne constituent pas un conseil juridique.
      </p>

      <h2>3. Formules et prix</h2>
      <ul>
        {PLANS.map((p) => (
          <li key={p.id}>
            {p.name} : {formatEuros(p.price.month)} par mois ou {formatEuros(p.price.year)} par an, jusqu&apos;à {p.maxLeases} logement(s).
          </li>
        ))}
      </ul>
      <p>
        Les prix sont indiqués en euros toutes taxes comprises. {e.vat}. L&apos;Éditeur peut modifier ses prix ; toute modification est notifiée au Client au moins 30 jours
        avant son application et ne s&apos;applique qu&apos;à la période suivante. Le Client qui la refuse peut résilier sans frais avant son entrée en vigueur.
      </p>

      <h2>4. Essai gratuit</h2>
      <p>
        Toute première souscription bénéficie d&apos;une période d&apos;essai gratuite de {TRIAL_DAYS} jours ({REFERRAL_TRIAL_DAYS} jours via un lien de parrainage). Un moyen de
        paiement est demandé à la souscription mais aucun montant n&apos;est prélevé pendant l&apos;essai. Un e-mail de rappel est envoyé avant la fin de l&apos;essai. Sans
        résiliation avant son terme, l&apos;abonnement payant démarre automatiquement à l&apos;issue de l&apos;essai. Un seul essai est accordé par Client.
      </p>

      <h2>5. Souscription et paiement</h2>
      <p>
        La souscription s&apos;effectue en ligne : création d&apos;un compte, choix de la formule et de la périodicité, puis saisie du moyen de paiement sur la page sécurisée de
        notre prestataire Stripe Payments Europe Ltd. Le contrat est conclu à la validation de cette page ; une confirmation est adressée par e-mail. Le paiement est
        prélevé à l&apos;avance pour chaque période (mois ou année), à la date anniversaire de la souscription. L&apos;Éditeur n&apos;a jamais accès aux données complètes de
        la carte bancaire. Une facture est disponible dans l&apos;espace client.
      </p>
      <p>
        En cas d&apos;échec de paiement, de nouvelles tentatives sont effectuées automatiquement pendant environ deux semaines et le Client en est informé par e-mail ; le
        Service reste accessible pendant ce délai. À défaut de régularisation, l&apos;abonnement prend fin et l&apos;accès aux fonctionnalités est suspendu ; les données sont
        conservées conformément à l&apos;article 10.
      </p>

      <h2>6. Durée et renouvellement</h2>
      <p>
        L&apos;abonnement est conclu pour la période choisie (un mois ou un an) et se renouvelle tacitement pour une durée identique, sauf résiliation. Pour les abonnements
        annuels souscrits par un consommateur, l&apos;Éditeur informe le Client par e-mail, au plus tôt trois mois et au plus tard un mois avant le terme, de la possibilité de
        ne pas reconduire le contrat (article L215-1 du Code de la consommation).
      </p>

      <h2>7. Droit de rétractation</h2>
      <p>
        Conformément aux articles L221-18 et suivants du Code de la consommation, le Client consommateur dispose d&apos;un délai de <strong>14 jours</strong> à compter de la
        conclusion du contrat pour se rétracter, sans avoir à motiver sa décision ni à supporter d&apos;autres coûts que ceux prévus à l&apos;article L221-25. La période
        d&apos;essai gratuite de {TRIAL_DAYS} jours couvre ce délai : une résiliation pendant l&apos;essai n&apos;entraîne aucun paiement.
      </p>
      <p>
        Lorsque le Client souscrit sans période d&apos;essai (réabonnement) et demande expressément à bénéficier du Service immédiatement, il reconnaît qu&apos;en cas de
        rétractation il reste redevable d&apos;un montant proportionnel au service fourni jusqu&apos;à la communication de sa décision (article L221-25). L&apos;Éditeur
        rembourse le solde au plus tard 14 jours après réception de la rétractation, par le même moyen de paiement.
      </p>
      <p>
        Pour exercer ce droit, le Client adresse une déclaration dénuée d&apos;ambiguïté par e-mail à {site.supportEmail}, via le formulaire de la page{" "}
        <a href="/resiliation">Résiliation</a>, ou au moyen du modèle ci-dessous :
      </p>
      <blockquote>
        <p>
          À l&apos;attention de {e.legalName}, {e.address}, {site.supportEmail} : Je vous notifie par la présente ma rétractation du contrat portant sur la prestation de
          services ci-dessous : abonnement {site.name}, formule […], souscrit le […]. Nom du consommateur : […]. Adresse e-mail du compte : […]. Date : […]. Signature (en cas de
          notification sur papier).
        </p>
      </blockquote>

      <h2>8. Résiliation par le Client</h2>
      <p>
        Le Client peut résilier son abonnement <strong>à tout moment, sans frais ni justification</strong>, conformément à la loi n° 2022-1158 du 16 août 2022 (« résiliation
        en trois clics ») :
      </p>
      <ol>
        <li>depuis l&apos;espace client, rubrique « Abonnement », bouton « Résilier mon abonnement », puis confirmation ;</li>
        <li>depuis le lien « Résilier mon abonnement » présent en bas de chaque page du site ;</li>
        <li>par e-mail à {site.supportEmail}.</li>
      </ol>
      <p>
        Un accusé de réception indiquant la date de prise d&apos;effet est adressé par e-mail. La résiliation prend effet à la fin de la période en cours déjà payée, jusqu&apos;à
        laquelle le Service reste accessible ; aucune somme supplémentaire n&apos;est prélevée. Sauf exercice du droit de rétractation, la période entamée n&apos;est pas
        remboursée.
      </p>

      <h2>9. Changement de formule</h2>
      <p>
        Le Client peut changer de formule à tout moment depuis son espace. Le changement est immédiat et donne lieu à un ajustement au prorata sur la facture suivante.
        Le passage à une formule inférieure suppose que le nombre de logements actifs soit compatible avec la nouvelle formule.
      </p>

      <h2>10. Données et réversibilité</h2>
      <p>
        Le Client peut exporter ses données à tout moment (format JSON et, selon la formule, CSV). Après la fin de l&apos;abonnement, les données sont conservées 12 mois afin
        de permettre un réabonnement, puis supprimées, sauf obligation légale contraire. Le Client peut demander leur suppression immédiate depuis son espace.
        Le traitement des données personnelles est décrit dans la <a href="/confidentialite">politique de confidentialité</a>.
      </p>

      <h2>11. Disponibilité et responsabilité</h2>
      <p>
        L&apos;Éditeur met en œuvre les moyens raisonnables pour assurer l&apos;accessibilité du Service 24 h/24, sous réserve des opérations de maintenance et des
        interruptions indépendantes de sa volonté (obligation de moyens). Sa responsabilité ne saurait être engagée en cas de mauvaise saisie des informations par le
        Client, d&apos;usage non conforme, ou de non-réception d&apos;un e-mail imputable au destinataire. Pour les Clients professionnels, la responsabilité de l&apos;Éditeur
        est limitée au montant payé au cours des douze derniers mois.
      </p>

      <h2>12. Garantie légale de conformité</h2>
      <p>
        Le Client consommateur bénéficie de la garantie légale de conformité des contenus et services numériques (articles L224-25-1 et suivants du Code de la
        consommation) pendant toute la durée de fourniture du Service. Pour la mettre en œuvre, il contacte {site.supportEmail}.
      </p>

      <h2>13. Parrainage</h2>
      <p>
        Le filleul bénéficie d&apos;un essai de {REFERRAL_TRIAL_DAYS} jours. Le parrain reçoit un crédit égal à un mois de sa formule mensuelle lorsque le filleul règle sa
        première facture ; ce crédit est imputé sur ses factures suivantes et n&apos;est pas remboursable en numéraire. Tout abus (auto-parrainage, comptes fictifs) entraîne
        l&apos;annulation des crédits.
      </p>

      <h2>14. Modification des CGV</h2>
      <p>
        L&apos;Éditeur peut modifier les présentes CGV. Les Clients sont informés par e-mail au moins 30 jours avant l&apos;entrée en vigueur de toute modification
        substantielle et peuvent résilier sans frais avant cette date.
      </p>

      <h2>15. Médiation et droit applicable</h2>
      <p>
        Les présentes CGV sont soumises au droit français. En cas de litige, le Client consommateur peut, après réclamation écrite préalable restée sans réponse
        satisfaisante, recourir gratuitement au médiateur de la consommation : {e.mediator}. À défaut d&apos;accord amiable, les tribunaux compétents sont ceux désignés par
        la loi.
      </p>
    </LegalPage>
  );
}
