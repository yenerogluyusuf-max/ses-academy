import { requireStaff } from "@/lib/auth";
import { istToken } from "@/lib/codes";
import { createClient } from "@/lib/supabase/server";
import { ladeAuswertung, leseFilter } from "@/lib/auswertung";
import { zugehoerigkeit } from "@/lib/einlass";
import { teamLocale, type TeamSprache } from "@/lib/team-sprache";

/** Spaltenköpfe, Zugehörigkeit, Meldungen und Dateiname in der Sprache des Teamkontos. */
const T: Record<TeamSprache, { kopf: string[]; zugehoerigkeit: Record<string, string>; ohneFreigabe: string; ungueltig: (grund: string) => string; fehler: string; datei: string }> = {
  de: {
    kopf: ["Vorname", "Nachname", "E-Mail", "Zugehörigkeit", "Region", "Module angemeldet", "Tage da", "Tage verpasst",
      "Module entschuldigt/abgemeldet", "Quote %", "Aktuelle Serie", "Rekord-Serie", "Zuletzt verpasst in Folge", "Letzte Teilnahme", "Letztes Modul"],
    zugehoerigkeit,
    ohneFreigabe: "Export nur nach Freigabe durch eine zweite Person (Team → Freigaben).",
    ungueltig: (grund) => `Kein gültiger Export-Antrag (${grund}).`,
    fehler: "Fehler",
    datei: "ses-auswertung",
  },
  tr: {
    kopf: ["Ad", "Soyad", "E-posta", "Statü", "Bölge", "Kayıtlı modül", "Geldiği gün", "Kaçırdığı gün",
      "Mazeretli/iptal modül", "Oran %", "Güncel seri", "Rekor seri", "Son art arda kaçırılan", "Son katılım", "Son modül"],
    zugehoerigkeit: { member: "Üye", academy_student: "Academy katılımcısı", guest: "Misafir", alumni: "Mezun" },
    ohneFreigabe: "Dışa aktarma yalnızca ikinci bir kişinin onayından sonra mümkün (Ekip → Onaylar).",
    ungueltig: (grund) => `Geçerli bir dışa aktarma talebi yok (${grund}).`,
    fehler: "hata",
    datei: "ses-degerlendirme",
  },
  fr: {
    kopf: ["Prénom", "Nom", "E-mail", "Catégorie", "Région", "Modules inscrits", "Jours présents", "Jours manqués",
      "Modules excusés/désinscrits", "Taux %", "Série actuelle", "Série record", "Manqués d’affilée récemment", "Dernière présence", "Dernier module"],
    zugehoerigkeit: { member: "Membre", academy_student: "Participant·e de l’Academy", guest: "Invité·e", alumni: "Alumni" },
    ohneFreigabe: "Export uniquement après validation par une deuxième personne (Équipe → Validations).",
    ungueltig: (grund) => `Aucune demande d’export valide (${grund}).`,
    fehler: "erreur",
    datei: "ses-analyse",
  },
};

/**
 * CSV für Excel (Semikolon, UTF-8 mit BOM). Nur admin/vorstand; enthält E-Mail-Adressen.
 * Vier-Augen-Prinzip: nur mit freigegebenem Antrag (?freigabe=<id>), einmal, innerhalb von 24 Stunden.
 */
export async function GET(request: Request) {
  const l = (await requireStaff("alles")).sprache;
  const t = T[l];
  const freigabe = new URL(request.url).searchParams.get("freigabe") ?? "";
  if (!istToken(freigabe)) return new Response(t.ohneFreigabe, { status: 403 });
  const supabase = await createClient();
  const { data: antwort } = await supabase.rpc("claim_approval", { p_id: freigabe, p_action: "export" });
  const a = antwort as { result: string; payload?: { filter?: Record<string, string> } } | null;
  if (a?.result !== "ok") return new Response(t.ungueltig(a?.result ?? t.fehler), { status: 403 });
  const sp = a.payload?.filter ?? {};
  const { personen } = await ladeAuswertung(leseFilter(sp));
  const zelle = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    // Formeln in Excel verhindern (=, +, -, @ am Anfang) und Anführungszeichen maskieren
    const sicher = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[;"\n]/.test(sicher) ? `"${sicher.replace(/"/g, '""')}"` : sicher;
  };
  const kopf = t.kopf;
  const zeilen = personen.map((p) => [
    p.vorname, p.nachname, p.email, t.zugehoerigkeit[p.zugehoerigkeit], p.region, p.total_registered, p.total_attended, p.total_no_shows,
    p.total_cancelled_or_excused, p.attendance_rate?.toString().replace(".", ","), p.current_streak, p.longest_streak, p.trailing_misses,
    p.last_attended_at ? new Date(p.last_attended_at).toLocaleDateString(teamLocale[l], { timeZone: "Europe/Berlin" }) : "", p.last_attended_title,
  ]);
  const csv = "﻿" + [kopf, ...zeilen].map((z) => z.map(zelle).join(";")).join("\r\n");
  const tag = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${t.datei}-${tag}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
