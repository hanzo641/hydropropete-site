# Conquête Run — Règles du jeu (v1)

> Nom provisoire. Toutes les valeurs chiffrées de ce document sont des **paramètres serveur**
> (table `game_config`, voir « Paramètres » en fin de document). Ils se modifient sans
> redéployer l'app. Les valeurs indiquées sont les valeurs par défaut de la saison test.

## 1. Principe

Chaque kilomètre que tu cours devient une troupe. Après ta course, tu déploies tes troupes
sur les territoires que tu viens de traverser : renforcer ceux de ton équipe, attaquer ceux
des autres ou les territoires sauvages. Trois factions se disputent une carte mondiale
découpée automatiquement en hexagones. Une saison dure 4 semaines, puis la carte est remise
à zéro.

## 2. La carte

### 2.1 Territoires

* Le monde entier est découpé en hexagones **H3 de résolution 8** (≈ 0,74 km², environ
  920 m d'un bord à l'autre). Aucun territoire n'est dessiné à la main : la grille existe
  partout, en ville comme en montagne.
* Deux territoires sont **voisins** s'ils partagent un bord (adjacence native H3).
* *Pourquoi la résolution 8 ?* Une sortie de 8 km traverse 10 à 15 hexagones : assez pour
  faire des choix tactiques, pas trop pour que le déploiement reste lisible. La résolution 9
  (0,1 km²) donnerait 40+ cases par course et une carte illisible à l'échelle d'une ville ;
  la résolution 7 (5 km²) rendrait les courses urbaines trop peu stratégiques.

### 2.2 Régions

* Une **région** = la cellule H3 parente de **résolution 6** (≈ 36 km², 49 territoires).
  Assez grande pour exiger une coordination d'équipe, assez petite pour être tenue par
  un groupe de 5 à 10 coureurs.
* Les limites administratives (communes, cantons) pourront remplacer les cellules parentes
  plus tard (voir `DECISIONS.md` D-07) ; le code manipule un identifiant de région opaque.

### 2.3 Zones

* Une **zone** = la cellule H3 parente de **résolution 4** (≈ 1 770 km², l'échelle d'une
  agglomération et de ses environs). Elle sert aux **classements locaux** et au
  **rééquilibrage des équipes**.

## 3. Territoires sauvages

* Tout territoire jamais conquis (ou abandonné) est **sauvage** : il possède une garnison
  neutre gérée par le jeu. Elle n'est **pas stockée** : elle est recalculée à la volée.
* Garnison sauvage = `base` (1) + bonus d'altitude (+1 par tranche de 400 m au-dessus de
  300 m, altitude du centre de l'hexagone d'après un modèle de terrain) + variation
  déterministe de 0 à 1 (identique pour tous les joueurs et fixée pour la saison),
  plafonnée à 6.
  * Plaine / ville : 1 à 2 troupes → une course de 3 km suffit à prendre un territoire.
  * Montagne à 1 500 m : 4 à 5 troupes → il faut une vraie sortie trail (qui rapporte
    aussi plus de troupes grâce au dénivelé).
* Un coureur isolé peut donc progresser seul en conquérant les territoires sauvages
  autour de lui.
* *Amélioration proposée* : les zones « reculées » sont approximées par l'altitude (donnée
  disponible partout). Un indicateur d'isolement réel (densité de population) pourra être
  ajouté quand une source mondiale libre sera intégrée.

## 4. Les équipes (factions)

* **3 factions mondiales** : **Braise** (rouge-orangé), **Sylve** (vert), **Marée** (bleu).
  Une 4ᵉ (**Ambre**, jaune) est prête dans la configuration pour une ouverture large.
* À l'inscription, le joueur choisit sa faction **ou** laisse le jeu l'attribuer.
* **Rééquilibrage par zone** : une faction est **fermée** dans une zone si elle y dépasse
  sa part équitable de plus de 10 points (ex. > 43 % des joueurs actifs avec 3 factions)
  **et** que la zone compte au moins 6 joueurs. L'attribution automatique choisit la
  faction la moins représentée dans la zone du joueur.
* La zone du joueur est déterminée **une seule fois** à partir d'une position approximative
  (cellule de résolution 4 : seule cette cellule est conservée, jamais la position exacte).
* Changer de faction : impossible pendant une saison, libre entre deux saisons (sous réserve
  du rééquilibrage).

## 5. Troupes

