import { RechtlicheLinks } from "@/components/RechtlicheLinks";
import { rechtlicheTexte } from "@/lib/rechtliches";
import type { Metadata } from "next";
import { jetztMs } from "@/lib/zeit";
import { notFound } from "next/navigation";
import { locale } from "@/i18n/typ";
import { abmeldeLinkSenden, perTicketAbmelden, perTicketZuruecknehmen } from "@/lib/aktionen/ticket";
import { portalTexte, sprachOder } from "@/lib/portal-texte";
import { ladeTicket, modulZeitraum } from "@/lib/teilnahme";
import { offeneUmfragen } from "@/lib/feedback";
import { FeedbackKarte } from "@/components/FeedbackKarte";
import { ladeModulProgramm, tagesordnungFassung, type ProgrammTag } from "@/lib/modul-programm";
import { istToken, kurzcodeAnzeige, ticketQrSvg } from "@/lib/tickets";
import { WalletKnoepfe } from "@/components/WalletKnoepfe";
import { QrVollbild } from "@/components/QrVollbild";
import { istInterneZimmerbezeichnung } from "@/lib/zimmer-anzeige";
import { SprachUmschalter } from "@/components/SprachUmschalter";
import { linkSpracheSetzen } from "@/lib/aktionen/sprache";

export const metadata: Metadata = { title: "Ticket | SES Academy", robots: { index: false, follow: false }, referrer: "same-origin" };

/** Nummer im Hinweis „Zimmereinteilung wird aktualisiert“ und unter „Hilfe“, wird als Anruf-Link gezeigt. */
const TELEFON = "+49 151 70543675";

