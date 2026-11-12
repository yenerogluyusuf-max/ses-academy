import "server-only";

import { istToken } from "@/lib/codes";
import { faltName } from "@/lib/import/namen";
import { createClient } from "@/lib/supabase/server";
import { teamLocale, type TeamSprache } from "@/lib/team-sprache";
import { jetztMs } from "@/lib/zeit";

// Teilnehmendenliste mit allen Filtern. Seite, Excel-Export und Rundmail an die Auswahl rechnen damit dieselbe Menge.
// Texte je Sprache des Team-Bereichs (Standard Deutsch); die Filterbeschreibung für die Rundmail bleibt deutsch (Freigabe).

const datumsTeile = Object.fromEntries((Object.keys(teamLocale) as TeamSprache[]).map((l) => [l, {
  tagZahl: new Intl.DateTimeFormat(teamLocale[l], { day: "numeric", timeZone: "Europe/Berlin" }),
  monat: new Intl.DateTimeFormat(teamLocale[l], { month: "short", timeZone: "Europe/Berlin" }),
}])) as Record<TeamSprache, { tagZahl: Intl.DateTimeFormat; monat: Intl.DateTimeFormat }>;

/** Spaltenkopf eines Moduls: seine Termine statt eines Kürzels, z. B. „14./15. Nov.“ (Türkisch „14/15 Kas“, Französisch „14/15 nov.“) */
export function termine(tage: { starts_at: string }[], sprache: TeamSprache = "de") {
  const { tagZahl, monat } = datumsTeile[sprache];
  const d = tage.map((t) => new Date(t.starts_at));
  const monate = [...new Set(d.map((x) => monat.format(x)))];
  if (sprache !== "de") return monate.length === 1 ? `${d.map((x) => tagZahl.format(x)).join("/")} ${monate[0]}` : d.map((x) => `${tagZahl.format(x)} ${monat.format(x)}`).join(" / ");
  return monate.length === 1 ? `${d.map((x) => tagZahl.format(x)).join("./")}. ${monate[0]}` : d.map((x) => `${tagZahl.format(x)}. ${monat.format(x)}`).join(" / ");
}

export type ModulStand = { m: string; s: string; r: string | null; d: number; q?: string };
export type Person = {
  participant_id: string; name: string; email: string | null; phone: string | null; region: string | null; mentor_name: string | null;
  branch: string | null; active: boolean; affiliation_status: string; gender: string | null; modules: ModulStand[];
  registration_status: string | null; rsvp: string | null; stay_answered: boolean; nights: string[] | null; module_contacts: number;
  last_at: string | null; last_channel: string | null; last_outcome: string | null; last_note: string | null; last_by: string | null;
};

/**
 * Punkt je Modul: da (grün), teilweise (orange), zugesagt (gelb), keine Zusage bzw. nicht gekommen (rot), abgesagt (grau).
 * Rot für „keine Zusage“ erst, wenn für das Modul Zusagen eingesammelt werden; sonst nur „angemeldet“ (hell).
 */
export function punkt(reg: ModulStand | undefined, tage: number, vorbei: boolean, zusagenLaufen: boolean, sprache: TeamSprache = "de") {
  if (!reg) return null;
  const t = punktTexte[sprache];
  if (reg.d >= tage) return { farbe: "bg-mint", text: t.alleDa };
  if (reg.d > 0) return { farbe: "bg-orange-400", text: t.teilweise(reg.d, tage) };
  if (reg.s === "excused" || reg.s === "cancelled" || reg.r === "abgesagt") return { farbe: "bg-zinc-300", text: t.abgesagt };
  if (vorbei) return { farbe: "bg-rot", text: t.nichtDa };
  if (reg.s === "waitlist") return { farbe: "bg-paper-deep ring-1 ring-line", text: t.warteliste };
  if (reg.r === "zugesagt") return { farbe: "bg-yellow-300", text: t.zugesagt };
  return zusagenLaufen ? { farbe: "bg-rot", text: t.keineZusage } : { farbe: "bg-paper-deep ring-1 ring-line", text: t.angemeldet };
}

