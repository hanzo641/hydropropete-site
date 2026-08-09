# Images — guide de remplacement

Toutes les images du site sont des illustrations SVG **conçues sur mesure** pour ce
projet (aucun droit d'auteur tiers, aucune dépendance externe). Elles servent
d'emplacements de démonstration : remplacez-les par de vraies photos de vos
chantiers pour un rendu 100 % personnalisé.

Pour remplacer une image, gardez **exactement le même nom de fichier** (ou mettez
à jour le chemin dans le HTML/CSS concerné) et respectez le ratio conseillé.

| Fichier                  | Utilisé sur                                  | Ratio conseillé | Contenu suggéré |
|---------------------------|-----------------------------------------------|------------------|------------------|
| `glass-hero.svg`          | Accueil (hero), page Nettoyage de vitres      | 16:10            | Grande photo de vitres/façade vitrée impeccable |
| `building-copropriete.svg`| Carte service + page Copropriété              | 16:10            | Immeuble résidentiel, façade entretenue |
| `sofa-interior.svg`       | Carte service + page Canapé                   | 16:10            | Canapé/salon avant-après nettoyage |
| `terrasse-paving.svg`     | Carte service + page Terrasse                 | 16:10            | Terrasse dallée nettoyée, extérieur |
| `fin-chantier.svg`        | Carte service + page Fin de chantier          | 16:10            | Chantier propre, intérieur neuf |
| `remise-etat.svg`         | Carte service + page Remise en état           | 16:10            | Logement remis à neuf |
| `compare-before.svg`      | Slider avant/après (accueil) — état "avant"   | 16:10            | Vitre ou surface sale |
| `compare-after.svg`       | Slider avant/après (accueil) — état "après"   | 16:10            | Vitre ou surface impeccable |
| `og-cover.svg`            | Balises OpenGraph / Twitter Card (toutes pages)| 1200×630        | Visuel de partage réseaux sociaux |
| `favicon.svg`             | Icône d'onglet du navigateur                  | 1:1              | Logo simplifié |

Le logo affiché dans l'en-tête et le pied de page est un SVG inline directement
dans le HTML (`<svg class="logo-mark">`) afin d'hériter des couleurs CSS. Modifiez-le
directement dans chaque fichier HTML, ou remplacez-le par une balise `<img>`
pointant vers votre propre logo.

## Recommandations pour la production

- Exportez vos photos en **WebP** (avec fallback JPEG) pour un poids minimal.
- Compressez chaque image sous 200 Ko pour préserver le score PageSpeed.
- Gardez `loading="lazy"` sur toutes les images hors zone visible immédiate.
- Pour les réseaux sociaux (`og:image`), utilisez un fichier **JPG/PNG** de
  1200×630 px : certains lecteurs (Facebook, X) ne restituent pas le SVG.
