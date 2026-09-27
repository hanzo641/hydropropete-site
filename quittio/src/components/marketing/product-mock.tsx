import { Bell, CheckCircle2, TrendingUp } from "lucide-react";

const rows = [
  { label: "T2 · Rue des Cordeliers", tenant: "Locataire A", amount: "720,00 €", status: "Payé", tone: "text-success bg-success/10" },
  { label: "Studio · Place Clemenceau", tenant: "Locataire B", amount: "495,00 €", status: "Quittance envoyée", tone: "text-primary bg-primary/10" },
  { label: "T3 · Avenue Foch", tenant: "Locataire C", amount: "860,00 €", status: "Relance J+5", tone: "text-foreground bg-warning/20" },
];

/** Aperçu illustratif de l'espace client (données fictives), rendu en HTML pour un LCP rapide. */
export function ProductMock() {
  return (
    <div className="relative mx-auto w-full max-w-lg" role="img" aria-label="Aperçu de l'espace Quittio : loyers du mois, quittances envoyées et relances automatiques">
      <div aria-hidden className="absolute -inset-6 rounded-[2rem] bg-[var(--glow)] blur-3xl" />
      <div className="relative rounded-2xl border bg-card p-4 shadow-2xl sm:p-5" aria-hidden>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Loyers de septembre</p>
            <p className="text-2xl font-semibold tracking-tight">2 075,00 €</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
            <TrendingUp className="size-3.5" /> 2 sur 3 encaissés
          </span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-primary to-[oklch(0.7_0.15_200)]" />
        </div>
        <ul className="mt-5 space-y-2.5">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between gap-3 rounded-xl border bg-background/60 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{r.label}</p>
                <p className="text-xs text-muted-foreground">
                  {r.tenant} · {r.amount}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${r.tone}`}>{r.status}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="absolute -bottom-6 -left-2 hidden items-center gap-3 rounded-xl border bg-popover p-3 shadow-xl sm:flex" aria-hidden>
        <span className="grid size-9 place-items-center rounded-lg bg-success/10 text-success">
          <CheckCircle2 className="size-5" />
        </span>
        <div>
          <p className="text-sm font-medium">Quittance envoyée</p>
          <p className="text-xs text-muted-foreground">PDF · septembre 2026</p>
        </div>
      </div>
      <div className="absolute -right-3 -top-5 hidden items-center gap-3 rounded-xl border bg-popover p-3 shadow-xl sm:flex" aria-hidden>
        <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
          <Bell className="size-5" />
        </span>
        <div>
          <p className="text-sm font-medium">Révision IRL disponible</p>
          <p className="text-xs text-muted-foreground">+1,15 % · lettre prête</p>
        </div>
      </div>
    </div>
  );
}
