import type { Metadata } from "next";
import Link from "next/link";
import { CornerUpLeft, Paperclip } from "lucide-react";
import { TeamKopf } from "@/components/team/TeamKopf";
import { Versandprotokoll } from "@/components/team/Versandprotokoll";
import { darf, requireStaff } from "@/lib/auth";
import { istOrdner, ordnerListe, postfachBereit, postfachListe, type Kopf, type OrdnerId } from "@/lib/postfach";
import { teamLocale, type TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";
import { ladeVersandprotokoll } from "@/lib/versandprotokoll";

export const metadata: Metadata = { title: "Postfach | SES Academy" };

const ADRESSE = "info@ses-academy.org";

/** Ordnernamen je Sprache des Team-Bereichs (gleich in postfach/[ordner]/[uid]/page.tsx). */
const ordnerNamen: Record<TeamSprache, Record<OrdnerId, string>> = {
  de: { eingang: "Posteingang", gesendet: "Gesendet", spam: "Spam" },
  tr: { eingang: "Gelen kutusu", gesendet: "Gönderilenler", spam: "Spam" },
  fr: { eingang: "Boîte de réception", gesendet: "Envoyés", spam: "Spam" },
};

const de = {
  intro: `Mails an ${ADRESSE}. Antworten gehen als ${ADRESSE} raus.`,
  ordner: "Ordner",
  neu: (n: number) => ` · ${n} neu`,
  ohneZugang: "Für das Postfach fehlen die Zugangsdaten auf dem Server.",
  nichtErreichbar: "Das Postfach ist gerade nicht erreichbar. Bitte in einer Minute neu laden.",
  leer: "Keine Mails in diesem Ordner.",
  an: "An: ", unbekannt: "(unbekannt)", ungelesen: " (ungelesen)", beantwortet: "beantwortet", mitAnhang: "mit Anhang", ohneBetreff: "(ohne Betreff)",
  mehr: (gezeigt: number, gesamt: number) => `Gezeigt werden die neuesten ${gezeigt} von ${gesamt} Mails. Ältere im Webmail von Hetzner.`,
  geteilt: "Das Postfach teilen sich alle im Orga-Team: Eine geöffnete Mail gilt für alle als gelesen, auch im Webmail.",
  antworten: "Im Ordner „Gesendet“ gespeichert (Antworten und Kopien)",
  kopieFehlt: "Für diese Mail liegt keine Kopie im Postfach. Die App hat bis zum 13.11. nur protokolliert, was sie verschickt.",
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    intro: `${ADRESSE} adresine gelen e-postalar. Yanıtlar ${ADRESSE} adresinden gider.`,
    ordner: "Klasörler",
    neu: (n) => ` · ${n} yeni`,
    ohneZugang: "Posta kutusu için sunucuda erişim bilgileri eksik.",
    nichtErreichbar: "Posta kutusuna şu an ulaşılamıyor. Lütfen bir dakika sonra sayfayı yeniden yükle.",
    leer: "Bu klasörde e-posta yok.",
    an: "Alıcı: ", unbekannt: "(bilinmiyor)", ungelesen: " (okunmadı)", beantwortet: "yanıtlandı", mitAnhang: "ekli", ohneBetreff: "(konu yok)",
    mehr: (gezeigt, gesamt) => `${gesamt} e-postadan en yeni ${gezeigt} tanesi gösteriliyor. Daha eskileri Hetzner web postasında.`,
    geteilt: "Posta kutusunu organizasyon ekibindeki herkes ortak kullanır: Açılan bir e-posta herkes için okunmuş sayılır, web postasında da.",
    antworten: "Gönderilenler klasöründe kayıtlı (yanıtlar ve kopyalar)",
    kopieFehlt: "Bu e-postanın posta kutusunda kopyası yok. Uygulama 13.11’e kadar gönderdiklerini yalnızca kaydediyordu.",
  },
  fr: {
    intro: `E-mails envoyés à ${ADRESSE}. Les réponses partent depuis ${ADRESSE}.`,
    ordner: "Dossiers",
    neu: (n) => ` · ${n} ${n === 1 ? "nouveau" : "nouveaux"}`,
    ohneZugang: "Les identifiants de la boîte mail manquent sur le serveur.",
    nichtErreichbar: "La boîte mail est injoignable pour le moment. Merci de recharger la page dans une minute.",
    leer: "Aucun e-mail dans ce dossier.",
    an: "À : ", unbekannt: "(inconnu)", ungelesen: " (non lu)", beantwortet: "répondu", mitAnhang: "avec pièce jointe", ohneBetreff: "(sans objet)",
    mehr: (gezeigt, gesamt) => `Affichage des ${gezeigt} e-mails les plus récents sur ${gesamt}. Les plus anciens sont dans le webmail de Hetzner.`,
    geteilt: "Toute l’équipe d’organisation partage la boîte mail : un e-mail ouvert compte comme lu pour tout le monde, y compris dans le webmail.",
    antworten: "Enregistrés dans «\u00a0Envoyés\u00a0» (réponses et copies)",
    kopieFehlt: "Aucune copie de cet e-mail dans la boîte mail. Jusqu’au 13/11, l’application ne faisait que consigner ses envois.",
  },
};

