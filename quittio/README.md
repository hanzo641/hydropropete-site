# Quittio

**La gestion locative automatique pour les propriétaires qui gèrent en direct** : quittances de loyer PDF envoyées par e-mail, suivi des paiements, avis d'échéance, relances d'impayés, révision IRL calculée et lettre générée, export des revenus fonciers. Abonnement mensuel/annuel via Stripe.

| Document | Contenu |
|---|---|
| [BUSINESS.md](./BUSINESS.md) | Étude des 15 idées, choix, persona, offre, prix, projections, risques |
| [SEO.md](./SEO.md) | 30 mots-clés longue traîne, SEO technique, plan éditorial 12 semaines |
| [GROWTH.md](./GROWTH.md) | Plan d'acquisition organique, 10 posts prêts à publier, plan B payant |
| [DECISIONS.md](./DECISIONS.md) | Les choix techniques et business, et pourquoi |
| [TODO.md](./TODO.md) | Actions humaines restantes, dans l'ordre, avec temps estimé |

---

## Stack

- **Next.js 16** (App Router, Turbopack, Server Actions, `proxy.ts`) + **TypeScript** strict
- **Tailwind CSS v4** + composants **shadcn/ui** (Radix) + **Framer Motion** (chargement différé) + `next-themes` (clair/sombre)
- **Firebase Auth** (e-mail/mot de passe + Google) avec **cookies de session httpOnly** vérifiés côté serveur, **Firestore** via Admin SDK uniquement (règles : tout accès client refusé)
- **Stripe** Checkout (abonnements, essai 14 j) + Customer Portal + webhooks idempotents synchronisés dans Firestore
- **Resend** pour les e-mails transactionnels, **pdf-lib** pour les PDF (quittances, lettres)
- **Vercel** (hébergement + Cron quotidien) et **Vercel Web Analytics** (sans cookie, activé seulement après consentement)
- Blog **MDX** (`@next/mdx`, remark-gfm), **Vitest** pour la logique métier

## Arborescence

```
./
├── src/
│   ├── app/
│   │   ├── (marketing)/        accueil, tarifs, outils gratuits, blog, contact, légal, résiliation
│   │   ├── (auth)/             connexion, inscription
│   │   ├── espace/             espace client protégé (tableau de bord, logements, abonnement, parrainage, compte)
│   │   ├── api/                auth/session, stripe/{checkout,portal,webhook}, cron/daily, pdf/*, export/*, contact, tools/quittance
│   │   ├── r/[code]/           liens de parrainage
│   │   ├── sitemap.ts robots.ts opengraph-image.tsx manifest.ts
│   ├── components/             ui (shadcn), marketing, app (espace client)
│   ├── content/blog/*.mdx      articles
│   ├── lib/                    irl, rent, pdf, email, billing, stripe, session, leases, automation, plans, site…
│   └── proxy.ts                redirection rapide vers /connexion si pas de cookie de session
├── firestore.rules / firestore.indexes.json / firebase.json
├── scripts/stripe-setup.sh     création des produits et prix Stripe
└── vercel.json                 cron quotidien (07:00 UTC)
```

## Installation locale

