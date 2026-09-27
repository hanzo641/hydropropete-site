import { Gift } from "lucide-react";
import { requireAccount } from "@/lib/session";
import { absoluteUrl } from "@/lib/site";
import { REFERRAL_TRIAL_DAYS } from "@/lib/plans";
import { CopyButton } from "@/components/app/copy-button";
import { Input } from "@/components/ui/input";

export default async function ReferralPage() {
  const account = await requireAccount("/espace/parrainage");
  const link = absoluteUrl(`/r/${account.user.referralCode}`);
  const rewards = account.user.referralRewards?.length ?? 0;
  const message = `J'utilise Quittio pour envoyer mes quittances et suivre mes loyers automatiquement. Avec mon lien, tu as ${REFERRAL_TRIAL_DAYS} jours d'essai gratuit : ${link}`;
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Parrainage</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Recommandez Quittio à un autre propriétaire : il profite de <strong>{REFERRAL_TRIAL_DAYS} jours d&apos;essai</strong> au lieu de 14, et vous gagnez{" "}
          <strong>1 mois offert</strong> dès qu&apos;il devient abonné payant. Sans limite.
        </p>
      </div>
      <div className="rounded-2xl border bg-card p-6">
        <label htmlFor="ref-link" className="text-sm font-medium">
          Votre lien personnel
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Input id="ref-link" readOnly value={link} className="font-mono" />
          <CopyButton value={link} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <a className="text-sm text-primary underline underline-offset-2" href={`mailto:?subject=${encodeURIComponent("Je te recommande Quittio")}&body=${encodeURIComponent(message)}`}>
            Partager par e-mail
          </a>
          <span aria-hidden className="text-muted-foreground">·</span>
          <a className="text-sm text-primary underline underline-offset-2" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
            Partager sur WhatsApp
          </a>
        </div>
      </div>
      <div className="flex items-center gap-4 rounded-2xl border bg-card p-6">
        <span className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
          <Gift aria-hidden />
        </span>
        <div>
          <p className="text-2xl font-semibold">{rewards}</p>
          <p className="text-sm text-muted-foreground">mois offert(s) grâce à vos filleuls</p>
        </div>
      </div>
    </div>
  );
}
