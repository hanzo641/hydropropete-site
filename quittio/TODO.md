# TODO — actions humaines restantes (dans l'ordre)

Tout le code est prêt. Ce qui suit demande une identité, un paiement, une signature ou un accès à des comptes. **Durée totale estimée : ~1 jour de travail effectif**, étalé sur 1 à 3 semaines (délais d'immatriculation et de vérification).

Légende : ⏱ temps actif · ⌛ délai d'attente · 💶 coût

## Phase A — Juridique et administratif (avant d'encaisser)

| # | Action | ⏱ | ⌛ | 💶 |
|---|---|---|---|---|
| 1 | **Vérifier le nom « Quittio »** : recherche sur [data.inpi.fr](https://data.inpi.fr) (classes 9, 35, 36, 42) et disponibilité de `quittio.fr` / `.com`. En cas de conflit, changer `site.name` dans `src/lib/site.ts` (et le logo texte). | 20 min | — | 0 € |
| 2 | **Créer l'entreprise** (micro-entreprise, activité libérale non réglementée / prestation de services informatiques — code APE 58.29C ou 62.01Z) sur [formalites.entreprises.gouv.fr](https://formalites.entreprises.gouv.fr). Option versement libératoire à étudier. | 45 min | 1–4 sem. (SIRET) | 0 € |
| 3 | **Ouvrir un compte bancaire dédié** (obligatoire au-delà de 10 000 € de CA deux années consécutives, recommandé dès le départ). | 30 min | 1–3 j | 0–10 €/mois |
| 4 | **Désigner un médiateur de la consommation** (obligatoire pour vendre à des particuliers — ex. CM2C, Medicys, AME Conso) et signer la convention. | 30 min | 1–2 sem. | ~50–150 €/an |
| 5 | **Compléter les mentions légales** : dans `src/lib/site.ts`, remplacer tous les champs `[…]` de `editor` (nom, statut, SIRET, RCS/dispense, adresse, téléphone, directeur de publication, médiateur). Rechercher `[` dans ce fichier. | 15 min | — | 0 € |
| 6 | **Souscrire une RC Pro** (éditeur de logiciel / prestations informatiques). | 30 min | 1–3 j | ~15 €/mois |
| 7 | **Relecture juridique** des CGV, de la politique de confidentialité et des modèles de courriers (avocat ou juriste, forfait) — recommandé, pas bloquant pour la bêta. | 1 h | 1–2 sem. | 300–800 € |

## Phase B — Comptes et configuration technique

| # | Action | ⏱ | ⌛ | 💶 |
|---|---|---|---|---|
| 8 | **Acheter le domaine** `quittio.fr` (+ `quittio.com` pour protéger la marque) chez OVH, Gandi ou Cloudflare Registrar. Créer l'adresse `bonjour@quittio.fr` (redirection gratuite du registrar ou Google Workspace). | 20 min | — | ~12–25 €/an |
| 9 | **Firebase** : créer le projet, activer Auth (e-mail + Google), créer Firestore en **région Europe (eur3 ou europe-west9)**, générer la clé de compte de service, déployer règles et index (`firebase deploy --only firestore:rules,firestore:indexes`). Passer en plan **Blaze** (paiement à l'usage, quasi gratuit à ce volume) et fixer une **alerte budgétaire à 10 €**. — README §1 | 30 min | — | 0–5 €/mois |
| 10 | **Stripe** : créer le compte, **activer les paiements** (identité, SIRET, IBAN du compte pro), créer les produits/prix (`./scripts/stripe-setup.sh`, en test puis en live), configurer le **Customer Portal** (annulation en fin de période, changement de formule, factures), activer Smart Retries, e-mail de fin d'essai et **rappel de renouvellement annuel**, renseigner le nom commercial et l'URL des CGV (Paramètres → Public details). — README §2 | 1 h | 1–3 j (vérification) | 1,5 % + 0,25 € / paiement + 0,7 % Billing |
| 11 | **Resend** : créer le compte, vérifier le domaine d'envoi (enregistrements **SPF, DKIM, DMARC** chez le registrar), créer la clé API. — README §4 | 20 min | 10 min–24 h (DNS) | 0 € (≤ 3 000 e-mails/mois) |
| 12 | **Tester le parcours complet en local** avec la Stripe CLI (tableau de 7 scénarios du README §3) : abonnement, résiliation 3 clics, réactivation, fin d'essai, échec de paiement, résiliation immédiate, rejeu d'événement. Créer 1 logement, envoyer une quittance à votre propre adresse, vérifier le PDF. | 1 h | — | 0 € |
| 13 | **Vercel** : importer le dépôt, **Root Directory = `quittio`**, renseigner les variables d'environnement (Production = clés live, Preview = clés test), passer en **plan Pro** (usage commercial), ajouter les domaines et les enregistrements DNS, créer le **webhook Stripe live** et redéployer, ajouter le domaine dans Firebase Auth, activer Web Analytics, vérifier le Cron. — README « Déploiement » | 45 min | 10 min–24 h (DNS) | ~20 $/mois |
| 14 | **Test en production** : souscrire avec votre propre carte (formule Essentiel), vérifier e-mails et PDF, résilier en 3 clics, vous rembourser depuis Stripe. | 20 min | — | 0 € |

## Phase C — Référencement et lancement

| # | Action | ⏱ | ⌛ | 💶 |
|---|---|---|---|---|
| 15 | **Google Search Console** : ajouter la propriété de domaine (enregistrement DNS TXT), **soumettre `https://www.quittio.fr/sitemap.xml`**, demander l'indexation de l'accueil, des 2 outils et des 5 articles. | 20 min | 2–7 j | 0 € |
| 16 | **Bing Webmaster Tools** : importer depuis Search Console. | 5 min | — | 0 € |
| 17 | **Google Keyword Planner** (compte Google Ads sans campagne) : confirmer les volumes de `SEO.md` et réordonner le plan éditorial si besoin. | 30 min | — | 0 € |
| 18 | **Fiches annuaires** : Capterra/GetApp, Appvizer, Product Hunt (jour de lancement). | 1 h | — | 0 € |
| 19 | **Bêta privée** : inviter 10 propriétaires de votre entourage (formule offerte 3 mois via un code promo Stripe), recueillir **5 avis réels** et l'autorisation de les publier → ajouter une section témoignages (jamais de faux avis). | 2 h | 2–4 sem. | 0 € |
| 20 | **Lancement communautés** : premiers posts de `GROWTH.md` (§6), 2 réponses/semaine dans les groupes de bailleurs. | 1 h | — | 0 € |

## Phase D — Récurrent (voir BUSINESS.md, ~4 h/semaine)

- **Mi-janvier, mi-avril, mi-juillet, mi-octobre** : ajouter le nouvel IRL en tête de `src/lib/irl.ts`, `npm test`, déployer ; mettre à jour l'article « augmentation de loyer » ; publier l'actu IRL. **Prochaine échéance : IRL du 3e trimestre 2026, mi-octobre 2026.** (15 min + 1 h d'article)
- **Chaque semaine** : 1 article (`SEO.md` §5), support, revue Stripe/Search Console, logs du Cron Vercel.
- **Chaque année** : déclaration du chiffre d'affaires URSSAF (mensuelle ou trimestrielle), CFE (dès la 2e année), relecture juridique des modèles, mise à jour des mentions « mis à jour le » des articles.
- **Surveillance du seuil de franchise de TVA** : au dépassement, activer Stripe Tax et mettre à jour la mention TVA dans `src/lib/site.ts`.

## Points techniques à connaître

- `npm audit` signale 2 vulnérabilités modérées dans une dépendance transitive de `firebase-admin` (`uuid` via `gaxios`), sans impact sur l'usage fait ici ; se résoudra avec une mise à jour de `firebase-admin`. Relancer `npm audit` chaque mois.
- Les tests automatisés couvrent la logique métier (IRL, échéances, relances, PDF). Les parcours Firebase/Stripe se valident avec la procédure du README §3 (nécessite vos comptes).
- Évolutions produit suggérées (non développées) : synchronisation bancaire (Bridge/Powens) pour détecter les virements, régularisation annuelle des charges, signature électronique du bail, encart de parrainage après la 3e quittance.
