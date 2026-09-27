# SEO — Quittio

> **Méthode et limites.** Volumes et difficultés sont des **estimations** (ordres de grandeur France, recherches mensuelles) établies à partir de la structure de la SERP, de la saisonnalité connue (pics à chaque publication de l'IRL) et des outils publics. Ils doivent être **confirmés** dans Google Keyword Planner / Search Console dès les premières semaines (TODO.md, étape 14). Difficulté : **F** = faible (site jeune peut viser le top 5 en 3–6 mois), **M** = moyenne (6–12 mois + liens), **É** = élevée (sites institutionnels/éditeurs établis).

## 1. Stratégie en une phrase

Ne pas attaquer « logiciel gestion locative » (dominé par des acteurs installés) mais **capter le bailleur au moment précis de son problème** (calculer une révision, rédiger une relance, produire une quittance) avec des **outils gratuits** et des **guides meilleurs que la concurrence**, puis le convertir vers l'essai.

## 2. Trente requêtes longue traîne

### Intention transactionnelle / commerciale (conversion directe)

| # | Requête | Volume est. | Diff. | Page cible |
|---|---|---|---|---|
| 1 | logiciel quittance de loyer | 300–700 | M | /tarifs |
| 2 | envoyer quittance de loyer automatiquement | 50–150 | F | / |
| 3 | application gestion locative particulier | 300–800 | M | / |
| 4 | logiciel gestion locative gratuit ou pas cher | 200–500 | M | /tarifs |
| 5 | alternative rentila | 50–150 | F | article comparatif (S7) |
| 6 | gérer sa location sans agence | 300–700 | M | /blog/gerer-location-sans-agence ✅ |
| 7 | relance automatique loyer impayé | 50–150 | F | /blog/lettre-relance-loyer-impaye ✅ |
| 8 | gestion locative en ligne propriétaire | 200–500 | M | / |

### Intention « outil » (lead magnets)

| # | Requête | Volume est. | Diff. | Page cible |
|---|---|---|---|---|
| 9 | calcul révision loyer irl | 5 000–15 000 (pics trimestriels) | É | /outils/calcul-revision-loyer-irl ✅ |
| 10 | simulateur augmentation loyer | 1 000–3 000 | M | /outils/calcul-revision-loyer-irl ✅ |
| 11 | quittance de loyer gratuite pdf | 2 000–6 000 | É | /outils/quittance-de-loyer-gratuite ✅ |
| 12 | modèle quittance de loyer meublé | 500–1 500 | M | article S2 |
| 13 | quittance de loyer colocation modèle | 200–600 | F | article S5 |
| 14 | générateur quittance de loyer | 500–1 500 | M | /outils/quittance-de-loyer-gratuite ✅ |

### Intention informationnelle (guides, maillage vers tarifs)

| # | Requête | Volume est. | Diff. | Page cible |
|---|---|---|---|---|
| 15 | irl 2e trimestre 2026 / irl t3 2026 | 3 000–10 000 (saisonnier) | M | /blog/augmentation-loyer-irl-2026 ✅ |
| 16 | augmentation loyer 2026 | 2 000–6 000 | M | /blog/augmentation-loyer-irl-2026 ✅ |
| 17 | quittance de loyer obligatoire | 500–1 500 | F | /blog/quittance-de-loyer-obligatoire ✅ |
| 18 | révision loyer oubliée | 300–800 | F | /blog/revision-loyer-oubliee ✅ |
| 19 | révision loyer rétroactive | 200–600 | F | /blog/revision-loyer-oubliee ✅ |
| 20 | lettre relance loyer impayé | 1 000–3 000 | M | /blog/lettre-relance-loyer-impaye ✅ |
| 21 | locataire ne paie pas son loyer que faire | 1 000–2 500 | M | /blog/lettre-relance-loyer-impaye ✅ |
| 22 | mise en demeure loyer impayé modèle | 800–2 000 | M | article S3 |
| 23 | avis d'échéance loyer obligatoire | 100–300 | F | article S1 |
| 24 | régularisation des charges locatives calcul | 1 000–3 000 | M | article S4 |
| 25 | loyer gelé dpe f g | 300–1 000 | F | article S6 |
| 26 | restitution dépôt de garantie délai | 2 000–5 000 | É | article S8 |
| 27 | déclarer revenus fonciers micro foncier ou réel | 1 000–3 000 | É | article S9 |
| 28 | combien de temps garder quittance de loyer | 300–800 | F | /blog/quittance-de-loyer-obligatoire ✅ |
| 29 | paiement partiel loyer quittance ou reçu | 50–200 | F | /blog/quittance-de-loyer-obligatoire ✅ |
| 30 | date anniversaire bail révision loyer | 200–600 | F | article S10 |

**Priorité** : les requêtes F à forte intention (2, 5, 7, 13, 17, 18, 19, 23, 25, 29, 30) d'abord ; les requêtes É (9, 11) sont visées par des outils, les plus à même de gagner des liens naturels.

## 3. SEO technique — ce qui est en place

| Élément | Implémentation |
|---|---|
| Metadata par page | `metadata` / `generateMetadata` (title ≤ 60 car., description ≤ 160, canonical) sur chaque route ; gabarit `%s \| Quittio` |
| Open Graph / Twitter | `openGraph` global + par article ; image générée `src/app/opengraph-image.tsx` (1200×630) |
| sitemap.xml | `src/app/sitemap.ts` (pages, outils, articles avec `lastModified`) |
| robots.txt | `src/app/robots.ts` : exclut `/espace/`, `/api/`, `/r/` ; **bloque tout sur les déploiements Preview** |
| Données structurées | `Organization` + `WebSite` (layout), `Product` + `Offer` ×3 (accueil), `FAQPage` (accueil, tarifs, outils), `WebApplication` (outils), `Article` + `BreadcrumbList` (articles) |
| URLs propres | français, minuscules, tirets, sans extension ni paramètres (`/outils/calcul-revision-loyer-irl`) |
| Images | aucune image bitmap au-dessus de la ligne de flottaison (maquette produit en HTML/CSS, SVG) ; `next/image` configuré AVIF/WebP pour les futures captures |
| Core Web Vitals | pages statiques, polices auto-hébergées sous-ensemble latin, Framer Motion et Firebase chargés à la demande, CLS 0 ; Lighthouse mobile 95–97 / 100 / 100 / 100 |
| Accessibilité | contrastes AA, lien d'évitement, focus visible, libellés de formulaires, `aria-live` pour les retours, `prefers-reduced-motion` |
| Maillage interne | chaque article renvoie vers /tarifs, un outil et 1–2 articles ; encadré `<Cta />` ; « À lire aussi » ; pied de page vers les outils |
| Hreflang | inutile (site mono-langue `fr-FR`, `lang="fr"`) |

**À faire après la mise en ligne** : Search Console + soumission du sitemap, vérification de l'indexation des 17 URL, suivi des Core Web Vitals réels (rapport CrUX après ~28 jours de trafic).

## 4. Règles éditoriales

1. Un article = une intention = un mot-clé principal (dans le `title`, le H1, l'introduction, un H2) + 3–5 variantes naturelles.
2. Répondre à la question **dans les 100 premiers mots**, puis détailler.
3. Citer les **textes de loi** (article, date) et des **exemples chiffrés** exacts ; mention « mis à jour le … ».
4. Au moins un tableau ou une liste récapitulative (extraits optimisés).
5. Maillage : 1 lien vers un outil, 1 vers /tarifs (via `<Cta />`), 1–2 vers d'autres articles.
6. Relecture juridique annuelle des articles et mise à jour des dates.

## 5. Plan éditorial — 12 semaines (1 article / semaine)

Les 5 articles de lancement sont déjà publiés. Le plan suivant démarre la semaine de mise en ligne.

| Sem. | Titre | Mot-clé principal | Intention | Diff. |
|---|---|---|---|---|
| S1 | Avis d'échéance de loyer : est-il obligatoire ? Modèle et bonnes pratiques | avis d'échéance loyer | Info | F |
| S2 | Quittance de loyer pour une location meublée : mentions et modèle | modèle quittance de loyer meublé | Outil / info | M |
| S3 | Mise en demeure pour loyer impayé : modèle de lettre et délais | mise en demeure loyer impayé modèle | Info / transac. | M |
| S4 | Régularisation des charges locatives : calcul, délais et modèle de décompte | régularisation des charges locatives | Info | M |
| S5 | Quittance de loyer en colocation : une ou plusieurs ? | quittance de loyer colocation | Info | F |
| S6 | Loyer gelé pour les logements F et G : ce que dit la loi en 2026 | loyer gelé dpe f g | Info | F |
| S7 | Rentila, BailFacile, Quittio… quel logiciel de gestion locative choisir en 2026 ? | alternative rentila / comparatif logiciel gestion locative | Commerciale | M |
| S8 | Restitution du dépôt de garantie : délais, retenues et pénalités | restitution dépôt de garantie délai | Info | É |
| S9 | Micro-foncier ou régime réel : comment déclarer vos loyers ? | micro foncier ou réel | Info | É |
| S10 | Date anniversaire du bail : comment la trouver et quand réviser le loyer | date anniversaire bail révision loyer | Info | F |
| S11 | IRL du 3e trimestre 2026 : valeur et impact sur votre loyer *(à publier le jour de la publication INSEE, mi-octobre)* | irl 3e trimestre 2026 | Info (actu) | M |
| S12 | Locataire en difficulté de paiement : échéancier, CAF, FSL — les solutions amiables | locataire difficulté paiement loyer | Info | F |

**Actualisation récurrente** : à chaque publication de l'IRL (mi-janvier, mi-avril, mi-juillet, mi-octobre), mettre à jour `src/lib/irl.ts`, l'article « augmentation de loyer » (valeurs + date) et publier un court article d'actualité le jour même (requête très saisonnière).
