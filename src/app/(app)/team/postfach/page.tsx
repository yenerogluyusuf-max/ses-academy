import type { Metadata } from "next";
import Link from "next/link";
import { CornerUpLeft, Paperclip } from "lucide-react";
import { TeamKopf } from "@/components/team/TeamKopf";
import { requireStaff } from "@/lib/auth";
import { istOrdner, ordnerListe, postfachBereit, postfachListe, type Kopf, type OrdnerId } from "@/lib/postfach";

export const metadata: Metadata = { title: "Postfach | SES Academy" };

const ADRESSE = "info@ses-academy.org";

/** Heute nur die Uhrzeit, sonst das Datum (wie in Mailprogrammen). */
function wann(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const tag = (x: Date) => new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeZone: "Europe/Berlin" }).format(x);
  return tag(d) === tag(new Date())
    ? new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(d)
    : new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", timeZone: "Europe/Berlin" }).format(d);
}

/**
 * Postfach info@ses-academy.org (Wunsch 12.11.2026): eingehende Mails lesen und beantworten, ohne Postfach-Passwort.
 * Liest direkt vom Mailserver (IMAP), es wird nichts in der Datenbank gespeichert.
 */
export default async function Postfach({ searchParams }: PageProps<"/team/postfach">) {
  const staff = await requireStaff("orga");
  const { ordner: o } = await searchParams;
  const ordner: OrdnerId = istOrdner(o) ? o : "eingang";
  const ergebnis = postfachBereit() ? await postfachListe(ordner).catch(() => null) : null;
  const gesendet = ordner === "gesendet";

  return (
    <>
      <TeamKopf staff={staff} aktiv="postfach" />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="font-display text-3xl font-bold">Postfach</h1>
        <p className="mt-1 text-ink-soft">Mails an {ADRESSE}. Antworten gehen als {ADRESSE} raus.</p>

        <nav aria-label="Ordner" className="mt-6 flex flex-wrap gap-2">
          {ordnerListe.map((x) => (
            <Link key={x.id} href={x.id === "eingang" ? "/team/postfach/" : `/team/postfach/?ordner=${x.id}`}
              aria-current={x.id === ordner ? "page" : undefined}
              className={x.id === ordner ? "rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper" : "rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-line hover:bg-paper-deep"}>
              {x.name}
              {x.id === ordner && ergebnis && ordner !== "gesendet" && ergebnis.ungelesen > 0 ? ` · ${ergebnis.ungelesen} neu` : ""}
            </Link>
          ))}
        </nav>

        {!postfachBereit() ? (
          <p className="karte mt-6">Für das Postfach fehlen die Zugangsdaten auf dem Server.</p>
        ) : !ergebnis ? (
          <p role="alert" className="mt-6 rounded-2xl bg-amber-100 p-4 text-amber-950">Das Postfach ist gerade nicht erreichbar. Bitte in einer Minute neu laden.</p>
        ) : ergebnis.mails.length === 0 ? (
          <p className="karte mt-6 text-ink-soft">Keine Mails in diesem Ordner.</p>
        ) : (
          <ul className="mt-6 divide-y divide-line overflow-hidden rounded-3xl bg-weiss ring-1 ring-ink/[0.06]">
            {ergebnis.mails.map((m: Kopf) => {
              const person = gesendet ? m.an[0] : m.von;
              const neu = !m.gelesen && !gesendet;
              return (
                <li key={m.uid}>
                  <Link href={`/team/postfach/${ordner}/${m.uid}/`} className="grid grid-cols-[auto_1fr_auto] items-baseline gap-x-3 gap-y-0.5 px-4 py-3 hover:bg-paper-deep sm:px-5">
                    <span aria-hidden className={`mt-1.5 h-2 w-2 self-start rounded-full ${neu ? "bg-forest" : "bg-transparent"}`} />
                    <span className={`truncate ${neu ? "font-bold" : "font-semibold"}`}>
                      {gesendet ? "An: " : ""}{person ? person.name || person.adresse : "(unbekannt)"}
                      {neu && <span className="sr-only"> (ungelesen)</span>}
                    </span>
                    <span className="text-sm whitespace-nowrap text-ink-soft">{wann(m.datum)}</span>
                    <span />
                    <span className={`col-span-2 flex items-center gap-1.5 truncate text-sm ${neu ? "font-semibold text-ink" : "text-ink-soft"}`}>
                      {m.beantwortet && <CornerUpLeft aria-label="beantwortet" className="h-3.5 w-3.5 shrink-0" />}
                      {m.anhang && <Paperclip aria-label="mit Anhang" className="h-3.5 w-3.5 shrink-0" />}
                      <span className="truncate">{m.betreff || "(ohne Betreff)"}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {ergebnis && ergebnis.gesamt > ergebnis.mails.length && (
          <p className="mt-3 text-sm text-ink-soft">Gezeigt werden die neuesten {ergebnis.mails.length} von {ergebnis.gesamt} Mails. Ältere im Webmail von Hetzner.</p>
        )}
        <p className="mt-6 text-sm text-ink-soft">Das Postfach teilen sich alle im Orga-Team: Eine geöffnete Mail gilt für alle als gelesen, auch im Webmail.</p>
      </main>
    </>
  );
}
