import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatDateFr, formatEuros } from "./utils";
import { formatPeriod, periodBounds } from "./rent";
import { formatQuarter } from "./irl";

/** Les polices standard PDF ne couvrent que WinAnsi : on retire les caractères non encodables. */
const EXTRA = new Set([..."€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ"]);
export function pdfSafe(s: string): string {
  return [...s.normalize("NFC").replace(/[   ]/g, " ")]
    .filter((c) => c === "\n" || (c.charCodeAt(0) >= 0x20 && c.charCodeAt(0) <= 0xff) || EXTRA.has(c))
    .join("");
}

interface Party {
  name: string;
  address: string;
}

const MARGIN = 56;
const INK = rgb(0.11, 0.11, 0.16);
const MUTED = rgb(0.42, 0.42, 0.48);
const BRAND = rgb(0.26, 0.22, 0.79);

class Writer {
  y: number;
  constructor(
    public page: PDFPage,
    public font: PDFFont,
    public bold: PDFFont,
  ) {
    this.y = page.getHeight() - MARGIN;
  }
  get width() {
    return this.page.getWidth() - MARGIN * 2;
  }
  wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const lines: string[] = [];
    for (const paragraph of pdfSafe(text).split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
          lines.push(line);
          line = word;
        } else line = candidate;
      }
      lines.push(line);
    }
    return lines;
  }
  text(text: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; x?: number; maxWidth?: number; gap?: number } = {}) {
    const size = opts.size ?? 10.5;
    const font = opts.bold ? this.bold : this.font;
    const x = opts.x ?? MARGIN;
    for (const line of this.wrap(text, font, size, opts.maxWidth ?? this.width - (x - MARGIN))) {
      this.page.drawText(line, { x, y: this.y, size, font, color: opts.color ?? INK });
      this.y -= size * 1.45;
    }
    this.y -= opts.gap ?? 0;
  }
  right(text: string, y: number, opts: { size?: number; bold?: boolean } = {}) {
    const size = opts.size ?? 10.5;
    const font = opts.bold ? this.bold : this.font;
    const t = pdfSafe(text);
    this.page.drawText(t, { x: MARGIN + this.width - font.widthOfTextAtSize(t, size), y, size, font, color: INK });
  }
  rule(gap = 12) {
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: MARGIN + this.width, y: this.y }, thickness: 0.6, color: rgb(0.88, 0.88, 0.92) });
    this.y -= gap;
  }
  row(label: string, value: string, bold = false) {
    const y = this.y;
    this.text(label, { bold });
    this.right(value, y, { bold });
  }
}

async function newDoc(title: string) {
  const doc = await PDFDocument.create();
  doc.setTitle(pdfSafe(title));
  doc.setCreator("Quittio");
  doc.setProducer("Quittio");
  doc.setLanguage("fr-FR");
  const page = doc.addPage([595.28, 841.89]); // A4
  const w = new Writer(page, await doc.embedFont(StandardFonts.Helvetica), await doc.embedFont(StandardFonts.HelveticaBold));
  return { doc, w };
}

function parties(w: Writer, owner: Party, tenant: Party) {
  const top = w.y;
  w.text("BAILLEUR", { size: 8, bold: true, color: MUTED });
  w.text(owner.name, { bold: true, maxWidth: w.width / 2 - 12 });
  w.text(owner.address || "", { color: MUTED, maxWidth: w.width / 2 - 12 });
  const leftBottom = w.y;
  w.y = top;
  const x = MARGIN + w.width / 2 + 12;
  w.text("LOCATAIRE", { size: 8, bold: true, color: MUTED, x });
  w.text(tenant.name, { bold: true, x });
  w.text(tenant.address, { color: MUTED, x });
  w.y = Math.min(leftBottom, w.y) - 18;
}

function footer(w: Writer, note: string) {
  w.page.drawText(pdfSafe(note), { x: MARGIN, y: 32, size: 7.5, font: w.font, color: MUTED });
}

