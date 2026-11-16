import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Hinweis } from "@/components/team/Hinweis";
import { MailHinweis } from "@/components/team/MailHinweis";
import { ModulReiter } from "@/components/team/ModulReiter";
import { TeamKopf } from "@/components/team/TeamKopf";
import { laenderNamen } from "@/components/team/Ui";
import { feedbackEinladen, frageEntfernen, frageHinzufuegen, umfrageAnlegen, umfrageJetztOeffnen } from "@/lib/aktionen/feedback";
import { ort, regionName } from "@/lib/orte";
import { requireStaff } from "@/lib/auth";
import { istToken } from "@/lib/codes";
import { createClient } from "@/lib/supabase/server";
import { teamLocale, type TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";
import { jetztMs } from "@/lib/zeit";

export const metadata: Metadata = { title: "Auswertung des Moduls | SES Academy" };

type Hinweise = Record<string, { text: string; gut: boolean }>;

const de = {
  hinweise: {
    "feedback-angelegt": { text: "Umfrage mit Standardfragen angelegt. Fragen prüfen, dann nach dem Modul die Einladung senden.", gut: true },
    "feedback-offen": { text: "Umfrage ist freigeschaltet. Anwesende sehen sie jetzt auf der Ticket-Seite und in „Mein Bereich“.", gut: true },
    "feedback-ohne-termin": { text: "Zuerst Termine eintragen, die Umfrage öffnet am letzten Modultag.", gut: false },
    "frage-gespeichert": { text: "Frage hinzugefügt.", gut: true },
    "frage-entfernt": { text: "Frage entfernt.", gut: true },
    "frage-hat-antworten": { text: "Es gibt schon Antworten. Fragen lassen sich jetzt nicht mehr entfernen.", gut: false },
    fehler: { text: "Das hat nicht geklappt.", gut: false },
  } as Hinweise,
  anwesenheit: "Anwesenheit",
  anwesenheitText: "Gezählt sind bestätigte Anmeldungen und wer am Einlass eingecheckt wurde.",
  tag: "Tag", erwartet: "angemeldet", da: "da", quote: "Quote", zugesagtNichtDa: "zugesagt, aber nicht da",
  nachLand: "Nach Land", nachZweig: "Nach GT / KGT", nachRegion: "Nach Region", ohne: "ohne Angabe",
  mindEinTag: "mind. ein Tag da", nieDa: "an keinem Tag da", liste: "Liste ansehen",
  feedback: "Feedback der Teilnehmenden",
  einladungen: (n: number) => `${n} Einladungen verschickt`,
  einladungenFehler: (n: number) => `, ${n} fehlgeschlagen (meist fehlt die E-Mail-Adresse).`,
  umfrageText: "Die Umfrage öffnet am letzten Modultag um 13 Uhr und bleibt 14 Tage offen. Antworten können nur Anwesende.",
  umfrageAnlegen: "Umfrage anlegen",
  offen: (von: string, bis: string) => `Offen von ${von} bis ${bis}`,
  zuletzt: (tag: string) => ` · Einladung zuletzt am ${tag}`,
  antworten: (n: number) => `${n} Antworten`,
  vonAnwesenden: (n: number, da: number) => `${n} von ${da} Anwesenden haben geantwortet`,
  freischalten: "Jetzt freischalten",
  einladen: "Erinnerung an Anwesende ohne Antwort senden",
  bewertungen: "Bewertungen",
  durchschnitt: "Ø",
  auswahl: "Auswahlfragen",
  anders: (n: number) => `${n}× „Sonstiges“`,
  kommentare: "Kommentare",
  lesen: (n: number) => `${n} Antworten lesen`,
  fragenBearbeiten: (n: number) => `Fragen bearbeiten (${n})`,
  skala: "Skala", freitext: "Freitext", pflicht: "Pflicht", nur: (land: string) => `nur ${land}`,
  neueFrage: "Neue Frage", art: "Art", entfernen: "entfernen",
  keineAntworten: "Noch keine Antworten.",
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    hinweise: {
      "feedback-angelegt": { text: "Standart sorularla anket oluşturuldu. Soruları kontrol et, modülden sonra daveti gönder.", gut: true },
      "feedback-offen": { text: "Anket açıldı. Katılanlar onu artık bilet sayfasında ve „Mein Bereich“ alanında görüyor.", gut: true },
      "feedback-ohne-termin": { text: "Önce tarihleri gir; anket modülün son gününde açılır.", gut: false },
      "frage-gespeichert": { text: "Soru eklendi.", gut: true },
      "frage-entfernt": { text: "Soru kaldırıldı.", gut: true },
      "frage-hat-antworten": { text: "Zaten cevaplar var. Sorular artık kaldırılamaz.", gut: false },
      fehler: { text: teamTexte.tr.meldung.fehler, gut: false },
    },
    anwesenheit: "Katılım",
    anwesenheitText: "Onaylı kayıtlar ve girişte kaydı yapılanlar sayılır.",
    tag: "Gün", erwartet: "kayıtlı", da: "katıldı", quote: "Oran", zugesagtNichtDa: "katılacağını söyleyip gelmeyen",
    nachLand: "Ülkeye göre", nachZweig: "GT / KGT’ye göre", nachRegion: "Bölgeye göre", ohne: "bilgi yok",
    mindEinTag: "en az bir gün katılan", nieDa: "hiç gelmeyen", liste: "Listeyi gör",
    feedback: "Katılımcı geri bildirimi",
    einladungen: (n) => `${n} davet gönderildi`,
    einladungenFehler: (n) => `, ${n} başarısız (çoğunlukla e-posta adresi eksik).`,
    umfrageText: "Anket modülün son gününde saat 13:00’te açılır ve 14 gün açık kalır. Yalnızca katılmış olanlar cevap verebilir.",
    umfrageAnlegen: "Anket oluştur",
    offen: (von, bis) => `Açık: ${von} – ${bis}`,
    zuletzt: (tag) => ` · son davet ${tag}`,
    antworten: (n) => `${n} cevap`,
    vonAnwesenden: (n, da) => `Katılan ${da} kişiden ${n} kişi cevap verdi`,
    freischalten: "Şimdi aç",
    einladen: "Cevap vermeyen katılanlara hatırlatma gönder",
    bewertungen: "Puanlar",
    durchschnitt: "Ort.",
    auswahl: "Seçmeli sorular",
    anders: (n) => `${n}× „Diğer“`,
    kommentare: "Yorumlar",
    lesen: (n) => `${n} cevabı oku`,
    fragenBearbeiten: (n) => `Soruları düzenle (${n})`,
    skala: "Ölçek", freitext: "Serbest metin", pflicht: "zorunlu", nur: (land) => `yalnızca ${land}`,
    neueFrage: "Yeni soru", art: "Tür", entfernen: "kaldır",
    keineAntworten: "Henüz cevap yok.",
  },
  fr: {
    hinweise: {
      "feedback-angelegt": { text: "Questionnaire créé avec les questions standard. Vérifie-les, puis envoie l’invitation après le module.", gut: true },
      "feedback-offen": { text: "Le questionnaire est ouvert. Les présents le voient sur la page du billet et dans « Mein Bereich ».", gut: true },
      "feedback-ohne-termin": { text: "Ajoute d’abord les dates ; le questionnaire ouvre le dernier jour du module.", gut: false },
      "frage-gespeichert": { text: "Question ajoutée.", gut: true },
      "frage-entfernt": { text: "Question supprimée.", gut: true },
      "frage-hat-antworten": { text: "Il y a déjà des réponses. Les questions ne peuvent plus être supprimées.", gut: false },
      fehler: { text: teamTexte.fr.meldung.fehler, gut: false },
    },
    anwesenheit: "Présence",
    anwesenheitText: "Sont comptées les inscriptions confirmées et les personnes enregistrées à l’accueil.",
    tag: "Jour", erwartet: "inscrits", da: "présents", quote: "Taux", zugesagtNichtDa: "ont confirmé mais absents",
    nachLand: "Par pays", nachZweig: "Par GT / KGT", nachRegion: "Par région", ohne: "non renseigné",
    mindEinTag: "présents au moins un jour", nieDa: "jamais présents", liste: "Voir la liste",
    feedback: "Retours des participants",
    einladungen: (n) => `${n} invitations envoyées`,
    einladungenFehler: (n) => `, ${n} échecs (souvent faute d’adresse e-mail).`,
    umfrageText: "Le questionnaire ouvre le dernier jour du module à 13 h et reste ouvert 14 jours. Seuls les présents peuvent répondre.",
    umfrageAnlegen: "Créer le questionnaire",
    offen: (von, bis) => `Ouvert du ${von} au ${bis}`,
    zuletzt: (tag) => ` · dernière invitation le ${tag}`,
    antworten: (n) => `${n} réponses`,
    vonAnwesenden: (n, da) => `${n} présents sur ${da} ont répondu`,
    freischalten: "Ouvrir maintenant",
    einladen: "Relancer les présents sans réponse",
    bewertungen: "Notes",
    durchschnitt: "Moy.",
    auswahl: "Questions à choix",
    anders: (n) => `${n}× « Autre »`,
    kommentare: "Commentaires",
    lesen: (n) => `Lire les ${n} réponses`,
    fragenBearbeiten: (n) => `Modifier les questions (${n})`,
    skala: "Échelle", freitext: "Texte libre", pflicht: "obligatoire", nur: (land) => `seulement ${land}`,
    neueFrage: "Nouvelle question", art: "Type", entfernen: "supprimer",
    keineAntworten: "Pas encore de réponses.",
  },
};