const punktDe = {
  alleDa: "alle Tage da", teilweise: (d: number, tage: number) => `${d} von ${tage} Tagen da`, abgesagt: "abgesagt oder entschuldigt",
  nichtDa: "nicht da", warteliste: "Warteliste", zugesagt: "zugesagt", keineZusage: "noch keine Zusage",
  angemeldet: "angemeldet, Zusagen noch nicht abgefragt",
};
/** Texte der Punkte, auch für die Legende unter der Liste. */
export const punktTexte: Record<TeamSprache, typeof punktDe> = {
  de: punktDe,
  tr: {
    alleDa: "her gün geldi", teilweise: (d, tage) => `${d}/${tage} gün geldi`, abgesagt: "katılmayacak veya mazeretli",
    nichtDa: "gelmedi", warteliste: "bekleme listesi", zugesagt: "katılacak", keineZusage: "henüz cevap yok",
    angemeldet: "kayıtlı, katılım henüz sorulmadı",
  },
  fr: {
    alleDa: "présent·e tous les jours", teilweise: (d, tage) => `présent·e ${d} jour${d > 1 ? "s" : ""} sur ${tage}`, abgesagt: "ne vient pas ou excusé·e",
    nichtDa: "absent·e", warteliste: "liste d’attente", zugesagt: "vient", keineZusage: "pas encore de réponse",
    angemeldet: "inscrit·e, réponses pas encore demandées",
  },
};

// Filter für das gewählte Modul (wie früher in der Anrufliste); name je Sprache des Team-Bereichs
export const zusagen = {
  "": { name: { de: "Alle", tr: "Tümü", fr: "Tous" }, passt: () => true },
  offen: { name: { de: "Noch keine Zusage", tr: "Henüz cevap yok", fr: "Sans réponse" }, passt: (p: Person) => p.registration_status === "confirmed" && !p.rsvp },
  zugesagt: { name: { de: "Zugesagt", tr: "Katılacak", fr: "Viennent" }, passt: (p: Person) => p.rsvp === "zugesagt" },
  abgesagt: {
    name: { de: "Abgesagt", tr: "Katılmayacak", fr: "Ne viennent pas" },
    passt: (p: Person) => p.rsvp === "abgesagt" || p.registration_status === "excused" || p.registration_status === "cancelled",
  },
} as const satisfies Record<string, { name: Record<TeamSprache, string>; passt: (p: Person) => boolean }>;
export const kontakte = {
  "": { name: { de: "Kontakt: alle", tr: "İletişim: tümü", fr: "Contact\u00a0: tous" }, passt: () => true },
  offen: { name: { de: "Noch nicht kontaktiert", tr: "Henüz iletişime geçilmedi", fr: "Pas encore contacté·e" }, passt: (p: Person) => p.module_contacts === 0 },
  nachfassen: {
    name: { de: "Nicht erreicht / Rückruf", tr: "Ulaşılamadı / geri aranacak", fr: "Injoignable / à rappeler" },
    passt: (p: Person) => p.last_outcome === "nicht_erreicht" || p.last_outcome === "rueckruf",
  },
  erreicht: { name: { de: "Erreicht", tr: "Ulaşıldı", fr: "Joint·e" }, passt: (p: Person) => p.last_outcome === "erreicht" },
} as const satisfies Record<string, { name: Record<TeamSprache, string>; passt: (p: Person) => boolean }>;
export const uebernachtungen = {
  "": { name: { de: "Übernachtung: alle", tr: "Konaklama: tümü", fr: "Hébergement\u00a0: tous" }, passt: () => true },
  offen: { name: { de: "Übernachtung: keine Angabe", tr: "Konaklama: bilgi yok", fr: "Hébergement\u00a0: non renseigné" }, passt: (p: Person) => !p.stay_answered },
  ja: { name: { de: "übernachtet", tr: "konaklıyor", fr: "dort sur place" }, passt: (p: Person) => (p.nights?.length ?? 0) > 0 },
  nein: { name: { de: "übernachtet nicht", tr: "konaklamıyor", fr: "ne dort pas sur place" }, passt: (p: Person) => p.stay_answered && !p.nights?.length },
} as const satisfies Record<string, { name: Record<TeamSprache, string>; passt: (p: Person) => boolean }>;
const wahl = <T extends object>(liste: T, wert: string) => (wert in liste ? wert : "") as keyof T;

