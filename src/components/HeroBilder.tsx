"use client";

import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";

export type HeroBild = { src: string; alt: string; text: string; position?: string };

/**
 * Startbild der Website als ruhige Bildfolge (Wunsch Yusuf 16.11.2026: „alle 5 Sekunden ein neues Bild“).
 * Überblendet weich und wechselt immer (auch bei „Bewegung reduzieren“, dann mit kurzer Überblendung – eine
 * Überblendung ist keine Bewegung; Yusufs Mac hatte die Einstellung, die Bilder standen still). Hält nur an, solange
 * der Tab im Hintergrund ist. Das erste Bild lädt sofort (wichtig für den Seitenaufbau), die übrigen danach.
 */
export function HeroBilder({ bilder, takt = 5000 }: { bilder: HeroBild[]; takt?: number }) {
  const [aktiv, setAktiv] = useState(0);
  // „Bewegung reduzieren“ nur für die Dauer der Überblendung (kürzer), nicht für das Wechseln selbst
  const ruhig = useSyncExternalStore(
    (melden) => {
      const m = window.matchMedia("(prefers-reduced-motion: reduce)");
      m.addEventListener("change", melden);
      return () => m.removeEventListener("change", melden);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );

  useEffect(() => {
    if (bilder.length < 2) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") setAktiv((i) => (i + 1) % bilder.length);
    }, takt);
    return () => window.clearInterval(id);
  }, [bilder.length, takt]);

  return (
    <div className="absolute inset-0">
      {bilder.map((b, i) => (
        <Image key={b.src} src={b.src} alt={i === aktiv ? b.alt : ""} aria-hidden={i !== aktiv} fill priority={i === 0} loading={i === 0 ? undefined : "eager"}
          sizes="(min-width:1024px) 45vw, 100vw"
          className={`object-cover transition-opacity ease-in-out ${ruhig ? "duration-300" : "duration-1000"} ${b.position ?? "object-center"} ${i === aktiv ? "opacity-100" : "opacity-0"}`} />
      ))}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink/70 to-transparent" />
      {/* Punkte über der Bildzeile: bricht die Zeile um, rutschen sie mit nach oben statt sie zu verdecken */}
      <div className="absolute right-5 bottom-5 left-5 flex flex-col gap-2.5">
        {bilder.length > 1 && (
          <div className="flex gap-1.5 self-end" aria-hidden>
            {bilder.map((b, i) => <span key={b.src} className={`h-1.5 rounded-full transition-all duration-500 ${i === aktiv ? "w-5 bg-paper" : "w-1.5 bg-paper/50"}`} />)}
          </div>
        )}
        <p aria-live="off" className="text-sm font-medium text-paper/90">{bilder[aktiv]?.text}</p>
      </div>
    </div>
  );
}
