"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Lädt die Seite alle n Sekunden neu, solange sie sichtbar ist (Regieplan auf mehreren Handys). */
export function AutoAktualisieren({ sekunden = 30 }: { sekunden?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, sekunden * 1000);
    return () => clearInterval(id);
  }, [router, sekunden]);
  return null;
}