type Reg = {
  status: string; rsvp: string | null;
  participants: { country: string | null; branch: string | null; regions: { name: string } | null } | null;
  attendances: { module_day_id: string }[];
};

/** Balken für eine Quote (0–100). */
function Balken({ wert, ton = "bg-forest" }: { wert: number; ton?: string }) {
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-paper-deep">
      <span className={`block h-full rounded-full ${ton}`} style={{ width: `${Math.max(0, Math.min(100, wert))}%` }} />
    </span>
  );
}

/**
 * Auswertung eines Moduls (neu 16.11.2026): Anwesenheit nach Tag, Land, GT/KGT und Region, darunter das Feedback.
 * Bewertungen kompakt mit Durchschnitt und Verteilung, Kommentare eingeklappt je Frage, damit die Seite lesbar bleibt.
 */
export default async function ModulAuswertung({ params, searchParams }: PageProps<"/team/module/[id]/auswertung">) {
  const staff = await requireStaff("alles");
  const l = staff.sprache;
  const t = T[l];
  const w = teamTexte[l];
  const { id } = await params;
  const { hinweis } = await searchParams;
  if (!istToken(id)) notFound();
  const supabase = await createClient();
  const { data: modul } = await supabase.from("modules").select("id, title, module_days(id, starts_at, ends_at)").eq("id", id).maybeSingle();
  if (!modul) notFound();
  const [{ data: regs }, { data: umfrage }] = await Promise.all([
    supabase.from("registrations").select("status, rsvp, participants(country, branch, regions(name)), attendances(module_day_id)").eq("module_id", id),
    supabase.from("feedback_surveys").select("id, opens_at, closes_at, sent_at, feedback_questions(id, position, kind, prompt, scale_max, required, country)").eq("module_id", id).maybeSingle(),
  ]);
  const { data: ergebnisse } = umfrage ? await supabase.rpc("get_feedback_results", { p_survey_id: umfrage.id }) : { data: null };

  const jetzt = jetztMs();
  const zahl = (x: number) => x.toLocaleString(teamLocale[l], { maximumFractionDigits: 1 });
  const prozent = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  const kurzTag = new Intl.DateTimeFormat(teamLocale[l], { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Berlin" });
  const datum = new Intl.DateTimeFormat(teamLocale[l], { day: "numeric", month: "long", timeZone: "Europe/Berlin" });
  const tage = [...modul.module_days].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const vergangen = tage.filter((x) => Date.parse(x.starts_at) < jetzt);
  const bestaetigt = ((regs ?? []) as unknown as Reg[]).filter((r) => r.status === "confirmed" && r.participants);
  const daMind = bestaetigt.filter((r) => r.attendances.length > 0);
  const zugesagtNichtDa = bestaetigt.filter((r) => r.rsvp === "zugesagt" && r.attendances.length === 0).length;

  const gruppiert = (schluessel: (r: Reg) => string) => {
    const karte = new Map<string, { alle: number; da: number }>();
    for (const r of bestaetigt) {
      const k = schluessel(r);
      const x = karte.get(k) ?? { alle: 0, da: 0 };
      karte.set(k, { alle: x.alle + 1, da: x.da + (r.attendances.length > 0 ? 1 : 0) });
    }
    return [...karte].sort((a, b) => b[1].alle - a[1].alle);
  };
  const laender = laenderNamen[l];
  const nachLand = gruppiert((r) => (r.participants!.country ? laender[r.participants!.country] ?? r.participants!.country : t.ohne));
  const nachZweig = gruppiert((r) => r.participants!.branch ?? t.ohne);
  const nachRegion = gruppiert((r) => regionName(r.participants!.regions?.name, l) ?? t.ohne);

  const fragen = umfrage ? [...umfrage.feedback_questions].sort((a, b) => a.position - b.position) : [];
  const res = ergebnisse ?? [];
  const antworten = Math.max(0, ...res.map((e) => e.answers));
  const skalen = res.filter((e) => e.kind === "skala");
  const auswahl = res.filter((e) => e.kind === "auswahl");
  const texte = res.filter((e) => e.kind !== "skala" && e.kind !== "auswahl" && (e.texts ?? []).some((x) => x.trim().length > 1));
  const feedbackVersand = typeof hinweis === "string" && /^feedback-\d+-\d+$/.test(hinweis) ? hinweis.split("-").slice(1).map(Number) : null;

  const tabelle = (titel: string, zeilen: [string, { alle: number; da: number }][]) => (
    <div>
      {titel && <h3 className="mb-2 text-sm font-semibold tracking-wide text-ink-soft uppercase">{titel}</h3>}
      <ul className="space-y-2">
        {zeilen.map(([name, x]) => (
          <li key={name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm">
            <span className="truncate">{name}</span>
            <span className="tabular-nums text-ink-soft"><span className="font-semibold text-ink">{x.da}</span> / {x.alle} · {prozent(x.da, x.alle)} %</span>
            <span className="col-span-2"><Balken wert={prozent(x.da, x.alle)} /></span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <>
      <TeamKopf staff={staff} aktiv="module" />
      <main lang={l} className="mx-auto max-w-6xl px-4 py-8">
        <ModulReiter id={id} titel={modul.title} aktiv="auswertung/" />
        <Hinweis code={hinweis} texte={t.hinweise} />

        <section className="karte">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-2xl font-bold">{t.anwesenheit}</h2>
            <Link href={`/team/module/${id}/teilnehmende/?filter=fehlt`} className="link text-sm">{t.liste}</Link>
          </div>
          <p className="mt-1 text-sm text-ink-soft">{t.anwesenheitText}</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {tage.map((x) => {
              const da = bestaetigt.filter((r) => r.attendances.some((a) => a.module_day_id === x.id)).length;
              const vorbei = Date.parse(x.starts_at) < jetzt;
              return (
                <div key={x.id} className="rounded-2xl bg-paper p-4">
                  <p className="text-sm text-ink-soft">{kurzTag.format(new Date(x.starts_at))}</p>
                  <p className="font-display mt-1 text-3xl font-extrabold tabular-nums">{vorbei ? da : "–"}<span className="text-base text-ink-soft"> / {bestaetigt.length}</span></p>
                  {vorbei && <div className="mt-2"><Balken wert={prozent(da, bestaetigt.length)} /></div>}
                </div>
              );
            })}
            {vergangen.length > 0 && (
              <>
                <div className="rounded-2xl bg-paper p-4">
                  <p className="text-sm text-ink-soft">{t.mindEinTag}</p>
                  <p className="font-display mt-1 text-3xl font-extrabold tabular-nums">{daMind.length}<span className="text-base text-ink-soft"> · {prozent(daMind.length, bestaetigt.length)} %</span></p>
                </div>
                <Link href={`/team/module/${id}/teilnehmende/?filter=fehlt`} className="rounded-2xl bg-gelb-hell p-4 hover:ring-1 hover:ring-ink">
                  <p className="text-sm">{t.zugesagtNichtDa}</p>
                  <p className="font-display mt-1 text-3xl font-extrabold tabular-nums">{zugesagtNichtDa}</p>
                </Link>
              </>
            )}
          </div>

          {vergangen.length > 0 && (
            <div className="mt-8 grid gap-8 md:grid-cols-3">
              {tabelle(t.nachLand, nachLand)}
              {tabelle(t.nachZweig, nachZweig)}
              <details className="md:col-span-1" open={nachRegion.length <= 8}>
                <summary className="cursor-pointer text-sm font-semibold tracking-wide text-ink-soft uppercase">{t.nachRegion} ({nachRegion.length})</summary>
                <div className="mt-2">{tabelle("", nachRegion)}</div>
              </details>
            </div>
          )}
        </section>

        <section id="feedback" className="karte mt-6">
          <h2 className="font-display text-2xl font-bold">{t.feedback}</h2>
          {feedbackVersand && (
            <p role="status" className={`mt-3 rounded-2xl p-4 text-sm ${feedbackVersand[1] ? "bg-gelb-hell" : "bg-gruen-hell"}`}>
              {t.einladungen(feedbackVersand[0])}{feedbackVersand[1] ? t.einladungenFehler(feedbackVersand[1]) : "."}
            </p>
          )}
          {!umfrage ? (
            <form action={umfrageAnlegen} className="mt-3">
              <p className="text-sm text-ink-soft">{t.umfrageText}</p>
              <input type="hidden" name="module_id" value={id} />
              <button type="submit" className="knopf mt-3">{t.umfrageAnlegen}</button>
            </form>
          ) : (
            <>
              <p className="mt-1 text-sm text-ink-soft">
                {t.offen(datum.format(new Date(umfrage.opens_at)), datum.format(new Date(umfrage.closes_at)))}
                {umfrage.sent_at ? t.zuletzt(datum.format(new Date(umfrage.sent_at))) : ""}
                {" · "}{daMind.length ? t.vonAnwesenden(antworten, daMind.length) : t.antworten(antworten)}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {Date.parse(umfrage.opens_at) > jetzt && (
                  <form action={umfrageJetztOeffnen}>
                    <input type="hidden" name="module_id" value={id} /><input type="hidden" name="survey_id" value={umfrage.id} />
                    <button type="submit" className="knopf">{t.freischalten}</button>
                  </form>
                )}
                {daMind.length > 0 && Date.parse(umfrage.closes_at) > jetzt && (
                  <form action={feedbackEinladen}>
                    <input type="hidden" name="module_id" value={id} /><input type="hidden" name="survey_id" value={umfrage.id} />
                    <button type="submit" className="knopf-hell">{t.einladen}</button>
                  </form>
                )}
              </div>
              <MailHinweis knapp className="mt-2" sprache={l} />

              {antworten === 0 ? <p className="mt-6 text-ink-soft">{t.keineAntworten}</p> : (
                <>
                  {skalen.length > 0 && (
                    <div className="mt-6">
                      <h3 className="mb-3 text-sm font-semibold tracking-wide text-ink-soft uppercase">{t.bewertungen}</h3>
                      <ul className="grid gap-x-8 gap-y-4 md:grid-cols-2">
                        {skalen.map((e) => {
                          const max = e.scale_max ?? 5;
                          const ton = e.average === null ? "bg-paper-deep" : e.average / max >= 0.8 ? "bg-forest" : e.average / max >= 0.6 ? "bg-sage" : "bg-signal";
                          return (
                            <li key={e.question_id}>
                              <div className="flex items-baseline justify-between gap-3">
                                <p className="text-sm font-semibold">{e.prompt}</p>
                                <p className="shrink-0 tabular-nums"><span className="font-display text-xl font-extrabold">{e.average === null ? "–" : zahl(e.average)}</span><span className="text-xs text-ink-soft"> / {max}</span></p>
                              </div>
                              <div className="mt-1.5"><Balken wert={e.average === null ? 0 : (e.average / max) * 100} ton={ton} /></div>
                              <p className="mt-1 text-xs text-ink-soft">{t.antworten(e.answers)}{e.country ? ` · ${t.nur(e.country)}` : ""}</p>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {auswahl.length > 0 && (
                    <div className="mt-8">
                      <h3 className="mb-3 text-sm font-semibold tracking-wide text-ink-soft uppercase">{t.auswahl}</h3>
                      <ul className="grid gap-x-8 gap-y-5 md:grid-cols-2">
                        {auswahl.map((e) => (
                          <li key={e.question_id}>
                            <p className="text-sm font-semibold">{e.prompt}</p>
                            <ul className="mt-2 space-y-1.5">
                              {(e.options ?? []).map((o, i) => {
                                const n = e.distribution?.[i] ?? 0;
                                return (
                                  <li key={o} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 text-sm">
                                    <span className="truncate">{o}</span><span className="tabular-nums font-semibold">{n}</span>
                                    <span className="col-span-2"><Balken wert={prozent(n, e.answers)} ton="bg-sage" /></span>
                                  </li>
                                );
                              })}
                            </ul>
                            {(e.texts ?? []).length > 0 && <p className="mt-1.5 text-xs text-ink-soft">{t.anders((e.texts ?? []).length)}: {(e.texts ?? []).join(" · ")}</p>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {texte.length > 0 && (
                    <div className="mt-8">
                      <h3 className="mb-3 text-sm font-semibold tracking-wide text-ink-soft uppercase">{t.kommentare}</h3>
                      <div className="divide-y divide-line rounded-2xl ring-1 ring-line">
                        {texte.map((e) => {
                          const echte = (e.texts ?? []).filter((x) => x.trim().length > 1);
                          return (
                            <details key={e.question_id} className="group px-4 py-3">
                              <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2">
                                <span className="font-semibold">{e.prompt}</span>
                                <span className="text-sm text-ink-soft group-open:hidden">{t.lesen(echte.length)}</span>
                              </summary>
                              <ul className="mt-3 space-y-2 text-sm">
                                {echte.map((x, i) => <li key={i} className="rounded-xl bg-paper px-3 py-2">{x}</li>)}
                              </ul>
                            </details>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

              <details className="mt-8">
                <summary className="cursor-pointer text-sm font-semibold">{t.fragenBearbeiten(fragen.length)}</summary>
                <ol className="mt-3 space-y-2">
                  {fragen.map((f) => (
                    <li key={f.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="mr-auto">{f.position}. {f.prompt} <span className="text-ink-soft">({f.kind === "skala" ? `${t.skala} 1–${f.scale_max ?? 5}` : f.kind === "auswahl" ? t.auswahl : t.freitext}{f.required ? `, ${t.pflicht}` : ""}{f.country ? `, ${t.nur(f.country)}` : ""})</span></span>
                      {antworten === 0 && (
                        <form action={frageEntfernen}>
                          <input type="hidden" name="module_id" value={id} /><input type="hidden" name="survey_id" value={umfrage.id} /><input type="hidden" name="id" value={f.id} />
                          <button type="submit" className="font-semibold text-ink-soft underline">{t.entfernen}</button>
                        </form>
                      )}
                    </li>
                  ))}
                </ol>
                <form action={frageHinzufuegen} className="mt-4 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="module_id" value={id} /><input type="hidden" name="survey_id" value={umfrage.id} />
                  <div className="min-w-60 flex-1"><label htmlFor="prompt" className="etikett">{t.neueFrage}</label><input id="prompt" name="prompt" required minLength={3} maxLength={300} className="feld" /></div>
                  <div><label htmlFor="kind" className="etikett">{t.art}</label>
                    <select id="kind" name="kind" className="feld"><option value="skala">{t.skala} 1–5</option><option value="text">{t.freitext}</option></select></div>
                  <button type="submit" className="knopf-hell">{w.wort.hinzufuegen}</button>
                </form>
              </details>
            </>
          )}
        </section>
      </main>
    </>
  );
}
