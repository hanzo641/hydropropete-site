import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { escapeHtml, sendEmail } from "@/lib/email";
import { sameOrigin } from "@/lib/http";
import { site } from "@/lib/site";

const schema = z.object({
  name: z.string().trim().min(2, "Nom requis").max(120),
  email: z.email("E-mail invalide").max(200),
  subject: z.enum(["question", "support", "partenariat", "resiliation", "autre"]).default("question"),
  message: z.string().trim().min(10, "Message trop court").max(5000),
  website: z.string().max(0).optional(),
});

const LABELS: Record<string, string> = {
  question: "Question avant abonnement",
  support: "Support",
  partenariat: "Partenariat",
  resiliation: "Demande de résiliation",
  autre: "Autre",
};

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Origine refusée" }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Formulaire invalide" }, { status: 400 });
  const d = parsed.data;
  const to = process.env.CONTACT_EMAIL ?? site.supportEmail;
  try {
    await sendEmail({
      to,
      replyTo: d.email,
      subject: `[${LABELS[d.subject]}] ${d.name}`,
      html: `<p><strong>${escapeHtml(d.name)}</strong> &lt;${escapeHtml(d.email)}&gt;</p><p>${escapeHtml(d.message).replace(/\n/g, "<br>")}</p>`,
      text: `${d.name} <${d.email}>\n\n${d.message}`,
    });
    if (d.subject === "resiliation") {
      // Accusé de réception sur support durable (art. L215-1-1 du Code de la consommation).
      await sendEmail({
        to: d.email,
        subject: `Nous avons bien reçu votre demande de résiliation — ${site.name}`,
        html: `<p>Bonjour ${escapeHtml(d.name)},</p><p>Nous accusons réception de votre demande de résiliation, reçue le ${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}. Elle sera traitée sous 48 h ouvrées et vous recevrez une confirmation indiquant la date de fin de votre abonnement.</p><p>Pour une résiliation immédiate, vous pouvez aussi vous connecter : Espace client → Abonnement → Résilier.</p><p>L'équipe ${site.name}</p>`,
        text: `Nous accusons réception de votre demande de résiliation. Elle sera traitée sous 48 h ouvrées.`,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[contact]", e);
    return NextResponse.json({ error: "Envoi impossible pour le moment. Écrivez-nous directement par e-mail." }, { status: 500 });
  }
}
