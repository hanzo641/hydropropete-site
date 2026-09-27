import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Mentions légales", alternates: { canonical: "/mentions-legales" }, robots: { index: true, follow: true } };

export default function LegalNoticePage() {
  const e = site.editor;
  return (
    <LegalPage title="Mentions légales" updated="27 septembre 2026">
      <p>Conformément à l&apos;article 6 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l&apos;économie numérique (LCEN) :</p>
      <h2>Éditeur du site</h2>
      <ul>
        <li>Nom / raison sociale : {e.legalName}</li>
        <li>Statut : {e.status}</li>
        <li>SIRET : {e.siret}</li>
        <li>Immatriculation : {e.rcs}</li>
        <li>Adresse : {e.address}</li>
        <li>Téléphone : {e.phone}</li>
        <li>E-mail : {site.supportEmail}</li>
        <li>TVA : {e.vat}</li>
        <li>Directeur de la publication : {e.director}</li>
      </ul>
      <h2>Hébergement</h2>
      <p>
        Site hébergé par {site.host.name}, {site.host.address} — <a href={site.host.website}>{site.host.website}</a>.
        <br />
        Données applicatives hébergées par Google Cloud (Firebase / Firestore), Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irlande, dans la région
        Union européenne.
      </p>
      <h2>Propriété intellectuelle</h2>
      <p>
        L&apos;ensemble des contenus du site (textes, interface, logo, code) est la propriété de l&apos;éditeur, sauf mention contraire. Toute reproduction non autorisée
        est interdite. Les indices IRL sont publiés par l&apos;INSEE et reproduits avec mention de la source.
      </p>
      <h2>Données personnelles</h2>
      <p>
        Voir notre <a href="/confidentialite">politique de confidentialité</a> et notre <a href="/cookies">politique cookies</a>.
      </p>
      <h2>Médiation de la consommation</h2>
      <p>
        Conformément à l&apos;article L612-1 du Code de la consommation, vous pouvez recourir gratuitement au médiateur : {e.mediator}. Plateforme européenne de règlement
        des litiges en ligne : <a href="https://ec.europa.eu/consumers/odr">ec.europa.eu/consumers/odr</a>.
      </p>
      <h2>Avertissement</h2>
      <p>
        Les informations, modèles et calculs proposés sur ce site ont une vocation informative et d&apos;aide à la gestion. Ils ne constituent pas un conseil juridique
        personnalisé.
      </p>
    </LegalPage>
  );
}
