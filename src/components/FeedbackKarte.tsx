import Link from "next/link";
import type { OffeneUmfrage } from "@/lib/feedback";

/**
 * Hinweis „Dein Feedback“ für offene Umfragen (Ticket-Seite und „Mein Bereich“). Der Link nutzt den persönlichen
 * Link-Token wie die Einladungsmail; wer schon geantwortet hat, sieht nur den Dank (die Antworten sind anonym).
 */
export function FeedbackKarte({ umfragen, token, texte }: {
  umfragen: OffeneUmfrage[];
  token: string;
  texte: { titel: string; text: (modul: string) => string; geben: string; danke: string; aendern: string };
}) {
  if (umfragen.length === 0) return null;
  return (
    <section className="mt-6 space-y-3" aria-label={texte.titel}>
      {umfragen.map((u) => (
        <div key={u.surveyId} className="rounded-3xl bg-signal/40 p-5 ring-1 ring-forest/20">
          <p className="font-display text-xl font-bold">{u.beantwortet ? texte.danke : texte.titel}</p>
          {!u.beantwortet && <p className="mt-1">{texte.text(u.modulTitel)}</p>}
          {/* Antworten sind anonym (seit 15.11.2026): nach dem Absenden nichts mehr zum Ansehen oder Ändern */}
          {!u.beantwortet && (
            <Link href={`/feedback/${token}/${u.surveyId}/`} className="mt-4 inline-block rounded-full bg-ink px-6 py-3 font-semibold text-paper">
              {texte.geben}
            </Link>
          )}
        </div>
      ))}
    </section>
  );
}
