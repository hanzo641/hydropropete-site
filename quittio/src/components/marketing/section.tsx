import { cn } from "@/lib/utils";

export function Section({ id, eyebrow, title, intro, children, className }: { id?: string; eyebrow?: string; title: string; intro?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={cn("scroll-mt-20 py-20 sm:py-28", className)}>
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          {eyebrow ? <p className="text-sm font-semibold text-primary">{eyebrow}</p> : null}
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
          {intro ? <p className="mt-4 text-lg text-muted-foreground text-balance">{intro}</p> : null}
        </div>
        <div className="mt-14">{children}</div>
      </div>
    </section>
  );
}
