import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, ArrowRight, CalendarClock, Download, Plus } from "lucide-react";
import { requireAccount } from "@/lib/session";
import { getPayment, listLeases, listPayments } from "@/lib/leases";
import { addMonths, diffDays, formatPeriod, nextAnniversary, periodOf, todayParis } from "@/lib/rent";
import { computeRevision } from "@/lib/irl";
import { formatDateFr, formatEuros } from "@/lib/utils";
import { syncLatestSubscription } from "@/lib/sync-checkout";
import { markPaidAndSend } from "./actions";
import { ActionButton } from "@/components/app/action-button";
import { PlanPicker } from "@/components/app/plan-picker";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage({ searchParams }: PageProps<"/espace">) {
  const sp = await searchParams;
  const account = await requireAccount();

  if (!account.active || !account.plan) {
    if (sp.checkout === "success" && account.user.stripeCustomerId && (await syncLatestSubscription(account.user.stripeCustomerId))) {
      redirect("/espace?bienvenue=1");
    }
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Activez Quittio</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {account.user.hadTrial
            ? "Votre abonnement n'est plus actif. Choisissez une formule pour retrouver vos logements, quittances et automatisations — vos données sont intactes."
            : "Choisissez votre formule pour démarrer. Aucun débit pendant 14 jours, résiliable en 1 clic."}
        </p>
        <div className="mt-8">
          <PlanPicker trial={!account.user.hadTrial} />
        </div>
      </div>
    );
  }

  const plan = account.plan;
  const today = todayParis();
  const period = periodOf(today);
  const leases = await listLeases(account.uid);
  const current = await Promise.all(leases.map(async (l) => ({ lease: l, payment: await getPayment(account.uid, l, period) })));
  const previous = (
    await Promise.all(
      leases.map(async (l) => {
        const periods = [1, 2, 3].map((n) => addMonths(period, -n)).filter((p) => p >= periodOf(l.startDate));
        return (await listPayments(account.uid, l, periods)).filter((p) => p.status === "late" || p.status === "partial").map((p) => ({ lease: l, payment: p }));
      }),
    )
  ).flat();
  const revisions = leases
    .map((l) => ({ lease: l, date: nextAnniversary(l.startDate, today), r: computeRevision({ rentCents: l.rentCents, referenceQuarter: l.irlReferenceQuarter, dpeClass: l.dpeClass }) }))
    .filter((x) => x.r.ok && diffDays(x.date, today) <= 60);

  const expected = current.reduce((s, c) => s + c.payment.amountDue, 0);
  const received = current.reduce((s, c) => s + c.payment.amountPaid, 0);
  const firstName = (account.user.ownerName || account.user.displayName || "").split(" ")[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Bonjour{firstName ? ` ${firstName}` : ""} 👋</h1>
          <p className="mt-1 text-muted-foreground">Loyers de {formatPeriod(period)}</p>
        </div>
        {leases.length < plan.maxLeases ? (
          <Button asChild>
            <Link href="/espace/logements/nouveau">
              <Plus aria-hidden /> Ajouter un logement
            </Link>
          </Button>
        ) : null}
      </div>

      {sp.checkout === "success" || sp.bienvenue ? (
        <p role="status" className="rounded-xl border border-success/30 bg-success/10 p-4 text-sm">
          🎉 Votre abonnement {plan.name} est actif. Ajoutez votre premier logement pour envoyer votre première quittance.
        </p>
      ) : null}

      {!account.user.ownerAddress ? (
        <Card className="border-warning/40">
          <CardHeader className="flex-row items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div>
              <CardTitle className="text-base">Complétez votre identité de bailleur</CardTitle>
              <CardDescription>Votre nom et votre adresse sont obligatoires sur les quittances.</CardDescription>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href="/espace/compte">Compléter mon profil</Link>
              </Button>
            </div>
          </CardHeader>
        </Card>
      ) : null}

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { k: "Attendus ce mois", v: formatEuros(expected) },
          { k: "Encaissés", v: formatEuros(received) },
          { k: "Impayés en cours", v: String(previous.length + current.filter((c) => c.payment.status === "late").length) },
        ].map((s) => (
          <div key={s.k} className="rounded-2xl border bg-card p-5">
            <dt className="text-sm text-muted-foreground">{s.k}</dt>
            <dd className="mt-1 text-2xl font-semibold tracking-tight">{s.v}</dd>
          </div>
        ))}
      </dl>

      {leases.length === 0 ? (
        <Card className="border-dashed text-center">
          <CardHeader className="items-center">
            <CardTitle>Ajoutez votre premier logement</CardTitle>
            <CardDescription>3 minutes : adresse, locataire, loyer. Votre première quittance peut partir aujourd&apos;hui.</CardDescription>
            <Button asChild className="mt-4">
              <Link href="/espace/logements/nouveau">
                Commencer <ArrowRight aria-hidden />
              </Link>
            </Button>
          </CardHeader>
        </Card>
      ) : (
        <section aria-labelledby="mois">
          <h2 id="mois" className="text-lg font-semibold">
            Échéances du mois
          </h2>
          <ul className="mt-4 divide-y rounded-2xl border bg-card">
            {current.map(({ lease, payment }) => (
              <li key={lease.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <Link href={`/espace/logements/${lease.id}`} className="font-medium hover:underline">
                    {lease.propertyLabel}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {lease.tenantName} · {formatEuros(payment.amountDue)} · échéance le {formatDateFr(payment.dueDate)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge status={payment.status} />
                  {payment.status === "paid" ? (
                    <Button asChild variant="outline" size="sm">
                      <a href={`/api/pdf/quittance?lease=${lease.id}&period=${period}`}>
                        <Download aria-hidden /> Quittance
                      </a>
                    </Button>
                  ) : (
                    <ActionButton action={markPaidAndSend.bind(null, lease.id, period)}>Payé · envoyer la quittance</ActionButton>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {previous.length ? (
        <section aria-labelledby="retards">
          <h2 id="retards" className="text-lg font-semibold">
            Retards des mois précédents
          </h2>
          <ul className="mt-4 divide-y rounded-2xl border bg-card">
            {previous.map(({ lease, payment }) => (
              <li key={`${lease.id}-${payment.period}`} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p>
                  <Link href={`/espace/logements/${lease.id}`} className="font-medium hover:underline">
                    {lease.propertyLabel}
                  </Link>{" "}
                  <span className="text-muted-foreground">· {formatPeriod(payment.period)} · reste {formatEuros(payment.amountDue - payment.amountPaid)}</span>
                </p>
                <StatusBadge status={payment.status} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {revisions.length ? (
        <section aria-labelledby="revisions">
          <h2 id="revisions" className="text-lg font-semibold">
            Révisions de loyer à venir
          </h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {revisions.map(({ lease, date, r }) =>
              r.ok ? (
                <li key={lease.id} className="rounded-2xl border bg-card p-5">
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarClock className="size-4" aria-hidden /> Date anniversaire : {formatDateFr(date)}
                  </p>
                  <p className="mt-2 font-medium">{lease.propertyLabel}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatEuros(lease.rentCents)} → <strong className="text-foreground">{formatEuros(r.newRentCents)}</strong> (+{r.percent.toString().replace(".", ",")} %)
                  </p>
                  <Button asChild variant="link" className="mt-1 h-auto px-0">
                    <Link href={`/espace/logements/${lease.id}#revision`}>Préparer la révision</Link>
                  </Button>
                </li>
              ) : null,
            )}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
