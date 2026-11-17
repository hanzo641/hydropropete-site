/* ================== Devis instantané : logique du flux ================== */
const CONFIG = {
  calendlyUrl: "https://calendly.com/hydroproprete/reservation",
  color: "2B4D7F",
  phone: "06 02 16 92 36", email: "hydroproprete@gmail.com"
};
const SERVICES = [
  {id:"canape2", name:"Canapé 2 ou 3 places", price:80, kind:"count"},
  {id:"canape4", name:"Canapé 4-5 places ou d'angle", price:110, kind:"count"},
  {id:"fauteuil", name:"Fauteuil", price:50, kind:"count"},
  {id:"matelas1", name:"Matelas 1 place", price:60, kind:"count"},
  {id:"matelas2", name:"Matelas 2 places", price:90, kind:"count"},
  {id:"tapis", name:"Tapis", label:"50 à 120 € selon la taille", kind:"count"},
  {id:"vitres", name:"Vitres", label:"Dès 60 €, tarif au pan", kind:"windows"},
  {id:"menage", name:"Ménage et entretien", label:"35 € de l'heure", kind:"toggle"},
  {id:"logement", name:"Départ locataire, remise en état", label:"Sur devis", kind:"toggle"},
  {id:"autre", name:"Autre demande", label:"Sur devis", kind:"toggle"},
  {id:"copro", name:"Entretien de copropriété", label:"Sur devis", kind:"toggle", group:"autres"},
  {id:"bureaux", name:"Nettoyage de bureaux", label:"Sur devis", kind:"toggle", group:"autres"},
  {id:"terrasse", name:"Nettoyage de terrasse", label:"Sur devis", kind:"toggle", group:"autres"},
  {id:"chantier", name:"Fin de chantier", label:"Sur devis", kind:"toggle", group:"autres"},
  {id:"remiseetat2", name:"Remise en état de logement", label:"Sur devis", kind:"toggle", group:"autres"},
  {id:"debarras", name:"Débarras", label:"Sur devis", kind:"toggle", group:"autres"},
  {id:"extreme", name:"Nettoyage extrême", label:"Sur devis", kind:"toggle", group:"autres"}
];
/* ============================================================ */

const $ = (id) => document.getElementById(id);
const qty = {};
const WIN = [
  {id:"classic", name:"Fenêtre classique", sub:"Moins de 1 m², 2,50 € le pan", price:2.5, label:["fenêtre","fenêtres"]},
  {id:"porte", name:"Porte-fenêtre", sub:"De 1 à 2 m², 4 € le pan", price:4, label:["porte-fenêtre","portes-fenêtres"]},
  {id:"baie", name:"Baie vitrée", sub:"De 2 à 4 m², 6 € le pan", price:6, label:["baie vitrée","baies vitrées"]},
  {id:"velux", name:"Fenêtre de toit", sub:"Accessible, 5 € l'unité", price:5, label:["fenêtre de toit","fenêtres de toit"]}
];
const win = {classic:0, porte:0, baie:0, velux:0};
const WIN_MIN = 60;
const winRaw = (o) => WIN.reduce((a,w) => a + w.price*o[w.id], 0);
const winPrice = (o) => { const t = winRaw(o); return t > 0 ? Math.max(WIN_MIN, t) : 0; };
const winTotal = () => winPrice(win);
const winText = () => WIN.filter(w => win[w.id]).map(w => win[w.id] + " " + w.label[win[w.id]>1?1:0]).join(", ");
const eur = (n) => (Math.round(n*100)/100).toLocaleString("fr-FR",{minimumFractionDigits:n%1?2:0,maximumFractionDigits:2}) + " €";
const chosen = () => SERVICES.filter(s => (qty[s.id]||0) > 0);

function track(name, params){ if (typeof trackEvent === 'function') trackEvent(name, params || {}); }

