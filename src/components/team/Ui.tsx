import Link from "next/link";
import type { TeamSprache } from "@/lib/team-sprache";

export function Titel({ kicker, children, aktion }: { kicker?: string; children: React.ReactNode; aktion?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {kicker && <p className="text-sm font-semibold tracking-wide text-sage uppercase">{kicker}</p>}
        <h1 className="font-display mt-1 text-4xl leading-none font-extrabold">{children}</h1>
      </div>
      {aktion}
    </div>
  );
}

export function Zahl({ wert, text, href, ton = "neutral" }: { wert: number | string; text: string; href?: string; ton?: "neutral" | "warnung" | "gut" }) {
  const farbe = ton === "warnung" ? "bg-gelb-hell" : ton === "gut" ? "bg-gruen-hell" : "bg-weiss";
  const inhalt = (
    <>
      <span className="font-display block text-3xl font-extrabold">{wert}</span>
      <span className="mt-1 block text-sm text-ink-soft">{text}</span>
    </>
  );
  return href ? (
    <Link href={href} className={`block rounded-3xl p-5 ring-1 ring-line transition hover:ring-ink ${farbe}`}>{inhalt}</Link>
  ) : (
    <div className={`rounded-3xl p-5 ring-1 ring-line ${farbe}`}>{inhalt}</div>
  );
}

const hinweiseDe: Record<string, string> = {
  gespeichert: "Gespeichert.",
  bewertet: "Bewertung gespeichert.",
  "ticket-gesendet": "QR-Code per Mail verschickt.",
  "ticket-fehler": "Die Mail konnte nicht verschickt werden: Der Mailserver hat sie abgelehnt oder war nicht erreichbar.",
  "mail-aus": "Mailversand ist noch nicht eingerichtet: Die Zugangsdaten für info@ses-academy.org fehlen noch.",
};

/** Texte der Standard-Hinweise (?hinweis=) je Sprache des Team-Bereichs. */
export const rueckmeldungTexte: Record<TeamSprache, Record<string, string>> = {
  de: hinweiseDe,
  tr: {
    gespeichert: "Kaydedildi.",
    bewertet: "Değerlendirme kaydedildi.",
    "ticket-gesendet": "QR kod e-postayla gönderildi.",
    "ticket-fehler": "E-posta gönderilemedi: Posta sunucusu e-postayı reddetti ya da sunucuya ulaşılamadı.",
    "mail-aus": "E-posta gönderimi henüz kurulmadı: info@ses-academy.org için erişim bilgileri hâlâ eksik.",
  },
  fr: {
    gespeichert: "Enregistré.",
    bewertet: "Évaluation enregistrée.",
    "ticket-gesendet": "QR code envoyé par e-mail.",
    "ticket-fehler": "L’e-mail n’a pas pu être envoyé : le serveur de messagerie l’a refusé ou était injoignable.",
    "mail-aus": "L’envoi d’e-mails n’est pas encore configuré : les identifiants de info@ses-academy.org manquent encore.",
  },
};

/**
 * Rückmeldung aus ?hinweis= bzw. ?fehler=
 * sprache: Sprache des Team-Bereichs (Standard Deutsch); texte: zusätzliche oder abweichende Hinweistexte der Seite.
 */
export function Rueckmeldung({ hinweis, fehler, sprache = "de", texte }: {
  hinweis?: string | string[]; fehler?: string | string[]; sprache?: TeamSprache; texte?: Record<string, string>;
}) {
  if (typeof fehler === "string") return <p role="alert" className="mb-6 rounded-2xl bg-rot-hell p-4 text-sm font-semibold text-rot">{fehler}</p>;
  if (typeof hinweis === "string") {
    const text = texte?.[hinweis] ?? rueckmeldungTexte[sprache][hinweis] ?? hinweis;
    return <p role="status" className={`mb-6 rounded-2xl p-4 text-sm font-semibold ${hinweis === "ticket-fehler" || hinweis === "mail-aus" ? "bg-gelb-hell" : "bg-gruen-hell"}`}>{text}</p>;
  }
  return null;
}

export function Leer({ children }: { children: React.ReactNode }) {
  return <p className="rounded-3xl border-2 border-dashed border-line p-8 text-center text-ink-soft">{children}</p>;
}

/** Ländernamen je Sprache des Team-Bereichs (Schlüssel wie in der Datenbank). */
export const laenderNamen: Record<TeamSprache, Record<string, string>> = {
  de: { DE: "Deutschland", AT: "Österreich", FR: "Frankreich", CH: "Schweiz", NL: "Niederlande", BE: "Belgien", other: "Andere" },
  tr: { DE: "Almanya", AT: "Avusturya", FR: "Fransa", CH: "İsviçre", NL: "Hollanda", BE: "Belçika", other: "Diğer" },
  fr: { DE: "Allemagne", AT: "Autriche", FR: "France", CH: "Suisse", NL: "Pays-Bas", BE: "Belgique", other: "Autre" },
};

/** Deutsche Ländernamen (bisherige Schnittstelle). */
export const laender: Record<string, string> = laenderNamen.de;
