import type { Metadata } from "next";
import { exportBeantragen } from "@/lib/aktionen/freigaben";
import Link from "next/link";
import { TeamKopf } from "@/components/team/TeamKopf";
import { Leer, Titel, Zahl } from "@/components/team/Ui";
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

export default async function Auswertung({ searchParams }: PageProps<"/team/auswertung">) {
  const staff = await requireStaff("alles");
  const l = staff.sprache;
  const t = T[l];
  const w = teamTexte[l].wort;
  const datum = new Intl.DateTimeFormat(teamLocale[l], { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Berlin" });
  const kurz = new Intl.DateTimeFormat(teamLocale[l], { day: "numeric", month: "short", timeZone: "Europe/Berlin" });
  const prozent = (v: number | null) => (v === null ? "–" : prozentFormat[l](v.toLocaleString(teamLocale[l])));
  const sp = await searchParams;
  const filter = leseFilter(sp);
  const { module, tage, personen } = await ladeAuswertung(filter);
  const jetzt = jetztMs();

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
  // Vier-Augen-Prinzip: eigener, freigegebener und noch nicht genutzter Export-Antrag der letzten 24 Stunden
  const { data: freigaben } = await (await createClient()).from("approvals").select("id, decided_at").eq("action", "export").eq("status", "freigegeben").eq("requested_by", staff.userId).order("decided_at", { ascending: false }).limit(1);
  const freigabe = freigaben?.find((f) => f.decided_at && Date.parse(f.decided_at) > jetztMs() - 86_400_000);
  const exportParams = new URLSearchParams(Object.entries({ von: filter.von, bis: filter.bis, gruppe: filter.gruppe }).filter(([, v]) => v));

  return (
    <>
      <TeamKopf staff={staff} aktiv="auswertung" breit />
      <main lang={l} className="mx-auto max-w-7xl px-4 py-10">
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

        <form className="mb-8 flex flex-wrap items-end gap-3" action="/team/auswertung/">
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
          {(filter.von || filter.bis || filter.gruppe !== "academy_student") && <Link href="/team/auswertung/" className="link text-sm">{t.zuruecksetzen}</Link>}
        </form>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Zahl wert={personen.length} text={t.zahlAngemeldet} />
          <Zahl wert={prozent(quoteGesamt)} text={t.zahlAnwesenheit} ton={quoteGesamt !== null && quoteGesamt < 70 ? "warnung" : "neutral"} />
          <Zahl wert={noShows} text={t.zahlNoShows} ton={noShows ? "warnung" : "neutral"} />
          <Zahl wert={gefaehrdet.length} text={t.zahlGefaehrdet} ton={gefaehrdet.length ? "warnung" : "gut"} />
        </div>

        <section className="karte mb-8">
          <h2 className="font-display text-2xl font-bold">{t.proTag}</h2>
          <p className="mb-6 text-sm text-ink-soft">{t.proTagText}{walkIns ? t.walkIns(walkIns) : ""}</p>
          <Verlauf punkte={punkte} sprache={l} />
        </section>

        <section className="karte mb-8 overflow-x-auto">
          <h2 className="font-display mb-4 text-2xl font-bold">{t.vergleich}</h2>
          {module.length ? (
            <table className="tabelle">
              <thead><tr><th>{w.modul}</th><th>{t.beginn}</th><th className="text-right">{t.angemeldet}</th><th className="text-right">{t.mindEinTag}</th><th className="text-right">{t.noShows}</th><th className="text-right">{t.abgemeldet}</th><th className="text-right">{t.anwesenheit}</th></tr></thead>
              <tbody>
                {module.map((m) => (
                  <tr key={m.module_id}>
                    <td className="font-semibold"><Link href={`/team/module/${m.module_id}/`} className="hover:underline">{m.title}</Link></td>
                    <td>{datum.format(new Date(m.first_day))}{m.days_past < m.days_total ? (m.days_past ? t.laeuft : t.kommt) : ""}</td>
                    <td className="text-right tabular-nums">{m.registered}</td>
                    <td className="text-right tabular-nums">{m.days_past ? m.attended_people : "–"}</td>
                    <td className="text-right tabular-nums">{m.days_past === m.days_total ? m.no_shows : "–"}</td>
                    <td className="text-right tabular-nums">{m.cancelled_or_excused}</td>
                    <td className="text-right tabular-nums font-semibold">{prozent(m.attendance_rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <Leer>{t.keineModule}</Leer>}
        </section>

        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <Personen titel={t.aktivTitel} text={t.aktivText} personen={aktiv} leer={t.aktivLeer} t={t} prozent={prozent} />
          <Personen titel={t.gefaehrdetTitel} text={t.gefaehrdetText} personen={gefaehrdet} leer={t.gefaehrdetLeer} t={t} prozent={prozent} />
        </div>

        <section className="karte overflow-x-auto">
          <h2 className="font-display mb-4 text-2xl font-bold">{t.alle}</h2>
          {personen.length ? (
            <table className="tabelle">
              <thead><tr><th>{w.name}</th><th>{w.region}</th><th className="text-right">{w.module}</th><th className="text-right">{t.tageDa}</th><th className="text-right">{t.verpasstKurz}</th><th className="text-right">{t.entschuldigt}</th><th className="text-right">{t.quote}</th><th className="text-right">{t.serieKurz}</th><th className="text-right">{t.rekord}</th><th>{t.zuletzt}</th></tr></thead>
              <tbody>
                {[...personen].sort((a, b) => a.vorname.localeCompare(b.vorname, l === "de" ? "de" : teamLocale[l])).map((p) => (
                  <tr key={p.participant_id}>
                    <td className="font-semibold"><Link href={`/team/teilnehmende/${p.participant_id}/`} className="hover:underline">{p.vorname} {p.nachname}</Link></td>
                    <td>{p.region ?? "–"}</td>
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
        </section>
      </main>
    </>
  );
}