function estimate(){
  const units = [];
  chosen().forEach(x => { if (x.price) for (let i=0;i<qty[x.id];i++) units.push(x.price); });
  units.sort((a,b)=>b-a);
  const total = units.reduce((a,p)=>a+p,0), disc = units.length > 1 ? units[1]/2 : 0;
  const w = qty.vitres ? winTotal() : 0;
  return {total, disc, w, net: total-disc+w, quote: chosen().some(x => !x.price && x.id !== "vitres"), count: units.length + (w > 0 ? 1 : 0)};
}

function renderSvcs(){
  const box = $("svcs"); box.textContent = "";
  let dividerDone = false;
  SERVICES.forEach(s => {
    if (s.group === "autres" && !dividerDone){
      const div = document.createElement("div"); div.className = "qd-svc-divider"; div.textContent = "Autres prestations";
      box.append(div); dividerDone = true;
    }
    const q = qty[s.id]||0;
    const card = document.createElement("div"); card.className = "qd-svc" + (q ? " qd-on" : "");
    const t = document.createElement("div"); t.className = "qd-t";
    const n = document.createElement("div"); n.className = "qd-n"; n.textContent = s.name;
    const p = document.createElement("div"); p.className = "qd-p"; p.textContent = s.price ? eur(s.price) : s.label;
    t.append(n,p); card.append(t);
    if (s.kind === "windows"){
      if (q) p.textContent = winText() + " · " + eur(winTotal());
      const b = document.createElement("button"); b.type = "button"; b.className = "qd-tog";
      b.setAttribute("aria-label", (q ? "Modifier " : "Choisir ") + "les vitres"); b.textContent = q ? "Modifier" : "Choisir";
      b.onclick = openWin; card.append(b);
    } else if (s.kind === "toggle"){
      const b = document.createElement("button"); b.type = "button"; b.className = "qd-tog";
      b.setAttribute("aria-pressed", q ? "true" : "false"); b.textContent = q ? "Ajouté" : "Ajouter";
      b.setAttribute("aria-label", (q ? "Retirer " : "Ajouter ") + s.name);
      b.onclick = () => {
        const turningOn = !q;
        qty[s.id] = q ? 0 : 1;
        if (turningOn) track('quote_widget_select', { service_name: s.name, price: 0 });
        changed();
      };
      card.append(b);
    } else {
      const w = document.createElement("div"); w.className = "qd-qty";
      const mi = document.createElement("button"); mi.type = "button"; mi.textContent = "−"; mi.disabled = !q; mi.setAttribute("aria-label","Retirer un : "+s.name);
      const o = document.createElement("output"); o.textContent = q;
      const pl = document.createElement("button"); pl.type = "button"; pl.textContent = "+"; pl.disabled = q >= 9; pl.setAttribute("aria-label","Ajouter un : "+s.name);
      mi.onclick = () => { qty[s.id] = Math.max(0,q-1); changed(); };
      pl.onclick = () => {
        const wasZero = !q;
        qty[s.id] = Math.min(9,q+1);
        if (wasZero) track('quote_widget_select', { service_name: s.name, price: s.price || 0 });
        changed();
      };
      w.append(mi,o,pl); card.append(w);
    }
    box.append(card);
  });
}

function renderEstimate(){
  const e = estimate(), box = $("estimate"); box.textContent = "";
  if (!chosen().length){ box.hidden = true; return; }
  box.hidden = false;
  const add = (html) => { const d = document.createElement("div"); d.innerHTML = html; box.append(d); };
  if (e.count){
    if (e.disc) add("Remise de 50 % sur le 2e article : <b>− "+eur(e.disc)+"</b>");
    if (e.w) add("Vitres : <b>"+eur(e.w)+"</b>" + (winRaw(win) < WIN_MIN ? " (minimum d'intervention)" : " (tarif au pan)"));
    add("Estimation : <b>"+eur(e.net)+"</b>"+(e.quote ? " + prestations sur devis" : "")+" · déplacement inclus à Pau");
    add("Après crédit d'impôt de 50 % (domicile personnel) : <b>"+eur(e.net/2)+"</b>"+(e.quote ? " + prestations sur devis" : ""));
  } else {
    add("Les prestations choisies se chiffrent sur devis : je vous réponds avec un tarif précis après votre rendez-vous ou sur photos.");
  }
}

