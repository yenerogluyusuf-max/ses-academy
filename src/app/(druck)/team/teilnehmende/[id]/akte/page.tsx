import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { aussagekraeftig, alterHeute, bewerbungsAngaben, bewerbungsGruppen } from "@/lib/bewerbung-felder";
import { zusammenfassen } from "@/lib/bewertung";
import { istToken, kurzcodeAnzeige } from "@/lib/codes";
import { createClient } from "@/lib/supabase/server";
import type { TeamSprache } from "@/lib/team-sprache";
import { jetztMs } from "@/lib/zeit";

export const metadata: Metadata = { title: "Akte | SES Academy" };

/**
 * Akte einer Person im SES-Dokumentendesign (wie die Tagesordnung): Stammdaten, Stärken und Aufgaben, Teilnahme mit
 * Ankunftszeiten, Gruppen und Zimmern, Hausaufgaben, Steckbrief aus der Bewerbung und – als Bild – der Lebenslauf.
 * Ein Lebenslauf als PDF wird von /akte/pdf/ an die fertige Datei angehängt. Das Dokument ist deutsch (wie
 * Zimmerliste und Notfall-Liste); nur die Leiste am Bildschirm folgt der Sprache des Team-Bereichs.
 * Nur Admin/Vorstand (enthält Einschätzungen und Bewerbungsangaben).
 */
const leiste = {
  de: { titel: "Akte", pdf: "Als PDF herunterladen", drucken: "Drucken", hinweis: "Die PDF enthält einen hochgeladenen Lebenslauf als Anhang." },
  tr: { titel: "Dosya", pdf: "PDF olarak indir", drucken: "Yazdır", hinweis: "PDF, yüklenmiş özgeçmişi ek olarak içerir." },
  fr: { titel: "Dossier", pdf: "Télécharger en PDF", drucken: "Imprimer", hinweis: "Le PDF contient en annexe le CV importé." },
} satisfies Record<TeamSprache, Record<string, string>>;

const gruen = "#3d7a61";
const hellgruen = "#e6f0ea";
const tinte = "#173226";
const grau = "#5d6b63";

const datum = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });
const tagKurz = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "numeric", timeZone: "Europe/Berlin" });
const uhr = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
const laender: Record<string, string> = { DE: "Deutschland", AT: "Österreich", FR: "Frankreich", CH: "Schweiz", NL: "Niederlande", BE: "Belgien", other: "Andere" };
const bewerbungStatus: Record<string, string> = { eingegangen: "offen", in_pruefung: "in Prüfung", angenommen: "angenommen", warteliste: "Warteliste", abgelehnt: "abgelehnt", zurueckgezogen: "zurückgezogen" };

type Reg = {
  id: string; status: string; rsvp: string | null;
  modules: { id: string; title: string; cancelled_at: string | null; module_days: { id: string; starts_at: string; ends_at: string }[] };
  attendances: { module_day_id: string; method: string; checked_in_at: string }[];
};

