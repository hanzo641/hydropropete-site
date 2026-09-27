"use client";

import { useActionState } from "react";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage, SubmitButton } from "./form-status";
import type { ActionState } from "@/app/espace/actions";
import type { LeaseDoc } from "@/lib/db";

type Quarter = { quarter: string; label: string };

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const euros = (cents?: number) => (cents === undefined ? "" : (cents / 100).toFixed(2).replace(".", ","));

export function LeaseForm({
  action,
  lease,
  quarters,
  automation,
  submitLabel,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  lease?: Partial<LeaseDoc>;
  quarters: Quarter[];
  automation: boolean;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-10">
      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 text-lg font-semibold">Le logement</legend>
        <Field id="propertyLabel" label="Nom court" hint="Pour vous repérer, ex. « Studio Clemenceau ».">
          <Input id="propertyLabel" name="propertyLabel" required defaultValue={lease?.propertyLabel} aria-describedby="propertyLabel-hint" />
        </Field>
        <Field id="propertyAddress" label="Adresse complète du logement">
          <Input id="propertyAddress" name="propertyAddress" required autoComplete="street-address" defaultValue={lease?.propertyAddress} />
        </Field>
        <Field id="dpeClass" label="Classe énergie (DPE)" hint="F et G : loyer gelé, pas de révision possible.">
          <NativeSelect id="dpeClass" name="dpeClass" defaultValue={lease?.dpeClass ?? ""} aria-describedby="dpeClass-hint">
            <option value="">Je ne sais pas</option>
            {["A", "B", "C", "D", "E", "F", "G"].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="flex items-center gap-3 self-end pb-2">
          <input id="furnished" name="furnished" type="checkbox" defaultChecked={lease?.furnished} className="size-4 accent-[var(--primary)]" />
          <Label htmlFor="furnished">Location meublée</Label>
        </div>
      </fieldset>

      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 text-lg font-semibold">Le locataire</legend>
        <Field id="tenantName" label="Nom du ou des locataires">
          <Input id="tenantName" name="tenantName" required defaultValue={lease?.tenantName} />
        </Field>
        <Field id="tenantEmail" label="E-mail du locataire" hint="Les quittances et avis d'échéance y seront envoyés.">
          <Input id="tenantEmail" name="tenantEmail" type="email" required defaultValue={lease?.tenantEmail} aria-describedby="tenantEmail-hint" />
        </Field>
      </fieldset>

      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 text-lg font-semibold">Le bail</legend>
        <Field id="rent" label="Loyer hors charges (€)">
          <Input id="rent" name="rent" inputMode="decimal" required placeholder="650,00" defaultValue={euros(lease?.rentCents)} />
        </Field>
        <Field id="charges" label="Provision pour charges (€)">
          <Input id="charges" name="charges" inputMode="decimal" required placeholder="50,00" defaultValue={euros(lease?.chargesCents ?? 0)} />
        </Field>
        <Field id="dueDay" label="Jour de paiement" hint="Jour du mois où le loyer est exigible (souvent le 1er ou le 5).">
          <Input id="dueDay" name="dueDay" type="number" min={1} max={31} required defaultValue={lease?.dueDay ?? 5} aria-describedby="dueDay-hint" />
        </Field>
        <Field id="startDate" label="Date de début du bail">
          <Input id="startDate" name="startDate" type="date" required defaultValue={lease?.startDate} />
        </Field>
        <Field id="irlReferenceQuarter" label="Trimestre IRL de référence" hint="Indiqué dans la clause de révision du bail (ou utilisé lors de la dernière révision).">
          <NativeSelect id="irlReferenceQuarter" name="irlReferenceQuarter" required defaultValue={lease?.irlReferenceQuarter ?? quarters[0]?.quarter} aria-describedby="irlReferenceQuarter-hint">
            {quarters.map((q) => (
              <option key={q.quarter} value={q.quarter}>
                {q.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-lg font-semibold">Automatisations</legend>
        {!automation ? (
          <p className="rounded-lg bg-accent p-3 text-sm text-accent-foreground">
            Les avis d&apos;échéance, quittances automatiques et relances sont inclus dans les formules Sérénité et Patrimoine.
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex gap-3 rounded-xl border p-4">
            <input name="remindersEnabled" type="checkbox" disabled={!automation} defaultChecked={automation && (lease?.remindersEnabled ?? true)} className="mt-1 size-4 accent-[var(--primary)]" />
            <span>
              <span className="font-medium">Avis d&apos;échéance et relances</span>
              <span className="block text-sm text-muted-foreground">Avis envoyé avant l&apos;échéance, relances à J+5 et J+15 si le loyer n&apos;est pas marqué payé.</span>
            </span>
          </label>
          <label className="flex gap-3 rounded-xl border p-4">
            <input name="autoQuittance" type="checkbox" disabled={!automation} defaultChecked={automation && lease?.autoQuittance} className="mt-1 size-4 accent-[var(--primary)]" />
            <span>
              <span className="font-medium">Quittance automatique à l&apos;échéance</span>
              <span className="block text-sm text-muted-foreground">Pour les virements permanents fiables : la quittance part le jour de l&apos;échéance, sans action de votre part.</span>
            </span>
          </label>
        </div>
        <Field id="noticeDaysBefore" label="Envoyer l'avis d'échéance (jours avant)">
          <Input id="noticeDaysBefore" name="noticeDaysBefore" type="number" min={1} max={15} className="max-w-32" defaultValue={lease?.noticeDaysBefore ?? 5} />
        </Field>
      </fieldset>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SubmitButton>{submitLabel}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
