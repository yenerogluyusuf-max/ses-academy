import "server-only";

import { kurzcodeAnzeige } from "@/lib/codes";
import { anmeldestatus } from "@/lib/einlass";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Notfall-Liste für den Einlass auf Papier: alle Angemeldeten eines Moduls mit Kurzcode und einem Kästchen je Tag,
 * dazu die Leitung vor Ort aus dem Rollenplan. Enthält keine Kontaktdaten der Teilnehmenden.
 * Läuft mit dem Admin-Client, weil auch das nächtliche Skript ohne Anmeldung sie erzeugt; die Seite prüft vorher die Rolle.
 */
export async function ladeNotfallListe(modulId: string) {
  const db = createAdminClient();
  const { data: modul } = await db
    .from("modules")
    .select("id, slug, title, location, module_days(id, day, starts_at, label), registrations(status, participant:participants(first_name, last_name, short_code))")
    .eq("id", modulId)
    .maybeSingle();
  if (!modul) return null;
  const tage = [...modul.module_days].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const personen = modul.registrations
    .filter((r) => r.status === "confirmed" || r.status === "waitlist")
    .map((r) => ({ name: `${r.participant.last_name}, ${r.participant.first_name}`.replace(/^, /, ""), code: r.participant.short_code ?? "", status: r.status }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
  const { data: leitung } = await db
    .from("duty_assignments")
    .select("person_name, phone, task, module_day_id")
    .in("module_day_id", tage.map((t) => t.id))
    .eq("is_lead", true);
  return { modul, tage, personen, leitung: leitung ?? [] };
}

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const tagKurz = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "numeric", timeZone: "Europe/Berlin" });
const stand = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" });

/** Druckfertiges HTML (A4 hoch). Wird im Browser gedruckt oder vom Skript als PDF gespeichert. */
export function notfallHtml(d: NonNullable<Awaited<ReturnType<typeof ladeNotfallListe>>>, mitDruckknopf = false): string {
  const kopf = d.tage.map((t) => `<th class="tag">${esc(tagKurz.format(new Date(t.starts_at)))}</th>`).join("");
  const zeilen = d.personen.map((p, i) => `<tr><td class="nr">${i + 1}</td><td>${esc(p.name)}${p.status === "waitlist" ? ` <span class="hinweis">(${esc(anmeldestatus.waitlist)})</span>` : ""}</td><td class="code">${esc(kurzcodeAnzeige(p.code))}</td>${d.tage.map(() => '<td class="kasten"><span></span></td>').join("")}</tr>`).join("");
  const leitung = d.leitung.length
    ? d.leitung.map((l) => {
      const tag = d.tage.find((t) => t.id === l.module_day_id);
      return `${tag ? esc(tagKurz.format(new Date(tag.starts_at))) + ": " : ""}<strong>${esc(l.person_name)}</strong>${l.phone ? ` · ${esc(l.phone)}` : ""}`;
    }).join("<br>")
    : "Im Rollenplan ist noch niemand als Leitung eingetragen.";
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="robots" content="noindex">
<title>Notfall-Liste ${esc(d.modul.title)}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #13201a; font-size: 11pt; margin: 0; }
  h1 { font-size: 18pt; margin: 0 0 4px; }
  .meta { color: #3c4a42; margin: 0 0 10px; font-size: 10pt; }
  .box { border: 1.5px solid #13201a; border-radius: 8px; padding: 8px 10px; margin: 0 0 12px; font-size: 10pt; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  th, td { border-bottom: 1px solid #c9c2b0; padding: 4px 6px; text-align: left; }
  th { font-size: 8.5pt; text-transform: uppercase; letter-spacing: .04em; color: #3c4a42; }
  tr { break-inside: avoid; }
  .nr { width: 26px; color: #3c4a42; }
  .code { font-family: Menlo, Consolas, monospace; font-size: 12pt; letter-spacing: .06em; white-space: nowrap; }
  .tag, .kasten { width: 52px; text-align: center; }
  .kasten span { display: inline-block; width: 14px; height: 14px; border: 1.5px solid #13201a; border-radius: 3px; }
  .hinweis { color: #3c4a42; font-size: 9pt; }
  .druck { position: fixed; top: 12px; right: 12px; padding: 10px 18px; border-radius: 999px; border: 0; background: #13201a; color: #f3efe4; font-weight: bold; cursor: pointer; }
  @media print { .druck { display: none; } }
</style></head><body>
${mitDruckknopf ? '<button class="druck" onclick="window.print()">Drucken / als PDF sichern</button>' : ""}
<h1>Notfall-Liste · ${esc(d.modul.title)}</h1>
<p class="meta">${d.modul.location ? esc(d.modul.location) + " · " : ""}${d.personen.length} Angemeldete · Stand ${esc(stand.format(new Date()))}</p>
<div class="box"><strong>Wenn Server oder WLAN ausfallen:</strong> Einlass auf dieser Liste abhaken, Walk-ins unten mit Namen notieren. Später im Teambereich nachtragen.<br>
<strong>Entscheidet vor Ort:</strong><br>${leitung}</div>
<table><thead><tr><th class="nr">#</th><th>Name</th><th>Kurzcode</th>${kopf}</tr></thead><tbody>${zeilen}</tbody></table>
<h2 style="font-size:12pt;margin:18px 0 6px">Walk-ins (Name, E-Mail, Tag)</h2>
<table><tbody>${Array.from({ length: 12 }, () => `<tr><td style="height:22px"></td></tr>`).join("")}</tbody></table>
</body></html>`;
}