* **1 km validé = 1 troupe** ; **+1 troupe par 100 m de D+ validé** (le trail est récompensé).
* Troupes d'une course = `⌊ km + D+/100 ⌋`. Exemple : 7,8 km et 230 m D+ → 10 troupes.
* Seuls la distance et le dénivelé **recalculés par le serveur** comptent (voir §11).
* **Plafond journalier** : 42 km et 3 000 m D+ validés par jour et par joueur. Au-delà, la
  course est enregistrée mais ne rapporte plus de troupes.
* Les troupes d'une course doivent être déployées **dans les 48 h** ; passé ce délai, celles
  qui restent sont perdues (on garde ainsi une carte vivante).

## 6. Déploiement

* Après une course, les troupes se déploient **uniquement sur les territoires traversés
  pendant cette course**. Pas de déploiement depuis le canapé.
* Un territoire compte comme traversé si la trace filtrée y parcourt **au moins 30 m**
  (évite de « gagner » une case frôlée à cause de l'imprécision GPS).
* Le joueur répartit librement ses troupes (tout sur une case, ou un peu partout). Un
  bouton « Répartition auto » propose une répartition (attaques gagnables d'abord, puis
  renforts des territoires menacés).
* **Territoire allié** → renfort : la garnison augmente du nombre de troupes (plafond de
  garnison : 60).
* **Territoire ennemi ou sauvage** → attaque (voir §7).
* Les déploiements sont résolus **dans l'ordre d'arrivée** sur le serveur, case par case,
  de manière atomique (deux attaques simultanées ne peuvent pas se « dédoubler »).

## 7. Combat

* Soit `A` les troupes envoyées (après bonus de région éventuel) et `G` la garnison
  actuelle (après érosion). La défense a un avantage **×1,2**.
* Si `A ≥ 1,2 × G` : **le territoire tombe**. Il passe à l'équipe de l'attaquant avec une
  garnison égale au surplus `A − 1,2 × G`, **au minimum 1** (un territoire vient d'être pris
  par au moins un coureur : il ne peut pas être vide).
* Sinon : la garnison est réduite de `A / 1,2`. Les troupes attaquantes sont perdues.
* Exemple : garnison ennemie de 10. J'envoie 8 troupes → 10 − 8/1,2 = 3,33 restant.
  Un coéquipier envoie ensuite 5 troupes ≥ 1,2 × 3,33 = 4 → pris avec 1 de garnison.
  **La coordination d'équipe paie.**
* Les garnisons sont des nombres décimaux (l'érosion les grignote) ; l'app affiche
  l'arrondi.

## 8. Érosion

* Chaque garnison perd **5 % par jour** (calcul continu : `G × 0,95^jours`), ce qui oblige
  à entretenir son territoire.
* Un territoire dont la garnison tombe **sous 1** est **abandonné** et redevient sauvage.
  Ordre de grandeur : une garnison de 10 tient ~45 jours sans renfort, une garnison de 3
  environ 21 jours.
* Le serveur calcule l'érosion à la lecture (valeur toujours exacte) et un traitement
  planifié quotidien (04:00 UTC) matérialise les valeurs et libère les territoires abandonnés.

## 9. Bonus de région

* Une équipe **contrôle** une région si elle détient **au moins 50 % des 49 territoires**
  de cette région (majorité stricte ⇒ une seule équipe au plus).
* *Amélioration par rapport à « toute la région »* : une région contient des lacs, voies
  ferrées, terrains militaires ou privés inaccessibles. Exiger 100 % rendrait le bonus
  impossible dans la plupart des régions. Le seuil est paramétrable (mettre 1,0 pour
  revenir à la règle stricte).
* L'équipe qui contrôle une région obtient **+10 % de troupes** sur tous ses déploiements
  dans cette région (attaque comme renfort).
* Une prise de contrôle ou une perte de région génère un événement dans le fil d'actualité.

## 10. Saisons et classements

* Une saison dure **4 semaines**. À la fin, la carte est remise à zéro (tous les territoires
  redeviennent sauvages, la variation des garnisons sauvages est re-tirée).
* **Points de faction par zone** : chaque jour à 04:00 UTC, chaque faction marque 1 point par
  territoire tenu dans la zone (« territoire-jours »). On récompense la domination durable,
  pas un raid la veille de la fin.
* **Classement mondial des factions** : somme des territoire-jours de toutes les zones.
* **Classement individuel par zone** : points de saison =
  10 × territoires pris + 1 × troupe déployée + 1 × km validé.
* **Titres et badges** de fin de saison : faction victorieuse de la zone (badge de faction),
  « Conquérant » (1ᵉʳ de la zone), « Stratège » (plus de régions prises par son équipe
  avec sa participation), « Bâtisseur » (plus de renforts), « Explorateur » (plus de
  territoires différents traversés), « Sherpa » (plus de D+).

## 11. Validation des courses (anti-triche)

Le serveur ne fait **jamais** confiance au client. Il reçoit la trace brute et :

1. vérifie la cohérence temporelle (horodatages croissants, course < 12 h, envoyée dans les
   7 jours, pas dans le futur, pas de doublon) ;
2. rejette une course contenant des positions simulées (`mocked`) ;
3. refiltre la trace (même chaîne que l'app + lissage arrière) ;
4. rejette la course si la vitesse moyenne dépasse **20 km/h sur une fenêtre glissante de
   3 minutes** (véhicule) ; retire les sauts isolés impossibles ; signale les accélérations
   impossibles (> 6 m/s²) ;
5. recalcule distance, D+ (modèle de terrain), territoires traversés, troupes et XP ;
6. applique les plafonds journaliers.

Chaque course rejetée apparaît dans le **journal des courses** du joueur avec la raison
(ex. « Vitesse de véhicule détectée entre 12:04 et 12:09 »).

## 12. Progression individuelle

* **XP** par course validée : 10 XP/km + 1 XP par 10 m de D+ + 2 XP par minute active,
  + 15 XP par territoire pris, + 3 XP par renfort. Les XP ne sont jamais remises à zéro.
* **Niveaux** : XP pour passer du niveau `n` au niveau `n+1` = `100 + 50 × (n − 1)`
  (repris du prototype).
* **Rangs** (repris du prototype) : Débutant (niv. 1), Jogger (11), Coureur (26),
  Athlète (46), Champion (71), Maître (91).
* **Trophées** : jalons de régularité et de distance (repris du prototype) + trophées de
  conquête (premier territoire, 10/50/200 territoires, première région, 1 000 m / 10 000 m
  de D+ cumulé, territoire au-dessus de 2 000 m…).
* **Défis solo** hebdomadaires tirés au sort (déterministe par joueur et par semaine) :
  distance, D+, nombre de territoires sauvages pris, nombre de nouveaux territoires
  explorés.

## 13. Vie privée (rappel des règles de jeu)

* Les autres joueurs ne voient **jamais** tes traces : seulement les territoires, leur
  couleur et leur garnison.
* Le fil d'actualité ne te nomme pas pour une action située dans ta **zone de
  confidentialité** (domicile) : il affiche « Un membre de Braise a pris … ».

## 14. Paramètres (valeurs par défaut)

| Clé | Défaut | Rôle |
| --- | --- | --- |
| `h3.territoryRes` | 8 | résolution des territoires |
| `h3.regionRes` | 6 | résolution des régions |
| `h3.zoneRes` | 4 | résolution des zones (classements, rééquilibrage) |
| `troops.perKm` | 1 | troupes par km |
| `troops.perDplus100m` | 1 | troupes par 100 m D+ |
| `troops.deployWindowHours` | 48 | délai pour déployer |
| `troops.dailyKmCap` / `dailyDplusCap` | 42 / 3000 | plafonds journaliers |
| `territory.minMetersInCell` | 30 | présence minimale pour compter une case |
| `combat.defenseMultiplier` | 1.2 | avantage défensif |
| `combat.minGarrisonAfterCapture` | 1 | garnison minimale après prise |
| `combat.maxGarrison` | 60 | plafond de garnison |
| `erosion.dailyRate` | 0.05 | érosion quotidienne |
| `erosion.abandonThreshold` | 1 | seuil d'abandon |
| `region.controlThreshold` | 0.5 | part de la région à tenir |
| `region.troopBonus` | 0.10 | bonus de troupes |
| `wild.base` / `wild.altitudeStepM` / `wild.altitudeStartM` / `wild.jitter` / `wild.max` | 1 / 400 / 300 / 1 / 6 | garnisons sauvages |
| `factions.count` | 3 | nombre de factions actives |
| `factions.balanceMargin` / `balanceMinPlayers` | 0.10 / 6 | rééquilibrage |
| `season.lengthDays` | 28 | durée d'une saison |
| `antiCheat.*` | voir `ARCHITECTURE.md` | seuils de validation |
