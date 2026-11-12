import Link from "next/link";

/** Sprachen für Teilnehmende (Mein Bereich, Ticket-Seite, Feedback), jeweils in der eigenen Sprache benannt. */
const namen = { de: "Deutsch", tr: "Türkçe", fr: "Français" } as const;
type UmschaltSprache = keyof typeof namen;
const reihenfolge: UmschaltSprache[] = ["de", "tr", "fr"];
const beschriftung: Record<string, string> = { de: "Sprache", tr: "Dil", fr: "Langue", en: "Language", nl: "Taal" };

const knopf = "rounded-full px-3 py-1.5 text-sm font-semibold text-ink-soft ring-1 ring-line hover:bg-paper-deep";
const aktivStil = "rounded-full bg-ink px-3 py-1.5 text-sm font-semibold text-paper";

/**
 * Sichtbarer Umschalter Deutsch · Türkçe · Français (Wunsch 12.11.2026).
 * Mit action: speichert die Sprache im Profil (Formular, geht ohne JavaScript). Mit href: wechselt nur die Anzeige.
 */
export function SprachUmschalter({ aktiv, action, felder = {}, href, className = "" }: {
  aktiv: string;
  action?: (formData: FormData) => Promise<void>;
  felder?: Record<string, string>;
  href?: (sprache: UmschaltSprache) => string;
  className?: string;
}) {
  const label = beschriftung[aktiv] ?? beschriftung.de;
  const eintrag = (x: UmschaltSprache) => {
    if (x === aktiv) return <span key={x} lang={x} aria-current="true" className={aktivStil}>{namen[x]}</span>;
    if (href) return <Link key={x} href={href(x)} hrefLang={x} lang={x} className={knopf}>{namen[x]}</Link>;
    return <button key={x} type="submit" name="sprache" value={x} lang={x} className={knopf}>{namen[x]}</button>;
  };
  if (action) {
    return (
      <form action={action} aria-label={label} className={`flex flex-wrap gap-1.5 ${className}`}>
        {Object.entries(felder).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        {reihenfolge.map(eintrag)}
      </form>
    );
  }
  return <nav aria-label={label} className={`flex flex-wrap gap-1.5 ${className}`}>{reihenfolge.map(eintrag)}</nav>;
}
