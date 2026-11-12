"use client";

import { useFormStatus } from "react-dom";
import type { TeamSprache } from "@/lib/team-sprache";

const laeuftStandard: Record<TeamSprache, string> = { de: "Einen Moment …", tr: "Lütfen bekle …", fr: "Un instant …" };

/**
 * Absendeknopf, der während der Anfrage gesperrt ist (kein doppeltes Absenden bei Doppelklick oder langsamem WLAN).
 * laeuft: Text während des Sendens; ohne Angabe „Einen Moment …“ in der Sprache des Team-Bereichs (sprache, Standard Deutsch).
 */
export function SendeKnopf({ children, laeuft, className = "knopf", sprache = "de" }: { children: React.ReactNode; laeuft?: string; className?: string; sprache?: TeamSprache }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} aria-busy={pending} className={className}>{pending ? (laeuft ?? laeuftStandard[sprache]) : children}</button>;
}
