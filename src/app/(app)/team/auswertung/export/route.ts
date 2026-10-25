import { requireStaff } from "@/lib/auth";
import { istToken } from "@/lib/codes";
import { createClient } from "@/lib/supabase/server";
import { ladeAuswertung, leseFilter } from "@/lib/auswertung";
import { zugehoerigkeit } from "@/lib/einlass";

/**
 * CSV für Excel (Semikolon, UTF-8 mit BOM). Nur admin/vorstand; enthält E-Mail-Adressen.
 * Vier-Augen-Prinzip: nur mit freigegebenem Antrag (?freigabe=<id>), einmal, innerhalb von 24 Stunden.
 */
export async function GET(request: Request) {
  await requireStaff("alles");
  const freigabe = new URL(request.url).searchParams.get("freigabe") ?? "";
  if (!istToken(freigabe)) return new Response("Export nur nach Freigabe durch eine zweite Person (Team → Freigaben).", { status: 403 });
  const supabase = await createClient();
  const { data: antwort } = await supabase.rpc("claim_approval", { p_id: freigabe, p_action: "export" });
  const a = antwort as { result: string; payload?: { filter?: Record<string, string> } } | null;
  if (a?.result !== "ok") return new Response(`Kein gültiger Export-Antrag (${a?.result ?? "Fehler"}).`, { status: 403 });
  const sp = a.payload?.filter ?? {};
  const { personen } = await ladeAuswertung(leseFilter(sp));
  const zelle = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    // Formeln in Excel verhindern (=, +, -, @ am Anfang) und Anführungszeichen maskieren
    const sicher = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[;"\n]/.test(sicher) ? `"${sicher.replace(/"/g, '""')}"` : sicher;
  };
  const kopf = ["Vorname", "Nachname", "E-Mail", "Zugehörigkeit", "Region", "Module angemeldet", "Tage da", "Tage verpasst",
    "Module entschuldigt/abgemeldet", "Quote %", "Aktuelle Serie", "Rekord-Serie", "Zuletzt verpasst in Folge", "Letzte Teilnahme", "Letztes Modul"];
  const zeilen = personen.map((p) => [
    p.vorname, p.nachname, p.email, zugehoerigkeit[p.zugehoerigkeit], p.region, p.total_registered, p.total_attended, p.total_no_shows,
    p.total_cancelled_or_excused, p.attendance_rate?.toString().replace(".", ","), p.current_streak, p.longest_streak, p.trailing_misses,
    p.last_attended_at ? new Date(p.last_attended_at).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" }) : "", p.last_attended_title,
  ]);
  const csv = "﻿" + [kopf, ...zeilen].map((z) => z.map(zelle).join(";")).join("\r\n");
  const tag = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ses-auswertung-${tag}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