export default async function Akte({ params }: PageProps<"/team/teilnehmende/[id]/akte">) {
  const staff = await requireStaff("alles");
  const t = leiste[staff.sprache];
  const { id } = await params;
  if (!istToken(id)) notFound();
  const supabase = await createClient();
  const [{ data: p }, { data: regs }, { data: profil }, { data: gruppen }, { data: zimmer }, { data: abg }, { data: kennzahlen }] = await Promise.all([
    supabase.from("participants").select("*, regions(name), mentors(name)").eq("id", id).maybeSingle(),
    supabase.from("registrations").select("id,status,rsvp,modules(id,title,cancelled_at,module_days(id,starts_at,ends_at)),attendances(module_day_id,method,checked_in_at)").eq("participant_id", id),
    supabase.from("participant_profiles").select("*").eq("participant_id", id).maybeSingle(),
    supabase.from("group_members").select("module_id, module_groups(name, room)").eq("participant_id", id),
    supabase.rpc("get_person_rooms", { p_participant_id: id }),
    supabase.from("submission_participants").select("submissions(id,assignments(number,title),reviews(*))").eq("participant_id", id),
    supabase.rpc("get_participant_analytics"),
  ]);
  if (!p) notFound();
  const { data: bewerbungen } = await supabase.from("applications")
    .select("status, created_at, age, birth_year, city, country, languages, motivation, details")
    .or(p.email ? `participant_id.eq.${id},email.eq."${p.email}"` : `participant_id.eq.${id}`)
    .order("created_at", { ascending: false });
  const bewerbung = (bewerbungen ?? []).find((b) => b.status === "angenommen") ?? (bewerbungen ?? [])[0] ?? null;
  const jetzt = jetztMs();
  const name = `${p.first_name} ${p.last_name}`.trim();
  const alter = alterHeute(bewerbung, jetzt);
  const k = (kennzahlen ?? []).find((x) => x.participant_id === id);
  const modulListe = ((regs ?? []) as unknown as Reg[])
    .map((r) => ({ ...r, tage: [...r.modules.module_days].sort((a, b) => a.starts_at.localeCompare(b.starts_at)) }))
    .filter((r) => r.tage.length > 0)
    .sort((a, b) => a.tage[0].starts_at.localeCompare(b.tage[0].starts_at));
  const gruppeVon = new Map((gruppen ?? []).map((g) => [g.module_id, g.module_groups as unknown as { name: string; room: string | null } | null]));
  const zimmerVon = new Map((zimmer ?? []).map((z) => [z.module_id, z]));
  const abgaben = ((abg ?? []) as unknown as { submissions: { id: string; assignments: { number: number; title: string } | null; reviews: Record<string, number | null>[] } | null }[])
    .map((a) => a.submissions!).filter(Boolean).sort((a, b) => (a.assignments?.number ?? 0) - (b.assignments?.number ?? 0));
  const angaben = bewerbungsAngaben(bewerbung?.details, "de");
  const gruppenNamen = bewerbungsGruppen.de;
  const cvBild = profil?.cv_path && /\.(jpg|png)$/i.test(profil.cv_path);
  const ersterTag = modulListe.find((r) => r.attendances.length > 0)?.tage[0]?.starts_at;
  const heute = datum.format(new Date());
  const status = (r: (typeof modulListe)[number]) => {
    const vorbei = r.tage.filter((x) => Date.parse(x.ends_at) < jetzt).length;
    if (r.modules.cancelled_at) return "Modul abgesagt";
    if (r.status === "excused") return "entschuldigt";
    if (r.status === "cancelled") return "abgemeldet";
    if (r.status === "waitlist") return "Warteliste";
    if (r.status !== "confirmed") return "nicht bestätigt";
    if (vorbei === 0) return r.rsvp === "zugesagt" ? "angemeldet, zugesagt" : r.rsvp === "abgesagt" ? "angemeldet, abgesagt" : "angemeldet";
    if (r.attendances.length === 0) return "nicht gekommen";
    return `teilgenommen (${r.attendances.length}/${r.tage.length} Tage)`;
  };
  const zeilen: [string, string | null | undefined][] = [
    ["Alter", alter ? `${alter} Jahre` : null],
    ["Wohnort", [bewerbung?.city, bewerbung?.country].filter(Boolean).join(", ") || null],
    ["Region", (p.regions as { name: string } | null)?.name],
    ["Land", p.country ? laender[p.country] : null],
    ["GT / KGT", p.branch],
    ["Geschlecht", p.gender === "w" ? "weiblich" : p.gender === "m" ? "männlich" : null],
    ["E-Mail", p.email],
    ["Telefon", p.phone],
    ["Verantwortlich", (p.mentors as { name: string } | null)?.name],
    ["Dabei seit", ersterTag ? datum.format(new Date(ersterTag)) : null],
    ["Status", p.active ? "aktiv" : "ausgeschieden"],
    ["Kurzcode", p.short_code ? kurzcodeAnzeige(p.short_code) : null],
  ];

  const kopf = (
    <div className="kopf">
      <img src="/brand/ses-logo.png" alt="SES Academy" />
      <span>Teilnehmenden-Akte · intern · Stand {heute}</span>
    </div>
  );

  return (
    <>
      <style>{`
        @page { size: A4; margin: 0; }
        @media print { .nur-bildschirm { display: none !important; } html, body { margin: 0; background: #fff; } .blatt { margin: 0 !important; box-shadow: none !important; } }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media screen { body { background: #f1efe8; } }
        .blatt { width: 210mm; min-height: 296.5mm; box-sizing: border-box; margin: 8mm auto; background: #fff; box-shadow: 0 1mm 6mm rgb(0 0 0 / .12);
          font-family: var(--font-inter), Arial, sans-serif; color: ${tinte}; font-size: 9.8pt; line-height: 1.45; padding: 15mm 18mm 16mm; break-after: page; }
        .blatt:last-of-type { break-after: auto; }
        .serif { font-family: var(--font-newsreader), Georgia, serif; }
        .kopf { display: flex; justify-content: space-between; align-items: center; margin-bottom: 9mm; }
        .kopf img { height: 11mm; }
        .kopf span { font-size: 7.5pt; letter-spacing: .22em; text-transform: uppercase; color: #6b7a71; }
        .band { background: ${gruen}; color: #fff; padding: 3.4mm 4.5mm; font-size: 15pt; font-weight: 600; }
        .person { display: grid; grid-template-columns: 38mm 1fr; gap: 7mm; margin-top: 6mm; }
        .bild { width: 38mm; height: 46mm; object-fit: cover; border-radius: 2mm; background: ${hellgruen}; display: grid; place-items: center; font-size: 26pt; color: ${gruen}; font-weight: 700; }
        h1 { font-size: 24pt; font-weight: 500; margin: 0 0 3mm; line-height: 1.1; }
        dl.stamm { display: grid; grid-template-columns: 30mm 1fr; gap: 1.2mm 4mm; margin: 0; }
        dl.stamm dt { color: ${grau}; font-size: 8.5pt; }
        dl.stamm dd { margin: 0; }
        .abschnitt { margin: 8mm 0 3mm; font-size: 7.5pt; letter-spacing: .3em; font-weight: 700; text-transform: uppercase; color: ${gruen}; border-bottom: 0.3mm solid ${gruen}; padding-bottom: 1.5mm; }
        .chips span { display: inline-block; margin: 0 1.5mm 1.5mm 0; padding: 0.8mm 2.6mm; border-radius: 4mm; background: ${hellgruen}; font-size: 9pt; font-weight: 600; }
        .zahlen { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin-top: 4mm; }
        .zahlen div { background: ${hellgruen}; padding: 2.5mm 3mm; }
        .zahlen b { display: block; font-size: 14pt; }
        .zahlen span { font-size: 8pt; color: ${grau}; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; font-size: 7.5pt; letter-spacing: .12em; text-transform: uppercase; color: ${grau}; padding: 1.5mm 2mm; border-bottom: 0.3mm solid ${gruen}; }
        td { padding: 2mm 2mm; vertical-align: top; border-bottom: 0.2mm solid #e4e1d8; }
        tr { break-inside: avoid; }
        .klein { font-size: 8.5pt; color: ${grau}; }
        dl.angaben { margin: 0; }
        dl.angaben dt { font-size: 7.5pt; letter-spacing: .12em; text-transform: uppercase; color: ${grau}; margin-top: 2.5mm; }
        dl.angaben dd { margin: 0.5mm 0 0; white-space: pre-line; }
        .zweispaltig { display: grid; grid-template-columns: 1fr 1fr; gap: 0 8mm; }
        .cv img { max-width: 100%; max-height: 250mm; display: block; margin: 4mm auto 0; }
      `}</style>

      <div lang={staff.sprache} className="nur-bildschirm sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-line bg-paper px-5 py-3 text-sm">
        <p className="mr-auto"><span className="font-semibold">{t.titel} · {name}</span>{profil?.cv_path && !cvBild ? ` · ${t.hinweis}` : ""}</p>
        <a href={`/team/teilnehmende/${id}/akte/pdf/`} className="rounded-full bg-ink px-5 py-2 font-semibold text-paper">{t.pdf}</a>
        <button id="drucken" className="rounded-full bg-white px-5 py-2 font-semibold ring-1 ring-line">{t.drucken}</button>
        <script dangerouslySetInnerHTML={{ __html: "document.getElementById('drucken').onclick=()=>window.print()" }} />
      </div>

      <section className="blatt">
        {kopf}
        <div className="band serif">Teilnehmenden-Akte</div>
        <div className="person">
          {p.photo_path ? <img className="bild" src={`/portal/foto/${p.id}/`} alt="" /> : <div className="bild serif">{(p.first_name[0] ?? "") + (p.last_name[0] ?? "")}</div>}
          <div>
            <h1 className="serif">{name}</h1>
            <dl className="stamm">
              {zeilen.filter(([, v]) => v).map(([k, v]) => <div key={k} style={{ display: "contents" }}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
          </div>
        </div>

        <div className="zahlen">
          <div><b>{k ? `${k.total_attended}/${k.total_attended + k.total_no_shows}` : "–"}</b><span>Tage anwesend</span></div>
          <div><b>{k?.attendance_rate != null ? `${Math.round(k.attendance_rate)} %` : "–"}</b><span>Anwesenheitsquote</span></div>
          <div><b>{modulListe.filter((r) => r.attendances.length > 0).length}</b><span>Module besucht</span></div>
          <div><b>{abgaben.length}</b><span>Hausaufgaben abgegeben</span></div>
        </div>

        <p className="abschnitt">Stärken und Aufgaben</p>
        {(profil?.skills.length || profil?.tasks.length || profil?.assessment) ? (
          <>
            {profil.skills.length > 0 && <p className="chips"><span style={{ background: "none", padding: 0, fontWeight: 400, color: grau }}>Kann gut:</span>{profil.skills.map((s) => <span key={s}>{s}</span>)}</p>}
            {profil.tasks.length > 0 && <p className="chips"><span style={{ background: "none", padding: 0, fontWeight: 400, color: grau }}>Verantwortlich für:</span>{profil.tasks.map((s) => <span key={s} style={{ background: "#eef6c9" }}>{s}</span>)}</p>}
            {profil.assessment && <p style={{ whiteSpace: "pre-line", margin: "2mm 0 0" }}>{profil.assessment}</p>}
          </>
        ) : <p className="klein">Noch nichts eingetragen.</p>}

        <p className="abschnitt">Teilnahme</p>
        {modulListe.length === 0 ? <p className="klein">Für kein Modul angemeldet.</p> : (
          <table>
            <thead><tr><th>Modul</th><th>Status</th><th>Tage (✓ da, Uhrzeit = Ankunft per QR)</th><th>Gruppe · Zimmer</th></tr></thead>
            <tbody>
              {modulListe.map((r) => {
                const g = gruppeVon.get(r.modules.id);
                const z = zimmerVon.get(r.modules.id);
                return (
                  <tr key={r.id}>
                    <td><b>{r.modules.title}</b><br /><span className="klein">{datum.format(new Date(r.tage[0].starts_at))}</span></td>
                    <td>{status(r)}</td>
                    <td>
                      {r.tage.filter((x) => Date.parse(x.starts_at) < jetzt).map((x, i) => {
                        const a = r.attendances.find((y) => y.module_day_id === x.id);
                        return <span key={x.id} style={{ whiteSpace: "nowrap" }}>{i > 0 && " · "}{tagKurz.format(new Date(x.starts_at))} {a ? `✓${a.method === "manual" ? "" : ` ${uhr.format(new Date(a.checked_in_at))}`}` : "–"}</span>;
                      })}
                      {r.tage.every((x) => Date.parse(x.starts_at) >= jetzt) && <span className="klein">kommt noch</span>}
                    </td>
                    <td>{g ? <div>{g.name}{g.room ? ` (${g.room})` : ""}</div> : null}{z ? <div>Zimmer {z.room_label}{z.mates.length ? ` mit ${z.mates.join(", ")}` : ""}</div> : null}{!g && !z && <span className="klein">–</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {abgaben.length > 0 && (
          <>
            <p className="abschnitt">Hausaufgaben</p>
            <table>
              <tbody>
                {abgaben.map((a) => {
                  const e = zusammenfassen(a.reviews);
                  return <tr key={a.id}><td>Hausaufgabe {a.assignments?.number}{a.assignments?.title && !/^hausaufgabe \d+$/i.test(a.assignments.title) ? `: ${a.assignments.title}` : ""}</td><td style={{ textAlign: "right" }}>{e.durchschnitt != null ? `${e.durchschnitt.toLocaleString("de-DE")} · ${e.urteil ?? ""}` : "noch nicht bewertet"}</td></tr>;
                })}
              </tbody>
            </table>
          </>
        )}
      </section>

      <section className="blatt">
        {kopf}
        <div className="band serif">Steckbrief aus der Bewerbung</div>
        {!bewerbung ? <p className="klein" style={{ marginTop: "6mm" }}>Keine Bewerbung gefunden.</p> : (
          <>
            <p className="klein" style={{ marginTop: "4mm" }}>Bewerbung vom {datum.format(new Date(bewerbung.created_at))} · {bewerbungStatus[bewerbung.status] ?? bewerbung.status}{bewerbung.languages.length ? ` · Sprachen: ${bewerbung.languages.join(", ")}` : ""}</p>
            <div className="zweispaltig">
              {(["bildung", "beruf", "engagement", "sonst"] as const).map((gr) => {
                const teil = angaben.filter((a) => a.gruppe === gr);
                return teil.length > 0 && (
                  <div key={gr}>
                    <p className="abschnitt">{gruppenNamen[gr]}</p>
                    <dl className="angaben">{teil.map((a) => <div key={a.name}><dt>{a.name}</dt><dd>{a.wert}</dd></div>)}</dl>
                  </div>
                );
              })}
            </div>
            {aussagekraeftig(bewerbung.motivation) && (
              <>
                <p className="abschnitt">Motivation</p>
                <p style={{ whiteSpace: "pre-line", margin: 0 }}>{bewerbung.motivation}</p>
              </>
            )}
          </>
        )}
        {profil?.cv_path && !cvBild && <p className="klein" style={{ marginTop: "8mm" }}>Lebenslauf: {profil.cv_name ?? "Datei"} (in der PDF-Fassung als Anhang).</p>}
      </section>

      {cvBild && (
        <section className="blatt cv">
          {kopf}
          <div className="band serif">Lebenslauf</div>
          <img src={`/team/teilnehmende/${id}/dateien/?art=lebenslauf`} alt="Lebenslauf" />
        </section>
      )}
    </>
  );
}
