"use client";

import { useActionState } from "react";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage, SubmitButton } from "./form-status";
import { saveProfile, deleteAccount } from "@/app/espace/actions";

export function ProfileForm({ ownerName, ownerAddress }: { ownerName?: string; ownerAddress?: string }) {
  const [state, action] = useActionState(saveProfile, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="ownerName">Nom du bailleur (tel qu&apos;il figure au bail)</Label>
        <Input id="ownerName" name="ownerName" required defaultValue={ownerName} autoComplete="name" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ownerAddress">Adresse du bailleur</Label>
        <Textarea id="ownerAddress" name="ownerAddress" required defaultValue={ownerAddress} autoComplete="street-address" className="min-h-20" />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SubmitButton>Enregistrer</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action] = useActionState(deleteAccount, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="confirm">Tapez SUPPRIMER pour confirmer</Label>
        <Input id="confirm" name="confirm" autoComplete="off" className="max-w-xs" />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SubmitButton variant="destructive">Supprimer définitivement mon compte</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
