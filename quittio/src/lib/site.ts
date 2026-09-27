/**
 * Configuration centrale du site. Les champs marqués [À COMPLÉTER] doivent
 * être renseignés avant la mise en ligne (voir TODO.md).
 */
export const site = {
  name: "Quittio",
  tagline: "La gestion locative automatique pour les propriétaires qui gèrent en direct",
  description:
    "Quittances de loyer envoyées automatiquement, suivi des paiements, relances d'impayés et révision IRL calculée pour vous. Essai gratuit 14 jours.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.quittio.fr").replace(/\/$/, ""),
  locale: "fr_FR",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "bonjour@quittio.fr",
  editor: {
    // [À COMPLÉTER] Informations légales de l'éditeur (mentions légales, CGV, factures).
    legalName: "[NOM ET PRÉNOM OU RAISON SOCIALE]",
    status: "[Entrepreneur individuel (micro-entreprise) / SASU…]",
    siret: "[SIRET : 000 000 000 00000]",
    rcs: "[RCS ou « Dispensé d'immatriculation » pour un EI non commerçant]",
    address: "[ADRESSE POSTALE COMPLÈTE]",
    phone: "[TÉLÉPHONE]",
    director: "[NOM DU DIRECTEUR DE LA PUBLICATION]",
    vat: "TVA non applicable, art. 293 B du CGI",
    mediator: "[NOM ET SITE DU MÉDIATEUR DE LA CONSOMMATION]",
  },
  host: {
    name: "Vercel Inc.",
    address: "440 N Barranca Ave #4133, Covina, CA 91723, États-Unis",
    website: "https://vercel.com",
  },
} as const;

export const absoluteUrl = (path = "/") => `${site.url}${path.startsWith("/") ? path : `/${path}`}`;
