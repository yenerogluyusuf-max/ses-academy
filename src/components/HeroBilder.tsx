"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export type HeroBild = { src: string; alt: string; text: string; position?: string };

/**
 * Startbild der Website als ruhige Bildfolge (Wunsch Yusuf 16.11.2026: „alle 5 Sekunden ein neues Bild“).
 * Überblendet weich und wechselt immer (auch bei „Bewegung reduzieren“, dann mit kurzer Überblendung – eine
 * Überblendung ist keine Bewegung; Yusufs Mac hatte die Einstellung, die Bilder standen still). Hält nur an, solange
 * der Tab im Hintergrund ist. Das erste Bild lädt sofort (wichtig für den Seitenaufbau), die übrigen danach.
 */
export function HeroBilder({ bilder, takt = 5000 }: { bilder: HeroBild[]; takt?: number }) {
  const [aktiv, setAktiv] = useState(0);
  const [ruhig, setRuhig] = useState(false);

  useEffect(() => {
    if (bilder.length < 2) return;
    setRuhig(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
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
      <p aria-live="off" className="absolute right-5 bottom-5 left-5 text-sm font-medium text-paper/90">{bilder[aktiv]?.text}</p>
      {bilder.length > 1 && (
        <div className="absolute right-5 bottom-11 flex gap-1.5" aria-hidden>
          {bilder.map((b, i) => <span key={b.src} className={`h-1.5 rounded-full transition-all duration-500 ${i === aktiv ? "w-5 bg-paper" : "w-1.5 bg-paper/50"}`} />)}
        </div>
      )}
    </div>
  );
}
