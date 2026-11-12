"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { TeamSprache } from "@/lib/team-sprache";

const T = {
  de: { rueckfrage: "Rückfrage", abbrechen: "Abbrechen", laeuft: "Einen Moment …" },
  tr: { rueckfrage: "Onay sorusu", abbrechen: "Vazgeç", laeuft: "Lütfen bekle …" },
  fr: { rueckfrage: "Confirmation", abbrechen: "Annuler", laeuft: "Un instant …" },
} satisfies Record<TeamSprache, Record<string, string>>;

function JaKnopf({ children, className, laeuft }: { children: React.ReactNode; className: string; laeuft: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" name="bestaetigt" value="ja" disabled={pending} aria-busy={pending} className={className}>{pending ? laeuft : children}</button>;
}

/**
 * Rückfrage vor einer folgenschweren Aktion, innerhalb eines <form> mit Server Action: Der erste Klick fragt nach
 * (mit Erklärung und ggf. weiteren Feldern als children), erst „Ja“ sendet ab, mit bestaetigt=ja. Die Server Action
 * prüft dieses Feld; ohne JavaScript geht also nichts aus Versehen durch.
 */
export function Rueckfrage({ knopf, knopfKlasse = "knopf-hell", frage, ja, gefahr = false, children, sprache = "de", abbrechen, laeuft, bezeichnung }: {
  knopf: React.ReactNode; knopfKlasse?: string; frage: React.ReactNode; ja: React.ReactNode; gefahr?: boolean; children?: React.ReactNode;
  /** Sprache des Team-Bereichs für „Abbrechen“, „Einen Moment …“ und die Bezeichnung der Rückfrage (Standard Deutsch) */
  sprache?: TeamSprache;
  /** Beschriftungen für andere Sprachen (z. B. „Mein Bereich“ auf Türkisch); haben Vorrang vor sprache */
  abbrechen?: string; laeuft?: string; bezeichnung?: string;
}) {
  const [offen, setOffen] = useState(false);
  const t = T[sprache];
  if (!offen) return <button type="button" onClick={() => setOffen(true)} className={knopfKlasse}>{knopf}</button>;
  return (
    <div role="group" aria-label={bezeichnung ?? t.rueckfrage} className={`basis-full rounded-2xl p-4 text-sm ring-1 ${gefahr ? "bg-rot-hell ring-rot/30" : "bg-gelb-hell ring-line"}`}>
      <div className="font-semibold">{frage}</div>
      {children && <div className="mt-2 space-y-1.5">{children}</div>}
      <div className="mt-3 flex flex-wrap gap-2">
        <JaKnopf laeuft={laeuft ?? t.laeuft} className={gefahr ? "rounded-full bg-red-800 px-4 py-2 font-semibold text-white" : "knopf"}>{ja}</JaKnopf>
        <button type="button" onClick={() => setOffen(false)} className="knopf-hell">{abbrechen ?? t.abbrechen}</button>
      </div>
    </div>
  );
}
