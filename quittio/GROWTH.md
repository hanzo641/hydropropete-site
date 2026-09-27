# Plan d'acquisition organique — Quittio

Objectif (BUSINESS.md) : **~25 abonnés à M+3, ~95 à M+6, ~330 à M+12**, sans publicité. Budget temps : ~4 h/semaine.

Économie unitaire de référence : ARPU ≈ 8,70 €/mois, churn prudent 3,5 %/mois → durée de vie moyenne ≈ 28 mois → **LTV brute ≈ 240 €**. Tout canal qui amène un abonné pour moins de ~60 € (1/4 de la LTV) est rentable.

---

## 1. SEO (canal principal, 60 % des inscriptions visées à M+12)

Voir `SEO.md` pour les mots-clés et le plan éditorial. Actions concrètes :

1. **Semaine 0** : Search Console, sitemap, Bing Webmaster Tools (import depuis Search Console, 5 min — Bing alimente aussi ChatGPT/Copilot).
2. **Chaque semaine** : 1 article du plan éditorial (1 h 30).
3. **Chaque trimestre** : mise à jour IRL le jour de la publication INSEE + article d'actu + post sur tous les canaux (pic de recherches).
4. **Liens entrants** (objectif : 20 domaines référents à M+6) :
   - proposer le **calculateur IRL** et le **générateur de quittance** comme ressources à des blogs d'investissement locatif, de finances personnelles et à des sites d'agences qui ne font que la mise en location ;
   - répondre aux journalistes (plateformes type *Presse-citron* / *HARO* FR, appels à témoins sur LinkedIn) sur les sujets IRL, impayés, gestion en direct ;
   - article invité sur 1 blog d'investissement par mois ;
   - fiches sur les annuaires de logiciels (Capterra, GetApp, Appvizer, Product Hunt au lancement).
5. **Intégrable** (M+4) : widget « calculateur IRL » à copier-coller (iframe + lien retour) pour blogs et agences : générateur naturel de liens.

## 2. Google Business Profile — non pertinent (décision)

Un profil d'établissement Google exige une adresse où recevoir des clients ou une zone de service physique ; un logiciel 100 % en ligne n'y est pas éligible selon les consignes Google, et un profil fictif risque la suspension. **On ne le crée pas.** À la place : fiche **Trustpilot** / **Google avis via le site** plus tard, et présence sur les annuaires SaaS.

> Exception utile : **HydroPropreté** (Pau) a un profil Google et une clientèle de propriétaires (remise en état, fin de chantier). Voir partenariats.

## 3. Communautés où se trouve le persona

Règle d'or : **apporter de la valeur d'abord** (réponse complète, sourcée), mentionner l'outil gratuit seulement s'il répond à la question, jamais de lien commercial brut. Se présenter comme fondateur quand on parle du produit.

| Communauté | Où | Action | Fréquence |
|---|---|---|---|
| Groupes Facebook de propriétaires bailleurs et d'investissement locatif (plusieurs dizaines de milliers de membres chacun) | Facebook | Répondre aux questions IRL / impayés / quittances ; partager le calculateur IRL à chaque publication INSEE (si le règlement du groupe l'autorise) | 2 réponses/sem. |
| r/vosfinances, r/immobilier, r/france (fils « immobilier ») | Reddit | Réponses détaillées ; AMA « j'ai construit un outil pour les bailleurs » à M+2 | 1–2/sem. |
| Forums d'investissement immobilier et de finances personnelles (sections location, fiscalité) | Web | Réponses expertes, signature discrète | 1/sem. |
| LinkedIn (investisseurs, CGP, courtiers) | LinkedIn | Posts pédagogiques (voir §6), commentaires chez les créateurs « investissement locatif » | 2 posts/sem. |
| YouTube / podcasts d'investissement locatif | — | Proposer un code partenaire (1er mois offert) aux créateurs de taille moyenne | 2 contacts/mois |
| Clubs d'investisseurs locaux, chambres syndicales de propriétaires (UNPI) | Local | Intervention « automatiser sa gestion » ou tarif adhérent | 1/trimestre |

## 4. Partenariats

