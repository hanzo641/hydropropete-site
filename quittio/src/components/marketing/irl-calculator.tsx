"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { IRL_VALUES, computeRevision, formatQuarter } from "@/lib/irl";
import { formatEuros } from "@/lib/utils";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function IrlCalculator() {
  const [rent, setRent] = useState("750");
  const [quarter, setQuarter] = useState(IRL_VALUES[4].quarter);
  const [frozen, setFrozen] = useState(false);

  const result = useMemo(() => {
    const cents = Math.round(Number(rent.replace(/\s/g, "").replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents <= 0) return null;
    return computeRevision({ rentCents: cents, referenceQuarter: quarter, dpeClass: frozen ? "G" : null });
  }, [rent, quarter, frozen]);

  return (
    <div className="grid gap-6 rounded-2xl border bg-card p-6 text-left shadow-xl sm:p-8 lg:grid-cols-2">
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="irl-rent">Loyer actuel hors charges (€)</Label>
          <Input id="irl-rent" inputMode="decimal" value={rent} onChange={(e) => setRent(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="irl-quarter">IRL de référence du bail</Label>
          <NativeSelect id="irl-quarter" value={quarter} onChange={(e) => setQuarter(e.target.value)} aria-describedby="irl-quarter-hint">
            {IRL_VALUES.map((e) => (
              <option key={e.quarter} value={e.quarter}>
                {formatQuarter(e.quarter)} — {e.value.toFixed(2).replace(".", ",")}
              </option>
            ))}
          </NativeSelect>
          <p id="irl-quarter-hint" className="text-xs text-muted-foreground">
            Indiqué dans la clause de révision de votre bail, ou celui utilisé lors de la dernière révision.
          </p>
        </div>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={frozen} onChange={(e) => setFrozen(e.target.checked)} className="size-4 accent-[var(--primary)]" />
          Le logement est classé F ou G au DPE
        </label>
      </div>

      <div className="flex flex-col justify-between rounded-xl bg-muted/50 p-6" aria-live="polite">
        {!result ? (
          <p className="text-muted-foreground">Saisissez un loyer valide.</p>
        ) : result.ok ? (
          <div>
            <p className="text-sm text-muted-foreground">Nouveau loyer maximum hors charges</p>
            <p className="mt-1 text-4xl font-semibold tracking-tight">{formatEuros(result.newRentCents)}</p>
            <p className="mt-2 text-sm">
              soit <strong>+{formatEuros(result.increaseCents)}</strong> par mois (+{String(result.percent).replace(".", ",")} %)
            </p>
            <p className="mt-4 text-xs text-muted-foreground">
              Calcul : loyer × {result.newIndex.value.toFixed(2).replace(".", ",")} ({formatQuarter(result.newIndex.quarter)}) ÷ {result.oldIndex.value.toFixed(2).replace(".", ",")} (
              {formatQuarter(result.oldIndex.quarter)})
            </p>
          </div>
        ) : result.reason === "dpe_frozen" ? (
          <p>Les logements classés F ou G ne peuvent plus voir leur loyer augmenter (loi Climat et résilience, depuis le 24 août 2022 en métropole).</p>
        ) : (
          <p>L&apos;indice du même trimestre de l&apos;année suivante n&apos;est pas encore publié : la révision n&apos;est pas encore possible avec cette référence.</p>
        )}
        <Button asChild className="mt-6">
          <Link href="/inscription">
            Automatiser mes révisions <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
    </div>
  );
}
