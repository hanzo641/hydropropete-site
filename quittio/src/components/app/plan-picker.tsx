import { Check } from "lucide-react";
import { PLANS, TRIAL_DAYS } from "@/lib/plans";
import { formatEuros, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** Choix de formule dans l'espace client : formulaire HTML natif → Stripe Checkout (fonctionne sans JS). */
export function PlanPicker({ trial }: { trial: boolean }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {PLANS.map((plan) => (
        <div key={plan.id} className={cn("flex flex-col rounded-2xl border bg-card p-6", plan.highlighted && "border-primary/60 ring-1 ring-primary/40")}>
          <h3 className="font-semibold">{plan.name}</h3>
          <p className="text-sm text-muted-foreground">{plan.tagline}</p>
          <p className="mt-4 text-3xl font-semibold tracking-tight">
            {formatEuros(plan.price.month)}
            <span className="text-sm font-normal text-muted-foreground">/mois</span>
          </p>
          <ul className="mt-4 flex-1 space-y-2 text-sm">
            {plan.features.map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-6 grid gap-2">
            <form action="/api/stripe/checkout" method="post">
              <input type="hidden" name="plan" value={plan.id} />
              <input type="hidden" name="interval" value="month" />
              <Button type="submit" className="w-full" variant={plan.highlighted ? "default" : "outline"}>
                {trial ? `Essayer ${TRIAL_DAYS} jours gratuits` : "Choisir"} · mensuel
              </Button>
            </form>
            <form action="/api/stripe/checkout" method="post">
              <input type="hidden" name="plan" value={plan.id} />
              <input type="hidden" name="interval" value="year" />
              <Button type="submit" className="w-full" variant="ghost">
                Annuel : {formatEuros(plan.price.year)}/an (2 mois offerts)
              </Button>
            </form>
          </div>
        </div>
      ))}
    </div>
  );
}
