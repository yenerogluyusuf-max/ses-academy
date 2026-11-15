"use client";

import { useActionState } from "react";
import { feedbackAbsenden, type FeedbackAntworten } from "@/lib/aktionen/feedback";
import { bereichTexte, type BereichSprache } from "@/lib/bereich-texte";
import { umfrageTexte } from "@/lib/umfrage-texte";
import type { UmfrageFrage } from "@/lib/umfrage";

const ANDERE = "__andere";

/**
 * Formular der Feedback-Umfrage (Mail-Link und allgemeiner Link /umfrage/). Skalen 1–5 oder 1–10, Freitext,
 * Auswahl mit „Sonstiges“; Pflichtfragen mit *. Zeigt gespeicherte Antworten vorausgefüllt (auch nach dem Absenden,
 * React leert Formulare sonst nach einer Aktion).
 * token: link_token aus der Mail oder der Zugang aus /umfrage/ (Person-ID mit Signatur).
 */
export function FeedbackFormular({ l, token, umfrage, fragen, gespeichert }: { l: BereichSprache; token: string; umfrage: string; fragen: UmfrageFrage[]; gespeichert: FeedbackAntworten | null }) {
  const t = bereichTexte[l];
  const u = umfrageTexte[l];
  const [zustand, absenden, laeuft] = useActionState(feedbackAbsenden, { ergebnis: null, antworten: gespeichert ?? undefined, runde: 0 });
  const meldung = zustand.ergebnis === "missing" ? { text: u.fehlt, gut: false } : zustand.ergebnis ? t.feedbackMeldungen[zustand.ergebnis] : null;
  const werte = zustand.antworten ?? {};
  const mitPflicht = fragen.some((f) => f.pflicht);
  return (
    <form key={zustand.runde} action={absenden} className="mt-6 space-y-6">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="survey_id" value={umfrage} />
      {gespeichert && !zustand.ergebnis && <p role="status" className="rounded-2xl bg-gruen-hell p-4 text-sm">{t.feedbackSchonGespeichert}</p>}
      <p className="text-sm text-ink-soft">{mitPflicht ? u.pflichtHinweis : t.feedbackFreiwillig}</p>
      {fragen.map((f, i) => {
        const wert = werte[f.id];
        const istAndere = f.kind === "auswahl" && typeof wert === "string" && !f.optionen.some((o) => o.wert === wert);
        return (
          <fieldset key={f.id} className="karte">
            <legend className="sr-only">{f.prompt}</legend>
            <input type="hidden" name={`art_${f.id}`} value={f.kind} />
            <p className="font-semibold" aria-hidden>{i + 1}. {f.prompt}{f.pflicht && <span className="text-rot"> *</span>}</p>
            {f.kind === "skala" ? (
              <>
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {Array.from({ length: f.max }, (_, n) => n + 1).map((n) => (
                    <label key={n} className="flex cursor-pointer items-center justify-center rounded-2xl bg-white py-2.5 ring-1 ring-line has-[:checked]:bg-ink has-[:checked]:text-paper">
                      <input type="radio" name={`q_${f.id}`} value={n} required={f.pflicht && n === 1} defaultChecked={wert === n} className="sr-only" />
                      <span className="font-display text-xl font-bold">{n}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-ink-soft">{u.skalaEnden(f.max)}</p>
              </>
            ) : f.kind === "auswahl" ? (
              <div className="mt-3 grid gap-2">
                {f.optionen.map((o, n) => (
                  <label key={o.wert} className="flex cursor-pointer items-center gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-line has-[:checked]:ring-2 has-[:checked]:ring-ink">
                    <input type="radio" name={`q_${f.id}`} value={o.wert} required={f.pflicht && n === 0} defaultChecked={wert === o.wert} />
                    <span>{o.text}</span>
                  </label>
                ))}
                {f.andere && (
                  <label className="flex cursor-pointer flex-wrap items-center gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-line has-[:checked]:ring-2 has-[:checked]:ring-ink">
                    <input type="radio" name={`q_${f.id}`} value={ANDERE} defaultChecked={istAndere} />
                    <span>{u.sonstiges}:</span>
                    <input type="text" name={`andere_${f.id}`} maxLength={300} defaultValue={istAndere ? String(wert) : ""} placeholder={u.sonstigesFeld} aria-label={`${u.sonstiges}: ${u.sonstigesFeld}`} className="feld min-w-0 flex-1 !py-1.5" />
                  </label>
                )}
              </div>
            ) : (
              <textarea name={`q_${f.id}`} rows={3} maxLength={2000} required={f.pflicht} defaultValue={typeof wert === "string" ? wert : ""} className="feld mt-3" aria-label={f.prompt} />
            )}
          </fieldset>
        );
      })}
      {meldung && <p role="status" className={`rounded-2xl p-4 font-semibold ${meldung.gut ? "bg-gruen-hell" : "bg-gelb-hell"}`}>{meldung.text}</p>}
      <button type="submit" disabled={laeuft} className="knopf w-full !py-3.5 text-base">{laeuft ? t.feedbackSpeichert : gespeichert || zustand.ergebnis === "saved" ? t.feedbackAktualisieren : t.feedbackAbsenden}</button>
    </form>
  );
}
