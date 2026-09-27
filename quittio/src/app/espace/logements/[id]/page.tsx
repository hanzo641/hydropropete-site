import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FileWarning, Mail, TrendingUp } from "lucide-react";
import { requireActiveAccount } from "@/lib/session";
import { getLease, listPayments } from "@/lib/leases";
import { addMonths, formatPeriod, nextAnniversary, periodOf, todayParis } from "@/lib/rent";
import { computeRevision, formatQuarter, getIrl } from "@/lib/irl";
import { quarterOptions } from "@/lib/quarters";
import { formatDateFr, formatEuros } from "@/lib/utils";
import { applyRevision, archiveLease, cancelPayment, recordPayment, resendQuittance, updateLease } from "../../actions";
import { ActionButton } from "@/components/app/action-button";
import { LeaseForm } from "@/components/app/lease-form";
import { PaymentForm } from "@/components/app/payment-form";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function LeasePage({ params, searchParams }: PageProps<"/espace/logements/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const account = await requireActiveAccount(`/espace/logements/${id}`);
  const lease = await getLease(account.uid, id);
  if (!lease || !lease.active) notFound();

  const today = todayParis();
  const current = periodOf(today);
  const start = periodOf(lease.startDate);
  const periods: string[] = [];
  for (let p = addMonths(current, 1); p >= start && periods.length < 13; p = addMonths(p, -1)) periods.push(p);
  const payments = await listPayments(account.uid, lease, periods);
  const unpaid = payments.filter((p) => p.status === "late" || p.status === "partial");
  const revision = computeRevision({ rentCents: lease.rentCents, referenceQuarter: lease.irlReferenceQuarter, dpeClass: lease.dpeClass });
  const anniversary = nextAnniversary(lease.startDate, today);
  const currentPayment = payments.find((p) => p.period === current);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/espace/logements" className="text-sm text-muted-foreground hover:text-foreground">
          ← Logements
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{lease.propertyLabel}</h1>
        <p className="mt-1 text-muted-foreground">
          {lease.propertyAddress} · {lease.tenantName} ({lease.tenantEmail})
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Loyer {formatEuros(lease.rentCents)} + charges {formatEuros(lease.chargesCents)} = <strong className="text-foreground">{formatEuros(lease.rentCents + lease.chargesCents)}</strong>, exigible le {lease.dueDay} de chaque mois
        </p>
      </div>

      {sp.cree ? (
        <p role="status" className="rounded-xl border border-success/30 bg-success/10 p-4 text-sm">
          Logement enregistré ✅ Enregistrez ci-dessous le dernier loyer reçu pour envoyer votre première quittance.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-5 text-primary" aria-hidden /> Enregistrer un paiement
          </CardTitle>
          <CardDescription>Montant complet : quittance. Montant partiel : reçu (la quittance n&apos;est due qu&apos;après paiement intégral).</CardDescription>
        </CardHeader>
        <CardContent>
          <PaymentForm
            action={recordPayment.bind(null, lease.id)}
            periods={periods.map((p) => ({ value: p, label: formatPeriod(p) }))}
            defaultPeriod={current}
            defaultAmount={((currentPayment?.amountDue ?? lease.rentCents + lease.chargesCents) / 100).toFixed(2).replace(".", ",")}
            today={today}
          />
        </CardContent>
      </Card>

      <section aria-labelledby="historique">
        <h2 id="historique" className="text-lg font-semibold">
          Historique des loyers
        </h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Historique des échéances de ce logement</caption>
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th scope="col" className="p-3 font-medium">Période</th>
                <th scope="col" className="p-3 font-medium">Dû</th>
                <th scope="col" className="p-3 font-medium">Reçu</th>
                <th scope="col" className="p-3 font-medium">Statut</th>
                <th scope="col" className="p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payments.map((p) => (
                <tr key={p.period}>
                  <th scope="row" className="p-3 text-left font-medium capitalize">{formatPeriod(p.period)}</th>
                  <td className="p-3">{formatEuros(p.amountDue)}</td>
                  <td className="p-3">
                    {p.amountPaid ? formatEuros(p.amountPaid) : "—"}
                    {p.paidAt ? <span className="block text-xs text-muted-foreground">le {formatDateFr(p.paidAt)}</span> : null}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={p.status} />
                    {p.quittanceSentAt ? <span className="mt-1 block text-xs text-muted-foreground">Envoyée</span> : null}
                  </td>
                  <td className="p-3">
                    {p.amountPaid > 0 ? (
                      <div className="flex flex-wrap items-start gap-2">
                        <Button asChild variant="outline" size="sm">
                          <a href={`/api/pdf/quittance?lease=${lease.id}&period=${p.period}`} aria-label={`Télécharger le PDF de ${formatPeriod(p.period)}`}>
                            <Download aria-hidden /> PDF
                          </a>
                        </Button>
                        <ActionButton action={resendQuittance.bind(null, lease.id, p.period)} variant="ghost">
                          Renvoyer
                        </ActionButton>
                        <ActionButton action={cancelPayment.bind(null, lease.id, p.period)} variant="ghost" confirm="Annuler ce paiement ?">
                          Annuler
                        </ActionButton>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="revision" className="scroll-mt-24">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-5 text-primary" aria-hidden /> Révision annuelle (IRL)
            </CardTitle>
            <CardDescription>
              Prochaine date anniversaire : {formatDateFr(anniversary)} · référence : {formatQuarter(lease.irlReferenceQuarter)} ({getIrl(lease.irlReferenceQuarter)?.value.toFixed(2).replace(".", ",")})
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {revision.ok ? (
              <>
                <p>
                  Nouvel indice : {formatQuarter(revision.newIndex.quarter)} ({revision.newIndex.value.toFixed(2).replace(".", ",")}), soit{" "}
                  <strong>+{revision.percent.toString().replace(".", ",")} %</strong>.
                </p>
                <p className="text-base">
                  {formatEuros(lease.rentCents)} → <strong>{formatEuros(revision.newRentCents)}</strong> hors charges (+{formatEuros(revision.increaseCents)}/mois)
                </p>
                <p className="text-muted-foreground">La révision n&apos;est pas rétroactive : envoyez la lettre au locataire, puis appliquez le nouveau loyer.</p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <a href={`/api/pdf/revision?lease=${lease.id}`}>
                      <Download aria-hidden /> Lettre de révision
                    </a>
                  </Button>
                  <ActionButton action={applyRevision.bind(null, lease.id)} confirm={`Appliquer le nouveau loyer de ${formatEuros(revision.newRentCents)} aux prochaines échéances ?`}>
                    Appliquer le nouveau loyer
                  </ActionButton>
                </div>
              </>
            ) : revision.reason === "dpe_frozen" ? (
              <p>Ce logement est classé {lease.dpeClass} au DPE : son loyer ne peut pas être augmenté (loi Climat et résilience).</p>
            ) : (
              <p className="text-muted-foreground">Aucun nouvel indice n&apos;est encore publié pour ce trimestre. Nous vous préviendrons par e-mail.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileWarning className="size-5 text-primary" aria-hidden /> Impayés
            </CardTitle>
            <CardDescription>
              {lease.remindersEnabled ? "Relances automatiques actives (J+5 et J+15)." : "Relances automatiques désactivées pour ce logement."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {unpaid.length ? (
              <>
                <p>
                  {unpaid.length} échéance(s) impayée(s), total{" "}
                  <strong>{formatEuros(unpaid.reduce((s, p) => s + p.amountDue - p.amountPaid, 0))}</strong>.
                </p>
                <Button asChild variant="outline" size="sm">
                  <a href={`/api/pdf/mise-en-demeure?lease=${lease.id}`}>
                    <Download aria-hidden /> Mise en demeure (PDF)
                  </a>
                </Button>
                <p className="text-muted-foreground">
                  À envoyer en lettre recommandée avec accusé de réception. Pensez aussi à prévenir la caution ou votre assurance loyers impayés.
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">Aucun impayé. 👌</p>
            )}
          </CardContent>
        </Card>
      </div>

      <details className="group rounded-2xl border bg-card">
        <summary className="cursor-pointer list-none p-5 font-semibold marker:hidden">
          Modifier le logement, le locataire ou le bail <span className="text-muted-foreground group-open:hidden">+</span>
        </summary>
        <div className="border-t p-5 sm:p-8">
          <LeaseForm action={updateLease.bind(null, lease.id)} lease={lease} quarters={quarterOptions()} automation={account.plan.automation} submitLabel="Enregistrer les modifications" />
          <div className="mt-10 border-t pt-6">
            <form action={archiveLease.bind(null, lease.id)}>
              <Button type="submit" variant="outline" size="sm">
                Archiver ce logement (fin de bail)
              </Button>
            </form>
          </div>
        </div>
      </details>
    </div>
  );
}