| Partenaire | Pourquoi ils y gagnent | Offre | Mise en place |
|---|---|---|---|
| **Courtiers en crédit immobilier** | Leurs clients investisseurs deviennent bailleurs | Guide PDF « premier bail » co-brandé + 30 jours d'essai | Lien de parrainage dédié `/r/CODE` |
| **Experts-comptables LMNP / services de déclaration en ligne** | Leurs clients arrivent avec un récapitulatif propre | Export CSV compatible, lien réciproque | Échange de liens / page partenaire |
| **Diagnostiqueurs immobiliers** | Contact avec chaque bailleur avant mise en location | Flyer + code | 5 diagnostiqueurs pilotes |
| **Assureurs PNO / GLI, Visale** | Moins d'impayés si relances rapides | Contenu commun sur la prévention des impayés | Partenariat de contenu |
| **Agences « mise en location seule »** | Elles ne gèrent pas, leurs clients cherchent un outil | Commission 20 % la 1re année (via parrainage manuel) | Contrat simple |
| **HydroPropreté (Pau)** | Ses clients propriétaires ont besoin de remise en état entre deux locataires | Carte « Quittio » remise après chaque prestation fin de bail ; article « préparer un logement entre deux locataires » avec lien HydroPropreté | Immédiat, coût nul |

## 5. Parrainage intégré au produit (déjà développé)

- Lien personnel dans **Espace → Parrainage** (`/r/CODE`), boutons e-mail / WhatsApp prêts à l'emploi.
- **Filleul** : 30 jours d'essai au lieu de 14. **Parrain** : 1 mois offert, crédité automatiquement par Stripe au premier paiement du filleul, e-mail de remerciement automatique.
- **Activation (à développer)** : rappel du lien dans un e-mail envoyé 30 jours après l'abonnement, et encart dans le tableau de bord après la 3e quittance envoyée (moment de satisfaction).
- Objectif : 15 % des nouveaux abonnés via parrainage à M+12.

## 6. Dix posts réseaux sociaux prêts à publier

**1 — LinkedIn (lancement)**
> J'ai calculé ce que coûte l'oubli de la révision de loyer à un propriétaire.
> Loyer 750 €, bail signé en 2023, jamais révisé : plus de 600 € perdus en deux ans. Et comme la révision n'est pas rétroactive depuis la loi ALUR, cet argent ne se rattrape pas.
> C'est pour ça que j'ai lancé Quittio : quittances envoyées, loyers suivis, révisions IRL calculées automatiquement.
> Le calculateur IRL est gratuit, sans inscription 👉 quittio.fr/outils/calcul-revision-loyer-irl
> #immobilier #investissementlocatif #propriétaire

