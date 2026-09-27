import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** Encadré d'appel à l'action inséré dans les articles MDX (<Cta />). */
export function BlogCta({ title = "Automatisez vos quittances et vos relances", text = "Quittio envoie vos quittances, suit vos loyers et calcule vos révisions IRL. 14 jours gratuits, sans engagement." }: { title?: string; text?: string }) {
  return (
    <aside className="not-prose my-10 rounded-2xl border bg-accent/60 p-6">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
      <Link href="/tarifs" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        Voir les formules <ArrowRight className="size-4" aria-hidden />
      </Link>
    </aside>
  );
}