export interface QuittanceData {
  owner: Party;
  tenantName: string;
  propertyAddress: string;
  period: string;
  rentCents: number;
  chargesCents: number;
  amountPaidCents: number;
  paidAt: string;
  issuedAt?: string;
  city?: string;
}

/** Quittance de loyer conforme à l'article 21 de la loi n° 89-462 du 6 juillet 1989 (loyer et charges détaillés). */
export async function quittancePdf(d: QuittanceData): Promise<Uint8Array> {
  const periodLabel = formatPeriod(d.period);
  const { start, end } = periodBounds(d.period);
  const total = d.rentCents + d.chargesCents;
  const partial = d.amountPaidCents < total;
  const title = partial ? "Reçu de paiement partiel" : "Quittance de loyer";
  const { doc, w } = await newDoc(`${title} - ${periodLabel}`);

  w.text(title.toUpperCase(), { size: 18, bold: true, color: BRAND });
  w.text(`Période du ${formatDateFr(start)} au ${formatDateFr(end)}`, { color: MUTED, gap: 18 });
  parties(w, d.owner, { name: d.tenantName, address: d.propertyAddress });

  w.text("Adresse du logement loué", { size: 8, bold: true, color: MUTED });
  w.text(d.propertyAddress, { gap: 16 });

  w.rule(16);
  w.row("Loyer hors charges", formatEuros(d.rentCents));
  w.row("Provision pour charges", formatEuros(d.chargesCents));
  w.rule(16);
  w.row("Total dû pour la période", formatEuros(total), true);
  w.row(`Montant reçu le ${formatDateFr(d.paidAt)}`, formatEuros(d.amountPaidCents), true);
  w.y -= 18;

  if (partial) {
    w.text(
      `Je soussigné(e) ${d.owner.name}, bailleur du logement désigné ci-dessus, déclare avoir reçu de ${d.tenantName} la somme de ${formatEuros(d.amountPaidCents)} à titre de paiement partiel du loyer et des charges de la période de ${periodLabel}. Reste dû : ${formatEuros(total - d.amountPaidCents)}. Ce reçu ne vaut pas quittance.`,
      { gap: 10 },
    );
  } else {
    w.text(
      `Je soussigné(e) ${d.owner.name}, bailleur du logement désigné ci-dessus, déclare avoir reçu de ${d.tenantName} la somme de ${formatEuros(total)} au titre du loyer et des charges pour la période de ${periodLabel}, et lui en donne quittance, sous réserve de tous mes droits.`,
      { gap: 10 },
    );
  }
  w.y -= 14;
  w.text(`Fait${d.city ? ` à ${d.city}` : ""} le ${formatDateFr(d.issuedAt ?? new Date().toISOString().slice(0, 10))}`);
  w.text(`${d.owner.name}, bailleur`, { bold: true });

  footer(
    w,
    "Quittance délivrée gratuitement (loi du 6 juillet 1989, art. 21). Le paiement de la présente n'emporte pas présomption de paiement des termes antérieurs.",
  );
  return doc.save();
}

export interface RevisionLetterData {
  owner: Party;
  tenantName: string;
  propertyAddress: string;
  oldRentCents: number;
  newRentCents: number;
  oldIndex: { quarter: string; value: number };
  newIndex: { quarter: string; value: number };
  effectiveDate: string;
}

