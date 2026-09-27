# Décisions — Quittio

Chaque choix structurant, pris en autonomie, avec sa justification et ce qui le ferait changer.

## Business

| # | Décision | Pourquoi | À revoir si… |
|---|---|---|---|
| B1 | **Gestion locative pour bailleurs particuliers** (49/60) plutôt qu'un outil pour micro-entrepreneurs (43/60) ou la collecte d'avis Google (41/60) | Douleur mensuelle imposée par la loi, marché de ~3,5 M de bailleurs, volonté de payer prouvée par les concurrents, SEO longue traîne abondant, logique 100 % déterministe (aucune IA ni partenaire requis), valeur dès le premier jour. Détail dans BUSINESS.md. | Le coût d'acquisition organique dépasse 3 mois d'ARPU après 6 mois. |
| B2 | **Dépôt dédié** | Produit autonome, déployé seul sur Vercel, historique et accès séparés de tout autre projet. | — |
| B3 | **Nom « Quittio »** | Court, évoque la quittance, prononçable, `.fr` probablement disponible. **Non vérifié** : recherche INPI et disponibilité du domaine dans TODO.md. | Antériorité de marque ou domaine pris → alternatives : Loyo, Bailio, Quittéo. |
| B4 | **3 paliers : 4,90 / 9,90 / 19,90 €/mois**, annuel = 10 mois | Porte d'entrée sous la barre psychologique des 5 € (1 logement, le cas majoritaire) ; le palier du milieu concentre l'automatisation (la vraie valeur) pour pousser vers 9,90 € ; Patrimoine capte les multi-propriétaires sensibles à l'export fiscal. Annuel mis en avant (trésorerie, churn plus faible). | Conversion Essentiel > 50 % des abonnés → tester 5,90 €. |
| B5 | **Essai 14 jours avec carte bancaire** | Filtre les inscriptions non qualifiées, conversion essai → payant bien supérieure ; l'essai couvre exactement le délai légal de rétractation, donc aucun remboursement à gérer pour les nouveaux clients. | Taux de démarrage de Checkout < 30 % → tester l'essai sans carte (`payment_method_collection: "if_required"` + `trial_settings.end_behavior`). |
| B6 | **Parrainage : 30 jours d'essai pour le filleul, 1 mois offert au parrain** | Récompense versée seulement après le premier paiement du filleul (pas de fraude coûteuse), crédit automatique via le solde client Stripe, zéro intervention manuelle. | — |
| B7 | **Prix TTC en franchise de TVA** (art. 293 B du CGI) | Démarrage en micro-entreprise ; les prix affichés sont ceux payés. | Dépassement du seuil de franchise → activer Stripe Tax, prix `tax_behavior=inclusive` déjà prévus pour absorber la TVA. |
| B8 | **Pas de témoignages ni de logos clients inventés** | Faux avis = pratique commerciale trompeuse (et risque de réputation). La section « preuve » s'appuie sur des faits vérifiables (frais d'agence évités, conformité légale, indices INSEE). | Dès 5 avis réels collectés (TODO.md) → ajouter une section témoignages + `AggregateRating`. |

## Produit

| # | Décision | Pourquoi |
|---|---|---|
| P1 | **Confirmation manuelle du paiement (1 clic) + option « quittance automatique »** plutôt que la synchronisation bancaire | L'agrégation bancaire (DSP2) impose un prestataire agréé, des coûts et une validation longue : incompatible avec « fonctionne dès le jour 1 ». Un clic depuis le téléphone suffit ; les virements permanents fiables passent en automatique. Feuille de route : Bridge/Powens. |
| P2 | **Reçu (et non quittance) en cas de paiement partiel** | Exigence de l'article 21 de la loi de 1989 : délivrer une quittance pour un paiement partiel priverait le bailleur de son recours. |
| P3 | **Révision IRL : arrondi au centime inférieur, exclusion automatique des DPE F/G, date d'effet non rétroactive** | Ne jamais dépasser le plafond légal ; conformité loi Climat et résilience et loi ALUR. Logique isolée dans `lib/irl.ts` et `lib/rent.ts`, couverte par des tests. |
| P4 | **Table IRL codée en dur, mise à jour 4×/an** | Aucune API INSEE simple et fiable pour cette série ; 4 lignes par an ne justifient pas une dépendance externe. Tâche dans la routine hebdomadaire. |
| P5 | **Relances à J+5 (cordiale) et J+15 (ferme) + mise en demeure à imprimer** | Calendrier d'usage, ton qui préserve la relation ; la mise en demeure reste une action consciente du bailleur (recommandé AR). |
| P6 | **Le locataire n'a pas de compte** | Zéro friction : il reçoit des e-mails avec PDF ; `reply-to` = e-mail du bailleur, bailleur en copie. |
| P7 | **Accès en lecture/écriture bloqué si l'abonnement n'est pas `active`, `trialing` ou `past_due`** | `past_due` = période de grâce pendant les nouvelles tentatives de Stripe (≈ 2 semaines) pour ne pas couper un client pour une carte expirée ; bandeau d'alerte. Les données restent exportables (RGPD) même sans abonnement. |
| P8 | **Purge automatique 12 mois après la fin de l'abonnement** | Durée de conservation annoncée dans la politique de confidentialité, appliquée par le cron. |