const route = (adresse: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adresse)}`;

/** Text mit der Telefonnummer darin: die Nummer antippbar (Android erkennt Nummern nicht von selbst). */
function MitTelefon({ text }: { text: string }) {
  return text.split(TELEFON).flatMap((teil, i) => i === 0 ? [teil] : [
    <a key={i} href={`tel:${TELEFON.replace(/\s/g, "")}`} className="font-semibold whitespace-nowrap underline underline-offset-2">{TELEFON}</a>, teil,
  ]);
}

/**
 * Ticket-Seite der Teilnehmenden (Link aus der Mail oder Inhalt des QR-Codes). Neu geordnet am 14.11.2026:
 * oben das laufende bzw. nächste Modul; Ticket mit Einlass pro Tag (man checkt jeden Tag neu ein), Zimmer, Programm,
 * Ort und Hilfe. Am Handy untereinander mit Sprungleiste, am Laptop zwei Spalten (links Ticket, rechts der Rest).
 */
export default async function TicketSeite({ params, searchParams }: PageProps<"/ticket/[token]">) {
  const { token } = await params;
  const { hinweis, sprache } = await searchParams;
  if (!istToken(token)) notFound();
  const daten = await ladeTicket({ token: token.toLowerCase() });
  if (!daten) notFound();

  const p = daten.participant;
  // Über den Mail-Link speichert der Umschalter die Sprache im Profil; mit dem QR-Inhalt wechselt nur die Anzeige (?sprache=)
  const l = !daten.perLink && (sprache === "de" || sprache === "tr" || sprache === "fr") ? sprache : sprachOder(p.preferred_language);
  const t = portalTexte[l];
  const svg = await ticketQrSvg(p.checkin_token);
  const jetzt = jetztMs();
  const meldungen: Record<string, string> = {
    abgemeldet: t.abgemeldet, "zu-spaet": t.zuSpaet, fehler: t.unbekannt, "link-gesendet": t.abmeldeLinkGesendet,
    "wieder-dabei": t.wiederAngemeldet, "wieder-warteliste": t.wiederWarteliste, "nicht-moeglich": t.nichtMehrMoeglich,
  };
  const meldung = typeof hinweis === "string" ? meldungen[hinweis] ?? null : null;
  // Abmelden und „Doch teilnehmen“ nur über den Link aus der Mail, nicht mit dem Inhalt des QR-Codes
  const perLink = daten.perLink;
  // Offene Feedback-Umfragen (nur Anwesende), siehe lib/feedback.ts
  const umfragen = perLink ? await offeneUmfragen(p.id, l) : [];
  // Laufendes bzw. nächstes Modul mit Programm und PDF
  const naechstes = daten.module.find((m) => !m.abgesagt && m.tage.some((d) => Date.parse(d.ende) >= jetzt)) ?? null;
  const [programm, pdf] = naechstes ? await Promise.all([ladeModulProgramm(naechstes.moduleId, l), tagesordnungFassung(naechstes.moduleId, l, true)]) : [[] as ProgrammTag[], null];
  // Zimmer mit Zimmerpartner:innen nur über den Mail-Link, nicht über den QR-Inhalt (der wird gezeigt und fotografiert)
  const zimmer = perLink && naechstes ? daten.zimmer.find((z) => z.moduleId === naechstes.moduleId) : undefined;
  const frueher = daten.module.filter((m) => !m.abgesagt && m !== naechstes).sort((a, b) => (b.beginn ?? "").localeCompare(a.beginn ?? ""));

  const kommt = naechstes?.beginn != null && Date.parse(naechstes.beginn) > jetzt;
  const kannAbmelden = !!naechstes && kommt && (naechstes.status === "confirmed" || naechstes.status === "waitlist" || naechstes.status === "pending");

  const tagFormat = new Intl.DateTimeFormat(locale[l], { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Berlin" });
  const wochentag = new Intl.DateTimeFormat(locale[l], { weekday: "long", timeZone: "Europe/Berlin" });
  const uhr = new Intl.DateTimeFormat(locale[l], { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
  const tagSchluessel = new Intl.DateTimeFormat("en-CA", { dateStyle: "short", timeZone: "Europe/Berlin" });
  const heute = tagSchluessel.format(new Date(jetzt));
  const zeit = (von: string, bis: string | null) => `${uhr.format(new Date(von))}${bis ? `–${uhr.format(new Date(bis))}` : ""}`;
  const offenerTag = programm.find((d) => tagSchluessel.format(new Date(d.beginn)) === heute)?.beginn
    ?? programm.find((d) => Date.parse(d.ende) >= jetzt)?.beginn ?? null;
  const mitProgramm = !!naechstes && programm.some((d) => d.punkte.length);
  const mitTicket = !naechstes || naechstes.ticketNoetig;

  const abschnitte = [
    { id: "ticket", name: t.navTicket },
    ...(zimmer ? [{ id: "zimmer", name: t.navZimmer }] : []),
    ...(mitProgramm ? [{ id: "programm", name: t.navProgramm }] : []),
    { id: "hilfe", name: t.navHilfe },
  ];
  const karte = "scroll-mt-16 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-line";
  const titel = "font-display text-lg font-bold";

  return (
    <main lang={l} className="mx-auto max-w-lg px-4 pb-10 pt-5 lg:max-w-5xl lg:px-8 lg:pt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <img src="/brand/ses-logo.png" alt="SES Academy" className="h-9 w-auto" />
        {daten.perLink
          ? <SprachUmschalter aktiv={l} action={linkSpracheSetzen} felder={{ token: token.toLowerCase() }} />
          : <SprachUmschalter aktiv={l} href={(x) => `/ticket/${token.toLowerCase()}/?sprache=${x}`} />}
      </div>

      {/* Kopf: Person und laufendes bzw. nächstes Modul */}
      <header className="mt-4 rounded-3xl bg-forest px-5 py-4 text-paper lg:flex lg:items-end lg:justify-between lg:gap-6 lg:px-7 lg:py-6">
        <div>
          <p className="text-sm text-paper/80">{p.first_name} {p.last_name}</p>
          <h1 className="font-display text-2xl font-bold leading-tight lg:text-4xl">{naechstes ? naechstes.titel : t.ticketTitel}</h1>
          {naechstes && <p className="mt-1 text-sm text-paper/85 lg:text-base">{modulZeitraum(naechstes, locale[l])}{naechstes.ort ? ` · ${naechstes.ort}` : ""}</p>}
        </div>
        {naechstes && <p className="mt-3 inline-block rounded-full bg-signal px-3 py-1 text-sm font-semibold text-ink lg:mt-0">{t.status[naechstes.status]}</p>}
      </header>

      {/* Sprungleiste (nur Handy) */}
      <nav aria-label={t.moduleTitel} className="sticky top-0 z-10 -mx-4 mt-3 flex gap-2 overflow-x-auto bg-paper/95 px-4 py-2 backdrop-blur lg:hidden">
        {abschnitte.map((a) => (
          <a key={a.id} href={`#${a.id}`} className="shrink-0 rounded-full bg-white px-4 py-1.5 text-sm font-semibold ring-1 ring-line">{a.name}</a>
        ))}
      </nav>

      {meldung && <p role="status" className="mt-3 rounded-2xl bg-white p-4 ring-1 ring-line">{meldung}</p>}
      {perLink && (
        <FeedbackKarte umfragen={umfragen} token={token.toLowerCase()}
          texte={{ titel: t.feedbackTitel, text: t.feedbackText, geben: t.feedbackGeben, danke: t.feedbackDanke, aendern: t.feedbackAendern }} />
      )}

      <div className="mt-3 grid gap-3 lg:mt-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-start lg:gap-6">
        {/* Linke Spalte: Ticket mit Einlass pro Tag */}
        <section id="ticket" className={`${karte} lg:sticky lg:top-6`}>
          <h2 className={titel}>{t.ticketTitel}</h2>
          {naechstes && mitTicket && naechstes.tage.length > 0 && (
            <>
              <ul className="mt-3 grid gap-1.5">
                {naechstes.tage.map((d) => {
                  const schluessel = tagSchluessel.format(new Date(d.beginn));
                  const zustand = d.eingecheckt ? "da" : schluessel === heute ? "heute" : Date.parse(d.ende) < jetzt ? "weg" : "spaeter";
                  const farbe = { da: "bg-gruen-hell text-ink", heute: "bg-signal/60 text-ink", weg: "bg-paper-deep text-ink-soft", spaeter: "bg-paper-deep/60 text-ink-soft" }[zustand];
                  return (
                    <li key={d.id} className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm ${farbe}`}>
                      <span className="font-semibold">{wochentag.format(new Date(d.beginn))}</span>
                      <span className="text-right">
                        {zustand === "da" ? <>✓ {t.eingechecktUm(uhr.format(new Date(d.eingecheckt!)))}</>
                          : zustand === "heute" ? t.heuteNochNicht : zustand === "weg" ? t.nichtEingecheckt : t.nochOffen}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {naechstes.tage.length > 1 && <p className="mt-2 text-xs font-semibold text-ink-soft">{t.einlassJedenTag}</p>}
            </>
          )}
          {!mitTicket && <p className="mt-2 text-sm text-ink-soft">{t.ohneTicket}</p>}
          <div className="mt-3 text-center">
            <p className="text-sm text-ink-soft">{t.ticketKurz}</p>
            <QrVollbild svg={svg} kurzcode={kurzcodeAnzeige(p.short_code ?? "")} name={`${p.first_name} ${p.last_name}`}
              texte={{ hinweis: t.qrHinweis, oeffnen: t.qrOeffnen, schliessen: t.qrSchliessen }} />
            <p className="mt-2 text-xs text-ink-soft">{t.kurzcode}</p>
            <p className="font-mono text-2xl font-bold tracking-[0.15em]">{kurzcodeAnzeige(p.short_code ?? "")}</p>
            <p className="text-xs text-ink-soft">{t.kurzcodeHilfe}</p>
            <WalletKnoepfe token={token.toLowerCase()} sprache={l} className="mt-3" />
          </div>
        </section>

        {/* Rechte Spalte */}
        <div className="grid gap-3 lg:gap-4">
          {zimmer?.versteckt && (
            <section id="zimmer" className={karte}>
              <h2 className={titel}>{t.zimmerTitel}</h2>
              <p className="mt-2 text-sm"><MitTelefon text={t.zimmerWirdAktualisiert} /></p>
            </section>
          )}
          {zimmer && !zimmer.versteckt && (
            <section id="zimmer" className={karte}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <h2 className={titel}>{t.zimmerTitel}</h2>
                <span className="text-sm text-ink-soft">{t.zimmerArt(zimmer.betten)}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-paper-deep px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.navZimmer}</p>
                  <p className="font-mono text-2xl font-bold">{istInterneZimmerbezeichnung(zimmer.label) ? "–" : zimmer.label}</p>
                </div>
                <div className="rounded-2xl bg-gruen-hell px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.zimmerCode}</p>
                  {zimmer.code
                    ? <p className="font-mono text-2xl font-bold tracking-[0.12em]">{zimmer.code}</p>
                    : <p className="text-sm">{t.zimmerCodeFolgt}</p>}
                </div>
              </div>
              {zimmer.mitbewohner.length > 0 && (
                <p className="mt-3 text-sm">{t.zimmerMit}: <span className="font-semibold">{zimmer.mitbewohner.join(", ")}</span></p>
              )}
              {(zimmer.hotel || zimmer.adresse) && (
                <p className="mt-1 text-sm text-ink-soft">
                  {[zimmer.hotel, zimmer.adresse].filter(Boolean).join(", ")}
                  {zimmer.adresse && <> · <a href={route(zimmer.adresse)} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink underline underline-offset-2">{t.route}</a></>}
                </p>
              )}
            </section>
          )}

          {mitProgramm && naechstes && (
            <section id="programm" className={karte}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <h2 className={titel}>{t.programmTitel}</h2>
                {pdf && <a href={`/programm/${naechstes.moduleId}/${l}/`} target="_blank" rel="noopener" className="text-sm font-semibold underline underline-offset-4">↓ PDF</a>}
              </div>
              <div className="mt-2 grid gap-2">
                {programm.map((d) => {
                  const istHeute = tagSchluessel.format(new Date(d.beginn)) === heute;
                  return (
                    <details key={d.beginn} open={d.beginn === offenerTag} className="rounded-2xl bg-paper-deep/60 px-4 py-2.5">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                        <span className="font-semibold">{tagFormat.format(new Date(d.beginn))} <span className="font-normal text-ink-soft tabular-nums">· {zeit(d.beginn, d.ende)}</span></span>
                        {istHeute && <span className="shrink-0 rounded-full bg-signal px-2.5 py-0.5 text-xs font-bold text-ink">{t.heute}</span>}
                      </summary>
                      <ul className="mt-1.5 divide-y divide-line text-sm">
                        {d.punkte.map((x) => (
                          <li key={x.von + x.titel} className="flex gap-3 py-1.5">
                            <span className="w-[5.9rem] shrink-0 font-semibold tabular-nums">{zeit(x.von, x.bis)}</span>
                            <span>{x.titel}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  );
                })}
              </div>
            </section>
          )}

          {/* Ort und Hilfe zusammen */}
          <section id="hilfe" className={`${karte} grid gap-4 sm:grid-cols-2`}>
            {naechstes?.ort && (
              <div>
                <h2 className={titel}>{t.ortTitel}</h2>
                <p className="mt-1 text-sm">{naechstes.ort}</p>
                <a href={route(naechstes.ort)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-paper">{t.route}</a>
              </div>
            )}
            <div>
              <h2 className={titel}>{t.hilfeTitel}</h2>
              <p className="mt-1 text-sm">{t.hilfeAnruf}</p>
              <a href={`tel:${TELEFON.replace(/\s/g, "")}`} className="mt-2 inline-block rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-paper">{TELEFON}</a>
              <p className="mt-2 text-xs text-ink-soft"><a href="mailto:info@ses-academy.org" className="underline underline-offset-2">info@ses-academy.org</a></p>
            </div>
          </section>

          {/* Abmelden bzw. wieder teilnehmen (nur über den Mail-Link) */}
          {naechstes && kannAbmelden && perLink && (
            <details className="rounded-3xl bg-white/70 px-5 py-3 ring-1 ring-line">
              <summary className="cursor-pointer text-sm font-semibold">{t.abmelden}</summary>
              <form action={perTicketAbmelden} className="mt-3 grid gap-2">
                <input type="hidden" name="token" value={p.link_token} />
                <input type="hidden" name="module_id" value={naechstes.moduleId} />
                <label htmlFor={`grund-${naechstes.moduleId}`} className="text-sm">{t.grund}</label>
                <textarea id={`grund-${naechstes.moduleId}`} name="grund" rows={2} maxLength={500} className="rounded-2xl bg-white px-4 py-3 ring-1 ring-line" />
                <button type="submit" className="justify-self-start rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper">{t.abmeldenBestaetigen}</button>
              </form>
            </details>
          )}
          {naechstes && kommt && perLink && (naechstes.status === "excused" || naechstes.status === "cancelled") && (
            <form action={perTicketZuruecknehmen} className="flex flex-wrap items-center gap-3 rounded-3xl bg-white/70 p-5 ring-1 ring-line">
              <input type="hidden" name="token" value={p.link_token} />
              <input type="hidden" name="module_id" value={naechstes.moduleId} />
              <span className="text-sm text-ink-soft">{t.abgesagtSelbst}</span>
              <button type="submit" className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold ring-1 ring-line">{t.dochTeilnehmen}</button>
            </form>
          )}
          {!perLink && naechstes && kommt && (
            <form action={abmeldeLinkSenden} className="rounded-3xl bg-white/70 p-5 text-sm ring-1 ring-line">
              <input type="hidden" name="token" value={p.checkin_token} />
              <p className="font-semibold">{t.abmelden}</p>
              <p className="mt-1 text-ink-soft">{t.abmeldenPerMail}</p>
              <button type="submit" className="mt-3 rounded-full bg-white px-5 py-2.5 font-semibold ring-1 ring-line">{t.abmeldeLinkSenden}</button>
            </form>
          )}

          {frueher.length > 0 && (
            <details className="rounded-3xl bg-white/70 px-5 py-3 ring-1 ring-line">
              <summary className="cursor-pointer text-sm font-semibold">{t.bisherigeModule} ({frueher.length})</summary>
              <ul className="mt-2 divide-y divide-line">
                {frueher.map((m) => {
                  const besucht = m.tage.filter((d) => d.besucht).length;
                  return (
                    <li key={m.registrationId} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span><span className="font-semibold">{m.titel}</span> <span className="text-ink-soft">· {modulZeitraum(m, locale[l])}</span></span>
                      <span className="shrink-0 rounded-full bg-paper-deep px-3 py-1 text-xs font-semibold">
                        {besucht > 0 ? `${t.besucht} (${besucht}/${m.tage.length})` : t.status[m.status]}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </details>
          )}
        </div>
      </div>

      <RechtlicheLinks {...rechtlicheTexte(l)} className="mt-8 justify-center text-ink-soft" />
    </main>
  );
}
