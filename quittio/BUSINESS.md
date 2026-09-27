# Quittio — Business plan (Phase 1)

> Document de travail rédigé le 27/09/2026. Tous les chiffres de marché sont des
> **estimations prudentes** issues de sources publiques (INSEE, ANIL, Stripe,
> grilles tarifaires publiques des concurrents) ; ils sont à reconfirmer avec
> un outil de mots-clés (Google Keyword Planner / Ubersuggest) une fois le
> compte Google Ads créé (voir `TODO.md`).

---

## 1. Quinze problèmes récurrents pour lesquels on paie (ou paierait) chaque mois

Grille de notation (chaque critère sur 10, total sur 60) :

- **D** — douleur récurrente (fréquence × intensité)
- **P** — volonté de payer (existence de concurrents payants, gain d'argent/temps chiffrable)
- **V** — volume de recherche Google probable sur de la longue traîne atteignable
- **C** — faible concurrence SEO (10 = très peu de concurrence)
- **A** — degré d'automatisation possible (10 = zéro intervention humaine)
- **T** — time-to-first-euro (10 = premier paiement possible en quelques jours)

| # | Problème | Persona | D | P | V | C | A | T | **Total** |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Gestion locative en direct : quittances mensuelles, suivi des loyers, relances d'impayés, révision IRL** | Propriétaire bailleur particulier (1–10 logements) | 8 | 8 | 9 | 6 | 9 | 9 | **49** |
| 2 | Calendrier des obligations du micro-entrepreneur (URSSAF, CFE, TVA, impôt) + rappels + suivi des seuils | Micro-entrepreneur | 7 | 5 | 9 | 5 | 9 | 8 | 43 |
| 3 | Relances automatiques de factures impayées | Indépendant / TPE de services | 8 | 7 | 6 | 6 | 7 | 7 | 41 |
| 4 | Collecte d'avis Google (demandes automatiques par e-mail/SMS, QR code) | Artisan / commerce local | 6 | 7 | 6 | 6 | 8 | 8 | 41 |
| 5 | Veille des appels d'offres publics (BOAMP) filtrés par métier et zone | TPE du BTP / services | 6 | 8 | 5 | 5 | 8 | 6 | 38 |
| 6 | Publications Google Business Profile hebdomadaires + réponses aux avis | Artisan / commerce local | 5 | 6 | 5 | 6 | 7 | 7 | 36 |
| 7 | Passage à la facturation électronique obligatoire (réception 09/2026, émission 09/2027) | TPE / indépendants | 7 | 7 | 8 | 3 | 5 | 4 | 34 |
| 8 | Rappels d'entretien et contrôles obligatoires du logement (chaudière, ramonage, DPE, assurance) | Propriétaire occupant | 4 | 3 | 6 | 7 | 9 | 8 | 37 |
| 9 | Suivi des indemnités kilométriques et notes de frais | Salarié au réel / indépendant | 5 | 4 | 7 | 5 | 8 | 7 | 36 |
| 10 | Gestion des abonnements personnels et résiliations | Particulier | 5 | 3 | 7 | 4 | 7 | 7 | 33 |
| 11 | Rappels de RDV et réduction des lapins (SMS) | Praticien libéral / coiffeur | 7 | 7 | 5 | 2 | 8 | 6 | 35 |
| 12 | Conformité RGPD (registre, mentions, cookies) pour TPE | TPE | 3 | 5 | 6 | 5 | 6 | 6 | 31 |
| 13 | DUERP (document unique) mis à jour chaque année | TPE avec salariés | 4 | 5 | 6 | 6 | 6 | 6 | 33 |
| 14 | Entretien ménager récurrent à domicile (service physique) | Particulier actif | 7 | 7 | 7 | 5 | 1 | 5 | 32 |
| 15 | Plannings et échanges de gardes / créneaux d'équipe | TPE avec 3–15 salariés | 6 | 6 | 4 | 4 | 7 | 5 | 32 |

### Lecture rapide des perdants

- **#2 micro-entrepreneur** : énorme volume de recherche, mais l'URSSAF et les
  néobanques (Shine, Qonto) offrent déjà gratuitement l'essentiel → volonté de
  payer faible.
- **#3 relances factures** et **#11 rappels RDV** : bonne douleur, mais
  concurrence installée (logiciels de facturation qui l'incluent, Planity,
  Doctolib) et délivrabilité e-mail/SMS au nom du client délicate.
- **#7 facturation électronique** : le sujet le plus « chaud » de 2026, mais
  impose de passer par une Plateforme Agréée (PA) → pas de produit jour 1.
- **#14 ménage à domicile** : récurrent et rentable mais non automatisable
  (c'est un métier de terrain, déjà exercé par HydroPropreté — voir DECISIONS.md).

---

## 2. Idée retenue : **Quittio** — la gestion locative automatique pour les propriétaires qui gèrent en direct

### Pourquoi celle-ci gagne (49/60)

1. **Douleur mensuelle, garantie par la loi.** Le bailleur doit remettre
   gratuitement une quittance au locataire qui la demande (loi du 6 juillet
   1989, art. 21). Chaque mois il faut vérifier le virement, faire la
   quittance, l'envoyer ; une fois par an réviser le loyer selon l'IRL ;
   régulièrement relancer un retard. C'est répétitif, anxiogène (impayés) et
   facile à oublier.
2. **Marché vaste et solvable.** La France compte environ **3,5 millions de
   particuliers bailleurs** (ménages détenant au moins un logement loué),
   dont une majorité gère sans agence pour économiser 6 à 8 % de frais de
   gestion. Un propriétaire qui économise 60 €/mois d'agence paie sans
   difficulté 5 à 10 €/mois pour un outil.
3. **Volonté de payer déjà prouvée** : Rentila, BailFacile, Smovin,
   Qalimo… facturent entre 4 et 30 €/mois. Le marché existe ; on vient avec
   un produit plus simple, plus beau, plus automatique, et une acquisition
   SEO sur des requêtes que ces acteurs traitent mal (outils gratuits,
   modèles de lettres, cas pratiques).
4. **Longue traîne SEO massive et « evergreen »** : « calcul révision loyer
   IRL », « modèle quittance de loyer gratuit », « lettre relance loyer
   impayé », « quittance de loyer obligatoire », « révision loyer oubliée »…
   plus un pic de recherche à chaque publication trimestrielle de l'IRL.
5. **Automatisation quasi totale** : génération PDF, e-mails, calcul IRL,
   relances — tout est déterministe. Aucune IA ni prestataire tiers
   nécessaire, aucune donnée externe à part l'IRL (4 mises à jour par an).
6. **Valeur dès le jour 1** : le propriétaire saisit son logement et son
   locataire en 3 minutes et envoie sa première quittance dans la foulée.
7. **Rétention naturelle** : une fois les baux, l'historique des loyers et
   les quittances centralisés, on ne change pas d'outil → churn faible.

### Persona principal — « Sophie, 47 ans »

- Cadre (ou professions libérales), revenus confortables, **2 appartements
  loués** en location nue achetés en LMNP/nue propriété il y a 3–8 ans, un
  studio étudiant + un T2.
- Gère seule pour ne pas payer 7 % TTC d'agence (≈ 90 €/mois pour elle).
- Fait ses quittances sur un modèle Word, oublie un mois sur deux ; n'a
  **jamais révisé son loyer** depuis 3 ans (manque à gagner cumulé : plusieurs
  centaines d'euros) ; angoisse dès qu'un virement arrive en retard et ne sait
  pas quoi écrire au locataire.
- Cherche sur Google le soir, sur mobile : « comment calculer l'augmentation
  de loyer », « modèle lettre retard de loyer ».
- Persona secondaire : **Marc, 62 ans, 6 logements**, retraité, veut un
  récapitulatif annuel pour sa déclaration 2044 et des relances sans y penser.

### Problème (formulation client)

« Chaque mois je perds du temps à faire mes quittances, j'oublie de réviser
mes loyers et je ne sais jamais comment relancer un locataire en retard sans
abîmer la relation. »

### Promesse en une phrase

**« Vos loyers suivis, vos quittances envoyées et vos révisions calculées
automatiquement — gérez vos locations en 5 minutes par mois. »**

### Offre

Un espace propriétaire en ligne (mobile-first) qui :

1. **Centralise** logements, baux et locataires.
2. **Envoie l'avis d'échéance** au locataire quelques jours avant la date de
   paiement.
3. **Génère et envoie la quittance PDF** conforme en 1 clic dès que le loyer
   est marqué payé (ou automatiquement à l'échéance, en mode « virement
   permanent »).
4. **Relance automatiquement** les retards (relance amiable J+5, rappel
   ferme J+15) et fournit un modèle de **mise en demeure** prêt à imprimer.
5. **Calcule la révision IRL** à la date anniversaire, prévient le
   propriétaire et génère la **lettre de révision** à envoyer au locataire.
6. **Récapitule les revenus locatifs** de l'année (export CSV) pour la
   déclaration de revenus fonciers.
7. **Outils gratuits** publics (lead magnets SEO) : calculateur IRL et
   générateur de quittance ponctuelle sans inscription.

### Paliers d'abonnement

Prix TTC. Au lancement, l'éditeur est en micro-entreprise en franchise en
base de TVA (« TVA non applicable, art. 293 B du CGI ») ; le prix affiché est
donc le prix payé. L'annuel = 10 mois payés (2 mois offerts).

| | **Essentiel** | **Sérénité** ⭐ | **Patrimoine** |
|---|---|---|---|
| Mensuel | **4,90 €** | **9,90 €** | **19,90 €** |
| Annuel | **49 €** | **99 €** | **199 €** |
| Logements | 1 | jusqu'à 5 | jusqu'à 20 |
| Quittances PDF + envoi e-mail | ✅ | ✅ | ✅ |
| Suivi des loyers & historique | ✅ | ✅ | ✅ |
| Calcul et lettre de révision IRL | ✅ | ✅ | ✅ |
| Avis d'échéance automatiques | — | ✅ | ✅ |
| Quittance automatique à l'échéance | — | ✅ | ✅ |
| Relances automatiques d'impayés + mise en demeure | — | ✅ | ✅ |
| Export annuel revenus fonciers (CSV) | — | — | ✅ |
| Support prioritaire (réponse < 24 h ouvrées) | — | — | ✅ |

**Essai gratuit : oui, 14 jours**, carte bancaire demandée par Stripe
Checkout mais **aucun débit avant J+14**, annulable en 1 clic depuis l'espace
client. Raison : le produit délivre sa valeur dès le premier jour (1ʳᵉ
quittance envoyée en 3 minutes), l'essai lève le frein principal (« est-ce
que c'est simple ? ») ; la carte en amont filtre les curieux et fait passer la
conversion essai → payant d'environ 15 % (sans CB) à environ 50 % (avec CB,
ordre de grandeur couramment constaté en SaaS B2C).

**Parrainage** intégré : 1 mois offert au parrain (crédit Stripe) pour
chaque filleul qui devient payant, et −1 mois pour le filleul (via l'essai
prolongé à 30 jours).

### Coûts fixes mensuels (au lancement)

| Poste | Coût/mois | Remarque |
|---|---|---|
| Vercel Pro | ~19 € (20 $) | Le plan Hobby interdit l'usage commercial |
| Firebase (Blaze) | 0–5 € | Quotas gratuits largement suffisants < 1 000 clients |
| Resend | 0 € puis ~19 € | Gratuit jusqu'à 3 000 e-mails/mois (100/jour) |
| Nom de domaine `.fr` | ~1 € | ~12 €/an |
| Compte pro bancaire | 0–9 € | Obligatoire au-delà de 10 k€ de CA 2 années de suite ; recommandé dès le début |
| Assurance RC Pro | ~15 € | Recommandée (éditeur de logiciel) |
| Google Workspace / e-mail pro | ~6 € | Optionnel (sinon alias gratuit via le registrar) |
| **Total** | **≈ 45 € au lancement, ≈ 65 € à partir de ~300 clients** | |

Coûts variables : Stripe ≈ 1,5 % + 0,25 € par paiement (cartes UE) + 0,7 %
Stripe Billing. Sur un abonnement Sérénité mensuel à 9,90 € : ≈ 0,47 € →
**marge nette ≈ 9,43 €**. Cotisations sociales micro-entrepreneur (BNC/
prestations de services, ~24,6 % du CA en 2026) à déduire du revenu de
l'entrepreneur, pas du seuil d'exploitation.

### Seuil de rentabilité

Hypothèse de mix : 30 % Essentiel, 55 % Sérénité, 15 % Patrimoine, 35 % en
annuel → ARPU ≈ **8,70 €/mois**, net Stripe ≈ **8,20 €**.

- Seuil d'exploitation (couvrir les ~45 € de coûts fixes) : **6 abonnés**.
- Seuil « un SMIC net après cotisations » (≈ 1 430 € net) : environ
  **1 430 / (8,20 × 0,754) + coûts ≈ 240 abonnés**.

### Projections prudentes

Hypothèses : trafic 100 % organique (pas de pub), taux de conversion
visiteur → essai 1,5 %, essai → payant 45 %, churn mensuel 3,5 %.

| Horizon | Visites/mois | Essais/mois | Abonnés actifs | MRR | Résultat mensuel (avant cotisations) |
|---|---|---|---|---|---|
| **M+3** | 1 500 | 22 | ~25 | ~215 € | ~+160 € |
| **M+6** | 5 000 | 75 | ~95 | ~830 € | ~+770 € |
| **M+12** | 14 000 | 210 | ~330 | ~2 900 € | ~+2 800 € |

Scénario pessimiste (SEO 2× plus lent) : ~120 abonnés à M+12 (≈ 1 000 € MRR).
Scénario optimiste (1 article viral / partenariat) : 600+ abonnés à M+12.

### Risques et parades

| Risque | Probabilité | Parade |
|---|---|---|
| Concurrence établie (Rentila, BailFacile) | Élevée | Se différencier par la simplicité, le design mobile, l'automatisation de bout en bout (avis d'échéance → quittance → relance) et le prix d'entrée à 4,90 €. Viser la longue traîne, pas « logiciel gestion locative ». |
| SEO lent à décoller (sandbox de 3–6 mois) | Élevée | Outils gratuits (calculateur IRL, générateur de quittance) qui captent des liens naturels ; communautés (forums, groupes Facebook de bailleurs) ; parrainage. |
| Délivrabilité des e-mails envoyés au locataire | Moyenne | Domaine d'envoi dédié authentifié (SPF, DKIM, DMARC) via Resend ; `reply-to` = e-mail du propriétaire ; copie au propriétaire ; PDF téléchargeable en secours. |
| Erreur de calcul IRL / contenu juridique | Faible | Valeurs IRL officielles, tests unitaires, formule plafonnée, disclaimers ; relecture annuelle des modèles par un juriste (voir TODO). |
| Données personnelles de tiers (locataires) | Moyenne | Minimisation (nom, e-mail, adresse du bien), Firestore en région UE, règles de sécurité par propriétaire, DPA Stripe/Resend/Google, suppression à la clôture. |
| Dépendance à un fournisseur (Firebase, Vercel) | Faible | Données exportables (CSV), code standard Next.js déployable ailleurs. |
| Churn élevé si le propriétaire vend son bien | Moyenne | Offre annuelle mise en avant ; relance e-mail avant fin d'essai ; export annuel qui crée de la valeur en fin d'année. |
| Modification législative (gel de l'IRL, loi Climat) | Moyenne | Veille hebdomadaire (tâche ci-dessous) ; les règles sont centralisées dans `src/lib/irl.ts`. |

### Tâches hebdomadaires pour faire tourner le business (≈ 4 h/semaine)

| Jour | Tâche | Durée |
|---|---|---|
| Lundi | Consulter le dashboard Stripe (MRR, échecs de paiement, résiliations) et contacter personnellement chaque résilié (« qu'est-ce qui a manqué ? ») | 20 min |
| Lundi | Répondre aux e-mails support (objectif < 24 h) | 30 min |
| Mardi | Rédiger et publier l'article de la semaine (plan éditorial dans `SEO.md`) | 1 h 30 |
| Mercredi | Publier 2 posts réseaux sociaux + 2 réponses utiles dans les communautés (voir `GROWTH.md`) | 45 min |
| Jeudi | Google Search Console : requêtes en progression, pages à optimiser, erreurs d'indexation | 20 min |
| Vendredi | Veille juridique locative (Service-public.fr, ANIL, Légifrance) + vérifier la publication trimestrielle de l'IRL (mi-janvier, mi-avril, mi-juillet, mi-octobre) et mettre à jour `src/lib/irl.ts` | 20 min |
| Vendredi | Vérifier les logs Vercel (cron quotidien OK, erreurs webhooks) et les rebonds Resend | 15 min |

---

## 3. Pourquoi pas une activité liée à HydroPropreté ?

Ce dépôt héberge aussi le site vitrine d'HydroPropreté (nettoyage à Pau).
L'idée « abonnement d'entretien ménager » (#14) a été évaluée : elle est
rentable localement mais ne passe pas le critère d'automatisation et reste
limitée géographiquement. Quittio est donc un business indépendant, construit
dans le sous-dossier `quittio/` pour ne pas perturber le site existant (voir
`DECISIONS.md`).
