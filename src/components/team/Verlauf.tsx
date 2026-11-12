"use client";

import { useState } from "react";
import type { TeamSprache } from "@/lib/team-sprache";

export type VerlaufPunkt = { id: string; modul: string; datum: string; erwartet: number; da: number };

const HOEHE = 180;
const LINIEN = [0, 50, 100];

const de = {
  leer: "Noch keine vergangenen Modultage im Zeitraum.",
  prozent: (q: number) => `${q} %`,
  daVon: (da: number, erwartet: number) => `${da} von ${erwartet} da`,
  aria: (p: VerlaufPunkt, q: number) => `${p.modul}, ${p.datum}: ${p.da} von ${p.erwartet} da (${q} %)`,
  beschriftung: "Anwesenheit pro Modultag in Prozent der bestätigten Anmeldungen",
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    leer: "Seçilen zaman aralığında henüz geçmiş modül günü yok.",
    prozent: (q) => `%${q}`,
    daVon: (da, erwartet) => `${erwartet} kişiden ${da} kişi geldi`,
    aria: (p, q) => `${p.modul}, ${p.datum}: ${p.erwartet} kişiden ${p.da} kişi geldi (%${q})`,
    beschriftung: "Modül günü başına katılım, onaylı kayıtların yüzdesi olarak",
  },
  fr: {
    leer: "Aucun jour de module passé sur cette période.",
    prozent: (q) => `${q} %`,
    daVon: (da, erwartet) => `${da} présents sur ${erwartet}`,
    aria: (p, q) => `${p.modul}, ${p.datum} : ${p.da} présents sur ${p.erwartet} (${q} %)`,
    beschriftung: "Présence par jour de module, en pourcentage des inscriptions confirmées",
  },
};

/**
 * Anwesenheit pro vergangenem Modultag in Prozent (da / erwartet).
 * Eine Reihe, daher keine Legende; Details im Tooltip, gleiche Zahlen in der Tabelle darunter.
 */
export function Verlauf({ punkte, sprache = "de" }: { punkte: VerlaufPunkt[]; sprache?: TeamSprache }) {
  const [aktiv, setAktiv] = useState<string | null>(null);
  const t = T[sprache];
  if (!punkte.length) return <p className="text-ink-soft">{t.leer}</p>;
  const quote = (p: VerlaufPunkt) => (p.erwartet ? Math.min(100, Math.round((p.da / p.erwartet) * 100)) : 0);
  const gewaehlt = punkte.find((p) => p.id === aktiv);

  return (
    <figure>
      <div className="relative pl-10">
        <div className="relative flex items-end gap-[2px] border-b border-line" style={{ height: HOEHE }} onMouseLeave={() => setAktiv(null)}>
          {LINIEN.map((l) => (
            <div key={l} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: (l / 100) * HOEHE }}>
              <span className="absolute -top-2.5 -left-1 -translate-x-full text-[11px] text-ink-soft tabular-nums">{t.prozent(l)}</span>
            </div>
          ))}
          {punkte.map((p) => {
            const q = quote(p);
            return (
              <button
                key={p.id} type="button"
                onMouseEnter={() => setAktiv(p.id)} onFocus={() => setAktiv(p.id)} onBlur={() => setAktiv(null)}
                aria-label={t.aria(p, q)}
                className="group relative flex h-full min-w-0 flex-1 items-end outline-none"
              >
                <span
                  className={`block w-full rounded-t-[4px] transition-opacity ${aktiv && aktiv !== p.id ? "opacity-40" : ""} group-focus-visible:ring-2 group-focus-visible:ring-ink`}
                  style={{ height: Math.max(2, (q / 100) * HOEHE), background: "var(--mint)" }}
                />
              </button>
            );
          })}
        </div>
        {gewaehlt && (
          <div role="tooltip" className="pointer-events-none absolute top-0 right-0 rounded-2xl bg-ink px-4 py-3 text-sm text-paper shadow-lg">
            <p className="font-semibold">{gewaehlt.modul}</p>
            <p className="text-paper/80">{gewaehlt.datum}</p>
            <p className="mt-1 tabular-nums">{t.daVon(gewaehlt.da, gewaehlt.erwartet)} · {t.prozent(quote(gewaehlt))}</p>
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-between pl-10 text-xs text-ink-soft">
        <span>{punkte[0].datum}</span>
        {punkte.length > 1 && <span>{punkte[punkte.length - 1].datum}</span>}
      </div>
      <figcaption className="sr-only">{t.beschriftung}</figcaption>
    </figure>
  );
}
