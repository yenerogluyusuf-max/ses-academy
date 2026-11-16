"use client";

import { startTransition, useActionState, useState } from "react";
import { beitragEinreichen, type EinreichenZustand } from "@/lib/aktionen/beitraege";

type Texte = {
  knopf: string; intro: string; art: string; titel: string; link: string; linkHilfe: string; medium: string; mediumHilfe: string;
  datum: string; sprache: string; text: string; textHilfe: string; land: string; stadt: string; name: string; nameKurz: string;
  nameVoll: string; einwilligung: string; abschicken: string; laeuft: string;
  arten: Record<string, string>; sprachen: Record<string, string>; laender: Record<string, string>;
  hinweise: Record<string, { text: string; gut: boolean }>;
};

/**
 * „Beitrag einreichen“ in „Mein Bereich“. Eingeklappt, damit die Seite übersichtlich bleibt. Bei einem Fehler bleiben
 * alle Eingaben stehen (wichtig bei langen Kommentaren) – deshalb onSubmit statt action, sonst leert React das Formular
 * nach jedem Absenden; nach dem Einreichen wird es über key neu (leer) aufgebaut.
 */
export function BeitragFormular({ t, vorgabe }: {
  t: Texte;
  vorgabe: { sprache: string; land: string; heute: string; nameKurz: string; nameVoll: string };
}) {
  const [zustand, aktion, laeuft] = useActionState<EinreichenZustand, FormData>(beitragEinreichen, {});
  const [art, setArt] = useState("artikel");
  const hinweis = zustand.ergebnis ? t.hinweise[zustand.ergebnis] ?? t.hinweise.fehler : null;
  const fehler = hinweis && !hinweis.gut;
  const id = (n: string) => `beitrag-${n}`;

  return (
    <details className="karte mt-4" open={Boolean(fehler)}>
      <summary className="cursor-pointer font-semibold">+ {t.knopf}</summary>
      {hinweis && <p role="status" className={`mt-4 rounded-2xl p-4 font-semibold ${hinweis.gut ? "bg-gruen-hell" : "bg-gelb-hell"}`}>{hinweis.text}</p>}
      <p className="mt-4 text-sm text-ink-soft">{t.intro}</p>
      {/* key: nach jedem Erfolg ein frisches, leeres Formular */}
      <form
        key={zustand.nr ?? 0}
        onSubmit={(e) => {
          e.preventDefault();
          const daten = new FormData(e.currentTarget);
          startTransition(() => aktion(daten));
        }}
        className="mt-5 grid gap-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="etikett" htmlFor={id("art")}>{t.art}</label>
            <select id={id("art")} name="art" className="feld" value={art} onChange={(e) => setArt(e.target.value)}>
              {Object.entries(t.arten).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="etikett" htmlFor={id("sprache")}>{t.sprache}</label>
            <select id={id("sprache")} name="sprache" defaultValue={vorgabe.sprache} className="feld">
              {Object.entries(t.sprachen).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="etikett" htmlFor={id("titel")}>{t.titel}</label>
          <input id={id("titel")} name="titel" required maxLength={200} className="feld" />
        </div>
        <div>
          <label className="etikett" htmlFor={id("link")}>{t.link}</label>
          <input id={id("link")} name="link" type="url" required={art !== "kommentar"} placeholder="https://" maxLength={1000} className="feld" aria-describedby={id("link-hilfe")} />
          <p id={id("link-hilfe")} className="mt-1 text-xs text-ink-soft">{t.linkHilfe}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
          <div>
            <label className="etikett" htmlFor={id("medium")}>{t.medium}</label>
            <input id={id("medium")} name="medium" maxLength={120} placeholder={t.mediumHilfe} className="feld" />
          </div>
          <div>
            <label className="etikett" htmlFor={id("datum")}>{t.datum}</label>
            <input id={id("datum")} name="datum" type="date" required max={vorgabe.heute} defaultValue={vorgabe.heute} className="feld" />
          </div>
        </div>
        <div>
          <label className="etikett" htmlFor={id("text")}>{t.text}</label>
          <textarea id={id("text")} name="text" required minLength={40} maxLength={8000} rows={art === "kommentar" ? 12 : 4} className="feld" aria-describedby={id("text-hilfe")} />
          <p id={id("text-hilfe")} className="mt-1 text-xs text-ink-soft">{t.textHilfe}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="etikett" htmlFor={id("land")}>{t.land}</label>
            <select id={id("land")} name="land" defaultValue={vorgabe.land} className="feld">
              {Object.entries(t.laender).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="etikett" htmlFor={id("stadt")}>{t.stadt}</label>
            <input id={id("stadt")} name="stadt" maxLength={80} className="feld" />
          </div>
        </div>
        <fieldset>
          <legend className="etikett">{t.name}</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex items-center gap-2"><input type="radio" name="name" value="kurz" defaultChecked /> {vorgabe.nameKurz} <span className="text-sm text-ink-soft">({t.nameKurz})</span></label>
            <label className="flex items-center gap-2"><input type="radio" name="name" value="voll" /> {vorgabe.nameVoll} <span className="text-sm text-ink-soft">({t.nameVoll})</span></label>
          </div>
        </fieldset>
        <label className="flex items-start gap-3 rounded-2xl bg-paper-deep p-4 text-sm">
          <input type="checkbox" name="einwilligung" value="ja" required className="mt-1" />
          <span>{t.einwilligung}</span>
        </label>
        <div>
          <button type="submit" disabled={laeuft} aria-busy={laeuft} className="knopf">{laeuft ? t.laeuft : t.abschicken}</button>
        </div>
      </form>
    </details>
  );
}
