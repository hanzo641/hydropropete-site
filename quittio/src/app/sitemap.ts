import type { MetadataRoute } from "next";
import { POSTS } from "@/lib/blog";
import { LATEST_IRL } from "@/lib/irl";
import { absoluteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPages: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; lastModified?: Date }[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/tarifs", priority: 0.9, changeFrequency: "monthly" },
    { path: "/outils/calcul-revision-loyer-irl", priority: 0.9, changeFrequency: "monthly", lastModified: new Date(LATEST_IRL.published) },
    { path: "/outils/quittance-de-loyer-gratuite", priority: 0.9, changeFrequency: "monthly" },
    { path: "/blog", priority: 0.7, changeFrequency: "weekly" },
    { path: "/inscription", priority: 0.6, changeFrequency: "yearly" },
    { path: "/contact", priority: 0.4, changeFrequency: "yearly" },
    { path: "/resiliation", priority: 0.2, changeFrequency: "yearly" },
    { path: "/cgv", priority: 0.2, changeFrequency: "yearly" },
    { path: "/mentions-legales", priority: 0.1, changeFrequency: "yearly" },
    { path: "/confidentialite", priority: 0.1, changeFrequency: "yearly" },
    { path: "/cookies", priority: 0.1, changeFrequency: "yearly" },
  ];
  return [
    ...staticPages.map((p) => ({ url: absoluteUrl(p.path), lastModified: p.lastModified ?? now, changeFrequency: p.changeFrequency, priority: p.priority })),
    ...POSTS.map((p) => ({ url: absoluteUrl(`/blog/${p.slug}`), lastModified: new Date(p.updated ?? p.date), changeFrequency: "monthly" as const, priority: 0.8 })),
  ];
}
