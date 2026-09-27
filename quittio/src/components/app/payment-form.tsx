"use client";

import { useActionState } from "react";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage, SubmitButton } from "./form-status";
import type { ActionState } from "@/app/espace/actions";

export function PaymentForm({
  action,
  periods,
  defaultPeriod,
  defaultAmount,
  today,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  periods: { value: string; label: string }[];
  defaultPeriod: string;
  defaultAmount: string;
  today: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-2">
        <Label htmlFor="period">Période</Label>
        <NativeSelect id="period" name="period" defaultValue={defaultPeriod}>
          {periods.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-2">
        <Label htmlFor="amount">Montant reçu (€)</Label>
        <Input id="amount" name="amount" inputMode="decimal" required defaultValue={defaultAmount} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="paidAt">Reçu le</Label>
        <Input id="paidAt" name="paidAt" type="date" required max={today} defaultValue={today} />
      </div>
      <label className="flex items-center gap-3 text-sm sm:col-span-3">
        <input type="checkbox" name="send" defaultChecked className="size-4 accent-[var(--primary)]" />
        Envoyer la quittance au locataire par e-mail (vous êtes en copie)
      </label>
      <div className="flex flex-col gap-3 sm:col-span-3 sm:flex-row sm:items-center">
        <SubmitButton>Enregistrer le paiement</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