/** Heute nur die Uhrzeit, sonst das Datum (wie in Mailprogrammen). */
function wann(iso: string | null, l: TeamSprache): string {
  if (!iso) return "";
  const d = new Date(iso);
  const tag = (x: Date) => new Intl.DateTimeFormat(teamLocale[l], { dateStyle: "short", timeZone: "Europe/Berlin" }).format(x);
  return tag(d) === tag(new Date())
    ? new Intl.DateTimeFormat(teamLocale[l], { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(d)
    : new Intl.DateTimeFormat(teamLocale[l], { day: "numeric", month: "short", timeZone: "Europe/Berlin" }).format(d);
}

/**
 * Postfach info@ses-academy.org (Wunsch 12.11.2026): eingehende Mails lesen und beantworten, ohne Postfach-Passwort.
 * Liest direkt vom Mailserver (IMAP), es wird nichts in der Datenbank gespeichert.
 */
export default async function Postfach({ searchParams }: PageProps<"/team/postfach">) {
  const staff = await requireStaff("orga");
  const l = staff.sprache;
  const t = T[l];
  const { ordner: o, suche: s, kopie } = await searchParams;
  const suche = typeof s === "string" ? s : "";
  const ordner: OrdnerId = istOrdner(o) ? o : "eingang";
  const ergebnis = postfachBereit() ? await postfachListe(ordner).catch(() => null) : null;
  const gesendet = ordner === "gesendet";
  // „Gesendet“: zuerst die Mails der App (Protokoll), darunter die Antworten aus dem Postfach (IMAP)
  const GRENZE = 300;
  const protokoll = gesendet ? await ladeVersandprotokoll({ suche, grenze: GRENZE }) : null;

  return (
    <>
      <TeamKopf staff={staff} aktiv="postfach" />
      <main lang={l} className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="font-display text-3xl font-bold">{teamTexte[l].bereiche.postfach}</h1>
        <p className="mt-1 text-ink-soft">{t.intro}</p>

        <nav aria-label={t.ordner} className="mt-6 flex flex-wrap gap-2">
          {ordnerListe.map((x) => (
            <Link key={x.id} href={x.id === "eingang" ? "/team/postfach/" : `/team/postfach/?ordner=${x.id}`}
              aria-current={x.id === ordner ? "page" : undefined}
              className={x.id === ordner ? "rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper" : "rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-line hover:bg-paper-deep"}>
              {ordnerNamen[l][x.id]}
              {x.id === ordner && ergebnis && ordner !== "gesendet" && ergebnis.ungelesen > 0 ? t.neu(ergebnis.ungelesen) : ""}
            </Link>
          ))}
        </nav>

        {kopie === "fehlt" && <p role="status" className="mt-6 rounded-2xl bg-amber-100 p-4 text-amber-950">{t.kopieFehlt}</p>}
        {protokoll && <Versandprotokoll eintraege={protokoll} sprache={l} suche={suche} vorschau={darf.alles(staff.role)} grenze={GRENZE} />}
        {gesendet && <h2 className="font-display mt-10 text-xl font-bold">{t.antworten}</h2>}

        {!postfachBereit() ? (
          <p className="karte mt-6">{t.ohneZugang}</p>
        ) : !ergebnis ? (
          <p role="alert" className="mt-6 rounded-2xl bg-amber-100 p-4 text-amber-950">{t.nichtErreichbar}</p>
        ) : ergebnis.mails.length === 0 ? (
          <p className="karte mt-6 text-ink-soft">{t.leer}</p>
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
                      {gesendet ? t.an : ""}{person ? person.name || person.adresse : t.unbekannt}
                      {neu && <span className="sr-only">{t.ungelesen}</span>}
                    </span>
                    <span className="text-sm whitespace-nowrap text-ink-soft">{wann(m.datum, l)}</span>
                    <span />
                    <span className={`col-span-2 flex items-center gap-1.5 truncate text-sm ${neu ? "font-semibold text-ink" : "text-ink-soft"}`}>
                      {m.beantwortet && <CornerUpLeft aria-label={t.beantwortet} className="h-3.5 w-3.5 shrink-0" />}
                      {m.anhang && <Paperclip aria-label={t.mitAnhang} className="h-3.5 w-3.5 shrink-0" />}
                      <span className="truncate">{m.betreff || t.ohneBetreff}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {ergebnis && ergebnis.gesamt > ergebnis.mails.length && (
          <p className="mt-3 text-sm text-ink-soft">{t.mehr(ergebnis.mails.length, ergebnis.gesamt)}</p>
        )}
        <p className="mt-6 text-sm text-ink-soft">{t.geteilt}</p>
      </main>
    </>
  );
}