**2 — Facebook (groupe de bailleurs, réponse type à « comment calculer l'augmentation ? »)**
> La formule légale : loyer hors charges × nouvel IRL ÷ IRL de référence du bail (même trimestre, un an d'écart). Exemple avec un bail indexé T2 : 750 × 148,37 ÷ 146,68 = 758,64 €. Attention, pas de révision possible si le logement est classé F ou G. J'ai mis un calculateur gratuit en ligne si ça peut aider : quittio.fr/outils/calcul-revision-loyer-irl

**3 — X / Threads**
> Rappel pour les propriétaires : une quittance de loyer doit être fournie GRATUITEMENT au locataire qui la demande, avec loyer et charges détaillés. Paiement partiel ? Ce n'est pas une quittance, c'est un reçu. (loi du 6 juillet 1989, art. 21) 🧾

**4 — Instagram (carrousel, 5 visuels)**
> Slide 1 : « Votre locataire n'a pas payé. Voici quoi faire (dans l'ordre). »
> Slide 2 : J+5 → relance cordiale (un oubli, 9 fois sur 10)
> Slide 3 : J+15 → relance écrite ferme, délai de 8 jours
> Slide 4 : ~J+30 → mise en demeure en recommandé + caution / GLI
> Slide 5 : Ensuite → commandement de payer par commissaire de justice. Guide complet : lien en bio.

**5 — LinkedIn (chiffre)**
> 7 % TTC. C'est ce que coûte en moyenne une agence de gestion locative. Sur un loyer de 750 €, ≈ 630 € par an.
> La vraie question n'est pas « agence ou pas », mais « quelles tâches ai-je vraiment besoin de déléguer ? ». Quittances, relances, révision : ça s'automatise. La relation avec le locataire, elle, gagne à rester entre vos mains.

**6 — Facebook / LinkedIn (jour de publication de l'IRL — à adapter chaque trimestre)**
> 📈 L'INSEE vient de publier l'IRL du 2e trimestre 2026 : 148,37, soit +1,15 % sur un an. Si votre bail est indexé sur le T2, votre loyer peut augmenter d'au maximum 1,15 % à la prochaine date anniversaire. Calcul en 10 secondes : quittio.fr/outils/calcul-revision-loyer-irl

**7 — X / Threads (fil)**
> 5 erreurs de propriétaire qui coûtent cher 🧵
> 1. Oublier la révision annuelle (non rétroactive)
> 2. Délivrer une quittance pour un paiement partiel
> 3. Facturer des « frais de quittance » (interdit)
> 4. Attendre 3 mois avant de relancer un impayé
> 5. Rendre le dépôt de garantie en retard (+10 % du loyer par mois de retard)

**8 — LinkedIn (coulisses / build in public)**
> Quittio, 1 mois après le lancement : X propriétaires inscrits, Y quittances envoyées, Z relances automatiques… et 1 leçon : la fonctionnalité la plus utilisée n'est pas celle que je pensais. [à compléter avec les vrais chiffres — ne jamais inventer]

**9 — Instagram / Facebook (outil gratuit)**
> Besoin d'une quittance de loyer maintenant ? Générateur gratuit, PDF conforme, 1 minute, sans inscription et sans conserver vos données 👉 quittio.fr/outils/quittance-de-loyer-gratuite

**10 — LinkedIn (parrainage)**
> Vous connaissez un propriétaire qui fait encore ses quittances sur Word ? Avec mon lien, il a 30 jours d'essai sur Quittio (au lieu de 14). [lien de parrainage personnel]

## 7. Rituels et indicateurs

| Indicateur | Outil | Cible M+3 | Cible M+12 |
|---|---|---|---|
| Visites organiques / mois | Vercel Analytics, Search Console | 1 500 | 14 000 |
| Taux visiteur → essai | Stripe (Checkout créés) / visites | 1,5 % | 1,5 % |
| Taux essai → payant | Stripe | 45 % | 50 % |
| Churn mensuel | Stripe | < 5 % | < 3,5 % |
| Part d'abonnés annuels | Stripe | 30 % | 40 % |
| Domaines référents | Search Console / Ahrefs Webmaster Tools (gratuit) | 8 | 40 |

Revue chaque lundi (20 min, voir BUSINESS.md). Un canal qui ne produit rien après 8 semaines d'efforts réguliers est abandonné au profit du meilleur canal.

---

## 8. Plan B — publicité payante (à activer quand le funnel est prouvé)

**Condition de déclenchement** : ≥ 40 % de conversion essai → payant sur 30 essais et churn < 5 %. Avant, la pub brûlerait du budget sur un funnel non optimisé.

| Canal | Ciblage | Budget test | Hypothèses | Arrêt si |
|---|---|---|---|---|
| **Google Ads — Search** | Requêtes transactionnelles : « logiciel quittance loyer », « gestion locative en ligne », « application gestion locative », « relance loyer impayé automatique » ; exclusions : « gratuit » (sauf vers l'outil), « agence », « emploi » | 300 €/mois pendant 2 mois | CPC 0,80–2 €, conversion clic → essai 5 %, essai → payant 45 % → **CAC ≈ 35–90 €** | CAC > 60 € après 60 essais |
| **Google Ads — pics IRL** | Mêmes requêtes + « augmentation loyer [année] » vers le calculateur (remarketing ensuite) | +150 € la semaine de chaque publication INSEE | Trafic bon marché, conversion différée | Pas d'essais à J+30 |
| **Microsoft Ads** | Import de la campagne Google (audience plus âgée, CPC plus bas) | 100 €/mois | CPC −30 % vs Google | Idem |
| **Meta (Facebook/Instagram)** | Remarketing des visiteurs des outils gratuits (nécessite consentement cookies : ajouter le pixel **uniquement** derrière la bannière, catégorie « publicité ») | 150 €/mois | Rattrape les visiteurs non convertis | CPA > 60 € |
| **Sponsoring de newsletters / podcasts d'investissement** | Audience d'investisseurs locatifs | 200–500 € par insertion | Code dédié pour mesurer | < 5 essais par insertion |

**Saisonnalité à exploiter** : janvier (bonnes résolutions, IRL T4), avril-mai (déclaration de revenus : mettre en avant l'export Patrimoine), juillet (IRL T2), octobre (IRL T3), septembre (rentrée étudiante, nouveaux baux).

**Mesure** : paramètres UTM sur toutes les annonces ; conversion « essai démarré » = `checkout.session.completed` ; conversion « payant » = premier `invoice.paid` > 0. Import des conversions hors ligne dans Google Ads quand le volume le permet.
