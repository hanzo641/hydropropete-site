# Architecture

```
conquete-run/
├── packages/core/          Logique pure TypeScript, sans dépendance native (seule dép. : h3-js)
│   └── src/
│       ├── gps/            Chaîne GPS : filtrage, Kalman (+ lissage RTS), distance, allure,
│       │                   altitude live, D+ par modèle de terrain, GPX, validation anti-triche
│       ├── game/           Règles : config, troupes, garnisons sauvages, combat, érosion,
│       │                   régions, factions, XP/rangs/trophées, défis, saisons
│       ├── geo/            H3 (territoires/régions/zones, cases traversées), géodésie, confidentialité
│       └── server/         Traitement complet d'une course côté serveur (processRun)
├── apps/mobile/            App Expo SDK 57 + Expo Router + TypeScript strict
├── supabase/
│   ├── migrations/         Schéma Postgres + PostGIS, RLS, fonctions SQL (combat, érosion…)
│   ├── functions/          Edge Functions Deno (submit-run, deploy-troops, …)
│   │   └── _shared/core/   Copie générée de packages/core/src (npm run sync:edge)
│   └── tests/              Tests pgTAP (RLS, combat, érosion, régions, saisons)
├── test-data/              Traces GPX de référence (ville/forêt/montagne) + grilles MNT
└── scripts/                Génération des traces, synchro edge, saison de démo, tests SQL
```

## 1. Principes

1. **Une seule implémentation des règles**, dans `packages/core`, exécutée :
   * dans l'app (affichage live, aperçu du résultat d'une attaque, garnisons sauvages) ;
   * dans les Edge Functions (autorité : validation, distance, D+, troupes) ;
   * dans les tests Vitest.
   Les opérations qui doivent être **atomiques et concurrentes** (combat, érosion, contrôle
   de région, instantanés de saison) sont aussi écrites en PL/pgSQL. La parité TS ↔ SQL est
   garantie par des **vecteurs de test communs** (`test-data/vectors/*.json`) exécutés par
   Vitest *et* convertis en tests pgTAP (`npm run gen:sql-vectors`).
2. **Le serveur ne fait jamais confiance au client** : l'app envoie la trace brute, le
   serveur recalcule tout.
3. **Seuls les territoires ayant un état sont stockés** (`hex_state`). Les sauvages sont
   calculés à la volée ; l'altitude de leurs centres est mise en cache (`cell_elevation`).
4. **Paramétrable sans redéploiement** : `game_config` (JSON) fusionné avec les valeurs par
   défaut du core ; lu par l'app au démarrage, par les Edge Functions et par le SQL
   (`cfg_num('combat.defenseMultiplier')`).

## 2. Chaîne GPS (app)

```
expo-location startLocationUpdatesAsync  (premier plan ET arrière-plan : une seule source)
        │  TaskManager.defineTask (portée globale, fonctionne app en arrière-plan)
        ▼
 SQLite (expo-sqlite, API synchrone)  ← persistance incrémentale de CHAQUE point brut
        │                                (aucun point perdu si l'app est tuée)
        ▼
 LiveTracker (core/gps)  ← reconstruit par rejeu du SQLite au redémarrage de l'app
   1. garde-fous : mocked, horodatage, précision adaptative (20 m → 35 m si signal
      durablement dégradé, 50 m absolu), sauts impossibles (> 9 m/s + marges d'erreur)
   2. filtre de Kalman 2D vitesse constante (repère local en mètres, R = accuracy²)
   3. distance comptée seulement si le déplacement dépasse la marge d'erreur du filtre
   4. allure sur fenêtre glissante de 30 s
   5. altitude lissée (Kalman 1D) + hystérésis 5 m pour le D+ live (estimation)
        │
        ▼
 UI (course en cours), cases traversées allumées en direct
        │ fin de course
        ▼
 File d'envoi (SQLite) → Edge Function submit-run (trace brute complète)
```

* iOS : `activityType: Fitness`, `showsBackgroundLocationIndicator: true`,
  `pausesUpdatesAutomatically: false`, `UIBackgroundModes: location`.
* Android : service de premier plan avec notification (`foregroundService`), permission
  `ACCESS_BACKGROUND_LOCATION` demandée après la permission de premier plan,
  `killServiceOnDestroy: false`.
* **Écran « GPS prêt »** : le suivi démarre en mode préchauffage ; le bouton Départ
  s'active quand 3 points consécutifs ont une précision ≤ 15 m (ou ≤ 25 m après 45 s,
  avec avertissement). Les points de préchauffage ne sont pas comptés.
* **Mode simulation** : un `GpxReplaySource` injecte les points d'un GPX dans *la même*
  fonction d'ingestion que la tâche d'arrière-plan (vitesse ×1 à ×20). Les courses sont
  marquées `source = 'simulation'` et refusées par le serveur sauf si
  `antiCheat.allowSimulatedRuns = true` (saison de démo).

## 3. Traitement serveur d'une course (`submit-run`)

`processRun(rawPoints, context)` (core/server) :

