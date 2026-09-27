"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { User } from "firebase/auth";
import { firebaseConfigured } from "@/lib/firebase/config";

/** Le SDK Firebase (~100 Ko) n'est chargé qu'au moment où l'utilisateur agit, pour garder la page légère. */
let sdkPromise: Promise<typeof import("firebase/auth") & { auth: import("firebase/auth").Auth }> | undefined;
function sdk() {
  sdkPromise ??= Promise.all([import("firebase/auth"), import("@/lib/firebase/client")]).then(([mod, client]) => ({ ...mod, auth: client.clientAuth() }));
  return sdkPromise;
}
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ERRORS: Record<string, string> = {
  "auth/invalid-credential": "E-mail ou mot de passe incorrect.",
  "auth/wrong-password": "E-mail ou mot de passe incorrect.",
  "auth/user-not-found": "Aucun compte avec cet e-mail.",
  "auth/email-already-in-use": "Un compte existe déjà avec cet e-mail. Connectez-vous.",
  "auth/weak-password": "Le mot de passe doit contenir au moins 8 caractères.",
  "auth/too-many-requests": "Trop de tentatives. Réessayez dans quelques minutes.",
  "auth/popup-closed-by-user": "Fenêtre de connexion fermée.",
  "auth/invalid-email": "Adresse e-mail invalide.",
};

function message(e: unknown): string {
  const code = (e as { code?: string })?.code;
  return (code && ERRORS[code]) || (e instanceof Error && !code ? e.message : "Une erreur est survenue. Réessayez.");
}

export function AuthForm({ mode, next, plan, interval }: { mode: "login" | "signup"; next?: string; plan?: string; interval?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Préchargement du SDK une fois la page affichée : la fenêtre Google s'ouvre ensuite sans délai (bloqueurs de pop-up).
  useEffect(() => {
    if (!firebaseConfigured) return;
    const t = setTimeout(() => void sdk().catch(() => {}), 1200);
    return () => clearTimeout(t);
  }, []);

  async function finish(user: User) {
    const idToken = await user.getIdToken(true);
    const res = await fetch("/api/auth/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken }) });
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Connexion impossible");
    await (await sdk()).auth.signOut(); // la session serveur (cookie httpOnly) prend le relais
    if (plan && interval) {
      const checkout = await fetch("/api/stripe/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan, interval }) });
      const data = await checkout.json().catch(() => ({}));
      if (checkout.ok && data.url) {
        window.location.assign(data.url);
        return;
      }
      throw new Error(data.error ?? "Paiement indisponible");
    }
    router.replace(next && /^\/(?![/\\])/.test(next) ? next : "/espace");
    router.refresh();
  }

  async function google() {
    setError(null);
    setLoading("google");
    try {
      const { auth, signInWithPopup, GoogleAuthProvider } = await sdk();
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      await finish(cred.user);
    } catch (e) {
      setError(message(e));
      setLoading(null);
    }
  }

  async function submit(form: FormData) {
    setError(null);
    setLoading("email");
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    try {
      const { auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } = await sdk();
      if (mode === "signup") {
        if (password.length < 8) throw Object.assign(new Error(), { code: "auth/weak-password" });
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const name = String(form.get("name") ?? "").trim();
        if (name) await updateProfile(cred.user, { displayName: name });
        await finish(cred.user);
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        await finish(cred.user);
      }
    } catch (e) {
      setError(message(e));
      setLoading(null);
    }
  }

  async function reset(emailInput: HTMLInputElement | null) {
    setError(null);
    const email = emailInput?.value.trim();
    if (!email) {
      setError("Saisissez votre e-mail, puis cliquez sur « Mot de passe oublié ».");
      emailInput?.focus();
      return;
    }
    try {
      const { auth, sendPasswordResetEmail } = await sdk();
      await sendPasswordResetEmail(auth, email);
      setInfo("Si un compte existe, un e-mail de réinitialisation vient d'être envoyé.");
    } catch (e) {
      setError(message(e));
    }
  }

  if (!firebaseConfigured) {
    return (
      <p role="alert" className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
        L&apos;authentification n&apos;est pas encore configurée. Renseignez les variables <code>NEXT_PUBLIC_FIREBASE_*</code> (voir README).
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <Button type="button" variant="outline" size="lg" className="w-full" onClick={google} disabled={loading !== null}>
        {loading === "google" ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden className="size-5">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
          </svg>
        )}
        Continuer avec Google
      </Button>

      <div className="flex items-center gap-3 text-xs uppercase text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> ou par e-mail <span className="h-px flex-1 bg-border" />
      </div>

      <form action={submit} className="space-y-4" noValidate={false}>
        {mode === "signup" ? (
          <div className="space-y-2">
            <Label htmlFor="name">Prénom et nom</Label>
            <Input id="name" name="name" autoComplete="name" required />
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Mot de passe</Label>
            {mode === "login" ? (
              <button
                type="button"
                className="text-sm text-primary underline-offset-2 hover:underline"
                onClick={(e) => reset(e.currentTarget.form?.elements.namedItem("email") as HTMLInputElement | null)}
              >
                Mot de passe oublié ?
              </button>
            ) : null}
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            minLength={mode === "signup" ? 8 : undefined}
            aria-describedby={mode === "signup" ? "password-hint" : undefined}
            required
          />
          {mode === "signup" ? (
            <p id="password-hint" className="text-xs text-muted-foreground">
              8 caractères minimum.
            </p>
          ) : null}
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={loading !== null}>
          {loading === "email" ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {mode === "signup" ? (plan ? "Créer mon compte et continuer" : "Créer mon compte") : "Se connecter"}
        </Button>
      </form>

      <div aria-live="polite" className="min-h-5 text-sm">
        {error ? <p className="text-destructive">{error}</p> : null}
        {info ? <p className="text-success">{info}</p> : null}
      </div>

      {mode === "signup" ? (
        <p className="text-xs text-muted-foreground">
          En créant un compte, vous acceptez nos{" "}
          <Link href="/cgv" className="underline underline-offset-2">
            CGV
          </Link>{" "}
          et notre{" "}
          <Link href="/confidentialite" className="underline underline-offset-2">
            politique de confidentialité
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
