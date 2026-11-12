/**
 * Sprache des Team-Bereichs (Wunsch 12.11.2026): Deutsch, Türkçe, Français. Gespeichert pro Teamkonto
 * (auth user_metadata.team_sprache, siehe getStaff in lib/auth.ts), vor der Anmeldung über ?sprache= bzw. Cookie.
 * Reine Daten, auch in Client-Komponenten nutzbar.
 */
export const teamSprachen = ["de", "tr", "fr"] as const;
export type TeamSprache = (typeof teamSprachen)[number];

export const teamSprachNamen: Record<TeamSprache, string> = { de: "Deutsch", tr: "Türkçe", fr: "Français" };

/** Für Intl.DateTimeFormat / NumberFormat / localeCompare. */
export const teamLocale: Record<TeamSprache, string> = { de: "de-DE", tr: "tr-TR", fr: "fr-FR" };

export function teamSprache(wert: unknown): TeamSprache {
  return wert === "tr" || wert === "fr" ? wert : "de";
}

export const TEAM_SPRACH_COOKIE = "team_sprache";
