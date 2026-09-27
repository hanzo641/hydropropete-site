import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import { BlogCta } from "@/components/marketing/blog-cta";

const components: MDXComponents = {
  Cta: BlogCta,
  a: ({ href = "", children, ...props }) =>
    href.startsWith("/") ? (
      <Link href={href} {...props}>
        {children}
      </Link>
    ) : (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    ),
};

export function useMDXComponents(): MDXComponents {
  return components;
}
