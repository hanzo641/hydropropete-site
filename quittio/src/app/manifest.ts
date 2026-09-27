import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Quittio — gestion locative",
    short_name: "Quittio",
    description: "Quittances de loyer automatiques, suivi des loyers, relances et révision IRL.",
    start_url: "/espace",
    display: "standalone",
    background_color: "#fcfcfd",
    theme_color: "#4338ca",
    lang: "fr",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
