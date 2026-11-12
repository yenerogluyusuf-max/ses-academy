"use client";

import type { TeamSprache } from "@/lib/team-sprache";

const T: Record<TeamSprache, string> = { de: "Drucken / als PDF sichern", tr: "Yazdır / PDF olarak kaydet", fr: "Imprimer / enregistrer en PDF" };

/** Knopf für Druck bzw. „Als PDF sichern“ im Druckdialog des Browsers. */
export function Drucken({ sprache = "de" }: { sprache?: TeamSprache }) {
  return (
    <button type="button" onClick={() => window.print()} className="knopf print:hidden">{T[sprache]}</button>
  );
}
