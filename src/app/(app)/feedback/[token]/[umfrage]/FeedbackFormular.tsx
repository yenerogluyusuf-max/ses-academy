"use client";

import { useActionState } from "react";
import { feedbackAbsenden, type FeedbackZustand } from "@/lib/aktionen/feedback";

type Frage = { id: string; kind: string; prompt: string };

const meldungen: Record<NonNullable<FeedbackZustand["ergebnis"]>, { text: string; gut: boolean }> = {
  saved: { text: "Danke! Deine Antwort ist gespeichert. Du kannst sie bis zum Ende der Umfrage noch ändern.", gut: true },
  closed: { text: "Die Umfrage ist gerade nicht offen.", gut: false },
  not_attended: { text: "Antworten können nur Personen, die beim Modul eingecheckt waren.", gut: false },
  not_found: { text: "Dieser Link ist ungültig.", gut: false },
  fehler: { text: "Das hat nicht geklappt. Bitte später noch einmal versuchen.", gut: false },
};

const skala = [
  { wert: 1, text: "sehr schlecht" },
  { wert: 2, text: "schlecht" },
  { wert: 3, text: "okay" },
  { wert: 4, text: "gut" },
  { wert: 5, text: "sehr gut" },
];

export function FeedbackFormular({ token, umfrage, fragen }: { token: string; umfrage: string; fragen: Frage[] }) {
  const [zustand, absenden, laeuft] = useActionState(feedbackAbsenden, { ergebnis: null });
  const meldung = zustand.ergebnis ? meldungen[zustand.ergebnis] : null;
  return (
    <form action={absenden} className="mt-6 space-y-6">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="survey_id" value={umfrage} />
      {fragen.map((f, i) => (
        <fieldset key={f.id} className="karte">
          <legend className="sr-only">{f.prompt}</legend>
          <input type="hidden" name={`art_${f.id}`} value={f.kind} />
          <p className="font-semibold" aria-hidden>{i + 1}. {f.prompt}</p>
          {f.kind === "skala" ? (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {skala.map((s) => (
                <label key={s.wert} className="flex cursor-pointer flex-col items-center gap-1 rounded-2xl bg-white p-2 text-center ring-1 ring-line has-[:checked]:bg-ink has-[:checked]:text-paper">
                  <input type="radio" name={`q_${f.id}`} value={s.wert} className="sr-only" />
                  <span className="font-display text-xl font-bold">{s.wert}</span>
                  <span className="text-[11px] leading-tight">{s.text}</span>
                </label>
              ))}
            </div>
          ) : (
            <textarea name={`q_${f.id}`} rows={3} maxLength={2000} className="feld mt-3" aria-label={f.prompt} />
          )}
        </fieldset>
      ))}
      {meldung && <p role="status" className={`rounded-2xl p-4 font-semibold ${meldung.gut ? "bg-gruen-hell" : "bg-gelb-hell"}`}>{meldung.text}</p>}
      <button type="submit" disabled={laeuft} className="knopf w-full !py-3.5 text-base">{laeuft ? "Wird gespeichert …" : "Antwort absenden"}</button>
    </form>
  );
}
