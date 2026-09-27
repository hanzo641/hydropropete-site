import { CreditCard, FileText, Repeat } from "lucide-react";
import { requireAccount } from "@/lib/session";
import { getPlan } from "@/lib/plans";
import { formatDateFr, formatEuros } from "@/lib/utils";
import { PlanPicker } from "@/components/app/plan-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const date = (unix: number | null | undefined) => (unix ? formatDateFr(new Date(unix * 1000)) : "—");

function PortalButton({ flow, children, variant = "outline" }: { flow?: string; children: React.ReactNode; variant?: "outline" | "destructive" | "default" }) {
  return (
    <form action="/api/stripe/portal" method="post">
      {flow ? <input type="hidden" name="flow" value={flow} /> : null}
      <Button type="submit" variant={variant} className="w-full sm:w-auto">
        {children}
      </Button>
    </form>
  );
}

export default async function SubscriptionPage({ searchParams }: PageProps<"/espace/abonnement">) {
  const sp = await searchParams;
  const account = await requireAccount("/espace/abonnement");
  const sub = account.user.subscription;
  const plan = getPlan(sub?.plan);

  if (!account.active || !sub || !plan) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Abonnement</h1>
        {sp.inactive ? (
          <p role="alert" className="mt-4 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
            Cette fonctionnalité nécessite un abonnement actif. Vos données sont conservées : réactivez votre abonnement pour y accéder.
          </p>
        ) : null}
        <p className="mt-2 text-muted-foreground">Aucun abonnement actif. Choisissez une formule :</p>
        <div className="mt-8">
          <PlanPicker trial={!account.user.hadTrial} />
        </div>
      </div>
    );
  }

  const statusLabel =
    sub.status === "trialing"
      ? { text: `Essai gratuit jusqu'au ${date(sub.trialEnd)}`, variant: "secondary" as const }
      : sub.status === "past_due"
        ? { text: "Paiement en échec", variant: "destructive" as const }
        : { text: "Actif", variant: "success" as const };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Abonnement</h1>

      {sp.resiliation === "ok" || sub.cancelAtPeriodEnd ? (
        <p role="status" className="rounded-xl border border-success/30 bg-success/10 p-4 text-sm">
          Votre résiliation est enregistrée. Vous gardez l&apos;accès jusqu&apos;au <strong>{date(sub.currentPeriodEnd)}</strong>, sans aucun autre prélèvement. Un e-mail de
          confirmation vous a été envoyé. Vous avez changé d&apos;avis ? Réactivez l&apos;abonnement depuis « Gérer mon abonnement ».
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="text-xl">Formule {plan.name}</CardTitle>
            <Badge variant={statusLabel.variant}>{statusLabel.text}</Badge>
          </div>
          <CardDescription>
            {formatEuros(plan.price[sub.interval])} / {sub.interval === "year" ? "an" : "mois"} TTC · jusqu&apos;à {plan.maxLeases} logement(s)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm">
            {sub.cancelAtPeriodEnd ? "Fin de l'abonnement le " : sub.status === "trialing" ? "Premier prélèvement le " : "Prochain renouvellement le "}
            <strong>{date(sub.status === "trialing" ? sub.trialEnd : sub.currentPeriodEnd)}</strong>.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <PortalButton>
              <Repeat aria-hidden /> Gérer / changer de formule
            </PortalButton>
            <PortalButton flow="payment">
              <CreditCard aria-hidden /> Mettre à jour ma carte
            </PortalButton>
            <PortalButton>
              <FileText aria-hidden /> Mes factures
            </PortalButton>
          </div>
        </CardContent>
      </Card>

      {!sub.cancelAtPeriodEnd ? (
        <section id="resilier" aria-labelledby="resilier-titre" className="scroll-mt-24 rounded-2xl border border-destructive/30 p-6">
          <h2 id="resilier-titre" className="text-lg font-semibold">
            Résilier mon abonnement
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            La résiliation prend effet à la fin de la période en cours{sub.status === "trialing" ? " (fin de l'essai : vous ne serez pas débité)" : ""}. Vous conservez l&apos;accès
            jusque-là et pouvez exporter vos données. Aucun frais, aucune justification demandée. Vous recevrez une confirmation par e-mail.
          </p>
          <div className="mt-4">
            <PortalButton flow="cancel" variant="destructive">
              Résilier mon abonnement
            </PortalButton>
          </div>
        </section>
      ) : null}
    </div>
  );
}
