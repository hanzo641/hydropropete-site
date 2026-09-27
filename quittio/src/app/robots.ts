import type { MetadataRoute } from "next";
import { absoluteUrl, site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const production = process.env.VERCEL_ENV ? process.env.VERCEL_ENV === "production" : true;
  return {
    // Les déploiements de prévisualisation Vercel ne doivent pas être indexés.
    rules: production ? { userAgent: "*", allow: "/", disallow: ["/espace/", "/api/", "/r/"] } : { userAgent: "*", disallow: "/" },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: site.url,
  };
}
