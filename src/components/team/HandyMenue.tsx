"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

/** Kopfleiste fürs Handy mit Menü-Knopf; das Menü (Navigation und Konto) kommt vom Server als children. */
export function HandyMenue({ titel, children }: { titel: string; children: React.ReactNode }) {
  const [offen, setzeOffen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = offen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [offen]);
  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-line bg-paper/95 px-4 backdrop-blur lg:hidden">
        <Link href="/team/" className="shrink-0"><img src="/brand/ses-logo.png" alt="SES Academy" className="h-8 w-auto" /></Link>
        <p className="mr-auto truncate font-display text-lg font-bold">{titel}</p>
        <button type="button" onClick={() => setzeOffen(!offen)} aria-expanded={offen} aria-controls="handy-menue"
          className="flex items-center gap-2 rounded-full bg-ink px-3.5 py-2 text-sm font-semibold text-paper">
          {offen ? <X aria-hidden className="h-4 w-4" /> : <Menu aria-hidden className="h-4 w-4" />} Menü
        </button>
      </header>
      {offen && (
        // Klick auf einen Link im Menü schließt es (die neue Seite lädt im Hintergrund)
        <div id="handy-menue" onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setzeOffen(false); }}
          className="fixed inset-x-0 top-14 bottom-0 z-50 overflow-y-auto bg-forest px-3 pt-5 pb-24 lg:hidden">
          {children}
        </div>
      )}
    </>
  );
}
