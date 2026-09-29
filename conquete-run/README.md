# Conquête Run (nom provisoire)

Jeu mobile (iOS + Android) de conquête de territoires façon Risk : les kilomètres courus
deviennent des troupes, le dénivelé compte, la carte (hexagones H3) couvre le monde entier.

* Règles : [`GAME_RULES.md`](GAME_RULES.md) · Architecture : [`ARCHITECTURE.md`](ARCHITECTURE.md)
* Jalons : [`PLAN.md`](PLAN.md) · Décisions prises : [`DECISIONS.md`](DECISIONS.md)
* Ce qu'il reste à faire côté humain : [`TODO.md`](TODO.md)

```
packages/core    logique pure TS (GPS, règles, anti-triche) — partagée app / serveur / tests
apps/mobile      app Expo SDK 57 (Expo Router, TypeScript strict, MapLibre, FR/EN)
supabase         migrations SQL (PostGIS, RLS), Edge Functions Deno, tests pgTAP, démo
test-data        traces GPX de référence (ville / forêt / montagne) + grilles MNT IGN
scripts          génération des traces, synchro du core, saison de démo, tests SQL
```

---

## 1. Installation

Prérequis : **Node 22+**, npm 10+. Pour les tests SQL locaux : Postgres 16 + PostGIS +
pgTAP (`sudo apt install postgresql-16 postgresql-16-postgis-3 postgresql-16-pgtap libtap-parser-sourcehandler-pgtap-perl`).

```bash
cd conquete-run
npm install          # installe tout le monorepo (core + app + outils, dont Deno via npm)
npm run check        # lint + types + Vitest + deno check + pgTAP + saison de démo
```

| Commande | Rôle |
| --- | --- |
| `npm test` | tests Vitest du core (GPS, règles, serveur, parité) |
| `npm run test:sql` | Postgres jetable + migrations + tests pgTAP + application de la démo |
| `npm run check:edge` | `deno check` des Edge Functions + copie du core à jour |
| `npm run sync:edge` | recopie `packages/core/src` → `supabase/functions/_shared/core` (**après chaque modif du core**) |
| `npm run gen:sql-vectors` | régénère le test SQL de parité depuis `test-data/vectors` |
| `npm run gen:traces` | reconstruit les traces de référence (réseau : OSRM + IGN) |
| `npm run gen:sim-traces` | reconstruit les traces du mode simulation de l'app |
| `npm run demo:season -- --city pau` | génère le SQL d'une saison de démo (30 faux joueurs) |
| `npm run legal:export` | publie les textes légaux de l'app dans `legal/*.md` |

---

## 2. Configuration Supabase, pas à pas

### 2.1 Projet
1. <https://supabase.com> → **New project**. Région **Europe (Paris `eu-west-3` ou Francfort)**
   pour le RGPD. Notez le mot de passe de la base.
2. **Project Settings → API** : notez l'**URL** du projet et la clé **publishable** (ou `anon`).
   La clé `service_role` / `secret` ne doit **jamais** aller dans l'app.

### 2.2 Base de données
```bash
cd conquete-run
npx supabase login
npx supabase link --project-ref <ref-du-projet>
npx supabase db push          # applique supabase/migrations/*.sql dans l'ordre
```
Sans CLI : collez chaque fichier de `supabase/migrations/` **dans l'ordre** dans
**SQL Editor → Run**.

* PostGIS est activé par la migration (schéma `extensions`).
* **pg_cron** : si la migration 4 affiche « pg_cron indisponible », activez-le dans
  **Database → Extensions → pg_cron**, puis exécutez :
  `select cron.schedule('conquete-daily-tick', '0 4 * * *', 'select public.daily_tick()');`
* **Realtime** : les tables `hex_state`, `events`, `region_control` sont ajoutées à la
  publication `supabase_realtime` ; vérifiez dans **Database → Publications**.

Créer la première saison (SQL Editor) :
```sql
select public.create_season('Saison 1 — Pau', now());          -- 28 jours, active tout de suite
-- ou planifiée : select public.create_season('Saison 1', '2026-11-02 00:00+01');
```
Modifier un paramètre de jeu sans redéployer l'app (exemple) :
```sql
update public.game_config set config = '{"erosion":{"dailyRate":0.04}}' where id = 1;
```

### 2.3 Authentification
**Authentication → URL Configuration** : ajoutez `conqueterun://auth-callback` aux
*Redirect URLs*.

* **E-mail (code à 6 chiffres)** : **Authentication → Providers → Email** activé.
  Dans **Authentication → Email Templates → Magic Link**, remplacez le lien par le code :
  `Ton code Conquête Run : {{ .Token }}`. Configurez un SMTP (Resend, Brevo…) dans
  **Project Settings → Auth → SMTP** : l'envoi par défaut de Supabase est limité à
  quelques e-mails par heure.
* **Apple** : dans le portail Apple Developer, activez *Sign in with Apple* sur l'App ID
  `app.conqueterun.mobile`. Dans Supabase **Providers → Apple**, ajoutez
  `app.conqueterun.mobile` dans *Client IDs* (connexion native iOS : pas de secret requis
  pour ce mode).
* **Google** : Google Cloud Console → *OAuth consent screen* puis *Credentials → OAuth
  client ID* de type **Web application** avec l'URI de redirection
  `https://<ref>.supabase.co/auth/v1/callback`. Collez client ID + secret dans
  **Providers → Google**.

