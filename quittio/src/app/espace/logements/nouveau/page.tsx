import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveAccount } from "@/lib/session";
import { listLeases } from "@/lib/leases";
import { quarterOptions } from "@/lib/quarters";
import { LeaseForm } from "@/components/app/lease-form";
import { createLease } from "../../actions";

export default async function NewLeasePage() {
  const account = await requireActiveAccount("/espace/logements/nouveau");
  if ((await listLeases(account.uid)).length >= account.plan.maxLeases) redirect("/espace/logements");
  return (
    <div>
      <Link href="/espace/logements" className="text-sm text-muted-foreground hover:text-foreground">
        ← Logements
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Nouveau logement</h1>
      <p className="mt-1 text-muted-foreground">Toutes ces informations figurent dans votre bail.</p>
      <div className="mt-8 rounded-2xl border bg-card p-5 sm:p-8">
        <LeaseForm action={createLease} quarters={quarterOptions()} automation={account.plan.automation} submitLabel="Enregistrer le logement" />
      </div>
    </div>
  );
}
