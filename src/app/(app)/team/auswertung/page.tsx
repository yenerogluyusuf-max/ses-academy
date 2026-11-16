import type { Metadata } from "next";
import { exportBeantragen } from "@/lib/aktionen/freigaben";
import { ort, regionName } from "@/lib/orte";
import Link from "next/link";
import { TeamKopf } from "@/components/team/TeamKopf";
import { laenderNamen, Leer, Titel, Zahl } from "@/components/team/Ui";
import { Verlauf, type VerlaufPunkt } from "@/components/team/Verlauf";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { istGefaehrdet, ladeAuswertung, leseFilter, verpasstInFolge, type PersonZeile } from "@/lib/auswertung";
import { zugehoerigkeit } from "@/lib/einlass";
import { jetztMs } from "@/lib/zeit";
import { teamLocale, type TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";

export const metadata: Metadata = { title: "Auswertung | SES Academy" };

/** Prozentangabe je Sprache: „12,5 %“, türkisch „%12,5“, französisch mit geschütztem schmalem Leerzeichen. */
const prozentFormat: Record<TeamSprache, (wert: string) => string> = {
  de: (w) => `${w} %`,
  tr: (w) => `%${w}`,
  fr: (w) => `${w}\u202f%`,
};

const de = {
  quote: "Quote",
  serie: (aktuell: number, rekord: number) => `Serie ${aktuell} · Rekord ${rekord}`,
  verpasst: (n: number) => `${n} Tage verpasst`,
  kicker: "Teilnahme über alle Module",
  exportLaden: "Freigegebenen Export herunterladen",
  exportBeantragen: "CSV-Export beantragen",
  exportBeantragt: "Export beantragt. Eine zweite Person gibt ihn unter „Freigaben“ frei, danach erscheint hier der Download (24 Stunden, einmal).",
  von: "Von",
  bis: "Bis",
  personen: "Personen",
  zugehoerigkeit: zugehoerigkeit as Record<string, string>,
  anzeigen: "Anzeigen",
  zuruecksetzen: "zurücksetzen",
  zahlAngemeldet: "Teilnehmende mit Anmeldung",
  zahlAnwesenheit: "Anwesenheit über alle vergangenen Modultage",
  zahlNoShows: "No-Shows (angemeldet, an keinem Tag da)",
  zahlGefaehrdet: "gefährdet (siehe unten)",
  proTag: "Anwesenheit pro Modultag",
  proTagText: "Anteil der bestätigten Anmeldungen, die eingecheckt wurden.",
  walkIns: (n: number) => ` Darin enthalten: ${n} Walk-ins.`,
  vergleich: "Veranstaltungen im Vergleich",
  beginn: "Beginn",
  angemeldet: "Angemeldet",
  mindEinTag: "Mind. 1 Tag da",
  noShows: "No-Shows",
  abgemeldet: "Abgemeldet",
  anwesenheit: "Anwesenheit",
  laeuft: " (läuft)",
  kommt: " (kommt)",
  keineModule: "Keine Module im Zeitraum.",
  aktivTitel: "Besonders aktiv",
  aktivText: "Längste laufende Serie, dann höchste Quote (Top 10).",
  aktivLeer: "Noch niemand mit laufender Serie.",
  gefaehrdetTitel: "Gefährdet",
  gefaehrdetText: "Zuletzt mindestens 2 Modultage in Folge verpasst, oder Quote unter 50 % (ab 4 möglichen Tagen). Entschuldigte Tage zählen nicht.",
  gefaehrdetLeer: "Niemand gefährdet.",
  alle: "Alle Teilnehmenden",
  tageDa: "Tage da",
  verpasstKurz: "Verpasst",
  entschuldigt: "Entsch.",
  serieKurz: "Serie",
  rekord: "Rekord",
  zuletzt: "Zuletzt da",
  keineTeilnehmenden: "Keine Teilnehmenden im Zeitraum.",
  fussnote: "Gezählt wird pro Modultag. Serie: aufeinanderfolgende besuchte Tage von Modulen, die für Serien zählen; entschuldigte oder abgemeldete Tage unterbrechen sie nicht.",
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    quote: "Oran",
    serie: (aktuell, rekord) => `Seri ${aktuell} · Rekor ${rekord}`,
    verpasst: (n) => `${n} gün kaçırdı`,
    kicker: "Tüm modüllerde katılım",
    exportLaden: "Onaylanan dışa aktarmayı indir",
    exportBeantragen: "CSV dışa aktarma talep et",
    exportBeantragt: "Dışa aktarma talep edildi. İkinci bir kişi bunu “Onaylar” bölümünde onaylar, ardından indirme burada görünür (24 saat, bir kez).",
    von: "Başlangıç",
    bis: "Bitiş",
    personen: "Kişiler",
    zugehoerigkeit: { member: "Üye", academy_student: "Academy katılımcısı", guest: "Misafir", alumni: "Mezun" },
    anzeigen: "Göster",
    zuruecksetzen: "sıfırla",
    zahlAngemeldet: "Kaydı olan katılımcılar",
    zahlAnwesenheit: "Geçmiş tüm modül günlerinde katılım",
    zahlNoShows: "Gelmeyenler (kayıtlı, hiçbir gün gelmedi)",
    zahlGefaehrdet: "risk altında (aşağıya bak)",
    proTag: "Modül gününe göre katılım",
    proTagText: "Onaylı kayıtlardan girişi yapılanların oranı.",
    walkIns: (n) => ` Buna kayıtsız gelen ${n} kişi dahil.`,
    vergleich: "Etkinliklerin karşılaştırması",
    beginn: "Başlangıç",
    angemeldet: "Kayıtlı",
    mindEinTag: "En az 1 gün geldi",
    noShows: "Gelmeyen",
    abgemeldet: "Kaydı iptal",
    anwesenheit: "Katılım",
    laeuft: " (sürüyor)",
    kommt: " (gelecek)",
    keineModule: "Bu zaman aralığında modül yok.",
    aktivTitel: "En aktifler",
    aktivText: "En uzun süren seri, sonra en yüksek oran (ilk 10).",
    aktivLeer: "Henüz serisi devam eden kimse yok.",
    gefaehrdetTitel: "Risk altında",
    gefaehrdetText: "Son olarak en az 2 modül gününü üst üste kaçırdı ya da oranı %50’nin altında (en az 4 olası günden itibaren). Mazeretli günler sayılmaz.",
    gefaehrdetLeer: "Risk altında kimse yok.",
    alle: "Tüm katılımcılar",
    tageDa: "Geldiği gün",
    verpasstKurz: "Kaçırdı",
    entschuldigt: "Mazeretli",
    serieKurz: "Seri",
    rekord: "Rekor",
    zuletzt: "Son katılım",
    keineTeilnehmenden: "Bu zaman aralığında katılımcı yok.",
    fussnote: "Her modül günü ayrı sayılır. Seri: seriye sayılan modüllerde art arda katılınan günler; mazeretli ya da kaydı iptal edilen günler seriyi bozmaz.",
  },
  fr: {
    quote: "Taux",
    serie: (aktuell, rekord) => `Série ${aktuell} · Record ${rekord}`,
    verpasst: (n) => `${n}\u00a0jours manqués`,
    kicker: "Participation sur tous les modules",
    exportLaden: "Télécharger l’export validé",
    exportBeantragen: "Demander l’export CSV",
    exportBeantragt: "Export demandé. Une deuxième personne le valide sous «\u00a0Validations\u00a0», puis le téléchargement apparaît ici (24\u00a0heures, une seule fois).",
    von: "Du",
    bis: "Au",
    personen: "Personnes",
    zugehoerigkeit: { member: "Membre", academy_student: "Participant·e de l’Academy", guest: "Invité·e", alumni: "Alumni" },
    anzeigen: "Afficher",
    zuruecksetzen: "réinitialiser",
    zahlAngemeldet: "Participants inscrits",
    zahlAnwesenheit: "Présence sur toutes les journées de module passées",
    zahlNoShows: "Absents (inscrits, présents aucun jour)",
    zahlGefaehrdet: "à risque (voir plus bas)",
    proTag: "Présence par journée de module",
    proTagText: "Part des inscriptions confirmées qui ont été enregistrées à l’accueil.",
    walkIns: (n) => ` Dont ${n}\u00a0personnes venues sans inscription.`,
    vergleich: "Comparaison des événements",
    beginn: "Début",
    angemeldet: "Inscrits",
    mindEinTag: "Présents ≥\u00a01\u00a0jour",
    noShows: "Absents",
    abgemeldet: "Désinscrits",
    anwesenheit: "Présence",
    laeuft: " (en cours)",
    kommt: " (à venir)",
    keineModule: "Aucun module sur la période.",
    aktivTitel: "Les plus actifs",
    aktivText: "Plus longue série en cours, puis meilleur taux (top\u00a010).",
    aktivLeer: "Personne n’a encore de série en cours.",
    gefaehrdetTitel: "À risque",
    gefaehrdetText: "A récemment manqué au moins 2\u00a0journées de module d’affilée, ou taux inférieur à 50\u202f% (à partir de 4\u00a0journées possibles). Les journées excusées ne comptent pas.",
    gefaehrdetLeer: "Personne n’est à risque.",
    alle: "Tous les participants",
    tageDa: "Jours présents",
    verpasstKurz: "Manqués",
    entschuldigt: "Excusés",
    serieKurz: "Série",
    rekord: "Record",
    zuletzt: "Dernière présence",
    keineTeilnehmenden: "Aucun participant sur la période.",
    fussnote: "Le décompte se fait par journée de module. Série\u00a0: journées de présence consécutives aux modules qui comptent pour les séries\u00a0; les journées excusées ou désinscrites ne l’interrompent pas.",
  },
};