## Technique

| # | Décision | Pourquoi |
|---|---|---|
| T1 | **Next.js 16 (App Router), `proxy.ts`, Server Actions** | Stack imposée ; `middleware` est renommé `proxy` en v16. Les mutations de l'espace client sont des Server Actions (CSRF géré nativement, pas d'API à maintenir). |
| T2 | **Sessions Firebase par cookie httpOnly** (`createSessionCookie`) plutôt que le SDK client partout | Rendu serveur de l'espace client, pas de jeton lisible en JavaScript, révocation possible (`checkRevoked`), SDK client chargé seulement sur les pages de connexion (et à la demande). |
| T3 | **Firestore uniquement via Admin SDK, règles « tout refuser »** | Une seule couche d'autorisation à auditer (serveur) ; impossible de contourner le contrôle d'abonnement depuis le navigateur. |
| T4 | **Webhooks idempotents + relecture systématique de l'abonnement via l'API** | Stripe peut livrer en double et dans le désordre ; la source de vérité reste Stripe. Filet de sécurité supplémentaire au retour de Checkout (`syncLatestSubscription`) si le webhook tarde. |
| T5 | **Résiliation via le Customer Portal avec `flow_data: subscription_cancel`** + page publique `/resiliation` | Parcours « 3 clics » exigé par la loi du 16 août 2022 (Abonnement → Résilier → Confirmer), lien présent dans le pied de chaque page, alternative par formulaire avec accusé de réception pour les clients qui ne peuvent pas se connecter. |
| T6 | **Formulaires HTML natifs vers `/api/stripe/*` (redirection 303)** | Le passage au paiement fonctionne même si le JavaScript n'est pas encore chargé ou échoue. |
| T7 | **Pas de React Email** : gabarits HTML en TypeScript | Moins de dépendances, e-mails simples et compatibles (tables + styles inline). |
| T8 | **pdf-lib avec polices standard** | Aucune dépendance native, fonctionne en serverless ; les caractères hors WinAnsi (espaces fines, émojis) sont filtrés (`pdfSafe`). |
| T9 | **Framer Motion chargé de façon asynchrone** (`LazyMotion` + import dynamique), animation du hero en CSS | Framer Motion coûtait ~10 points de performance mobile en chargement initial. Le hero n'attend aucun JavaScript (LCP). |
| T10 | **Polices Geist via `next/font/google`, sous-ensemble latin, mono non préchargée** | Auto-hébergées au build (aucune requête vers Google chez le visiteur, RGPD), ~30 Ko au lieu de ~140 Ko : LCP mobile de 3,3 s à 2,7 s (simulé). |
| T11 | **Vercel Web Analytics derrière le consentement** | Même si l'outil est sans cookie, il ne figure pas dans la liste des solutions exemptées par la CNIL : on applique la règle la plus prudente. |
| T12 | **Blog en MDX local + registre `lib/blog.ts`** | Méthode documentée par Next (import dynamique + `generateStaticParams`), pages statiques, pas de CMS à payer. Les métadonnées vivent dans le registre pour lister les articles sans parser les fichiers. |
| T13 | **Outils gratuits (calculateur IRL, générateur de quittance) sans compte** | Aimants SEO et à liens entrants ; le générateur fonctionne par simple POST de formulaire (aucune donnée conservée). |
| T14 | **Cron quotidien unique** (`/api/cron/daily`) | Suffisant pour des échéances à la journée, compatible avec tous les plans Vercel ; actions idempotentes grâce aux horodatages `noticeSentAt`, `reminder1SentAt`… |

## Mesures (audit local, Lighthouse 12, mobile simulé)

| Page | Perf. | Access. | Bonnes pratiques | SEO |
|---|---|---|---|---|
| Accueil | 95–96 | 100 | 100 | 100 |
| Tarifs | 97 | 100 | 100 | 100 |
| Calculateur IRL | 97 | 100 | 100 | 100 |
| Générateur de quittance | 97 | 100 | 100 | 100 |
| Article de blog | 97 | 100 | 100 | 100 |
| Inscription / Connexion | 95–96 | 100 | 100 | 100 |
| CGV | 97 | 100 | 100 | 100 |

Sur Vercel (CDN + HTTP/2 + compression Brotli), les scores réels sont généralement supérieurs à l'audit local.
