"use client";

import type { TeamSprache } from "@/lib/team-sprache";

const T = {
  de: { alle: "alle", keine: "keine" },
  tr: { alle: "tümü", keine: "hiçbiri" },
  fr: { alle: "tous", keine: "aucun" },
} satisfies Record<TeamSprache, Record<string, string>>;

/** „Alle“ / „Keine“ für die Kästchen der Rundmail-Auswahl (data-rundmail) in einer Liste. */
export function AuswahlKnoepfe({ sprache = "de" }: { sprache?: TeamSprache } = {}) {
  const t = T[sprache];
  const setzen = (an: boolean) => {
    document.querySelectorAll<HTMLInputElement>("input[data-rundmail]").forEach((e) => { e.checked = an; });
    document.dispatchEvent(new Event("change"));
  };
  return (
    <span className="inline-flex gap-2 text-xs font-semibold">
      <button type="button" onClick={() => setzen(true)} className="underline">{t.alle}</button>
      <button type="button" onClick={() => setzen(false)} className="underline">{t.keine}</button>
    </span>
  );
}
