import Link from "next/link";
import { ChevronDown } from "lucide-react";

type Tag = { id: string; starts_at: string; ends_at?: string; label?: string | null; module: { title: string } };

const wochentag = new Intl.DateTimeFormat("de-DE", { weekday: "short", timeZone: "Europe/Berlin" });
const tagMonat = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", timeZone: "Europe/Berlin" });
const kalendertag = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" });

/**
 * Auswahl des Modultags als Leiste mit Tageskarten (statt Auswahlfeld mit „Öffnen“-Knopf): ein Tipp wechselt den Tag.
 * Gezeigt werden heute und die kommenden Tage; frühere Tage liegen eingeklappt dahinter.
 */
export function TagWahl({ tage, aktiv, pfad, jetzt }: { tage: Tag[]; aktiv?: string; pfad: string; jetzt: number }) {
  if (tage.length <= 1) return null;
  const heute = kalendertag.format(new Date(jetzt));
  const kommend = tage.filter((t) => kalendertag.format(new Date(t.starts_at)) >= heute || t.id === aktiv);
  const frueher = tage.filter((t) => !kommend.includes(t)).reverse();
  const karte = (t: Tag) => {
    const an = t.id === aktiv;
    const istHeute = kalendertag.format(new Date(t.starts_at)) === heute;
    return (
      <Link key={t.id} href={`${pfad}?tag=${t.id}`} aria-current={an ? "page" : undefined}
        className={`flex w-36 shrink-0 snap-start flex-col rounded-2xl px-4 py-3 transition ${an ? "bg-forest text-paper shadow-lg shadow-forest/20" : "bg-weiss ring-1 ring-ink/[0.07] hover:ring-ink/25"}`}>
        <span className={`flex items-center gap-2 text-xs font-semibold tracking-wide uppercase ${an ? "text-signal" : "text-ink-soft"}`}>
          {wochentag.format(new Date(t.starts_at))}
          {istHeute && <span className={`rounded-full px-1.5 py-px text-[10px] normal-case ${an ? "bg-signal text-ink" : "bg-signal/70 text-ink"}`}>heute</span>}
        </span>
        <span className="font-display mt-0.5 text-xl font-bold leading-tight">{tagMonat.format(new Date(t.starts_at))}</span>
        <span className={`mt-1 truncate text-xs ${an ? "text-paper/70" : "text-ink-soft"}`}>{t.label ? `${t.module.title} · ${t.label}` : t.module.title}</span>
      </Link>
    );
  };
  return (
    <nav aria-label="Modultag wählen" className="-mx-4 mt-4 px-4">
      <div className="flex snap-x gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {kommend.map(karte)}
        {frueher.length > 0 && (
          <details className="group relative shrink-0">
            <summary className="flex h-full min-h-[4.75rem] w-28 cursor-pointer list-none flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-ink/15 px-3 text-xs font-semibold text-ink-soft hover:border-ink/30 [&::-webkit-details-marker]:hidden">
              Frühere Tage <ChevronDown aria-hidden className="h-4 w-4 transition group-open:rotate-180" />
            </summary>
            <div className="absolute right-0 z-30 mt-2 max-h-80 w-64 overflow-y-auto rounded-2xl bg-weiss p-2 shadow-xl ring-1 ring-ink/10">
              {frueher.map((t) => (
                <Link key={t.id} href={`${pfad}?tag=${t.id}`} className="flex items-baseline gap-2 rounded-xl px-3 py-2 text-sm hover:bg-paper">
                  <span className="w-24 shrink-0 font-semibold">{wochentag.format(new Date(t.starts_at))}, {tagMonat.format(new Date(t.starts_at))}</span>
                  <span className="truncate text-ink-soft">{t.module.title}</span>
                </Link>
              ))}
            </div>
          </details>
        )}
      </div>
    </nav>
  );
}
