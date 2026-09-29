# Conquête Run — Règles du jeu (v2 : la guerre des foulées)

> Nom provisoire. Toutes les valeurs chiffrées de ce document sont des **paramètres serveur**
> (table `game_config`, voir « Paramètres » en fin de document). Ils se modifient sans
> redéployer l'app. Les valeurs indiquées sont les valeurs par défaut de la saison test.

## 1. Principe

Chaque kilomètre que tu cours devient une troupe. Après ta course, tu déploies tes troupes
sur les territoires que tu viens de traverser : renforcer ceux de ton camp, attaquer ceux
de l'ennemi ou les territoires sauvages. **Deux factions, la Braise (rouge) et la Marée
(bleu), se font une guerre éternelle** sur une carte mondiale découpée automatiquement en
hexagones. Une saison dure 4 semaines : la faction qui a dominé la zone gagne la saison,
la victoire s'ajoute au score éternel, puis la carte est remise à zéro et la guerre reprend.

**En une phrase** : cours → gagne des troupes → prends les hexagones traversés → garde-les
face aux contre-attaques. Trois leviers rendent le jeu addictif : la **série** 🔥 (courir
chaque jour donne jusqu'à +50 % de troupes), le **front du jour** ⚔️ (une région où les
prises comptent double) et le **rival** 😈 (le joueur ennemi qui te reprend le plus de
territoires).

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

* **2 factions en guerre éternelle** :
  * **Braise** (rouge-orangé, emblème flamme) — « Le feu ne recule jamais. » Nés du premier
    feu, ses coureurs attaquent à l'aube et brûlent chaque rue qu'ils traversent.
  * **Marée** (bleu, emblème vague) — « Rien n'arrête la vague. » Patients et implacables,
    ses coureurs reviennent sans cesse et recouvrent tout sur leur passage.
  * **Sylve** (vert) et **Ambre** (jaune) restent en réserve (`factions.count` jusqu'à 4)
    si le jeu grandit au point de justifier plus de camps.
* Deux camps plutôt que trois : tout le monde comprend immédiatement qui est l'ennemi, le
  score est une simple barre « nous contre eux », et chaque prise se voit.
* **Le choix du camp est le premier écran du jeu** (deux grands panneaux, un « VS » au
  milieu). On peut aussi laisser le destin choisir. Toute l'interface prend ensuite la
  couleur de sa faction.
* **Rééquilibrage par zone** : une faction est **fermée** dans une zone si elle y dépasse
  sa part équitable de plus de 10 points (> 60 % des joueurs actifs à deux factions)
  **et** que la zone compte au moins 6 joueurs. L'attribution automatique choisit la
  faction la moins représentée dans la zone du joueur.
* La zone du joueur est déterminée **une seule fois** à partir d'une position approximative
  (cellule de résolution 4 : seule cette cellule est conservée, jamais la position exacte).
* Changer de faction : impossible pendant une saison, libre entre deux saisons (sous réserve
  du rééquilibrage).

## 5. Troupes

* **1 km validé = 1 troupe** ; **+1 troupe par 100 m de D+ validé** (le trail est récompensé).
* Troupes d'une course = `⌊ (km + D+/100) × (1 + bonus de série) ⌋`. Exemple : 7,8 km et
  230 m D+ sans série → 10 troupes ; le même jour de série n° 4 (+30 %) → 13 troupes.
* Seuls la distance et le dénivelé **recalculés par le serveur** comptent (voir §12).
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
* Sinon : la garnison est réduite de `A / 1,2`. Les troupes attaquantes sont perdues. Si la
  garnison d'un territoire ennemi tombe sous 1, il devient une **ruine neutre** (sans
  propriétaire, facile à prendre) puis redevient sauvage lors du traitement quotidien.
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

## 10. Série, front du jour, rival, guerre éternelle

* **Série 🔥** : nombre de jours consécutifs (jours locaux du coureur) avec au moins une
  course validée de **2 km**. Chaque jour de série au-delà du premier ajoute **+10 % de
  troupes**, plafonné à **+50 %** (6ᵉ jour). Un jour sans course remet la série à zéro.
  L'app prévient le jour où la série va s'éteindre (rappel local à 18 h 30, désactivable).
* **Front du jour ⚔️** : chaque jour, une région de la zone devient le front (choix
  déterministe identique pour tous, parmi les régions disputées par les deux camps si
  possible). Les territoires **pris** sur le front rapportent **×2 points** de saison et
  **×1,5 XP**. Il est surligné en or sur la carte.
* **Rival 😈** : le joueur ennemi qui t'a repris le plus de territoires parmi ceux que tu
  avais conquis. Il est affiché dans l'onglet Guerre, avec le nombre de prises à venger.
* **Guerre éternelle** : chaque saison gagnée (territoire-jours, voir §11) ajoute une
  victoire au compteur de la faction dans la zone. Ce compteur ne se remet jamais à zéro.
