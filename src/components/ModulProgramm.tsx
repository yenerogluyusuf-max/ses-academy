import type { ProgrammTag } from "@/lib/modul-programm";

/**
 * Programm eines Moduls zum Aufklappen, dazu Tagesordnung als PDF, Ort auf der Karte und die Kontaktadresse
 * (Ticket-Seite und „Mein Bereich“, Wunsch 12.11.2026).
 */
export function ModulProgramm({ tage, locale, ort, pdfHref, texte }: {
  tage: ProgrammTag[];
  locale: string;
  ort: string | null;
  pdfHref: string | null;
  texte: { ansehen: string; pdf: string; karte: string; fragen: string };
}) {
  const tag = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Berlin" });
  const uhr = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
  const zeit = (von: string, bis: string | null) => `${uhr.format(new Date(von))}${bis ? `–${uhr.format(new Date(bis))}` : ""}`;
  const karte = ort ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ort)}` : null;
  const mitPunkten = tage.some((t) => t.punkte.length > 0);
  return (
    <div className="mt-3 text-sm">
      {mitPunkten && (
        <details className="group">
          <summary className="cursor-pointer font-semibold">{texte.ansehen}</summary>
          <div className="mt-3 space-y-4">
            {tage.map((t) => (
              <div key={t.beginn}>
                <p className="font-semibold text-forest">{tag.format(new Date(t.beginn))}, {zeit(t.beginn, t.ende)}</p>
                <ul className="mt-1 divide-y divide-line">
                  {t.punkte.map((p) => (
                    <li key={p.von + p.titel} className="flex gap-3 py-1.5">
                      <span className="w-[6.5rem] shrink-0 font-semibold tabular-nums">{zeit(p.von, p.bis)}</span>
                      <span>{p.titel}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {pdfHref && <a href={pdfHref} target="_blank" rel="noopener" className="font-semibold underline underline-offset-4">↓ {texte.pdf}</a>}
        {karte && <a href={karte} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">{texte.karte}</a>}
      </p>
      <p className="mt-2 text-ink-soft">{texte.fragen} <a href="mailto:info@ses-academy.org" className="font-semibold underline underline-offset-4">info@ses-academy.org</a></p>
    </div>
  );
}
