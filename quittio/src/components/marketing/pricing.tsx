"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PLANS, TRIAL_DAYS, type BillingInterval } from "@/lib/plans";
import { cn, formatEuros } from "@/lib/utils";

export function Pricing({ headingLevel = "h3" }: { headingLevel?: "h2" | "h3" }) {
  const [interval, setInterval] = useState<BillingInterval>("year");
  const Heading = headingLevel;
  return (
    <div>
      <div className="flex justify-center">
        <div role="radiogroup" aria-label="Période de facturation" className="inline-flex rounded-full border bg-muted/50 p-1 text-sm">
          {(["month", "year"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={interval === v}
              onClick={() => setInterval(v)}
              className={cn(
                "rounded-full px-4 py-2 font-medium transition-colors",
                interval === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v === "month" ? "Mensuel" : "Annuel · 2 mois offerts"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const price = plan.price[interval];
          const perMonth = interval === "year" ? Math.round(price / 12) : price;
          return (
            <div
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-card p-6 shadow-sm sm:p-8",
                plan.highlighted && "border-primary/60 shadow-xl shadow-primary/10 ring-1 ring-primary/40",
              )}
            >
              {plan.highlighted ? <Badge className="absolute -top-3 left-6">Le plus choisi</Badge> : null}
              <Heading className="text-lg font-semibold">{plan.name}</Heading>
              <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
              <p className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight">{formatEuros(perMonth)}</span>
                <span className="text-sm text-muted-foreground">/mois</span>
              </p>
              <p className="mt-1 h-5 text-sm text-muted-foreground">
                {interval === "year" ? `soit ${formatEuros(price)} facturés par an` : "sans engagement"}
              </p>
              <Button asChild className="mt-6 w-full" variant={plan.highlighted ? "default" : "outline"} size="lg">
                <Link href={`/inscription?plan=${plan.id}&interval=${interval}`}>
                  Essayer {TRIAL_DAYS} jours gratuits<span className="sr-only"> avec la formule {plan.name}</span>
                </Link>
              </Button>
              <ul className="mt-8 space-y-3 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-3">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <span className={f.endsWith(":") ? "font-medium" : undefined}>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Prix TTC. Aucun débit pendant {TRIAL_DAYS} jours · Sans engagement · Résiliable en 1 clic.
      </p>
    </div>
  );
}
