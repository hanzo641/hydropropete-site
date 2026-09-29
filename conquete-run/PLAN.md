# Plan de développement

Chaque jalon = un commit, tests verts avant de passer au suivant.

| Jalon | Contenu | Critère de sortie |
| --- | --- | --- |
| **J0** | `GAME_RULES.md`, `ARCHITECTURE.md`, `PLAN.md`, `DECISIONS.md`, squelette monorepo (workspaces npm, TypeScript strict, ESLint, Vitest) | lint + typecheck OK |
| **J1** | Module GPS (`packages/core/src/gps`) : garde-fous, Kalman + RTS, distance à marge d'erreur, allure 30 s, altitude live à hystérésis, D+ par MNT (IGN / Open Topo Data), lecture/écriture GPX, validation anti-triche. Traces de référence réelles (ville / forêt / montagne) + grilles MNT + générateur de bruit (erreur corrélée, sauts, trous, arrêts) | erreur distance < 3 %, D+ serveur < 10 % sur toutes les traces et graines |
| **J2** | Schéma Supabase (migrations, RLS, PostGIS), config serveur, grille H3 (territoires/régions/zones, cases traversées), garnisons sauvages, `processRun` + Edge Function `submit-run`, calcul des troupes | Vitest + pgTAP verts, `deno check` des Edge Functions |
| **J3** | App Expo : navigation, auth, onboarding, carte MapLibre (chargement par zone visible), course en cours (tâche d'arrière-plan + SQLite + GPS prêt + mode simulation), fin de course + déploiement | typecheck + lint + export Metro Android/iOS OK |
| **J4** | Combat SQL atomique (`deploy_troops`), érosion, bonus/contrôle de région, saisons par zone, fil d'actualité, écrans Équipe et Profil, XP/rangs/trophées/défis, script de saison de démo | vecteurs de parité TS ↔ SQL verts |
| **J5** | Anti-triche complet (journal des rejets), confidentialité (zone domicile, export, suppression de compte), pages légales, `eas.json` (preview / TestFlight / test interne), `README.md`, `TODO.md` | tous les tests verts, doc complète |

## Hors périmètre v1 (préparé)

* Import HealthKit / Health Connect (interface `ActivityImporter` + `runs.source`).
* Limites administratives comme régions (identifiant de région opaque).
* Notifications push (fil d'actualité déjà en base, Realtime en place).

## État

Tous les jalons J0 → J5 sont livrés (un commit par jalon sur la branche
`claude/conquete-run`). Les tests sur téléphone réel restent à faire : voir `TODO.md` §13.