Prérequis : **Node.js ≥ 20.9**, npm, un compte Firebase, un compte Stripe (mode test), et optionnellement la [Stripe CLI](https://docs.stripe.com/stripe-cli) et un compte Resend.

```bash
cd quittio
npm install
cp .env.example .env.local   # puis renseignez les valeurs (voir ci-dessous)
npm run dev                  # http://localhost:3000
```

Le site vitrine, le blog et les outils gratuits fonctionnent **sans aucune variable**. L'espace client nécessite Firebase et Stripe. Sans `RESEND_API_KEY`, les e-mails sont simplement journalisés dans la console (`[email:dry-run]`).

### 1. Firebase (≈ 10 min)

1. [console.firebase.google.com](https://console.firebase.google.com) → **Ajouter un projet** (Google Analytics : inutile).
2. **Authentication** → Commencer → activer **E-mail/Mot de passe** et **Google**. Dans *Paramètres → Domaines autorisés*, ajoutez `localhost` (déjà présent) puis votre domaine de production.
3. **Firestore Database** → Créer → mode production → **emplacement `eur3` (Europe)** ou `europe-west9` (Paris).
4. *Paramètres du projet → Général → Vos applications* → ajouter une app **Web** → copiez `apiKey`, `authDomain`, `projectId`, `appId` dans les variables `NEXT_PUBLIC_FIREBASE_*`.
5. *Paramètres du projet → Comptes de service* → **Générer une nouvelle clé privée** → reportez `project_id`, `client_email` et `private_key` dans `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (sur une ligne, avec les `\n`, entre guillemets).
6. Déployez les règles et index :
   ```bash
   npm i -g firebase-tools && firebase login
   firebase use --add            # choisissez votre projet
   firebase deploy --only firestore:rules,firestore:indexes
   ```

### 2. Stripe (≈ 15 min)

1. Créez les produits et prix (mode test) : `stripe login && ./scripts/stripe-setup.sh`, puis copiez les 6 lignes `STRIPE_PRICE_*` affichées. *(Alternative : les créer à la main dans Dashboard → Catalogue de produits, prix TTC « taxe incluse ».)*
2. `STRIPE_SECRET_KEY` : Dashboard → Développeurs → Clés API.
3. **Customer Portal** : Dashboard → Paramètres → Billing → *Portail client* → activer : mise à jour du moyen de paiement, historique des factures, **annulation (à la fin de la période)** avec collecte du motif facultative, **changement de formule** entre les 6 prix. Enregistrez.
4. **E-mails & relances** : Paramètres → Billing → *Abonnements et e-mails* → activer les *Smart Retries*, l'e-mail de *rappel d'essai* et le **rappel de renouvellement pour les abonnements annuels** (obligation d'information L215-1 du Code de la consommation) ; après tous les échecs de paiement → **annuler l'abonnement**.

### 3. Tester les webhooks Stripe en local (Stripe CLI)

```bash
# Terminal 1
npm run dev

# Terminal 2 : relaie les événements Stripe vers votre machine
stripe listen --forward-to localhost:3000/api/stripe/webhook \
  --events checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,customer.subscription.paused,customer.subscription.resumed,customer.subscription.trial_will_end,invoice.paid,invoice.payment_failed
# → copiez le secret whsec_… affiché dans STRIPE_WEBHOOK_SECRET puis redémarrez `npm run dev`
```

**Parcours complet à tester** (carte de test `4242 4242 4242 4242`, date future, CVC quelconque) :

| # | Action | Résultat attendu |
|---|---|---|
| 1 | `/tarifs` → « Essayer 14 jours gratuits » → créer un compte → payer sur Checkout | Retour sur `/espace?checkout=success`, abonnement `trialing` dans Firestore (`users/{uid}.subscription`) |
| 2 | Espace → Abonnement → **Résilier mon abonnement** → confirmer dans le portail | `cancelAtPeriodEnd: true`, bandeau de confirmation, e-mail de confirmation de résiliation |
| 3 | Dans le portail, **Renouveler / réactiver** | `cancelAtPeriodEnd: false` |
| 4 | Fin d'essai simulée : `stripe subscriptions update sub_… --trial-end=now` | `invoice.paid` → statut `active` |
| 5 | Échec de paiement : ajouter la carte `4000 0000 0000 0341` dans le portail, puis `stripe invoices pay in_…` ou avancer l'horloge (voir ci-dessous) | `invoice.payment_failed` → statut `past_due`, bandeau rouge dans l'espace, e-mail « échec du paiement » |
| 6 | Résiliation immédiate : `stripe subscriptions cancel sub_…` | statut `canceled` → accès aux logements bloqué, écran de réabonnement |
| 7 | Rejouer un événement : `stripe events resend evt_…` | réponse `{ duplicate: true }` (idempotence) |

Déclencheurs rapides (sans parcours complet) : `stripe trigger checkout.session.completed`, `stripe trigger invoice.payment_failed`, `stripe trigger customer.subscription.deleted`. Ces objets factices n'ont pas de `uid` : le webhook les ignore proprement (utile pour vérifier la signature et les réponses 200).

Pour tester renouvellements et échecs dans le temps, utilisez les **[Test Clocks](https://docs.stripe.com/billing/testing/test-clocks)** (Dashboard → Billing → Horloges de test) : créez un client sur une horloge, abonnez-le, avancez d'un mois.

### 4. Resend (≈ 10 min)

1. [resend.com](https://resend.com) → *Domains* → ajoutez `quittio.fr` (ou un sous-domaine d'envoi `mail.quittio.fr`) → créez les enregistrements DNS **SPF, DKIM** (et **DMARC** conseillé) → vérifiez.
2. *API Keys* → créer une clé « Sending access » → `RESEND_API_KEY`.
3. `EMAIL_FROM="Quittio <notifications@quittio.fr>"`, `CONTACT_EMAIL=votre boîte`.

### 5. Tester le cron en local

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily
# → { today, users, leases, actions: { notice, auto_quittance, reminder1, reminder2, revision_reminder }, errors, purged }
```

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` / `npm start` | build et serveur de production |
| `npm run lint` | ESLint (config Next.js core-web-vitals + TypeScript) |
| `npm run typecheck` | génération des types de routes + `tsc --noEmit` |
| `npm test` | tests Vitest (IRL, échéances, automatisations, PDF) |

## Déploiement sur Vercel (pas à pas, ≈ 20 min)

1. Poussez le dépôt sur GitHub (c'est déjà le cas).
2. [vercel.com/new](https://vercel.com/new) → importez le dépôt `quittio`.
3. Framework : Next.js (détecté). Root Directory, Build et Output : par défaut.
4. **Environment Variables** : collez le contenu de votre `.env.local` en adaptant :
   - `NEXT_PUBLIC_SITE_URL=https://www.quittio.fr` ;
   - clés Stripe **live** (`sk_live_…`, prix live) pour *Production*, clés **test** pour *Preview* ;
   - `CRON_SECRET` : `openssl rand -hex 32`.
5. **Deploy**. Puis *Settings → Domains* : ajoutez `quittio.fr` et `www.quittio.fr` (redirection de l'apex vers `www`), et créez chez votre registrar les enregistrements DNS indiqués par Vercel.
6. **Webhook de production** : Stripe Dashboard → Développeurs → Webhooks → *Ajouter un endpoint* → `https://www.quittio.fr/api/stripe/webhook`, avec les 9 événements listés plus haut → copiez le secret dans `STRIPE_WEBHOOK_SECRET` (Production) → *Redeploy*.
7. **Firebase** : ajoutez `www.quittio.fr` dans *Authentication → Domaines autorisés*.
8. **Cron** : `vercel.json` déclare `/api/cron/daily` à 07:00 UTC ; vérifiez-le dans *Settings → Cron Jobs* après le déploiement.
9. **Analytics** : *Analytics → Enable* (Web Analytics). Le script ne se charge qu'après consentement de l'utilisateur.
10. Vérifications : `/sitemap.xml`, `/robots.txt`, un parcours d'abonnement en mode test sur une URL de Preview, puis en live avec votre propre carte (remboursez-vous ensuite).

> Plan Vercel : le plan *Hobby* est réservé à un usage non commercial. Passez en **Pro** avant d'encaisser le premier euro.

## Sécurité — points clés

- Aucune clé en dur : tout passe par les variables d'environnement (`.env*` ignorés par git, sauf `.env.example`).
- Firestore inaccessible depuis le navigateur (`allow read, write: if false`) ; chaque lecture/écriture passe par le serveur après `verifySessionCookie(…, checkRevoked = true)`.
- Cookie de session `httpOnly`, `Secure`, `SameSite=Lax` ; vérification d'origine sur les routes POST ; Server Actions protégées nativement contre le CSRF.
- Webhooks Stripe signés et **idempotents** (collection `stripeEvents`) ; l'état de l'abonnement est toujours relu depuis l'API Stripe (résistant au désordre des événements).
- Cron protégé par `CRON_SECRET` (comparaison à temps constant).
- En-têtes de sécurité (HSTS, nosniff, frame-options, referrer-policy, permissions-policy) dans `next.config.ts`.
- Export CSV protégé contre l'injection de formules.

## Mettre à jour l'IRL (4 fois par an)

À chaque publication INSEE (mi-janvier, mi-avril, mi-juillet, mi-octobre) : ajoutez la nouvelle valeur **en tête** de `IRL_VALUES` dans `src/lib/irl.ts`, lancez `npm test`, committez. Le calculateur, le bandeau de l'accueil, les révisions et les rappels se mettent à jour automatiquement.
