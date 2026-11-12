import { darf, requireStaff } from "@/lib/auth";
import { csvAntwort } from "@/lib/csv";
import { herkunft, ladeListe, leseFilter, punkt, termine } from "@/lib/teilnehmende-liste";
import { teamLocale, type TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";
import { nachtName } from "@/lib/uebernachtung";

// Spaltenköpfe und erzeugte Werte in der Sprache des Teamkontos; Aufbau (Spalten, Reihenfolge, Semikolon, BOM) wie bisher.
const de = {
  datei: "Teilnehmende",
  kopf: {
    name: "Name", herkunft: "Herkunft", telefon: "Telefon", email: "E-Mail", region: "Region", sorumlu: "Sorumlu", gt: "GT/KGT",
    anmeldung: "Anmeldung", zusage: "Zusage", uebernachtung: "Übernachtung", letzterKontakt: "Letzter Kontakt", ergebnis: "Ergebnis", notiz: "Notiz", aktiv: "Aktiv",
  },
  modulSpalte: (modul: string, spalte: string) => `${modul}: ${spalte}`,
  jahrgang: "Jahrgang",
  nichtAngemeldet: "nicht angemeldet",
  keineAngabe: "keine Angabe",
  nein: "nein",
  ergebnis: { erreicht: "erreicht", nicht_erreicht: "nicht erreicht", rueckruf: "Rückruf" } as Record<string, string>,
  notiz: "Notiz",
  ja: "ja",
  ausgeschieden: "ausgeschieden",
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    datei: "Katılımcılar",
    kopf: {
      name: "Ad Soyad", herkunft: "Katılım türü", telefon: "Telefon", email: "E-posta", region: "Bölge", sorumlu: "Sorumlu", gt: "GT/KGT",
      anmeldung: "Kayıt", zusage: "Katılım cevabı", uebernachtung: "Konaklama", letzterKontakt: "Son iletişim", ergebnis: "Sonuç", notiz: "Not", aktiv: "Aktif",
    },
    modulSpalte: (modul, spalte) => `${modul}: ${spalte}`,
    jahrgang: "Dönem",
    nichtAngemeldet: "kayıtlı değil",
    keineAngabe: "bilgi yok",
    nein: "hayır",
    ergebnis: { erreicht: "ulaşıldı", nicht_erreicht: "ulaşılamadı", rueckruf: "geri aranacak" },
    notiz: "Not",
    ja: "evet",
    ausgeschieden: "ayrıldı",
  },
  fr: {
    datei: "Participants",
    kopf: {
      name: "Nom", herkunft: "Type de participant", telefon: "Téléphone", email: "E-mail", region: "Région", sorumlu: "Sorumlu", gt: "GT/KGT",
      anmeldung: "Inscription", zusage: "Réponse", uebernachtung: "Hébergement", letzterKontakt: "Dernier contact", ergebnis: "Résultat", notiz: "Note", aktiv: "Actif",
    },
    modulSpalte: (modul, spalte) => `${modul} : ${spalte}`,
    jahrgang: "Promotion",
    nichtAngemeldet: "non inscrit·e",
    keineAngabe: "non renseigné",
    nein: "non",
    ergebnis: { erreicht: "joint·e", nicht_erreicht: "injoignable", rueckruf: "à rappeler" },
    notiz: "Note",
    ja: "oui",
    ausgeschieden: "a quitté le programme",
  },
};

const wannFormate = Object.fromEntries((Object.keys(teamLocale) as TeamSprache[]).map((l) =>
  [l, new Intl.DateTimeFormat(teamLocale[l], { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Berlin" })])) as Record<TeamSprache, Intl.DateTimeFormat>;
const heute = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" });

/**
 * Die (gefilterte) Teilnehmendenliste als Excel-Datei (CSV, Semikolon, UTF-8 mit BOM), ab Orga-Team. Gleiche Filter und
 * gleiche Rechte wie die Liste: E-Mail-Adressen nur für Admin/Vorstand (get_people), auf ein Modul begrenzte
 * Team-Zugänge kommen nicht hierher (requireStaff ohne modulBezogen, get_people verlangt has_orga_access()).
 */
export async function GET(request: Request) {
  const staff = await requireStaff("orga");
  const l = staff.sprache;
  const t = T[l];
  const k = t.kopf;
  const anmeldung: Record<string, string> = teamTexte[l].anmeldung;
  const rsvp: Record<string, string> = teamTexte[l].rsvp;
  const wann = wannFormate[l];
  const alles = darf.alles(staff.role);
  const { modulListe, modul, jetzt, alle, liste } = await ladeListe(leseFilter(new URL(request.url).searchParams), alles);
  const mitZusagen = new Set(alle.flatMap((p) => p.modules.filter((r) => r.r).map((r) => r.m)));

  const kopf = [
    k.name, k.herkunft, k.telefon, ...(alles ? [k.email] : []), k.region, k.sorumlu, k.gt,
    ...(modul ? [t.modulSpalte(modul.title, k.anmeldung), t.modulSpalte(modul.title, k.zusage), t.modulSpalte(modul.title, k.uebernachtung)] : []),
    ...modulListe.map((m) => `${m.title} (${termine(m.tage, l)})`),
    k.letzterKontakt, k.ergebnis, k.notiz, k.aktiv,
  ];
  const zeilen = liste.map((p) => [
    p.name, herkunft(p, l) ?? t.jahrgang, p.phone, ...(alles ? [p.email] : []), p.region, p.mentor_name, p.branch,
    ...(modul ? [
      p.registration_status ? anmeldung[p.registration_status] ?? p.registration_status : t.nichtAngemeldet,
      // Deutsch wie bisher der gespeicherte Wert (zugesagt/abgesagt), sonst übersetzt
      p.rsvp ? (l === "de" ? p.rsvp : rsvp[p.rsvp] ?? p.rsvp) : "",
      !p.registration_status ? "" : !p.stay_answered ? t.keineAngabe : p.nights?.length ? p.nights.map(nachtName).join(", ") : t.nein,
    ] : []),
    ...modulListe.map((m) => punkt(p.modules.find((r) => r.m === m.id), m.tage.length, m.tage[m.tage.length - 1].ends_at < jetzt, mitZusagen.has(m.id), l)?.text ?? ""),
    p.last_at ? `${wann.format(new Date(p.last_at))}${p.last_by ? ` (${p.last_by})` : ""}` : "",
    p.last_outcome ? t.ergebnis[p.last_outcome] ?? p.last_outcome : p.last_channel === "notiz" ? t.notiz : "",
    p.last_note, p.active ? t.ja : t.ausgeschieden,
  ]);
  const datei = `${t.datei}${modul ? ` ${modul.title}` : ""} ${heute.format(new Date())}.csv`;
  return csvAntwort([kopf, ...zeilen], datei);
}