1. `validateRaw` : horodatages, durée, fraîcheur, positions simulées, taille.
2. `filterTrack` : même garde-fous + Kalman **avant + lissage arrière RTS** (plus précis
   qu'en live).
3. `detectVehicle` : vitesse moyenne > 20 km/h sur 3 min glissantes → rejet ; accélérations
   > 6 m/s² → signalement ; part de points rejetés > 40 % → rejet (« signal trop mauvais »).
4. Distance : somme des segments lissés, avec la même marge d'erreur.
5. **D+ par modèle numérique de terrain** : rééchantillonnage tous les 25 m, altitude via
   fournisseur (`IgnAltiProvider` en France — RGE ALTI, `OpenTopoDataProvider` ailleurs —
   EU-DEM 25 m en Europe, SRTM 30 m dans le monde), lissage médian + hystérésis 2 m. En cas
   d'échec de tous les fournisseurs : D+ GPS lissé, plafonné, marqué `dplus_source = 'gps'`.
6. Territoires traversés (≥ 30 m dans la case) + altitude de leurs centres (cache).
7. Plafonds journaliers → troupes, XP, trophées.
8. Écriture atomique (`runs`, `run_traces`, `profiles`) ; réponse = résumé.

`deploy-troops` : vérifie que chaque case ∈ cases traversées de la course, que le total ≤
troupes restantes et que le délai n'est pas dépassé, puis appelle la fonction SQL
`apply_deployment` (verrous de ligne `FOR UPDATE`, combat, bonus de région, contrôle de
région, événements du fil, statistiques de saison) dans **une seule transaction**.

## 4. Données (Postgres + PostGIS)

| Table | Contenu | Lecture | Écriture |
| --- | --- | --- | --- |
| `game_config` | JSON des paramètres | tous | service |
| `factions` | 4 factions | tous | service |
| `seasons` | dates, statut, graine des garnisons sauvages | tous | service |
| `profiles` | pseudo, faction, zone, XP, niveau | tous (colonnes publiques via vue `public_profiles`) | soi (pseudo, langue) / service |
| `private_settings` | centre + rayon de la zone de confidentialité (PostGIS), consentements | soi | soi |
| `runs` | résumé, statut, raison de rejet, cases traversées, troupes | soi | service |
| `run_traces` | trace brute (JSONB) — purgée après 90 jours | soi | service |
| `hex_state` | (saison, h3) → faction, garnison, date | tous | service (via `apply_deployment`) |
| `cell_elevation` | cache d'altitude des centres de cases | tous | service |
| `region_control` | (saison, région) → faction | tous | service |
| `deployments` | historique des déploiements | soi | service |
| `events` | fil d'actualité (anonymisé en zone de confidentialité) | authentifiés | service |
| `zone_daily_scores` | territoire-jours par zone/faction | tous | service (cron) |
| `player_season_stats` | points individuels par saison/zone | tous | service |
| `trophies_earned` / `season_awards` | trophées, titres | tous | service |

* Les index H3 sont stockés en `text` (h3-js ↔ SQL). L'extension `h3` n'est pas
  disponible sur Supabase : les calculs H3 sont faits dans les Edge Functions (h3-js), le
  SQL ne manipule que des identifiants déjà calculés (région/zone de chaque case sont des
  colonnes).
* **PostGIS** : zone de confidentialité (`geography(Point)` + rayon, test `ST_DWithin` pour
  anonymiser les événements) ; emprise des cases (`geography`) pour les requêtes de carte
  par boîte englobante (`hexes_in_bbox`).
* **RLS** activée sur toutes les tables ; aucune écriture directe du client sur les tables
  de jeu : tout passe par les Edge Functions (service role) ou des fonctions
  `security definer` à la surface minimale. Tests pgTAP dédiés.
* **Realtime** : `hex_state` et `events` sont publiés ; l'app s'abonne aux changements de
  la saison courante et filtre sur la zone visible.
* **Planification** (`pg_cron`) : `daily_tick()` à 04:00 UTC (érosion matérialisée,
  abandons, instantanés de score, expiration des troupes non déployées, purge des traces
  brutes anciennes), `close_season()` à la fin de saison (titres, nouvelle saison).

## 5. Carte (app)

* MapLibre React Native, fond de carte libre **OpenFreeMap** (style « liberty », sans
  clé). URL configurable (`EXPO_PUBLIC_MAP_STYLE_URL`).
* Chargement **par zone visible** : à chaque déplacement de caméra (debounce 400 ms), l'app
  calcule les cases H3 de la boîte visible (`polygonToCells`, limité à 2 500 cases, sinon
  affichage agrégé par région), récupère les états stockés via la RPC `hexes_in_bbox`,
  complète avec les sauvages calculés localement, et génère un GeoJSON (une seule source,
  couches `fill` + `line` + `symbol` pour les garnisons).
* Couleurs par faction, opacité selon la garnison, contour pointillé pour les cases
  **contestées** (attaquées dans les dernières 24 h), contour épais pour les régions.

## 6. Authentification

Supabase Auth : **Apple** (natif, `expo-apple-authentication` + `signInWithIdToken`),
**Google** (OAuth via navigateur système `expo-web-browser`, retour par schéma
`conqueterun://`), **e-mail** (code à 6 chiffres, sans lien profond). Jetons stockés dans
`expo-sqlite/localStorage`.

## 7. Import futur des montres (HealthKit / Health Connect)

`runs.source` accepte déjà `healthkit` et `health_connect`. L'app définit une interface
`ActivityImporter` (lister les séances, récupérer la route GPS) ; `submit-run` traite une
route importée exactement comme une trace de l'app (mêmes validations). Les séances sans
route GPS ne donneront pas de troupes (impossible de savoir quels territoires ont été
traversés). Strava n'est **pas** utilisé (conditions d'API depuis nov. 2024).

## 8. Seuils anti-triche (défauts, `antiCheat.*`)

| Clé | Défaut |
| --- | --- |
| `maxAccuracyM` / `baseAccuracyM` / `adaptiveAccuracyMaxM` | 50 / 20 / 35 |
| `maxRunnerSpeedMps` (saut isolé) | 9 |
| `vehicleSpeedKmh` / `vehicleWindowS` | 20 / 180 |
| `maxAccelerationMps2` | 6 |
| `maxRejectedRatio` | 0.4 |
| `maxDurationH` / `maxUploadDelayDays` | 12 / 7 |
| `allowSimulatedRuns` | false |
| `rawTraceRetentionDays` | 90 |
