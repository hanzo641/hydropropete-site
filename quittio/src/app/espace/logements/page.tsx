import Link from "next/link";
import { Plus } from "lucide-react";
import { requireActiveAccount } from "@/lib/session";
import { listLeases } from "@/lib/leases";
import { formatEuros } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function LeasesPage() {
  const account = await requireActiveAccount("/espace/logements");
  const leases = await listLeases(account.uid);
  const canAdd = leases.length < account.plan.maxLeases;
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Logements</h1>
          <p className="mt-1 text-muted-foreground">
            {leases.length} / {account.plan.maxLeases} logement(s) · formule {account.plan.name}
          </p>
        </div>
        {canAdd ? (
          <Button asChild>
            <Link href="/espace/logements/nouveau">
              <Plus aria-hidden /> Ajouter un logement
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline">
            <Link href="/espace/abonnement">Passer à la formule supérieure</Link>
          </Button>
        )}
      </div>
      {leases.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">Aucun logement pour l&apos;instant.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {leases.map((l) => (
            <li key={l.id}>
              <Link href={`/espace/logements/${l.id}`} className="block rounded-2xl border bg-card p-5 transition-shadow hover:shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold">{l.propertyLabel}</p>
                  {l.autoQuittance ? <Badge variant="secondary">Auto</Badge> : null}
                </div>
                <p className="mt-1 truncate text-sm text-muted-foreground">{l.propertyAddress}</p>
                <p className="mt-4 text-sm">
                  {l.tenantName} · <strong>{formatEuros(l.rentCents + l.chargesCents)}</strong> CC · le {l.dueDay} du mois
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
