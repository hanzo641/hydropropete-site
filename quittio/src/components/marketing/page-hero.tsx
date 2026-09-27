export function PageHero({ eyebrow, title, intro, children }: { eyebrow?: string; title: string; intro?: string; children?: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden border-b">
      <div aria-hidden className="bg-grid absolute inset-0 -z-10 opacity-50" />
      <div className="container-page py-16 text-center sm:py-20">
        {eyebrow ? <p className="text-sm font-semibold text-primary">{eyebrow}</p> : null}
        <h1 className="mx-auto mt-2 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{title}</h1>
        {intro ? <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground text-balance">{intro}</p> : null}
        {children}
      </div>
    </section>
  );
}
