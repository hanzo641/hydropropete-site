# HydroPropreté — Site vitrine premium

Site statique (HTML5 / CSS moderne / Vanilla JS, sans framework ni dépendance)
pour l'entreprise de nettoyage professionnel HydroPropreté à Pau.

## Structure

```
hydropropete-site/
├── index.html                 Page d'accueil
├── contact.html                Formulaire de devis
├── mentions-legales.html
├── politique-confidentialite.html
├── 404.html
├── sitemap.xml
├── robots.txt
├── netlify.toml                Config déploiement + headers de sécurité/cache
├── css/
│   ├── style.css               Design system complet — SOURCE à éditer
│   └── style.min.css           Version minifiée servie par les pages HTML
├── js/
│   ├── main.js                 Interactions — SOURCE à éditer
│   └── main.min.js             Version minifiée servie par les pages HTML
├── fonts/
│   └── poppins-*.woff2         Poppins auto-hébergée (sous-ensemble latin)
├── images/
│   ├── *.svg                   Illustrations maison, prêtes à être remplacées
│   └── README.md                Guide de remplacement des visuels
└── pages/
    ├── nettoyage-vitres-pau.html
    ├── nettoyage-copropriete-pau.html
    ├── nettoyage-canape-pau.html
    ├── nettoyage-terrasse-pau.html
    ├── fin-de-chantier-pau.html
    └── remise-en-etat-pau.html
```

## Modifier le CSS ou le JS

Toutes les pages chargent `css/style.min.css` et `js/main.min.js` (versions
minifiées, plus rapides à télécharger). **Éditez toujours `style.css` /
`main.js`** (les sources lisibles et commentées), puis régénérez les
fichiers `.min` avant de déployer :

```bash
npx clean-css-cli -O2 -o css/style.min.css css/style.css
npx terser js/main.js -c -m -o js/main.min.js
```

## Police

Poppins est auto-hébergée dans `/fonts` (sous-ensemble latin, 5 graisses,
~40 Ko au total) plutôt que chargée depuis Google Fonts : cela supprime une
requête cross-origin bloquant le rendu et améliore le LCP. Pour ajouter une
graisse supplémentaire, régénérez les `.woff2` depuis
`https://fonts.google.com/specimen/Poppins` et ajoutez la règle `@font-face`
correspondante dans `style.css`.

## Déploiement

### Netlify

1. Créez un nouveau site depuis ce dossier (`hydropropete-site/`) comme
   répertoire de base ("Base directory").
2. Aucune commande de build n'est nécessaire (site 100 % statique).
   Répertoire de publication : `.`
3. Le formulaire de contact (`contact.html`) utilise **Netlify Forms**
   (attribut `data-netlify="true"`) : il sera automatiquement détecté au
   déploiement, sans configuration supplémentaire.

### Cloudflare Pages

1. Sélectionnez ce dossier comme racine du projet.
2. Build command : (aucune) — Output directory : `.`
3. Le formulaire Netlify Forms ne fonctionne pas sur Cloudflare Pages :
   remplacez l'action du formulaire dans `contact.html` par un service tiers
   (Cloudflare Pages Functions, Formspree, etc.) avant mise en production.

## Mini-jeu « Écho du Royaume » (`/game/`)

Runner RPG mobile autonome (Canvas 2D / JS vanilla), indépendant du site
vitrine — voir `game/index.html`, `css/game.css`, `js/game.js`.

### Synchro Strava (optionnelle)

Le bouton « Récupérer ma dernière course » convertit la dernière sortie
Strava du joueur (distance + allure) en XP et en or pour son personnage.
Comme le site est 100 % statique, l'échange OAuth passe par deux fonctions
serveur (`netlify/functions/strava-token.js` et `strava-activity.js`) qui
gardent le secret Strava côté serveur — cette partie ne fonctionne donc que
sur un déploiement Netlify (build déjà configuré avec `functions =
"netlify/functions"` dans `netlify.toml`).

Pour l'activer :

1. Créez une application sur https://www.strava.com/settings/api. Dans
   « Authorization Callback Domain », indiquez le domaine du site déployé
   (sans `https://` ni chemin, ex. `hydropropete-pau.fr` ou
   `mon-site.netlify.app`).
2. Récupérez le **Client ID** et le **Client Secret** de l'application.
3. Dans `js/strava.js`, remplacez `REMPLACER_PAR_VOTRE_STRAVA_CLIENT_ID` par
   votre Client ID (il n'est pas secret, il peut rester dans le code).
4. Dans les paramètres du site Netlify (Site configuration → Environment
   variables), ajoutez `STRAVA_CLIENT_ID` et `STRAVA_CLIENT_SECRET` (le
   secret ne doit jamais être commité dans le dépôt).
5. Redéployez le site.

Sans cette configuration, le bouton « Connecter Strava » reste visible mais
la connexion échouera proprement (message d'erreur, pas de plantage).

## Scores Lighthouse (audit local, 11 pages)

| Page | Performance | Accessibilité | Bonnes pratiques | SEO |
|---|---|---|---|---|
| Accueil | 99 | 100 | 100 | 100 |
| Contact | 100 | 100 | 100 | 100 |
| 6 pages prestations | 100 | 100 | 100 | 100 |
| Mentions légales / Confidentialité | 100 | 100 | 100 | 100 |

Optimisations clés apportées lors de l'audit SEO/perf :
- Police Poppins auto-hébergée (`/fonts`) → suppression d'une requête
  cross-origin bloquant le rendu (gain direct sur LCP/Speed Index).
- CSS/JS livrés minifiés (`style.min.css`, `main.min.js`).
- Correction d'un reflow forcé dans l'accordéon FAQ (lecture de `scrollHeight`
  déplacée avant les écritures de style).
- Hiérarchie de titres (`h1`→`h2`→`h3`) strictement séquentielle sur
  toutes les pages (plus de saut `h2`→`h4`).
- Toutes les icônes SVG décoratives marquées `aria-hidden="true"` ; le champ
  anti-spam (honeypot) du formulaire est retiré de l'ordre de tabulation
  (`tabindex="-1"`) pour ne pas piéger la navigation clavier/lecteur d'écran.
- Style `:focus-visible` custom (lisible sur fonds clairs et sombres).
- Slider avant/après : `aria-valuenow` tenu à jour sur le curseur (`role="slider"`).
- Page d'accueil enrichie pour cibler *« entreprise de nettoyage à Pau »* :
  section "à propos", FAQ dédiée, schema.org `Service` liés par `@id` à
  chaque page prestation.
- Barre CTA sticky mobile (Appeler / Devis gratuit) pour la conversion.

Pour reproduire l'audit : `npx lighthouse http://localhost:PORT/index.html
--only-categories=performance,accessibility,best-practices,seo`.

## Avant la mise en ligne — checklist

- [ ] Remplacer le domaine `https://www.hydropropete-pau.fr` dans toutes les
      balises `canonical`, `og:url` et le fichier `sitemap.xml`.
- [ ] Remplacer le téléphone, l'e-mail, l'adresse et le numéro WhatsApp
      (recherchez `+33559000000`, `+33659000000`, `contact@hydropropete-pau.fr`).
- [ ] Compléter les mentions légales (SIRET, forme juridique, hébergeur réel).
- [ ] Remplacer les visuels de démonstration dans `/images` (voir
      `images/README.md`).
- [ ] Remplacer les avis clients d'exemple sur la page d'accueil par de vrais
      avis vérifiés.
- [ ] Vérifier le score Google PageSpeed après remplacement des images par
      des photos réelles compressées (WebP recommandé).
