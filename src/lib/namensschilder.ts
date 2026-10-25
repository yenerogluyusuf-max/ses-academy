import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { qrSvg } from "@/lib/tickets";

/**
 * Namensschilder eines Moduls: Name, Region, Abzeichen (Generation bzw. Gast) und ein QR-Code mit dem Kurzcode,
 * mit dem am Einlass auch ohne Handy gescannt werden kann. Bewusst nicht der geheime Ticket-Token: der öffnet die
 * Ticket-Seite (Abmelden) und die Feedback-Umfrage; der Kurzcode reicht für den Einlass, auch offline. Acht Schilder (A7) je A4-Seite, mit Schnittlinien.
 * Läuft mit dem Admin-Client; die Route prüft vorher die Rolle.
 */
export async function namensschilderHtml(modulId: string): Promise<string | null> {
  const db = createAdminClient();
  const { data: modul } = await db
    .from("modules")
    .select("title, registrations(status, participant:participants(first_name, last_name, short_code, affiliation_status, region:regions(name), cohort:cohorts(name)))")
    .eq("id", modulId)
    .maybeSingle();
  if (!modul) return null;

  const personen = modul.registrations
    .filter((r) => r.status === "confirmed")
    .map((r) => r.participant)
    .sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`, "de"));

  const schilder = await Promise.all(personen.map(async (p) => {
    const abzeichen = p.affiliation_status === "academy_student" && p.cohort ? `SES · ${p.cohort.name}` : p.affiliation_status === "alumni" ? "SES Alumni" : "Gast";
    return `<div class="schild">
  <div class="text"><p class="kicker">SES Academy · ${esc(modul.title)}</p><p class="vorname">${esc(p.first_name)}</p><p class="nachname">${esc(p.last_name)}</p>
  <p class="zeile">${[p.region?.name, abzeichen].filter(Boolean).map((t) => esc(t!)).join(" · ")}</p></div>
  <div class="qr">${p.short_code ? await qrSvg(p.short_code) : ""}</div></div>`;
  }));
  // Vier leere Schilder für Walk-ins und Gäste
  for (let i = 0; i < 4; i++) schilder.push(`<div class="schild leer"><div class="text"><p class="kicker">SES Academy · ${esc(modul.title)}</p></div></div>`);

  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="robots" content="noindex">
<title>Namensschilder ${esc(modul.title)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #13201a; }
  .seite { width: 210mm; height: 297mm; display: grid; grid-template-columns: 105mm 105mm; grid-template-rows: repeat(4, 74.25mm); break-after: page; }
  .schild { border: 0.2mm dashed #b9b2a0; padding: 7mm 6mm; display: flex; gap: 4mm; align-items: center; overflow: hidden; }
  .text { flex: 1; min-width: 0; }
  .kicker { margin: 0 0 4mm; font-size: 7.5pt; letter-spacing: .06em; text-transform: uppercase; color: #3c4a42; }
  .vorname { margin: 0; font-size: 22pt; font-weight: bold; line-height: 1.05; overflow-wrap: anywhere; }
  .nachname { margin: 1mm 0 0; font-size: 14pt; line-height: 1.1; overflow-wrap: anywhere; }
  .zeile { margin: 4mm 0 0; font-size: 9pt; color: #3c4a42; }
  .qr { width: 30mm; flex: none; }
  .qr svg { width: 30mm; height: 30mm; display: block; }
  .druck { position: fixed; top: 12px; right: 12px; padding: 10px 18px; border-radius: 999px; border: 0; background: #13201a; color: #f3efe4; font-weight: bold; cursor: pointer; }
  @media print { .druck { display: none; } }
</style></head><body>
<button class="druck" onclick="window.print()">Drucken (A4, ohne Ränder)</button>
${Array.from({ length: Math.ceil(schilder.length / 8) }, (_, i) => `<div class="seite">${schilder.slice(i * 8, i * 8 + 8).join("")}</div>`).join("\n")}
</body></html>`;
}

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
