import { Download } from "lucide-react";
import { requireAccount } from "@/lib/session";
import { DeleteAccountForm, ProfileForm } from "@/components/app/profile-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AccountPage() {
  const account = await requireAccount("/espace/compte");
  const year = new Date().getFullYear();
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Compte</h1>
      <Card>
        <CardHeader>
          <CardTitle>Identité du bailleur</CardTitle>
          <CardDescription>Imprimée sur les quittances et courriers. Connecté en tant que {account.email}.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm ownerName={account.user.ownerName} ownerAddress={account.user.ownerAddress} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Exports</CardTitle>
          <CardDescription>Vos données vous appartiennent.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button asChild variant="outline">
            <a href="/api/export/donnees">
              <Download aria-hidden /> Toutes mes données (JSON)
            </a>
          </Button>
          {account.plan?.exportCsv ? (
            <>
              <Button asChild variant="outline">
                <a href={`/api/export/revenus?annee=${year - 1}`}>
                  <Download aria-hidden /> Revenus locatifs {year - 1} (CSV)
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={`/api/export/revenus?annee=${year}`}>
                  <Download aria-hidden /> Revenus locatifs {year} (CSV)
                </a>
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">L&apos;export annuel des revenus fonciers est inclus dans la formule Patrimoine.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle>Supprimer mon compte</CardTitle>
          <CardDescription>
            Supprime immédiatement et définitivement vos logements, locataires, paiements et votre compte, et met fin à votre abonnement sans remboursement de la période
            en cours. Pensez à exporter vos données avant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountForm />
        </CardContent>
      </Card>
    </div>
  );
}