const herkunftNamen: Record<TeamSprache, { walkIn: string; guest: string; member: string; alumni: string }> = {
  de: { walkIn: "Walk-in", guest: "Gast", member: "Mitglied", alumni: "Alumni" },
  tr: { walkIn: "Kapıda kayıt", guest: "Misafir", member: "Üye", alumni: "Mezun" },
  fr: { walkIn: "Inscription sur place", guest: "Invité·e", member: "Membre", alumni: "Alumni" },
};

/** Kennzeichen für alle, die nicht zum Jahrgang gehören (Gast, Walk-in, Mitglied, Alumni). */
export function herkunft(p: Person, sprache: TeamSprache = "de"): string | null {
  const n = herkunftNamen[sprache];
  if (p.modules.some((r) => r.q === "walk_in")) return n.walkIn;
  return p.affiliation_status === "academy_student" ? null : ({ guest: n.guest, member: n.member, alumni: n.alumni } as Record<string, string>)[p.affiliation_status] ?? n.guest;
}

/** Filter aus der Adresse; dieselben Namen in Seite, Export und Rundmail. */
export const filterNamen = ["modul", "q", "region", "verantwortlich", "gt", "filter", "gruppe", "zusage", "kontakt", "uebernachtung"] as const;
export type Filter = Partial<Record<(typeof filterNamen)[number], string>>;

export function leseFilter(quelle: Record<string, string | string[] | undefined> | URLSearchParams): Filter {
  const f: Filter = {};
  for (const k of filterNamen) {
    const v = quelle instanceof URLSearchParams ? quelle.get(k) : quelle[k];
    if (typeof v === "string" && v) f[k] = v.slice(0, 200);
  }
  return f;
}

/**
 * Lädt die Liste (Rechte wie get_people: ab Orga-Team, E-Mail nur für Admin/Vorstand) und wendet die Filter an.
 * grundmenge = alles außer dem Zusage-Filter (die Zusage-Knöpfe zählen darin), liste = was angezeigt wird.
 */