export async function revisionLetterPdf(d: RevisionLetterData): Promise<Uint8Array> {
  const { doc, w } = await newDoc("Révision annuelle du loyer");
  parties(w, d.owner, { name: d.tenantName, address: d.propertyAddress });
  w.text(`Le ${formatDateFr(new Date().toISOString().slice(0, 10))}`, { gap: 12 });
  w.text("Objet : révision annuelle du loyer", { bold: true, gap: 12 });
  w.text(`Madame, Monsieur ${d.tenantName},`, { gap: 8 });
  w.text(
    `Conformément à la clause de révision prévue au bail et à l'article 17-1 de la loi n° 89-462 du 6 juillet 1989, je vous informe de la révision de votre loyer hors charges, calculée selon l'Indice de Référence des Loyers (IRL) publié par l'INSEE.`,
    { gap: 12 },
  );
  w.rule(16);
  w.row("Loyer hors charges actuel", formatEuros(d.oldRentCents));
  w.row(`IRL de référence (${formatQuarter(d.oldIndex.quarter)})`, d.oldIndex.value.toFixed(2).replace(".", ","));
  w.row(`Nouvel IRL (${formatQuarter(d.newIndex.quarter)})`, d.newIndex.value.toFixed(2).replace(".", ","));
  w.text(`Calcul : ${formatEuros(d.oldRentCents)} × ${d.newIndex.value.toFixed(2).replace(".", ",")} / ${d.oldIndex.value.toFixed(2).replace(".", ",")}`, { color: MUTED, size: 9 });
  w.rule(16);
  w.row("Nouveau loyer hors charges", formatEuros(d.newRentCents), true);
  w.y -= 16;
  w.text(
    `Ce nouveau loyer s'appliquera à compter du ${formatDateFr(d.effectiveDate)}. Le montant de la provision pour charges reste inchangé.`,
    { gap: 12 },
  );
  w.text("Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.", { gap: 20 });
  w.text(d.owner.name, { bold: true });
  footer(w, "La révision ne peut excéder la variation de l'IRL. Elle n'est pas rétroactive (art. 17-1, loi du 6 juillet 1989).");
  return doc.save();
}

export interface NoticeOfDefaultData {
  owner: Party;
  tenantName: string;
  propertyAddress: string;
  items: { period: string; amountCents: number }[];
}

export async function miseEnDemeurePdf(d: NoticeOfDefaultData): Promise<Uint8Array> {
  const { doc, w } = await newDoc("Mise en demeure de payer");
  parties(w, d.owner, { name: d.tenantName, address: d.propertyAddress });
  w.text(`Le ${formatDateFr(new Date().toISOString().slice(0, 10))}`, { gap: 6 });
  w.text("Lettre recommandée avec accusé de réception", { bold: true, gap: 12 });
  w.text("Objet : mise en demeure de payer les loyers impayés", { bold: true, gap: 12 });
  w.text(`Madame, Monsieur ${d.tenantName},`, { gap: 8 });
  w.text(
    "Malgré mes précédentes relances, je constate que les sommes suivantes, dues au titre du bail du logement désigné ci-dessus, restent impayées à ce jour :",
    { gap: 10 },
  );
  let total = 0;
  for (const it of d.items) {
    total += it.amountCents;
    w.row(`Loyer et charges de ${formatPeriod(it.period)}`, formatEuros(it.amountCents));
  }
  w.rule(14);
  w.row("Total restant dû", formatEuros(total), true);
  w.y -= 16;
  w.text(
    `Par la présente, je vous mets en demeure de me régler la somme de ${formatEuros(total)} dans un délai de huit jours à compter de la réception de ce courrier.`,
    { gap: 10 },
  );
  w.text(
    "À défaut de règlement dans ce délai, je me verrai contraint(e) d'engager les démarches prévues par la loi, notamment la mise en jeu de la caution et/ou la délivrance d'un commandement de payer par commissaire de justice, pouvant conduire à la mise en œuvre de la clause résolutoire du bail.",
    { gap: 10 },
  );
  w.text(
    "Si vous rencontrez des difficultés, je vous invite à me contacter rapidement afin d'envisager un échéancier, et à vous rapprocher de votre CAF ou du Fonds de solidarité pour le logement (FSL) de votre département.",
    { gap: 14 },
  );
  w.text("Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.", { gap: 20 });
  w.text(d.owner.name, { bold: true });
  footer(w, "Modèle fourni à titre informatif par Quittio. Il ne constitue pas un conseil juridique personnalisé.");
  return doc.save();
}
