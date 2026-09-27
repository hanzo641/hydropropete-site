import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "./auth-form";
import { getSessionUser } from "@/lib/session";
import { getPlan, isInterval, isPlanId } from "@/lib/plans";
import { formatEuros } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Params = { next?: string; plan?: string; interval?: string };

export async function AuthCard({ mode, searchParams }: { mode: "login" | "signup"; searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const plan = isPlanId(sp.plan) ? sp.plan : undefined;
  const interval = isInterval(sp.interval) ? sp.interval : plan ? "month" : undefined;
  const session = await getSessionUser();

  if (session && !plan) redirect(sp.next?.startsWith("/") ? sp.next : "/espace");

  const selected = plan ? getPlan(plan) : undefined;
  const qs = new URLSearchParams(Object.entries({ plan, interval, next: sp.next }).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">{mode === "signup" ? "Démarrez votre essai gratuit" : "Bon retour parmi nous"}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {mode === "signup" ? "14 jours offerts, sans engagement. Configuration en 3 minutes." : "Connectez-vous à votre espace propriétaire."}
      </p>
      {selected && interval ? (
        <p className="mt-4 rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
          Formule <strong>{selected.name}</strong> · {formatEuros(selected.price[interval])}/{interval === "year" ? "an" : "mois"} après l&apos;essai.{" "}
          <Link href="/tarifs" className="underline underline-offset-2">
            Changer
          </Link>
        </p>
      ) : null}
      <div className="mt-6">
        {session && plan ? (
          <form action="/api/stripe/checkout" method="post">
            <input type="hidden" name="plan" value={plan} />
            <input type="hidden" name="interval" value={interval} />
            <Button type="submit" size="lg" className="w-full">
              Continuer vers le paiement sécurisé
            </Button>
          </form>
        ) : (
          <AuthForm mode={mode} next={sp.next} plan={plan} interval={interval} />
        )}
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "signup" ? (
          <>
            Déjà un compte ?{" "}
            <Link href={`/connexion${qs ? `?${qs}` : ""}`} className="font-medium text-primary underline-offset-2 hover:underline">
              Se connecter
            </Link>
          </>
        ) : (
          <>
            Pas encore de compte ?{" "}
            <Link href={`/inscription${qs ? `?${qs}` : ""}`} className="font-medium text-primary underline-offset-2 hover:underline">
              Essai gratuit
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