### 2.4 Edge Functions
```bash
npm run sync:edge
npx supabase functions deploy submit-run
npx supabase functions deploy export-data
npx supabase functions deploy delete-account
npx supabase secrets set DEM_PROVIDERS=ign,opentopodata OPENTOPODATA_DATASETS=eudem25m,srtm30m
```
`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont injectées automatiquement.

### 2.5 Saison de démo (facultatif)
```bash
npm run demo:season -- --city pau            # ou --lat 45.76 --lng 4.84 --name Lyon
psql "$DATABASE_URL" -f supabase/demo/demo-pau.sql     # ou coller dans le SQL Editor
```
⚠️ Ferme la saison active : à réserver à un projet de test.

---

## 3. Lancer l'app

```bash
cp .env.example apps/mobile/.env.local     # puis renseigner EXPO_PUBLIC_SUPABASE_URL / _KEY
cd apps/mobile
```
L'app utilise des modules natifs (MapLibre, localisation d'arrière-plan) : **Expo Go ne
suffit pas**, il faut un *development build* :

* **Sans Mac ni Android Studio** : `npx eas-cli@latest build --profile development --platform android`
  (ou `ios`), installez le build, puis `npm start` et scannez le QR code.
* **Avec Android Studio** : `npx expo run:android` ; **avec Xcode** : `npx expo run:ios`.

**Mode simulation** : Profil → *Mode simulation* → choisir une trace (ville / forêt /
montagne ou un GPX importé) et la vitesse (×1, ×5, ×20). La trace passe par la même
chaîne que le vrai GPS. Les courses simulées sont refusées par le serveur, sauf pendant
une saison dont la config contient `"antiCheat":{"allowSimulatedRuns":true}` (c'est le cas
de la saison de démo).

---

## 4. Builds de test (EAS)

```bash
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest init                        # crée le projet EAS (ajoute projectId à app.json)
# variables publiques de l'app, par environnement :
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value https://….supabase.co --visibility plaintext
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_KEY --value sb_publishable_… --visibility plaintext
# (idem pour --environment production)
```

| Cible | Commande |
| --- | --- |
| APK Android à partager directement | `npx eas-cli@latest build --profile preview --platform android` |
| iOS en distribution interne (appareils enregistrés) | `npx eas-cli@latest build --profile preview --platform ios` |
| **TestFlight** | `npx eas-cli@latest build --profile production --platform ios` puis `npx eas-cli@latest submit -p ios` |
| **Google Play – test interne** | `npx eas-cli@latest build --profile production --platform android` puis `npx eas-cli@latest submit -p android` (le 1ᵉʳ AAB doit être envoyé à la main dans la Play Console) |

Renseignez `ascAppId` dans `eas.json` (ID de l'app dans App Store Connect) avant `submit`.

---

## 5. Précision GPS — ce qui est mesuré

`npm test` rejoue 3 traces **réelles** (géométrie OpenStreetMap, altitude IGN RGE ALTI) avec
un bruit GPS réaliste (dérive corrélée, sauts de 20 à 150 m, trous de 20 à 70 s, rafales de
mauvaise précision, altitude GPS biaisée) sur 5 graines (vérifié sur 20) :

| Trace | Distance réf. | Erreur distance (serveur / live) | D+ réf. | Erreur D+ MNT | Distance brute naïve |
| --- | --- | --- | --- | --- | --- |
| Ville — Pau | 5,04 km | < 3 % | 36 m | < 8 m | ≈ 9 km (+80 %) |
| Forêt — Bastard | 5,20 km | < 3 % | 9 m | < 8 m | ≈ 12 km (+130 %) |
| Montagne — Ayous | 12,25 km | < 3 % | 832 m | < 10 % | ≈ 24 km (+96 %) |

Le D+ « live » (altitude GPS lissée + hystérésis 10 m) est une **estimation** affichée
pendant la course (±30 % / ±75 m) ; le D+ officiel est recalculé par le serveur avec un
modèle de terrain. Sur terrain plat, le critère « < 10 % » est remplacé par « < 8 m » :
10 % d'un D+ de 30 m est plus fin que la précision d'un MNT.

---

## 6. Ce qui n'a PAS pu être testé sur un vrai téléphone

Tout a été développé et vérifié dans un conteneur Linux sans téléphone, sans simulateur
et sans projet Supabase réel. **Vérifié** : logique (Vitest), base de données (pgTAP sur
Postgres 16 + PostGIS), Edge Functions (`deno check`), typage et lint de l'app, bundle
Metro Android + iOS (`expo export`), configuration Expo (`expo-doctor` 21/21).

**Non vérifié, à tester en priorité** (checklist dans `TODO.md`) :

1. **Localisation écran verrouillé** (iOS « Toujours », Android service de premier plan),
   app tuée puis relancée pendant une course (reprise par rejeu SQLite), batterie.
2. Comportement des surcouches Android agressives (Samsung, Xiaomi, Huawei… voir
   <https://dontkillmyapp.com>) : le service peut être tué malgré la notification.
3. **Rendu MapLibre** (couches, étiquettes de garnison, performance à 2 500 hexagones),
   style OpenFreeMap, Realtime.
4. **Connexions Apple / Google / e-mail** de bout en bout (redirections, jetons).
5. Appels réels aux Edge Functions (réseau, taille des traces, API IGN / Open Topo Data
   depuis l'infrastructure Supabase), `pg_cron`.
6. Glisser des jauges de déploiement, animations, lisibilité en plein soleil.
7. h3-js sous Hermes (fonctionne dans le bundle, jamais exécuté sur appareil).
8. Précision GPS réelle (les tests utilisent un bruit simulé calibré, pas de vraies puces).
   Enregistrez quelques vraies courses, exportez-les en GPX et déposez-les dans
   `test-data/gpx/real/` pour enrichir la non-régression.
