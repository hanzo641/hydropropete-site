import "server-only";
import { Resend } from "resend";
import { absoluteUrl, site } from "./site";

let resend: Resend | undefined;

export interface MailAttachment {
  filename: string;
  content: Buffer;
}

export interface Mail {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  cc?: string[];
  attachments?: MailAttachment[];
}

/** Envoie un e-mail via Resend. Sans clé API (développement), l'e-mail est journalisé et ignoré. */
export async function sendEmail(mail: Mail): Promise<{ id: string | null }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(`[email:dry-run] → ${String(mail.to)} : ${mail.subject}`);
    return { id: null };
  }
  resend ??= new Resend(key);
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? `${site.name} <notifications@quittio.fr>`,
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    replyTo: mail.replyTo,
    cc: mail.cc,
    attachments: mail.attachments,
  });
  if (error) throw new Error(`Resend : ${error.message}`);
  return { id: data?.id ?? null };
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Gabarit HTML sobre, compatible clients mail (tables + styles inline). */
function layout(opts: { preheader: string; body: string; cta?: { label: string; href: string }; footer?: string }): string {
  const cta = opts.cta
    ? `<p style="margin:28px 0"><a href="${opts.cta.href}" style="background:#4338ca;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block">${escapeHtml(opts.cta.label)}</a></p>`
    : "";
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f6f6f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1c28">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:560px;background:#fff;border:1px solid #e6e6ee;border-radius:16px" cellpadding="0" cellspacing="0">
<tr><td style="padding:28px 32px 0;font-weight:700;font-size:18px;letter-spacing:-0.01em">${site.name}</td></tr>
<tr><td style="padding:16px 32px 32px;font-size:15px;line-height:1.6">${opts.body}${cta}</td></tr>
</table>
<p style="font-size:12px;color:#6b6b7b;max-width:560px;line-height:1.5;margin:16px auto 0">${opts.footer ?? `Envoyé par ${site.name} · <a href="${site.url}" style="color:#6b6b7b">${site.url.replace(/^https?:\/\//, "")}</a>`}</p>
</td></tr></table></body></html>`;
}

const p = (s: string) => `<p style="margin:0 0 14px">${s}</p>`;

export const templates = {
  welcome(name: string) {
    const first = escapeHtml(name || "");
    return {
      subject: `Bienvenue sur ${site.name} 👋`,
      html: layout({
        preheader: "Votre premier logement se configure en 3 minutes.",
        body:
          p(`Bonjour ${first},`) +
          p(`Merci d'avoir rejoint ${site.name}. Trois étapes pour ne plus jamais penser à vos quittances :`) +
          `<ol style="margin:0 0 14px;padding-left:20px"><li>Ajoutez votre logement et votre locataire</li><li>Marquez le loyer du mois comme payé</li><li>La quittance part toute seule, en PDF</li></ol>` +
          p("Une question ? Répondez simplement à cet e-mail."),
        cta: { label: "Configurer mon premier logement", href: absoluteUrl("/espace/logements/nouveau") },
      }),
      text: `Bonjour ${name},\n\nMerci d'avoir rejoint ${site.name}. Ajoutez votre premier logement : ${absoluteUrl("/espace/logements/nouveau")}\n`,
    };
  },

  quittance(o: { tenantName: string; ownerName: string; periodLabel: string; amount: string; address: string }) {
    return {
      subject: `Quittance de loyer — ${o.periodLabel}`,
      html: layout({
        preheader: `Votre quittance de loyer pour ${o.periodLabel} est jointe.`,
        body:
          p(`Bonjour ${escapeHtml(o.tenantName)},`) +
          p(`Veuillez trouver ci-joint votre quittance de loyer pour la période de <strong>${escapeHtml(o.periodLabel)}</strong> (${escapeHtml(o.amount)}), concernant le logement situé ${escapeHtml(o.address)}.`) +
          p(`Bien cordialement,<br>${escapeHtml(o.ownerName)}`),
        footer: `Quittance émise par ${escapeHtml(o.ownerName)} via ${site.name}. Pour toute question, répondez à cet e-mail : votre bailleur le recevra directement.`,
      }),
      text: `Bonjour ${o.tenantName},\n\nVeuillez trouver ci-joint votre quittance de loyer pour ${o.periodLabel} (${o.amount}), logement : ${o.address}.\n\nBien cordialement,\n${o.ownerName}`,
    };
  },

  notice(o: { tenantName: string; ownerName: string; periodLabel: string; amount: string; dueDate: string; rent: string; charges: string }) {
    return {
      subject: `Avis d'échéance — loyer de ${o.periodLabel}`,
      html: layout({
        preheader: `Loyer de ${o.periodLabel} : ${o.amount} à régler le ${o.dueDate}.`,
        body:
          p(`Bonjour ${escapeHtml(o.tenantName)},`) +
          p(`Pour rappel, le loyer de <strong>${escapeHtml(o.periodLabel)}</strong> est à régler au plus tard le <strong>${escapeHtml(o.dueDate)}</strong>.`) +
          `<table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 14px;font-size:14px"><tr><td style="padding:6px 0;color:#555">Loyer hors charges</td><td align="right">${escapeHtml(o.rent)}</td></tr><tr><td style="padding:6px 0;color:#555">Provision sur charges</td><td align="right">${escapeHtml(o.charges)}</td></tr><tr><td style="padding:8px 0;border-top:1px solid #eee;font-weight:600">Total</td><td align="right" style="border-top:1px solid #eee;font-weight:600">${escapeHtml(o.amount)}</td></tr></table>` +
          p(`Si vous avez déjà effectué le règlement, merci de ne pas tenir compte de ce message.<br><br>Bien cordialement,<br>${escapeHtml(o.ownerName)}`),
      }),
      text: `Bonjour ${o.tenantName},\n\nLe loyer de ${o.periodLabel} (${o.amount}) est à régler au plus tard le ${o.dueDate}.\n\nBien cordialement,\n${o.ownerName}`,
    };
  },

  reminder(o: { level: 1 | 2; tenantName: string; ownerName: string; periodLabel: string; amount: string; dueDate: string }) {
    const friendly = o.level === 1;
    return {
      subject: friendly ? `Petit rappel — loyer de ${o.periodLabel}` : `Relance — loyer de ${o.periodLabel} impayé`,
      html: layout({
        preheader: friendly ? "Un oubli est vite arrivé." : "Merci de régulariser la situation rapidement.",
        body: friendly
          ? p(`Bonjour ${escapeHtml(o.tenantName)},`) +
            p(`Sauf erreur de ma part, je n'ai pas encore reçu le loyer de <strong>${escapeHtml(o.periodLabel)}</strong> (${escapeHtml(o.amount)}), qui était attendu le ${escapeHtml(o.dueDate)}. Il s'agit sans doute d'un simple oubli.`) +
            p("Pourriez-vous procéder au règlement dans les prochains jours ? En cas de difficulté, n'hésitez pas à me contacter en répondant à ce message : nous trouverons une solution ensemble.") +
            p(`Bien cordialement,<br>${escapeHtml(o.ownerName)}`)
          : p(`Bonjour ${escapeHtml(o.tenantName)},`) +
            p(`Malgré mon précédent message, le loyer de <strong>${escapeHtml(o.periodLabel)}</strong> d'un montant de <strong>${escapeHtml(o.amount)}</strong>, exigible depuis le ${escapeHtml(o.dueDate)}, reste impayé à ce jour.`) +
            p("Je vous remercie de bien vouloir régulariser cette situation sous 8 jours. À défaut, je serai contraint(e) de vous adresser une mise en demeure par lettre recommandée et, le cas échéant, de faire appel à la caution ou à l'assurance loyers impayés.") +
            p("Si vous rencontrez des difficultés financières, contactez-moi sans attendre : des solutions existent (échéancier, aides de la CAF ou du FSL).") +
            p(`Cordialement,<br>${escapeHtml(o.ownerName)}`),
      }),
      text: friendly
        ? `Bonjour ${o.tenantName},\n\nSauf erreur, le loyer de ${o.periodLabel} (${o.amount}), attendu le ${o.dueDate}, n'a pas encore été reçu. Pourriez-vous procéder au règlement ?\n\n${o.ownerName}`
        : `Bonjour ${o.tenantName},\n\nLe loyer de ${o.periodLabel} (${o.amount}), exigible depuis le ${o.dueDate}, reste impayé. Merci de régulariser sous 8 jours.\n\n${o.ownerName}`,
    };
  },

  ownerAlert(o: { title: string; lines: string[]; cta: { label: string; href: string } }) {
    return {
      subject: o.title,
      html: layout({ preheader: o.lines[0] ?? o.title, body: o.lines.map((l) => p(escapeHtml(l))).join(""), cta: o.cta }),
      text: `${o.lines.join("\n\n")}\n\n${o.cta.label} : ${o.cta.href}`,
    };
  },

  paymentFailed() {
    return {
      subject: "Échec du paiement de votre abonnement",
      html: layout({
        preheader: "Mettez à jour votre moyen de paiement pour garder l'accès.",
        body:
          p("Bonjour,") +
          p(`Le dernier paiement de votre abonnement ${site.name} n'a pas abouti. Nous réessaierons automatiquement dans les prochains jours ; vos automatisations restent actives pendant cette période.`) +
          p("Pour éviter toute interruption, mettez à jour votre carte en un clic :"),
        cta: { label: "Mettre à jour mon moyen de paiement", href: absoluteUrl("/espace/abonnement") },
      }),
      text: `Le dernier paiement de votre abonnement a échoué. Mettez à jour votre moyen de paiement : ${absoluteUrl("/espace/abonnement")}`,
    };
  },

  cancellationConfirmed(o: { endDate: string | null }) {
    const when = o.endDate ? `Votre accès reste ouvert jusqu'au <strong>${escapeHtml(o.endDate)}</strong>, aucun autre prélèvement ne sera effectué.` : "Votre abonnement est désormais terminé, aucun autre prélèvement ne sera effectué.";
    return {
      subject: `Confirmation de résiliation de votre abonnement ${site.name}`,
      html: layout({
        preheader: "Votre résiliation a bien été prise en compte.",
        body:
          p("Bonjour,") +
          p(`Nous confirmons la résiliation de votre abonnement ${site.name}, reçue le ${escapeHtml(new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }))}. ${when}`) +
          p("Vos données restent consultables et exportables jusqu'à cette date, puis sont supprimées conformément à notre politique de confidentialité. Vous pouvez vous réabonner à tout moment.") +
          p("Merci de nous avoir fait confiance. Un mot sur ce qui vous a manqué ? Répondez à cet e-mail, nous lisons tout."),
        cta: { label: "Exporter mes données", href: absoluteUrl("/espace/compte") },
      }),
      text: `Nous confirmons la résiliation de votre abonnement ${site.name}.${o.endDate ? ` Accès ouvert jusqu'au ${o.endDate}.` : ""} Aucun autre prélèvement ne sera effectué.`,
    };
  },

  trialEnding(o: { endDate: string }) {
    return {
      subject: `Votre essai ${site.name} se termine le ${o.endDate}`,
      html: layout({
        preheader: "Rien à faire pour continuer. Résiliable en 1 clic.",
        body:
          p("Bonjour,") +
          p(`Votre période d'essai se termine le <strong>${escapeHtml(o.endDate)}</strong>. Sans action de votre part, votre abonnement démarrera automatiquement à cette date.`) +
          p("Vous ne souhaitez pas continuer ? Vous pouvez résilier en un clic depuis votre espace, sans aucun frais."),
        cta: { label: "Gérer mon abonnement", href: absoluteUrl("/espace/abonnement") },
      }),
      text: `Votre essai se termine le ${o.endDate}. Gérer ou résilier : ${absoluteUrl("/espace/abonnement")}`,
    };
  },

  referralReward() {
    return {
      subject: "🎁 Un mois offert grâce à votre parrainage",
      html: layout({
        preheader: "Merci de recommander Quittio !",
        body: p("Bonne nouvelle : une personne que vous avez parrainée vient de devenir abonnée. Nous avons crédité l'équivalent d'un mois d'abonnement sur votre compte ; il sera déduit automatiquement de votre prochaine facture.") + p("Merci pour votre confiance !"),
        cta: { label: "Parrainer d'autres propriétaires", href: absoluteUrl("/espace/parrainage") },
      }),
      text: "Une personne parrainée est devenue abonnée : un mois vous est offert sur votre prochaine facture.",
    };
  },
};