export async function ladeListe(f: Filter, alles: boolean) {
  const s = (k: keyof Filter) => f[k] ?? "";
  const supabase = await createClient();
  const { data: jahrgang } = await supabase.from("cohorts").select("id,name").eq("is_current", true).maybeSingle();
  let modulAbfrage = supabase.from("modules").select("id,title,cancelled_at,module_days(id,starts_at,ends_at)").neq("status", "draft");
  if (jahrgang) modulAbfrage = modulAbfrage.eq("cohort_id", jahrgang.id);
  const { data: module } = await modulAbfrage;
  const jetzt = new Date(jetztMs()).toISOString();
  const modulListe = (module ?? [])
    .map((m) => ({ ...m, tage: [...m.module_days].sort((a, b) => a.starts_at.localeCompare(b.starts_at)) }))
    .filter((m) => m.tage.length)
    .sort((a, b) => a.tage[0].starts_at.localeCompare(b.tage[0].starts_at));
  // Vorschlag: das nächste Modul, das noch nicht vorbei ist
  const modul = modulListe.find((m) => m.id === s("modul") && istToken(s("modul")))
    ?? modulListe.find((m) => !m.cancelled_at && m.tage[m.tage.length - 1].ends_at > jetzt) ?? modulListe.at(-1);

  const { data: personen } = await supabase.rpc("get_people", { p_module_id: modul?.id });
  const alle = (personen ?? []) as unknown as Person[];
  const zusage = wahl(zusagen, s("zusage"));
  const kontakt = wahl(kontakte, s("kontakt"));
  const ueb = wahl(uebernachtungen, s("uebernachtung"));
  const gruppe = s("gruppe") === "alle" ? "alle" : s("gruppe") === "gaeste" ? "gaeste" : "jahrgang";
  const qf = faltName(s("q"));
  const ziffern = s("q").replace(/\D/g, "");
  const grundmenge = alle.filter((p) => {
    if (gruppe === "jahrgang" && p.affiliation_status !== "academy_student") return false;
    if (gruppe === "gaeste" && !herkunft(p)) return false;
    // Suche: Name/E-Mail, oder bei Ziffern die Telefonnummer (faltName behält keine Ziffern),
    // z. B. „0176 123“ findet „+49 176 123…“
    const telefonTreffer = ziffern.length >= 3 && (p.phone ?? "").replace(/\D/g, "").replace(/^(49|90|43|41)/, "0").includes(ziffern.replace(/^(00)?(49|90|43|41)/, "0"));
    const nameTreffer = Boolean(qf) && faltName(`${p.name} ${p.email ?? ""}`).includes(qf);
    if ((qf || ziffern.length >= 3) && !telefonTreffer && !nameTreffer) return false;
    if (s("region") && (p.region ?? "-") !== s("region")) return false;
    if (s("verantwortlich") && (p.mentor_name ?? "-") !== s("verantwortlich")) return false;
    if (s("gt") && p.branch !== s("gt")) return false;
    if (s("filter") === "ohne-mail" && (!alles || p.email)) return false;
    if (s("filter") === "ohne-telefon" && p.phone) return false;
    if (!kontakte[kontakt].passt(p) || !uebernachtungen[ueb].passt(p)) return false;
    return s("filter") === "inaktiv" ? !p.active : p.active;
  });
  const liste = grundmenge.filter(zusagen[zusage].passt);
  return { jahrgang, modulListe, modul, jetzt, alle, grundmenge, liste, zusage, kontakt, ueb, gruppe };
}

/**
 * Lesbare Beschreibung der gesetzten Filter (für Export-Dateiname und Rundmail-Antrag). Bleibt deutsch: Sie landet in
 * der Freigabe-Beschreibung, die die Datenbank auf Deutsch baut (create_approval) und eine zweite Person liest.
 */
export function filterBeschreibung(f: Filter, modulTitel: string | null): string {
  const teile: string[] = [];
  if (f.gruppe === "alle") teile.push("mit Gästen und Walk-ins");
  else if (f.gruppe === "gaeste") teile.push("nur Gäste und Walk-ins");
  if (f.q) teile.push(`Suche „${f.q}“`);
  if (f.region) teile.push(f.region === "-" ? "ohne Region" : `Region ${f.region}`);
  if (f.verantwortlich) teile.push(f.verantwortlich === "-" ? "ohne Sorumlu" : `Sorumlu ${f.verantwortlich}`);
  if (f.gt) teile.push(f.gt);
  if (f.filter === "ohne-mail") teile.push("ohne E-Mail");
  if (f.filter === "ohne-telefon") teile.push("ohne Telefon");
  if (f.filter === "inaktiv") teile.push("ausgeschieden");
  const zusage = f.zusage && f.zusage in zusagen ? zusagen[f.zusage as keyof typeof zusagen].name.de : null;
  const kontakt = f.kontakt && f.kontakt in kontakte ? kontakte[f.kontakt as keyof typeof kontakte].name.de : null;
  const ueb = f.uebernachtung && f.uebernachtung in uebernachtungen ? uebernachtungen[f.uebernachtung as keyof typeof uebernachtungen].name.de : null;
  if (modulTitel && (zusage || kontakt || ueb)) teile.push([modulTitel, zusage, kontakt, ueb].filter(Boolean).join(", "));
  return teile.join(" · ");
}
