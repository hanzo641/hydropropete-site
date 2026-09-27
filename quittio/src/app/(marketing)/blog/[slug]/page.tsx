import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { FinalCta } from "@/components/marketing/cta";
import { POSTS, getPost } from "@/lib/blog";
import { absoluteUrl, site } from "@/lib/site";
import { formatDateFr } from "@/lib/utils";

export const dynamicParams = false;

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const post = getPost((await params).slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    keywords: [post.keyword],
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { type: "article", title: post.title, description: post.description, publishedTime: post.date, modifiedTime: post.updated ?? post.date, url: absoluteUrl(`/blog/${post.slug}`) },
  };
}

export default async function PostPage({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();
  const { default: Content } = await import(`@/content/blog/${slug}.mdx`);
  const related = POSTS.filter((p) => p.slug !== slug).slice(0, 2);
  const url = absoluteUrl(`/blog/${slug}`);

  return (
    <>
      <article className="container-page max-w-3xl py-12 sm:py-16">
        <nav aria-label="Fil d'Ariane" className="text-sm text-muted-foreground">
          <ol className="flex flex-wrap gap-1">
            <li>
              <Link href="/" className="hover:text-foreground">Accueil</Link> /
            </li>
            <li>
              <Link href="/blog" className="hover:text-foreground">Blog</Link> /
            </li>
            <li aria-current="page" className="truncate text-foreground">{post.title}</li>
          </ol>
        </nav>
        <header className="mt-8">
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{post.title}</h1>
          <p className="mt-4 text-lg text-muted-foreground">{post.description}</p>
          <p className="mt-4 text-sm text-muted-foreground">
            Par l&apos;équipe {site.name} · <time dateTime={post.updated ?? post.date}>Mis à jour le {formatDateFr(post.updated ?? post.date)}</time> · {post.readingMinutes} min de lecture
          </p>
        </header>
        <div className="prose prose-neutral mt-10 max-w-none dark:prose-invert prose-headings:scroll-mt-24 prose-headings:tracking-tight prose-a:text-primary prose-blockquote:font-normal prose-blockquote:not-italic prose-table:text-sm">
          <Content />
        </div>
        <aside aria-labelledby="a-lire" className="mt-16 border-t pt-10">
          <h2 id="a-lire" className="text-lg font-semibold">
            À lire aussi
          </h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {related.map((r) => (
              <li key={r.slug}>
                <Link href={`/blog/${r.slug}`} className="block h-full rounded-xl border p-4 transition-colors hover:bg-muted">
                  <span className="font-medium">{r.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </article>
      <FinalCta />
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: post.title,
            description: post.description,
            datePublished: post.date,
            dateModified: post.updated ?? post.date,
            inLanguage: "fr-FR",
            mainEntityOfPage: url,
            url,
            image: absoluteUrl("/opengraph-image"),
            author: { "@type": "Organization", name: site.name, url: site.url },
            publisher: { "@id": absoluteUrl("/#organization") },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Accueil", item: site.url },
              { "@type": "ListItem", position: 2, name: "Blog", item: absoluteUrl("/blog") },
              { "@type": "ListItem", position: 3, name: post.title, item: url },
            ],
          },
        ]}
      />
    </>
  );
}
