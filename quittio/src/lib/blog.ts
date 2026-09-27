export interface PostMeta {
  slug: string;
  title: string;
  description: string;
  /** Mot-clé principal ciblé (voir SEO.md). */
  keyword: string;
  date: string;
  updated?: string;
  readingMinutes: number;
}

/** Registre des articles (le contenu est dans src/content/blog/<slug>.mdx). Du plus récent au plus ancien. */
export const POSTS: PostMeta[] = [
  {
    slug: "gerer-location-sans-agence",
    title: "Gérer sa location sans agence : le guide complet du propriétaire bailleur",
    description: "Obligations, documents, outils et organisation mois par mois pour louer en direct et économiser 6 à 8 % de frais de gestion, sans risque.",
    keyword: "gérer sa location sans agence",
    date: "2026-09-25",
    readingMinutes: 8,
  },
  {
    slug: "augmentation-loyer-irl-2026",
    title: "Augmentation de loyer 2026 : IRL, calcul et règles à connaître",
    description: "IRL 2026 trimestre par trimestre, formule de calcul, exemples chiffrés, logements F et G, zones encadrées : tout pour réviser votre loyer sans erreur.",
    keyword: "augmentation loyer 2026",
    date: "2026-09-22",
    readingMinutes: 7,
  },
  {
    slug: "lettre-relance-loyer-impaye",
    title: "Loyer impayé : les étapes et les modèles de lettre de relance",
    description: "Relance amiable, mise en demeure, commandement de payer : la procédure pas à pas face à un loyer impayé, avec des modèles de lettres prêts à l'emploi.",
    keyword: "lettre relance loyer impayé",
    date: "2026-09-18",
    readingMinutes: 8,
  },
  {
    slug: "revision-loyer-oubliee",
    title: "Révision de loyer oubliée : que faire et combien vous perdez ?",
    description: "Vous avez oublié d'augmenter votre loyer ? Délai d'un an, absence de rétroactivité, rattrapage : ce que dit la loi et comment ne plus jamais l'oublier.",
    keyword: "révision loyer oubliée",
    date: "2026-09-15",
    readingMinutes: 6,
  },
  {
    slug: "quittance-de-loyer-obligatoire",
    title: "La quittance de loyer est-elle obligatoire ? Règles, mentions et modèle",
    description: "Quand le bailleur doit-il fournir une quittance, que doit-elle contenir, peut-on l'envoyer par e-mail ? Le point complet, avec un modèle gratuit.",
    keyword: "quittance de loyer obligatoire",
    date: "2026-09-11",
    readingMinutes: 6,
  },
];

export const getPost = (slug: string) => POSTS.find((p) => p.slug === slug);
