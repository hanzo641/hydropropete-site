import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { POSTS } from "@/lib/blog";
import { formatDateFr } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Blog : guides pratiques du propriétaire bailleur",
  description: "Quittances, révision IRL, loyers impayés, gestion sans agence : des guides clairs et à jour pour gérer vos locations sereinement.",
  alternates: { canonical: "/blog" },
};

export default function BlogIndexPage() {
  return (
    <>
      <PageHero eyebrow="Blog" title="Les guides du propriétaire bailleur" intro="Des réponses claires, sourcées et à jour aux questions que vous vous posez chaque mois." />
      <section className="py-16">
        <div className="container-page">
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {POSTS.map((post) => (
              <li key={post.slug}>
                <article className="group relative flex h-full flex-col rounded-2xl border bg-card p-6 transition-shadow hover:shadow-lg">
                  <p className="text-xs text-muted-foreground">
                    <time dateTime={post.date}>{formatDateFr(post.date)}</time> · {post.readingMinutes} min de lecture
                  </p>
                  <h2 className="mt-3 text-lg font-semibold leading-snug">
                    <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0">
                      {post.title}
                    </Link>
                  </h2>
                  <p className="mt-2 flex-1 text-sm text-muted-foreground">{post.description}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary" aria-hidden>
                    Lire l&apos;article <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