function summaryRows(){
  const rows = [];
  rows.push(["Prestations", chosen().map(s => s.id==="vitres" ? "Vitres (" + winText() + ")" : (s.kind==="count" ? qty[s.id]+" × " : "") + s.name).join(", ") || "Aucune pour l'instant"]);
  const e = estimate();
  if (chosen().length && e.count) rows.push(["Estimation", eur(e.net) + (e.quote ? " + devis" : "") + " (" + eur(e.net/2) + " après crédit d'impôt)"]);
  rows.push(["Avance immédiate", $("f-credit").checked ? "Oui" : "Non"]);
  return rows;
}
function fillDl(dl, rows){
  dl.textContent = "";
  rows.forEach(([k,v]) => { const a = document.createElement("dt"), b = document.createElement("dd"); a.textContent = k; b.textContent = v; dl.append(a,b); });
}
function renderRecap(){ fillDl($("recap"), summaryRows()); $("credit-box").classList.toggle("qd-on", $("f-credit").checked); $("credit-info").hidden = !$("f-credit").checked; }
function renderBubble(){
  const b = $("bubble"), info = $("bubble-info"), e = estimate(), show = chosen().length > 0 && !$("steps").hidden;
  b.hidden = !show; document.body.classList.toggle("has-bubble", show);
  if (!show) return;
  info.textContent = "";
  const col = (cls, label, value, sub) => {
    const d = document.createElement("div"); d.className = cls;
    const a = document.createElement("small"); a.textContent = label;
    const v = document.createElement("strong"); v.textContent = value;
    d.append(a, v);
    if (sub){ const c = document.createElement("small"); c.textContent = sub; d.append(c); }
    return d;
  };
  if (e.count){
    const plus = e.quote ? " + devis" : "";
    info.append(col("qd-l", "Total estimé", eur(e.net) + plus, e.disc ? "remise 2e article incluse" : "déplacement inclus à Pau"),
             col("qd-r", "Avec l'avance immédiate", eur(e.net/2) + plus, "vous payez la moitié"));
  } else {
    info.append(col("qd-l", "Total estimé", "Sur devis", "tarif précis après votre demande"),
             col("qd-r", "Avance immédiate", "50 %", "vous payez la moitié"));
  }
}
function changed(){ renderSvcs(); renderEstimate(); renderRecap(); renderBubble(); $("e-svc").textContent = ""; }

function validate(){
  let ok = true, first = null;
  ["f-firstname","f-lastname","f-phone","f-email","f-addr"].forEach(i => $(i).removeAttribute("aria-invalid"));
  ["e-svc","e-firstname","e-lastname","e-phone","e-email","e-addr","e-send"].forEach(i => $(i).textContent = "");
  const bad = (err, msg, el) => { ok = false; $(err).textContent = msg; if (el) el.setAttribute("aria-invalid","true"); if (!first) first = el || $(err); };
  if (!chosen().length) bad("e-svc","Ajoutez au moins une prestation.");
  if ($("f-firstname").value.trim().length < 2) bad("e-firstname","Indiquez votre prénom.",$("f-firstname"));
  if ($("f-lastname").value.trim().length < 2) bad("e-lastname","Indiquez votre nom.",$("f-lastname"));
  if (($("f-phone").value.match(/\d/g)||[]).length < 9) bad("e-phone","Numéro de téléphone incomplet.",$("f-phone"));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test($("f-email").value.trim())) bad("e-email","Adresse email invalide.",$("f-email"));
  if ($("f-addr").value.trim().length < 8) bad("e-addr","Indiquez l'adresse complète (rue, code postal, ville).",$("f-addr"));
  if (first && first.scrollIntoView) first.scrollIntoView({behavior:"smooth",block:"center"});
  return ok;
}