* **Rapport d'absence** : à l'ouverture de l'app, un encart résume ce que l'ennemi et tes
  alliés ont pris depuis ta dernière visite, avec un bouton « Riposter ».

## 11. Saisons et classements

* Une saison dure **4 semaines**. À la fin, la carte est remise à zéro (tous les territoires
  redeviennent sauvages, la variation des garnisons sauvages est re-tirée).
* **Points de faction par zone** : chaque jour à 04:00 UTC, chaque faction marque 1 point par
  territoire tenu dans la zone (« territoire-jours »). On récompense la domination durable,
  pas un raid la veille de la fin.
* **Classement mondial des factions** : somme des territoire-jours de toutes les zones.
* **Classement individuel par zone** : points de saison =
  10 × territoires pris (× 2 sur le front du jour) + 1 × troupe déployée + 1 × km validé.
* **Titres et badges** de fin de saison : faction victorieuse de la zone (badge de faction),
  « Conquérant » (1ᵉʳ de la zone), « Stratège » (plus de régions prises par son équipe
  avec sa participation), « Bâtisseur » (plus de renforts), « Explorateur » (plus de
  territoires différents traversés), « Sherpa » (plus de D+).

## 12. Validation des courses (anti-triche)

Le serveur ne fait **jamais** confiance au client. Il reçoit la trace brute et :

1. vérifie la cohérence temporelle (horodatages croissants, course < 12 h, envoyée dans les
   7 jours, pas dans le futur, pas de doublon) ;
2. rejette une course contenant des positions simulées (`mocked`) ;
3. refiltre la trace (même chaîne que l'app + lissage arrière) ;
4. rejette la course si la vitesse moyenne dépasse **20 km/h sur une fenêtre glissante de
   3 minutes** (véhicule) ; retire les sauts isolés impossibles ; signale les accélérations
   impossibles (> 6 m/s²) ;
5. recalcule distance, D+ (modèle de terrain), territoires traversés, troupes et XP ;
6. applique les plafonds journaliers, une limite de 12 envois par heure, et refuse toute
   trace déjà validée (même envoyée par un autre compte) ;
7. signale pour modération (sans rejet automatique) les traces « trop parfaites »,
   les accélérations impossibles répétées et les longues coupures de signal.

Chaque course rejetée apparaît dans le **journal des courses** du joueur avec la raison
(ex. « Vitesse de véhicule détectée entre 12:04 et 12:09 »).

## 13. Progression individuelle

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

## 14. Vie privée (rappel des règles de jeu)

* Les autres joueurs ne voient **jamais** tes traces : seulement les territoires, leur
  couleur et leur garnison.
* Le fil d'actualité ne te nomme pas pour une action située dans ta **zone de
  confidentialité** (domicile) : il affiche « Un membre de Braise a pris … ».

## 15. Mode solo (sans compte ni serveur)

Si l'app n'est pas reliée à un serveur (aucune variable `EXPO_PUBLIC_SUPABASE_*`), ou avec
`EXPO_PUBLIC_GAME_MODE=local`, le jeu tourne **entièrement sur le téléphone** :

* inscription sans compte (nom de guerre, avatar, camp) ; le champ de bataille est créé
  autour de la position du joueur : voisinage immédiat sauvage, un front ennemi d'un côté,
  des territoires alliés de l'autre, des garnisons plus fortes au loin ;
* validation des courses par **la même chaîne que le serveur** (filtrage, anti-triche,
  D+ par modèle de terrain IGN / Open Topo Data quand le réseau est disponible, repli GPS) ;
* l'ennemi et des coéquipiers fictifs (6 par camp, noms thématiques) **jouent toutes les
  8 heures** : ils attaquent leur frontière (d'abord les prises bon marché et les territoires
  du joueur), harcèlent, renforcent leurs points faibles. Leur budget suit l'activité du
  joueur (6 à 30 troupes par jour pour l'ennemi) : le défi reste à sa mesure ;
* érosion, régions, front du jour, série, rival, trophées, défis, fin de saison et
  victoires éternelles fonctionnent comme en ligne ;
* les courses du mode simulation comptent (bac à sable), le délai d'envoi est de 30 jours.

## 16. Paramètres (valeurs par défaut)

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
| `factions.count` | 2 | nombre de factions actives (2 à 4) |
| `streak.minKm` / `bonusPerDay` / `maxBonus` | 2 / 0.10 / 0.50 | série |
| `front.pointsMultiplier` / `xpMultiplier` | 2 / 1.5 | front du jour |
| `factions.balanceMargin` / `balanceMinPlayers` | 0.10 / 6 | rééquilibrage |
| `season.lengthDays` | 28 | durée d'une saison |
| `antiCheat.*` | voir `ARCHITECTURE.md` | seuils de validation |
