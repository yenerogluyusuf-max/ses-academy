"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export type HeroBild = { src: string; alt: string; text: string; position?: string };

/**
 * Startbild der Website als ruhige Bildfolge (Wunsch Yusuf 16.11.2026: „alle 5 Sekunden ein neues Bild“).
 * Überblendet weich; hält an, solange die Maus darauf liegt oder der Tab im Hintergrund ist; bei „Bewegung reduzieren“
 * bleibt das erste Bild stehen. Das erste Bild lädt sofort (wichtig für den Seitenaufbau), die übrigen danach.
 */
export function HeroBilder({ bilder, takt = 5000 }: { bilder: HeroBild[]; takt?: number }) {
  const [aktiv, setAktiv] = useState(0);
  const pause = useRef(false);

  useEffect(() => {
    if (bilder.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      if (!pause.current && document.visibilityState === "visible") setAktiv((i) => (i + 1) % bilder.length);
    }, takt);
    return () => window.clearInterval(id);
  }, [bilder.length, takt]);

  return (
    <div className="absolute inset-0" onMouseEnter={() => (pause.current = true)} onMouseLeave={() => (pause.current = false)}>
      {bilder.map((b, i) => (
        <Image key={b.src} src={b.src} alt={i === aktiv ? b.alt : ""} aria-hidden={i !== aktiv} fill priority={i === 0} loading={i === 0 ? undefined : "eager"}
          sizes="(min-width:1024px) 45vw, 100vw"
          className={`object-cover transition-opacity duration-1000 ease-in-out ${b.position ?? "object-center"} ${i === aktiv ? "opacity-100" : "opacity-0"}`} />
      ))}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink/70 to-transparent" />
      <p aria-live="off" className="absolute right-5 bottom-5 left-5 text-sm font-medium text-paper/90">{bilder[aktiv]?.text}</p>
      {bilder.length > 1 && (
        <div className="absolute right-5 bottom-11 flex gap-1.5" aria-hidden>
          {bilder.map((b, i) => <span key={b.src} className={`h-1.5 rounded-full transition-all duration-500 ${i === aktiv ? "w-5 bg-paper" : "w-1.5 bg-paper/50"}`} />)}
        </div>
      )}
    </div>
  );
}
