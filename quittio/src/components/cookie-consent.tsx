"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

/**
 * Bannière conforme aux recommandations CNIL (délibération 2020-092) :
 * refus aussi simple que l'acceptation, aucun traceur non essentiel avant
 * consentement, choix conservé 6 mois, retrait possible à tout moment.
 */
const KEY = "quittio-consent";
const MAX_AGE = 1000 * 60 * 60 * 24 * 182;
export const OPEN_CONSENT_EVENT = "quittio:open-consent";

type Consent = { analytics: boolean; at: number };

function read(): Consent | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Consent;
    return Date.now() - c.at > MAX_AGE ? null : c;
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();
let cache: Consent | null | undefined;
const store = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  get(): Consent | null {
    if (cache === undefined) cache = read();
    return cache;
  },
  set(c: Consent) {
    try {
      localStorage.setItem(KEY, JSON.stringify(c));
    } catch {}
    cache = c;
    listeners.forEach((l) => l());
  },
};

export function CookieConsent() {
  const consent = useSyncExternalStore(store.subscribe, store.get, () => undefined);
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    const reopen = () => {
      setAnalytics(store.get()?.analytics ?? false);
      setCustom(true);
      setOpen(true);
    };
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
  }, []);

  const save = (value: boolean) => {
    store.set({ analytics: value, at: Date.now() });
    setOpen(false);
    setCustom(false);
  };

  const visible = consent !== undefined && (consent === null || open);

  return (
    <>
      {consent?.analytics ? <Analytics /> : null}
      {visible ? (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="consent-title"
          className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-2xl border bg-popover p-5 text-popover-foreground shadow-2xl sm:inset-x-6 sm:bottom-6"
        >
          <p id="consent-title" className="font-semibold">
            Votre vie privée, vos choix
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Nous utilisons uniquement des cookies indispensables au fonctionnement du site (connexion, paiement). Avec votre accord, nous mesurons aussi
            l&apos;audience de façon anonyme pour améliorer Quittio. Aucune publicité, aucun traceur tiers.{" "}
            <Link href="/cookies" className="underline underline-offset-2">
              En savoir plus
            </Link>
          </p>
          {custom ? (
            <div className="mt-4 space-y-3 rounded-xl border p-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span>
                  <span className="font-medium">Indispensables</span>
                  <span className="block text-muted-foreground">Session, sécurité, paiement. Toujours actifs.</span>
                </span>
                <Switch checked disabled aria-label="Cookies indispensables (toujours actifs)" />
              </div>
              <div className="flex items-center justify-between gap-4">
                <label htmlFor="consent-analytics">
                  <span className="font-medium">Mesure d&apos;audience</span>
                  <span className="block text-muted-foreground">Statistiques anonymes (Vercel Analytics).</span>
                </label>
                <Switch id="consent-analytics" checked={analytics} onCheckedChange={setAnalytics} />
              </div>
            </div>
          ) : null}
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Button variant="outline" onClick={() => save(false)}>
              Tout refuser
            </Button>
            {custom ? (
              <Button variant="outline" onClick={() => save(analytics)}>
                Enregistrer
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setCustom(true)}>
                Personnaliser
              </Button>
            )}
            <Button variant="outline" onClick={() => save(true)}>
              Tout accepter
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function ManageCookiesButton({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}>
      Gérer les cookies
    </button>
  );
}
