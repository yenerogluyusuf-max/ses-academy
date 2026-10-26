"use client";

/** Knopf für Druck bzw. „Als PDF sichern“ im Druckdialog des Browsers. */
export function Drucken() {
  return (
    <button type="button" onClick={() => window.print()} className="knopf print:hidden">Drucken / als PDF sichern</button>
  );
}
