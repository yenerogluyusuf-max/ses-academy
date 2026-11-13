"use client";

import { useEffect, useRef, useState } from "react";

/**
 * QR-Code auf der Ticket-Seite: doppelt tippen bzw. doppelt klicken (oder Enter) zeigt ihn im Vollbild auf weißem
 * Grund, damit der Scanner am Einlass ihn sicher liest; Tippen, Esc oder „Schließen“ beendet das Vollbild.
 * Doppeltippen wird selbst erkannt, weil mobile Browser dblclick oft für das Zoomen verwenden.
 * svg: von der App erzeugtes QR-SVG (ticketQrSvg), keine Nutzereingabe.
 */
export function QrVollbild({ svg, kurzcode, name, texte }: {
  svg: string; kurzcode: string; name: string; texte: { hinweis: string; oeffnen: string; schliessen: string };
}) {
  const [offen, setOffen] = useState(false);
  const letzterTipp = useRef(0);
  const schliessenKnopf = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!offen) return;
    schliessenKnopf.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOffen(false); };
    window.addEventListener("keydown", esc);
    const vorher = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = vorher; };
  }, [offen]);

  const tipp = () => {
    const jetzt = Date.now();
    if (jetzt - letzterTipp.current < 400) { setOffen(true); letzterTipp.current = 0; } else letzterTipp.current = jetzt;
  };

  return (
    <>
      <button type="button" onClick={tipp} onDoubleClick={() => setOffen(true)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setOffen(true); } }}
        aria-label={texte.oeffnen}
        className="mx-auto mt-2 block w-full max-w-[210px] touch-manipulation [&>span>svg]:h-auto [&>span>svg]:w-full">
        <span className="block" dangerouslySetInnerHTML={{ __html: svg }} />
      </button>
      <p className="mt-1 text-xs text-ink-soft">{texte.hinweis}</p>

      {offen && (
        <div role="dialog" aria-modal="true" aria-label={texte.oeffnen} onClick={() => setOffen(false)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white p-6 text-ink">
          <div className="w-[min(88vw,72vh)] [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="font-mono text-4xl font-bold tracking-[0.15em]">{kurzcode}</p>
          <p className="text-lg">{name}</p>
          <button ref={schliessenKnopf} type="button" onClick={() => setOffen(false)}
            className="mt-2 rounded-full bg-ink px-6 py-3 text-base font-semibold text-paper">{texte.schliessen}</button>
        </div>
      )}
    </>
  );
}
