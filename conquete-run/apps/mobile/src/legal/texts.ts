/**
 * Textes légaux (source unique : `npm run legal:export` les publie aussi en Markdown dans
 * legal/). Les passages entre crochets sont à compléter par l'éditeur (voir TODO.md).
 * ⚠️ Modèles à faire relire : ils ne constituent pas un conseil juridique.
 */
export const TERMS_VERSION = '2026-09-29';

type Doc = { title: string; body: string };

const PLACEHOLDERS = `[NOM OU RAISON SOCIALE DE L'ÉDITEUR], [ADRESSE], [E-MAIL DE CONTACT]`;

export const LEGAL: Record<'fr' | 'en', Record<'privacy' | 'terms' | 'notice', Doc>> = {
  fr: {
    privacy: {
      title: 'Politique de confidentialité',
      body: `Version ${TERMS_VERSION}

1. Responsable du traitement
${PLACEHOLDERS}. Contact pour toute question relative à vos données : [E-MAIL DE CONTACT].

2. Données traitées et finalités
• Compte : adresse e-mail ou identifiant Apple/Google, pseudo, année de naissance (vérification de l'âge minimum de 15 ans). Base légale : exécution du contrat.
• Traces GPS de vos courses (positions, horodatages, précision, altitude) : validation des courses, calcul de la distance, du dénivelé et des territoires traversés, lutte contre la triche. Base légale : votre consentement explicite, recueilli à l'inscription et révocable à tout moment (la révocation empêche l'enregistrement de nouvelles courses).
• Zone de jeu : une cellule géographique d'environ 1 770 km² déterminée une seule fois à l'inscription (la position exacte n'est pas conservée), pour les classements locaux et l'équilibrage des équipes.
• Zone de confidentialité (facultative) : un point arrondi à ~100 m et un rayon, pour anonymiser vos actions proches de votre domicile.
• Données de jeu : troupes, territoires, XP, trophées, classements.

3. Ce que voient les autres joueurs
Uniquement votre pseudo, votre faction, votre niveau, vos trophées, vos points de saison et les territoires (couleur et garnison). Jamais vos traces, ni leur début ni leur fin. Les actions situées dans votre zone de confidentialité apparaissent de façon anonyme dans le fil d'actualité.

4. Durées de conservation
• Traces GPS brutes : 90 jours après la course, puis suppression automatique (les résumés — distance, dénivelé, territoires — sont conservés tant que le compte existe).
• Compte et données de jeu : jusqu'à la suppression du compte.
• Journaux techniques : 30 jours maximum.

5. Destinataires et sous-traitants
Hébergement de la base de données et des fonctions serveur : Supabase Inc. (région [UE — À PRÉCISER, ex. Francfort ou Paris]). Calcul d'altitude : les coordonnées échantillonnées de la course sont envoyées, sans aucun identifiant, à l'API d'altimétrie de l'IGN (France) ou à Open Topo Data. Fond de carte : OpenFreeMap (tuiles demandées par votre appareil). Aucune donnée n'est vendue ni utilisée à des fins publicitaires.

6. Vos droits
Accès, rectification, effacement, portabilité, limitation, opposition, retrait du consentement : directement dans l'app (Profil → Confidentialité → Exporter mes données / Supprimer mon compte) ou à [E-MAIL DE CONTACT]. Vous pouvez introduire une réclamation auprès de la CNIL (www.cnil.fr).

7. Âge minimum
L'application est réservée aux personnes de 15 ans et plus.

8. Sécurité
Chiffrement des échanges (HTTPS), contrôle d'accès strict en base (Row Level Security), clés secrètes jamais présentes dans l'application.`,
    },
    terms: {
      title: "Conditions générales d'utilisation",
      body: `Version ${TERMS_VERSION}

1. Objet
Conquête Run (nom provisoire) est un jeu de conquête de territoires fondé sur la course à pied, édité par ${PLACEHOLDERS}. L'utilisation de l'application implique l'acceptation des présentes conditions.

2. Accès
Réservé aux personnes de 15 ans et plus. Un seul compte par personne. Service fourni gratuitement, en version de test, sans garantie de disponibilité.

3. Sécurité et santé
Vous restez seul responsable de votre sécurité : respectez le code de la route, les propriétés privées, les zones interdites et les règles de la montagne. Ne consultez pas l'écran en courant dans un environnement dangereux. Adaptez l'effort à votre condition physique. Le jeu ne vous incite jamais à pénétrer dans un lieu dont l'accès est interdit : un territoire inaccessible n'a pas à être conquis.

4. Fair-play
Interdits : courses en véhicule, positions simulées, partage ou rejeu de traces, comptes multiples, automatisation. Toute course est revalidée par le serveur ; les courses non conformes sont refusées et le motif est indiqué dans votre journal. En cas de triche avérée : réinitialisation des scores, suspension ou suppression du compte.

5. Contenus
Le pseudo ne doit pas être injurieux, discriminatoire ou usurper l'identité d'un tiers ; il peut être modifié ou supprimé par l'éditeur.

6. Responsabilité
L'éditeur ne peut être tenu responsable des dommages résultant de la pratique sportive, de l'imprécision du GPS, ni d'une interruption du service.

7. Données personnelles
Voir la politique de confidentialité.

8. Évolution et droit applicable
Les règles du jeu (paramètres, saisons) peuvent évoluer. Droit français ; à défaut d'accord amiable, tribunaux compétents du ressort de [VILLE].`,
    },
    notice: {
      title: 'Mentions légales',
      body: `Éditeur : ${PLACEHOLDERS}
Directeur de la publication : [NOM]
Hébergement des données : Supabase Inc., 970 Toa Payoh North #07-04, Singapore 318992 — infrastructure [AWS, RÉGION UE À PRÉCISER].
Cartographie : © contributeurs OpenStreetMap (ODbL), tuiles OpenFreeMap. Altimétrie : IGN RGE ALTI® (Licence Ouverte Etalab), Open Topo Data (SRTM, EU-DEM).
Avatars : créations originales du projet.`,
    },
  },
  en: {
    privacy: {
      title: 'Privacy policy',
      body: `Version ${TERMS_VERSION}

1. Controller
${PLACEHOLDERS}. Privacy contact: [CONTACT EMAIL].

2. Data and purposes
• Account: email or Apple/Google identifier, username, year of birth (15+ age check). Legal basis: contract.
• GPS tracks of your runs: run validation, distance, elevation and territory computation, anti-cheat. Legal basis: your explicit consent, given at sign-up and revocable at any time (revoking prevents recording new runs).
• Play area: a ~1,770 km² geographic cell computed once at sign-up (the exact position is not stored), for local leaderboards and team balancing.
• Privacy zone (optional): a point rounded to ~100 m and a radius, used to anonymise your actions near home.
• Game data: troops, territories, XP, trophies, leaderboards.

3. What other players see
Only your username, faction, level, trophies, season points and territories (colour and garrison). Never your tracks, nor their start or end. Actions inside your privacy zone appear anonymously in the feed.

4. Retention
Raw GPS tracks: 90 days, then automatic deletion (summaries are kept while the account exists). Account and game data: until account deletion. Technical logs: 30 days maximum.

5. Recipients and processors
Database and server functions: Supabase Inc. (region [EU — TO BE SPECIFIED]). Elevation: sampled coordinates, without any identifier, are sent to the IGN altimetry API (France) or Open Topo Data. Base map: OpenFreeMap. No data is sold or used for advertising.

6. Your rights
Access, rectification, erasure, portability, restriction, objection, consent withdrawal: in the app (Profile → Privacy → Export my data / Delete my account) or at [CONTACT EMAIL]. You may lodge a complaint with your data protection authority (CNIL in France).

7. Minimum age
15 years.

8. Security
Encrypted transport (HTTPS), strict database access control (Row Level Security), no secret keys shipped in the app.`,
    },
    terms: {
      title: 'Terms of use',
      body: `Version ${TERMS_VERSION}

1. Purpose
Conquest Run (working title) is a running-based territory game published by ${PLACEHOLDERS}.

2. Access
Ages 15+. One account per person. Free test service, no availability guarantee.

3. Safety
You are solely responsible for your safety: obey traffic rules, private property, restricted areas and mountain safety rules. Never enter a forbidden area: an inaccessible territory does not need to be conquered.

4. Fair play
Forbidden: vehicles, mock locations, sharing or replaying tracks, multiple accounts, automation. Every run is re-validated by the server; rejected runs show the reason in your log. Proven cheating may lead to score reset, suspension or deletion.

5. Usernames
Must not be offensive or impersonate anyone; the publisher may change or remove them.

6. Liability
The publisher is not liable for damage resulting from sport practice, GPS inaccuracy or service interruption.

7. Personal data
See the privacy policy.

8. Changes and law
Game rules may evolve. French law applies; courts of [CITY].`,
    },
    notice: {
      title: 'Legal notice',
      body: `Publisher: ${PLACEHOLDERS}
Data hosting: Supabase Inc. — [AWS EU REGION TO BE SPECIFIED].
Maps: © OpenStreetMap contributors (ODbL), OpenFreeMap tiles. Elevation: IGN RGE ALTI® (Etalab Open Licence), Open Topo Data (SRTM, EU-DEM).`,
    },
  },
};
