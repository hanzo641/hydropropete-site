"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ContactForm({ defaultSubject = "question", lockSubject = false }: { defaultSubject?: string; lockSubject?: boolean }) {
  const [state, setState] = useState<{ status: "idle" | "sending" | "ok" | "error"; error?: string }>({ status: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ status: "sending" });
    const body = Object.fromEntries(new FormData(e.currentTarget).entries());
    const res = await fetch("/api/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setState(res.ok ? { status: "ok" } : { status: "error", error: data.error });
  }

  if (state.status === "ok") {
    return (
      <p role="status" className="rounded-xl border border-success/30 bg-success/10 p-6">
        Merci ! Votre message est bien parti. Nous répondons en général sous 24 h ouvrées.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="c-name">Nom</Label>
        <Input id="c-name" name="name" required autoComplete="name" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="c-email">E-mail</Label>
        <Input id="c-email" name="email" type="email" required autoComplete="email" />
      </div>
      {lockSubject ? (
        <input type="hidden" name="subject" value={defaultSubject} />
      ) : (
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="c-subject">Sujet</Label>
          <NativeSelect id="c-subject" name="subject" defaultValue={defaultSubject}>
            <option value="question">Question avant abonnement</option>
            <option value="support">Support (je suis abonné)</option>
            <option value="partenariat">Partenariat</option>
            <option value="resiliation">Résiliation</option>
            <option value="autre">Autre</option>
          </NativeSelect>
        </div>
      )}
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="c-message">Message</Label>
        <Textarea id="c-message" name="message" required minLength={10} className="min-h-36" />
      </div>
      <div aria-hidden className="hidden">
        <label htmlFor="c-website">Ne pas remplir</label>
        <input id="c-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center">
        <Button type="submit" size="lg" disabled={state.status === "sending"}>
          {state.status === "sending" ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Envoyer
        </Button>
        <p aria-live="polite" className="text-sm text-destructive">
          {state.status === "error" ? state.error : null}
        </p>
      </div>
      <p className="text-xs text-muted-foreground sm:col-span-2">
        Vos informations servent uniquement à vous répondre. Voir notre politique de confidentialité.
      </p>
    </form>
  );
}