function fullName(){ return ($("f-firstname").value.trim() + " " + $("f-lastname").value.trim()).trim(); }
/* texte transmis à Calendly (question personnalisée n°5 : "Détail du devis") */
function recapText(){
  const L = [];
  summaryRows().forEach(([k,v]) => L.push(k + " : " + v));
  L.push("Téléphone : " + $("f-phone").value.trim(), "Adresse : " + $("f-addr").value.trim());
  const m = $("f-msg").value.trim(); if (m) L.push("Précisions : " + m);
  return L.join("\n");
}
/* Questions personnalisées Calendly (ordre réel du formulaire, vérifié en direct) :
   a1 = Votre Adresse, a2 = Numéro de téléphone, a3 = Quel est le problème rencontré, a4 = Détail du devis.
   (La question "Quel type de nettoyage" a été supprimée côté Calendly, ce qui a décalé les suivantes d'un cran.) */
function calendlyAnswers(){
  const answers = { a1: $("f-addr").value.trim(), a2: $("f-phone").value.trim(), a4: recapText() };
  const m = $("f-msg").value.trim(); if (m) answers.a3 = m;
  return answers;
}
function calendlyLink(){
  const u = new URL(CONFIG.calendlyUrl);
  u.searchParams.set("name", fullName());
  u.searchParams.set("email", $("f-email").value.trim());
  Object.entries(calendlyAnswers()).forEach(([k,v]) => u.searchParams.set(k, v));
  u.searchParams.set("hide_gdpr_banner","1"); u.searchParams.set("primary_color", CONFIG.color);
  return u.toString();
}

function loadCalendly(cb){
  if (window.Calendly) return cb(true);
  const s = document.createElement("script"); s.src = "https://assets.calendly.com/assets/external/widget.js"; s.async = true;
  s.onload = () => cb(!!window.Calendly); s.onerror = () => cb(false); document.head.append(s);
}
function showFallback(){
  const el = $("cal"); el.textContent = ""; el.style.minHeight = "0";
  const fb = $("cal-fallback"); fb.hidden = false; fb.textContent = "";
  const p = document.createElement("span"); p.textContent = "Le calendrier ne s'affiche pas ici. ";
  const a = document.createElement("a"); a.className = "qd-btn2"; a.href = calendlyLink(); a.target = "_blank"; a.rel = "noopener"; a.textContent = "Ouvrir mon agenda pour réserver";
  fb.append(p,document.createElement("br"),a);
  const num = document.createElement("p"); num.className = "qd-hint"; num.textContent = "Besoin d'aide ? " + CONFIG.phone + " · " + CONFIG.email;
  fb.append(num);
}
function openCalendar(){
  $("steps").hidden = true; $("calstep").hidden = false; $("booked").hidden = true; $("credit-note").hidden = !$("f-credit").checked; renderBubble();
  fillDl($("recap2"), summaryRows().concat([["Nom",fullName()],["Téléphone",$("f-phone").value.trim()],["Email",$("f-email").value.trim()],["Adresse",$("f-addr").value.trim()]]));
  const el = $("cal"); el.textContent = ""; el.style.minHeight = "760px"; $("cal-fallback").hidden = true;
  const timer = setTimeout(() => { if (!el.querySelector("iframe")) showFallback(); }, 8000);
  loadCalendly(ok => {
    if (!ok){ clearTimeout(timer); showFallback(); return; }
    try {
      window.Calendly.initInlineWidget({
        url: CONFIG.calendlyUrl + (CONFIG.calendlyUrl.includes("?") ? "&" : "?") + "hide_gdpr_banner=1&primary_color=" + CONFIG.color,
        parentElement: el,
        prefill: {
          name: fullName(), firstName: $("f-firstname").value.trim(), lastName: $("f-lastname").value.trim(),
          email: $("f-email").value.trim(), customAnswers: calendlyAnswers()
        }
      });
    } catch(e){ showFallback(); }
  });
  $("calstep").scrollIntoView({behavior:"smooth",block:"start"});
}

