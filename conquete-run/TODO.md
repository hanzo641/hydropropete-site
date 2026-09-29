# TODO — actions humaines, dans l'ordre

Durées = temps actif estimé (entre parenthèses : délai d'attente externe).
Les points **bloquants** empêchent la saison test.

## Tout de suite — tester le mode solo (15 min + une course)

0. Installer l'APK Android (README « Tester dès maintenant »), choisir son camp, lancer une
   course, déployer, puis rouvrir l'app le lendemain (rapport « Pendant ton absence »).
   À noter pendant le test, pour ajuster l'équilibrage (`game_config` / `world.ts`) :
   - [ ] la course est-elle bien suivie écran éteint (autorisation « Toujours ») ?
   - [ ] le nombre de troupes gagnées paraît-il juste pour l'effort ?
   - [ ] l'ennemi est-il trop agressif / pas assez (budget IA 6–30 troupes/jour) ?
   - [ ] la carte 3D est-elle fluide ; les couleurs lisibles au soleil ?
   - [ ] les rappels (série, troupes) arrivent-ils au bon moment ?

## Semaine 1 — cadre

1. **Cumul d'activités (agent de la fonction publique)** — *bloquant, à lancer en premier*
   — 1 h (réponse : jusqu'à 1 mois).
   Éditer et publier une application, même gratuite, peut constituer une activité
   accessoire soumise à **autorisation préalable** de l'employeur (art. L123-7 et s. du
   code général de la fonction publique ; décret n° 2020-69 du 30 janvier 2020). Si une
   structure est créée (micro-entreprise, association) ou si l'app est monétisée un jour,
   la procédure change. Demande écrite à votre autorité hiérarchique / service RH, en
   décrivant : activité non rémunérée à ce stade, hors temps de service, sans lien avec
   vos fonctions ; l'absence de réponse vaut en principe refus. Faites aussi vérifier si
   votre déontologue doit être saisi. *(Information générale, pas un conseil juridique.)*
2. **Dépôt dédié** — 15 min. Le projet vit dans `conquete-run/` du dépôt du site
   HydroPropreté (voir DECISIONS D-01). Créer un dépôt GitHub `conquete-run` puis :
   ```bash
   git subtree split --prefix conquete-run -b conquete-run-only
   git push git@github.com:<vous>/conquete-run.git conquete-run-only:main
   ```
   La CI (`.github/workflows/ci.yml`) s'active alors automatiquement.
3. **Nom et marque** — 1 h. Recherche d'antériorité INPI / EUIPO sur « Conquête Run »
   et vérification des noms sur les stores ; réserver un nom de domaine.
4. **Identité de l'éditeur + textes légaux** — 1 h 30. Compléter les `[CROCHETS]` de
   `apps/mobile/src/legal/texts.ts` (éditeur, contact, région d'hébergement, ville du
   tribunal), `npm run legal:export`, publier `legal/privacy.fr.md` à une URL publique
   (exigée par Apple et Google ; votre compte Netlify convient). Faire relire par un juriste
   si possible.
5. **Registre RGPD** — 1 h. Inscrire le traitement « traces GPS des joueurs » à votre
   registre des traitements. Données de localisation : évaluer la nécessité d'une AIPD
   (probablement non requise pour 30 testeurs, à refaire avant l'ouverture large).

## Semaine 1 — comptes techniques

6. **Apple Developer Program** — 30 min (validation 1–2 jours ; en société : numéro
   D-U-N-S, jusqu'à 2 semaines). 99 €/an. Créer l'App ID `app.conqueterun.mobile`
   (changer l'identifiant dans `app.json` si besoin) avec *Sign in with Apple*.
7. **Google Play Console** — 30 min (vérification d'identité : 1–3 jours). 25 $ une fois.
   ⚠️ Compte **personnel** récent : la mise en production exige d'abord un **test fermé
   avec au moins 12 testeurs pendant 14 jours** ; le *test interne* (jusqu'à 100
   testeurs) n'a pas cette contrainte et suffit pour la saison test.
8. **Expo / EAS** — 20 min. Créer le compte, `npx eas-cli@latest init` dans `apps/mobile`,
   déclarer les variables `EXPO_PUBLIC_*` (README §4). L'offre gratuite suffit (files
   d'attente de build plus longues).
9. **Supabase** — 1 h. Suivre README §2 (projet UE, migrations, pg_cron, saison, Edge
   Functions). Offre gratuite suffisante pour 30 joueurs ; attention : un projet gratuit
   est **mis en pause après 7 jours sans activité**.
10. **Fournisseurs de connexion** — 2 h. Apple (Services / App ID), Google (écran de
    consentement + client OAuth Web), SMTP pour les codes e-mail (Brevo / Resend, 30 min).
11. **Icône et écran de démarrage** — facultatif. Un visuel a été créé (hexagone fendu
    braise / marée, `apps/mobile/assets/images/`) ; un graphiste peut le remplacer.

## Semaine 2 — builds et tests terrain

12. **Premier build de développement** — 1 h (build : 15–30 min).
    `npx eas-cli@latest build --profile development --platform android` (et iOS).
13. **Tests sur téléphones réels** — 1 journée, *bloquant*. Checklist :
    - [ ] GPS prêt : attente puis bouton Départ (dehors et à l'intérieur) ;
    - [ ] course de 20 min **écran verrouillé** : pas de trou ni de ligne droite ;
    - [ ] tuer l'app pendant la course → la rouvrir : course reprise, distance cohérente ;
    - [ ] redémarrer le téléphone pendant une course (limite connue : Android ne relance pas le service) ;
    - [ ] batterie consommée sur 1 h (cible < 10 %/h) ;
    - [ ] Android Samsung / Xiaomi : désactiver l'optimisation de batterie si coupures ;
    - [ ] fin de course hors réseau → envoi automatique au retour du réseau ;
    - [ ] comparer distance / D+ avec une montre GPS sur les mêmes sorties (ville, forêt, montagne) ;
    - [ ] carte : fluidité, couleurs, étiquettes, mise à jour en direct entre deux téléphones ;
    - [ ] déploiement par glisser, animations, résultat identique à l'aperçu ;
    - [ ] connexions Apple / Google / e-mail, suppression de compte, export ;
    - [ ] mode simulation (×20) et saison de démo.
    Exportez 2–3 vraies traces en GPX dans `test-data/gpx/real/` (non-régression).
14. **Saison de démo** — 15 min. `npm run demo:season -- --city pau` sur un projet
    Supabase de test (jamais sur la production : elle ferme la saison active).

## Semaines 3–4 — recrutement et lancement

15. **Recruter ~30 testeurs** — 2 semaines en parallèle. Clubs d'athlétisme et de trail de
    la ville choisie, groupes de running, magasins de sport, réseaux sociaux. Formulaire
    (e-mail Apple/Google, type de téléphone, ville, faction souhaitée). Viser ≥ 6 joueurs
    par faction et un mélange route / trail. Prévoir 40 inscrits pour 30 actifs.
16. **Distribution** — 1 h (revue Beta App Review ≈ 24 h pour TestFlight externe).
    iOS : TestFlight (testeurs internes : 100 max, sans revue ; externes : lien public
    après revue). Android : piste de test interne + liste d'e-mails.
17. **Paramétrer la saison test** — 30 min. Dates (4 semaines), `create_season(...)`,
    ajuster `game_config` si besoin (ex. garnisons sauvages plus faibles si la ville est
    grande et les joueurs peu nombreux).
18. **Canal de retours** — 30 min. Groupe (Signal / WhatsApp / Discord) + formulaire de
    bug ; point hebdomadaire sur l'équilibrage (vitesse d'érosion, bonus de région).
19. **Modération** — 10 min / semaine. Surveiller les courses `flags` (`synthetic`,
    `accelerations`, `gaps`) : `select * from runs where array_length(flags, 1) > 0` ;
    invalider avec `select admin_reject_run('<id>', 'moderation')`.

## Avant l'ouverture large (après la saison test)

20. **Open Topo Data auto-hébergé** (EU-DEM + SRTM) — 1 journée. L'API publique est limitée
    à 1 000 requêtes/jour ; renseigner `OPENTOPODATA_URL`.
21. **Import des montres** (HealthKit / Health Connect) — 1–2 semaines de dev (architecture
    prête : `runs.source`, `submit-run` accepte ces sources).
22. **Notifications push serveur** (attaque d'un territoire, région perdue) — 3 jours de dev.
    Les rappels **locaux** (série, troupes, ennemi qui avance) existent déjà.
23. **Supervision** (Sentry, alertes Supabase), sauvegardes PITR, offre Supabase Pro.
24. **Limites administratives** comme régions (DECISIONS D-07) si les joueurs le demandent.
25. **AIPD RGPD** et relecture juridique complète des CGU / politique de confidentialité.