function Personen({ titel, text, personen, leer, t, prozent }: { titel: string; text: string; personen: PersonZeile[]; leer: string; t: typeof de; prozent: (v: number | null) => string }) {
  return (
    <section className="karte">
      <h2 className="font-display text-2xl font-bold">{titel}</h2>
      <p className="mb-4 text-sm text-ink-soft">{text}</p>
      {personen.length ? (
        <ul className="divide-y divide-line">
          {personen.map((p) => (
            <li key={p.participant_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              <Link href={`/team/teilnehmende/${p.participant_id}/`} className="mr-auto font-semibold hover:underline">{p.vorname} {p.nachname}</Link>
              <span className="text-sm tabular-nums text-ink-soft">{t.quote} {prozent(p.attendance_rate)}</span>
              <span className="chip bg-paper-deep tabular-nums">{t.serie(p.current_streak, p.longest_streak)}</span>
              {verpasstInFolge(p) > 0 && <span className="chip bg-gelb-hell tabular-nums">{t.verpasst(verpasstInFolge(p))}</span>}
            </li>
          ))}
        </ul>
      ) : <p className="text-ink-soft">{leer}</p>}
    </section>
  );
}

/** Land aus der freien Angabe im Bewerbungsformular („Almanya, Berlin“, „Viyana, Aut“ …) in der Sprache des Team-Bereichs. */
function landAusText(text: string | null, namen: Record<string, string>): string | null {
  const x = (text ?? "").toLocaleLowerCase("tr");
  if (!x.trim()) return null;
  const regeln: [string, RegExp][] = [
    ["AT", /avusturya|österreich|osterreich|austria|\baut\b|viyana|wien|linz|vorarlberg/],
    ["FR", /fransa|france|frankreich|paris|lyon|strasbourg|mantes/],
    ["CH", /isviçre|i̇sviçre|schweiz|suisse|zürich|basel/],
    ["NL", /hollanda|niederlande|nederland|netherlands/],
    ["BE", /belçika|belgien|belgique|belgium/],
    ["DE", /almanya|deutschland|germany|almanyа|berlin|köln|hamburg/],
  ];
  const treffer = regeln.find(([, muster]) => muster.test(x));
  return treffer ? namen[treffer[0]] : (text ?? "").trim();
}

/** Ansichten der Auswertung (Umbau 16.11.2026, Wunsch: „es gibt verschiedene Auswertungen“). */
const A = {
  de: {
    ansichten: { module: "Module", teilnahme: "Teilnahme", regionen: "Regionen und Verantwortliche", bewerbungen: "Von der Bewerbung zur Teilnahme" },
    feedback: "Feedback Ø", zumModul: "Auswertung des Moduls",
    zeitraum: "Zeitraum und Personenkreis",
    region: "Region", verantwortlich: "Verantwortlich", land: "Land", zweig: "GT / KGT", personen: "Personen", quote: "Ø Quote", gefaehrdet: "gefährdet", nieDa: "nie da",
    regionText: "Pro Region bzw. verantwortlicher Person: wie viele dabei sind und wie regelmäßig sie kommen. Gut, um gezielt nachzufassen.",
    ohne: "ohne Angabe",
    trichter: { bewerbungen: "Bewerbungen", angenommen: "angenommen", inListe: "in der Teilnehmendenliste", malDa: "mindestens einmal da", regelmaessig: "regelmäßig da (ab 75 %)" },
    trichterText: "Wie viele aus den Bewerbungen tatsächlich und regelmäßig kommen.",
    angenommenNachLand: "Angenommene nach Land der Bewerbung",
  },
  tr: {
    ansichten: { module: "Modüller", teilnahme: "Katılım", regionen: "Bölgeler ve sorumlular", bewerbungen: "Başvurudan katılıma" },
    feedback: "Geri bildirim ort.", zumModul: "Modül değerlendirmesi",
    zeitraum: "Zaman aralığı ve kişiler",
    region: "Bölge", verantwortlich: "Sorumlu", land: "Ülke", zweig: "GT / KGT", personen: "Kişi", quote: "Ort. oran", gefaehrdet: "risk altında", nieDa: "hiç gelmedi",
    regionText: "Bölge veya sorumlu kişiye göre: kaç kişi var ve ne kadar düzenli geliyorlar. Hedefli takip için.",
    ohne: "bilgi yok",
    trichter: { bewerbungen: "Başvuru", angenommen: "kabul edildi", inListe: "katılımcı listesinde", malDa: "en az bir kez geldi", regelmaessig: "düzenli geliyor (%75 ve üzeri)" },
    trichterText: "Başvuranlardan kaç kişinin gerçekten ve düzenli geldiği.",
    angenommenNachLand: "Kabul edilenler, başvurudaki ülkeye göre",
  },
  fr: {
    ansichten: { module: "Modules", teilnahme: "Participation", regionen: "Régions et responsables", bewerbungen: "De la candidature à la participation" },
    feedback: "Retours moy.", zumModul: "Analyse du module",
    zeitraum: "Période et personnes",
    region: "Région", verantwortlich: "Responsable", land: "Pays", zweig: "GT / KGT", personen: "Personnes", quote: "Taux moy.", gefaehrdet: "à risque", nieDa: "jamais venus",
    regionText: "Par région ou par responsable : combien de personnes et avec quelle régularité. Utile pour relancer de façon ciblée.",
    ohne: "non renseigné",
    trichter: { bewerbungen: "Candidatures", angenommen: "acceptées", inListe: "dans la liste des participants", malDa: "venus au moins une fois", regelmaessig: "présents régulièrement (dès 75 %)" },
    trichterText: "Combien de candidats viennent réellement, et régulièrement.",
    angenommenNachLand: "Acceptés par pays de candidature",
  },
} satisfies Record<TeamSprache, unknown>;
type Ansicht = keyof typeof A.de.ansichten;
const ansichten: Ansicht[] = ["module", "teilnahme", "regionen", "bewerbungen"];

export default async function Auswertung({ searchParams }: PageProps<"/team/auswertung">) {
  const staff = await requireStaff("alles");
  const l = staff.sprache;
  const t = T[l];
  const a = A[l];
  const w = teamTexte[l].wort;
  const datum = new Intl.DateTimeFormat(teamLocale[l], { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Berlin" });
  const kurz = new Intl.DateTimeFormat(teamLocale[l], { day: "numeric", month: "short", timeZone: "Europe/Berlin" });
  const prozent = (v: number | null) => (v === null ? "–" : prozentFormat[l](v.toLocaleString(teamLocale[l])));
  const sp = await searchParams;
  const ansicht: Ansicht = ansichten.includes(sp.ansicht as Ansicht) ? (sp.ansicht as Ansicht) : "module";
  const filter = leseFilter(sp);
  const { module, tage, personen } = await ladeAuswertung(filter);
  const jetzt = jetztMs();
  const supabase = await createClient();

  const vergangen = tage.filter((t) => Date.parse(t.ends_at) < jetzt);
  const punkte: VerlaufPunkt[] = vergangen.map((t) => ({ id: t.day_id, modul: t.module_title, datum: kurz.format(new Date(t.starts_at)), erwartet: t.expected, da: t.checked_in }));
  const tageDa = module.reduce((s, m) => s + m.person_days_attended, 0);
  const tageMoeglich = module.reduce((s, m) => s + m.person_days_possible, 0);
  const quoteGesamt = tageMoeglich ? Math.round((tageDa / tageMoeglich) * 1000) / 10 : null;
  const noShows = module.reduce((s, m) => s + m.no_shows, 0);
  const walkIns = tage.reduce((s, t) => s + t.walk_ins, 0);

  const mitHistorie = personen.filter((p) => p.total_attended + p.total_no_shows > 0);
  const aktiv = [...mitHistorie]
    .filter((p) => p.current_streak > 0)
    .sort((a, b) => b.current_streak - a.current_streak || (b.attendance_rate ?? 0) - (a.attendance_rate ?? 0))
    .slice(0, 10);
  const gefaehrdet = mitHistorie.filter(istGefaehrdet)
    .sort((a, b) => b.trailing_misses - a.trailing_misses || (a.attendance_rate ?? 0) - (b.attendance_rate ?? 0));

  // Feedback je Modul: Durchschnitt der ersten Bewertungsfrage („Programm insgesamt“)
  const feedbackVon = new Map<string, { wert: number; max: number }>();
  if (ansicht === "module") {
    const { data: umfragen } = await supabase.from("feedback_surveys").select("id, module_id");
    for (const u of umfragen ?? []) {
      const { data: e } = await supabase.rpc("get_feedback_results", { p_survey_id: u.id });
      const erste = (e ?? []).find((x) => x.kind === "skala" && x.average !== null);
      if (erste) feedbackVon.set(u.module_id, { wert: erste.average, max: erste.scale_max ?? 5 });
    }
  }

  // Regionen, Verantwortliche, Land, GT/KGT
  const gruppiere = (schluessel: (p: PersonZeile) => string | null) => {
    const karte = new Map<string, PersonZeile[]>();
    for (const p of personen.filter((x) => x.aktiv)) {
      const k = schluessel(p) ?? a.ohne;
      karte.set(k, [...(karte.get(k) ?? []), p]);
    }
    return [...karte].map(([name, liste]) => {
      const mit = liste.filter((p) => p.total_attended + p.total_no_shows > 0);
      const quote = mit.length ? Math.round(mit.reduce((s, p) => s + (p.attendance_rate ?? 0), 0) / mit.length) : null;
      return { name, anzahl: liste.length, quote, gefaehrdet: mit.filter(istGefaehrdet).length, nieDa: mit.filter((p) => p.total_attended === 0).length };
    }).sort((x, y) => y.anzahl - x.anzahl);
  };

  // Trichter: Bewerbung → Teilnahme
  const trichter = ansicht === "bewerbungen" ? await (async () => {
    const { data: bew } = await supabase.from("applications").select("status, participant_id, country");
    const angenommen = (bew ?? []).filter((b) => b.status === "angenommen");
    const ids = new Set(personen.map((p) => p.participant_id));
    const inListe = angenommen.filter((b) => b.participant_id && ids.has(b.participant_id));
    const zuPerson = new Map(personen.map((p) => [p.participant_id, p]));
    const malDa = inListe.filter((b) => (zuPerson.get(b.participant_id!)?.total_attended ?? 0) > 0);
    const regelmaessig = inListe.filter((b) => (zuPerson.get(b.participant_id!)?.attendance_rate ?? 0) >= 75);
    const nachLand = new Map<string, number>();
    for (const b of angenommen) {
      const land = landAusText(b.country, laenderNamen[l]) ?? a.ohne;
      nachLand.set(land, (nachLand.get(land) ?? 0) + 1);
    }
    return { stufen: [[a.trichter.bewerbungen, (bew ?? []).length], [a.trichter.angenommen, angenommen.length], [a.trichter.inListe, inListe.length], [a.trichter.malDa, malDa.length], [a.trichter.regelmaessig, regelmaessig.length]] as [string, number][],
      nachLand: [...nachLand].sort((x, y) => y[1] - x[1]).slice(0, 12) };
  })() : null;

  // Vier-Augen-Prinzip: eigener, freigegebener und noch nicht genutzter Export-Antrag der letzten 24 Stunden
  const { data: freigaben } = await supabase.from("approvals").select("id, decided_at").eq("action", "export").eq("status", "freigegeben").eq("requested_by", staff.userId).order("decided_at", { ascending: false }).limit(1);
  const freigabe = freigaben?.find((f) => f.decided_at && Date.parse(f.decided_at) > jetztMs() - 86_400_000);
  const exportParams = new URLSearchParams(Object.entries({ von: filter.von, bis: filter.bis, gruppe: filter.gruppe }).filter(([, v]) => v));
  const mitFilter = (x: Ansicht) => { const q = new URLSearchParams(exportParams); q.set("ansicht", x); if (filter.gruppe === "academy_student") q.delete("gruppe"); return `/team/auswertung/?${q}`; };

  const gruppenTabelle = (titel: string, zeilen: ReturnType<typeof gruppiere>) => (
    <section key={titel} className="karte overflow-x-auto">
      <h2 className="font-display mb-3 text-xl font-bold">{titel}</h2>
      <table className="tabelle">
        <thead><tr><th>{titel}</th><th className="text-right">{a.personen}</th><th className="text-right">{a.quote}</th><th className="text-right">{a.gefaehrdet}</th><th className="text-right">{a.nieDa}</th></tr></thead>
        <tbody>
          {zeilen.map((z) => (
            <tr key={z.name}>
              <td className="font-semibold">{z.name}</td>
              <td className="text-right tabular-nums">{z.anzahl}</td>
              <td className="text-right tabular-nums"><span className={z.quote !== null && z.quote < 60 ? "font-semibold text-rot" : ""}>{z.quote === null ? "–" : prozent(z.quote)}</span></td>
              <td className="text-right tabular-nums">{z.gefaehrdet || <span className="text-ink-soft/50">0</span>}</td>
              <td className="text-right tabular-nums">{z.nieDa || <span className="text-ink-soft/50">0</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );

  return (
    <>
      <TeamKopf staff={staff} aktiv="auswertung" breit />
      <main lang={l} className="mx-auto max-w-7xl px-4 py-8">
        <Titel kicker={t.kicker} aktion={
          freigabe
            ? <a href={`/team/auswertung/export/?freigabe=${freigabe.id}`} className="knopf">{t.exportLaden}</a>
            : (
              <form action={exportBeantragen}>
                {[...exportParams.entries()].map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
                <button type="submit" className="knopf-hell">{t.exportBeantragen}</button>
              </form>
            )
        }>{teamTexte[l].bereiche.auswertung}</Titel>
        {sp.hinweis === "export-beantragt" && <p role="status" className="mb-6 rounded-2xl bg-gruen-hell p-4 text-sm font-semibold">{t.exportBeantragt}</p>}

        <nav aria-label={teamTexte[l].bereiche.auswertung} className="-mt-2 mb-4 flex flex-wrap gap-1 border-b border-line pb-px">
          {ansichten.map((x) => (
            <Link key={x} href={mitFilter(x)} aria-current={x === ansicht ? "page" : undefined}
              className={`shrink-0 rounded-t-2xl px-4 py-2 text-sm font-semibold ${x === ansicht ? "bg-ink text-paper" : "hover:bg-paper-deep"}`}>{a.ansichten[x]}</Link>
          ))}
        </nav>

        <details className="mb-6" open={Boolean(filter.von || filter.bis || filter.gruppe !== "academy_student")}>
          <summary className="cursor-pointer text-sm font-semibold text-ink-soft">{a.zeitraum}</summary>
          <form className="mt-3 flex flex-wrap items-end gap-3" action="/team/auswertung/">
            <input type="hidden" name="ansicht" value={ansicht} />
            <div><label htmlFor="von" className="etikett">{t.von}</label><input id="von" name="von" type="date" defaultValue={filter.von} className="feld" /></div>
            <div><label htmlFor="bis" className="etikett">{t.bis}</label><input id="bis" name="bis" type="date" defaultValue={filter.bis} className="feld" /></div>
            <div>
              <label htmlFor="gruppe" className="etikett">{t.personen}</label>
              <select id="gruppe" name="gruppe" defaultValue={filter.gruppe} className="feld">
                <option value="alle">{w.alle}</option>
                {Object.keys(zugehoerigkeit).map((k) => <option key={k} value={k}>{t.zugehoerigkeit[k] ?? zugehoerigkeit[k as keyof typeof zugehoerigkeit]}</option>)}
              </select>
            </div>
            <button className="knopf">{t.anzeigen}</button>
            {(filter.von || filter.bis || filter.gruppe !== "academy_student") && <Link href={`/team/auswertung/?ansicht=${ansicht}`} className="link text-sm">{t.zuruecksetzen}</Link>}
          </form>
        </details>

        {ansicht === "module" && (
          <>
            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Zahl wert={personen.length} text={t.zahlAngemeldet} />
              <Zahl wert={prozent(quoteGesamt)} text={t.zahlAnwesenheit} ton={quoteGesamt !== null && quoteGesamt < 70 ? "warnung" : "neutral"} />
              <Zahl wert={noShows} text={t.zahlNoShows} ton={noShows ? "warnung" : "neutral"} />
              <Zahl wert={gefaehrdet.length} text={t.zahlGefaehrdet.replace(/\s*\(.*\)$/, "")} href={mitFilter("teilnahme")} ton={gefaehrdet.length ? "warnung" : "gut"} />
            </div>
            <section className="karte mb-6 overflow-x-auto">
              <h2 className="font-display mb-4 text-2xl font-bold">{t.vergleich}</h2>
              {module.length ? (
                <table className="tabelle">
                  <thead><tr><th>{w.modul}</th><th>{t.beginn}</th><th className="text-right">{t.angemeldet}</th><th className="text-right">{t.mindEinTag}</th><th className="text-right">{t.noShows}</th><th className="text-right">{t.anwesenheit}</th><th className="text-right">{a.feedback}</th><th /></tr></thead>
                  <tbody>
                    {module.map((m) => {
                      const fb = feedbackVon.get(m.module_id);
                      return (
                        <tr key={m.module_id}>
                          <td className="font-semibold">{m.title}</td>
                          <td>{datum.format(new Date(m.first_day))}{m.days_past < m.days_total ? (m.days_past ? t.laeuft : t.kommt) : ""}</td>
                          <td className="text-right tabular-nums">{m.registered}</td>
                          <td className="text-right tabular-nums">{m.days_past ? m.attended_people : "–"}</td>
                          <td className="text-right tabular-nums">{m.days_past === m.days_total ? m.no_shows : "–"}</td>
                          <td className="text-right tabular-nums font-semibold">{m.days_past ? prozent(m.attendance_rate) : "–"}</td>
                          <td className="text-right tabular-nums">{fb ? `${fb.wert.toLocaleString(teamLocale[l], { maximumFractionDigits: 1 })} / ${fb.max}` : "–"}</td>
                          <td className="text-right"><Link href={`/team/module/${m.module_id}/auswertung/`} className="link text-xs whitespace-nowrap">{a.zumModul} →</Link></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : <Leer>{t.keineModule}</Leer>}
            </section>
            <section className="karte">
              <h2 className="font-display text-2xl font-bold">{t.proTag}</h2>
              <p className="mb-6 text-sm text-ink-soft">{t.proTagText}{walkIns ? t.walkIns(walkIns) : ""}</p>
              <Verlauf punkte={punkte} sprache={l} />
            </section>
          </>
        )}

        {ansicht === "teilnahme" && (
          <>
            <div className="mb-6 grid gap-6 lg:grid-cols-2">
              <Personen titel={t.gefaehrdetTitel} text={t.gefaehrdetText} personen={gefaehrdet} leer={t.gefaehrdetLeer} t={t} prozent={prozent} />
              <Personen titel={t.aktivTitel} text={t.aktivText} personen={aktiv} leer={t.aktivLeer} t={t} prozent={prozent} />
            </div>
            <details className="karte overflow-x-auto">
              <summary className="cursor-pointer font-display text-2xl font-bold">{t.alle} ({personen.length})</summary>
              {personen.length ? (
                <table className="tabelle mt-4">
                  <thead><tr><th>{w.name}</th><th>{w.region}</th><th className="text-right">{w.module}</th><th className="text-right">{t.tageDa}</th><th className="text-right">{t.verpasstKurz}</th><th className="text-right">{t.entschuldigt}</th><th className="text-right">{t.quote}</th><th className="text-right">{t.serieKurz}</th><th className="text-right">{t.rekord}</th><th>{t.zuletzt}</th></tr></thead>
                  <tbody>
                    {[...personen].sort((x, y) => x.vorname.localeCompare(y.vorname, l === "de" ? "de" : teamLocale[l])).map((p) => (
                      <tr key={p.participant_id}>
                        <td className="font-semibold"><Link href={`/team/teilnehmende/${p.participant_id}/`} className="hover:underline">{p.vorname} {p.nachname}</Link></td>
                        <td>{regionName(p.region, l) ?? "–"}</td>
                        <td className="text-right tabular-nums">{p.total_registered}</td>
                        <td className="text-right tabular-nums">{p.total_attended}</td>
                        <td className="text-right tabular-nums">{p.total_no_shows}</td>
                        <td className="text-right tabular-nums">{p.total_cancelled_or_excused}</td>
                        <td className="text-right tabular-nums">{prozent(p.attendance_rate)}</td>
                        <td className="text-right tabular-nums">{p.current_streak}</td>
                        <td className="text-right tabular-nums">{p.longest_streak}</td>
                        <td>{p.last_attended_at ? `${datum.format(new Date(p.last_attended_at))} · ${p.last_attended_title}` : "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <Leer>{t.keineTeilnehmenden}</Leer>}
              <p className="mt-4 text-xs text-ink-soft">{t.fussnote}</p>
            </details>
          </>
        )}

        {ansicht === "regionen" && (
          <>
            <p className="mb-4 max-w-3xl text-sm text-ink-soft">{a.regionText}</p>
            <div className="grid gap-6 lg:grid-cols-2">
              {gruppenTabelle(a.verantwortlich, gruppiere((p) => p.verantwortlich))}
              {gruppenTabelle(a.region, gruppiere((p) => regionName(p.region, l)))}
              {gruppenTabelle(a.land, gruppiere((p) => (p.land ? laenderNamen[l][p.land] ?? p.land : null)))}
              {gruppenTabelle(a.zweig, gruppiere((p) => p.zweig))}
            </div>
          </>
        )}

        {ansicht === "bewerbungen" && trichter && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <section className="karte">
              <h2 className="font-display text-2xl font-bold">{a.ansichten.bewerbungen}</h2>
              <p className="mt-1 mb-5 text-sm text-ink-soft">{a.trichterText}</p>
              <ol className="space-y-3">
                {trichter.stufen.map(([name, n], i) => (
                  <li key={name}>
                    <div className="flex items-baseline justify-between gap-3 text-sm"><span className="font-semibold">{name}</span><span className="tabular-nums"><span className="font-display text-xl font-extrabold">{n}</span>{i > 0 && trichter.stufen[0][1] ? <span className="text-ink-soft"> · {Math.round((n / trichter.stufen[0][1]) * 100)} %</span> : null}</span></div>
                    <span className="mt-1 block h-3 overflow-hidden rounded-full bg-paper-deep"><span className="block h-full rounded-full bg-forest" style={{ width: `${trichter.stufen[0][1] ? (n / trichter.stufen[0][1]) * 100 : 0}%`, opacity: 1 - i * 0.12 }} /></span>
                  </li>
                ))}
              </ol>
            </section>
            <section className="karte">
              <h2 className="font-display mb-3 text-xl font-bold">{a.angenommenNachLand}</h2>
              <ul className="space-y-1.5 text-sm">
                {trichter.nachLand.map(([land, n]) => <li key={land} className="flex justify-between gap-3"><span>{land}</span><span className="font-semibold tabular-nums">{n}</span></li>)}
              </ul>
            </section>
          </div>
        )}
      </main>
    </>
  );
}