let tmp = null;
const dlg = $("win-dlg");
function renderWin(){
  const box = $("win-rows"); box.textContent = "";
  WIN.forEach(w => {
    const q = tmp[w.id], row = document.createElement("div"); row.className = "qd-wrow" + (q ? " qd-on" : "");
    const t = document.createElement("div"); const n = document.createElement("div"); n.style.fontWeight = "700"; n.textContent = w.name;
    const sub = document.createElement("div"); sub.className = "qd-wsub"; sub.textContent = w.sub; t.append(n,sub);
    const wq = document.createElement("div"); wq.className = "qd-qty";
    const mi = document.createElement("button"); mi.type = "button"; mi.textContent = "−"; mi.disabled = !q; mi.setAttribute("aria-label","Retirer : "+w.name);
    const o = document.createElement("output"); o.textContent = q;
    const pl = document.createElement("button"); pl.type = "button"; pl.textContent = "+"; pl.disabled = q >= 40; pl.setAttribute("aria-label","Ajouter : "+w.name);
    mi.onclick = () => { tmp[w.id] = Math.max(0,q-1); renderWin(); };
    pl.onclick = () => { tmp[w.id] = Math.min(40,q+1); renderWin(); };
    wq.append(mi,o,pl); row.append(t,wq); box.append(row);
  });
  const raw = winRaw(tmp);
  $("win-total").textContent = eur(winPrice(tmp));
  $("win-note").textContent = raw > 0 && raw < WIN_MIN ? "Détail : " + eur(raw) + ". Un minimum d'intervention de " + eur(WIN_MIN) + " s'applique, déplacement inclus." : "Déplacement inclus à Pau.";
  $("win-ok").disabled = !WIN.some(w => tmp[w.id] > 0);
}
function openWin(){
  tmp = Object.assign({}, win); renderWin();
  $("win-remove").hidden = !qty.vitres;
  if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open","");
}
function closeWin(){ if (dlg.close) dlg.close(); else dlg.removeAttribute("open"); }
$("win-ok").onclick = () => {
  Object.assign(win, tmp); qty.vitres = 1; closeWin();
  track('quote_widget_select', { service_name: "Nettoyage de vitres", price: winTotal() });
  changed();
};
$("win-cancel").onclick = closeWin;
$("win-remove").onclick = () => { WIN.forEach(w => win[w.id] = 0); qty.vitres = 0; closeWin(); changed(); };
dlg.addEventListener("click", (ev) => { if (ev.target === dlg) closeWin(); });

window.addEventListener("message", (ev) => {
  if (ev.origin !== "https://calendly.com" || !ev.data || !ev.data.event) return;
  if (ev.data.event === "calendly.page_height") {
    const h = Number(ev.data.payload && ev.data.payload.height || ev.data.payload);
    if (h) $("cal").style.height = Math.max(760, Math.ceil(h)) + "px";
    return;
  }
  if (ev.data.event !== "calendly.event_scheduled") return;
  track('generate_lead', { method: 'calendly' });
  const b = $("booked"); b.hidden = false;
  b.textContent = "Rendez-vous confirmé ! Vous recevez un email de confirmation." + ($("f-credit").checked ? " Vous allez aussi recevoir un email d'Abby pour votre avance immédiate : pensez à vérifier vos spams." : " À très vite.");
  b.scrollIntoView({behavior:"smooth",block:"center"});
});

$("bubble-cta").onclick = () => { $("h-info").scrollIntoView({behavior:"smooth",block:"start"}); $("f-firstname").focus({preventScroll:true}); };
$("ph-hint").textContent = CONFIG.phone;
$("f-credit").addEventListener("change", renderRecap);
$("edit").onclick = () => { $("calstep").hidden = true; $("steps").hidden = false; renderBubble(); $("steps").scrollIntoView({behavior:"smooth",block:"start"}); };
$("form").addEventListener("submit", (ev) => { ev.preventDefault(); if (validate()) openCalendar(); });
changed();
