import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { bereichSprache, bereichTexte } from "@/lib/bereich-texte";
import { istToken } from "@/lib/codes";
import { createAdminClient } from "@/lib/supabase/admin";
import { feedbackText } from "@/lib/feedback";
import { jetztMs } from "@/lib/zeit";
import { FeedbackFormular } from "./FeedbackFormular";

export const metadata: Metadata = { title: "Feedback | SES Academy", robots: { index: false, follow: false }, referrer: "same-origin" };

/** Feedback-Umfrage über den persönlichen Link aus der Mail. Der Link-Token (nicht der QR-Inhalt) ist der Nachweis, ein Konto ist nicht nötig. */
export default async function FeedbackSeite({ params }: PageProps<"/feedback/[token]/[umfrage]">) {
  const { token, umfrage } = await params;
  if (!istToken(token) || !istToken(umfrage)) notFound();
  const db = createAdminClient();
  const [{ data: person }, { data: u }] = await Promise.all([
    db.from("participants").select("id, first_name, preferred_language").eq("link_token", token.toLowerCase()).maybeSingle(),
    db.from("feedback_surveys").select("id, module_id, opens_at, closes_at, module:modules(title, i18n), feedback_questions(id, position, kind, prompt, i18n)").eq("id", umfrage).maybeSingle(),
  ]);
  if (!person || !u) notFound();
  // Schon geantwortet? Dann vorausfüllen. War die Person gar nicht da, gleich sagen statt erst nach dem Ausfüllen.
  const [{ data: antwort }, { count: anwesend }] = await Promise.all([
    db.from("feedback_responses").select("answers").eq("survey_id", u.id).eq("participant_id", person.id).maybeSingle(),
    db.from("attendances").select("registration_id, registrations!inner(participant_id, module_id)", { count: "exact", head: true })
      .eq("registrations.participant_id", person.id).eq("registrations.module_id", u.module_id),
  ]);
  const l = bereichSprache(person.preferred_language);
  const t = bereichTexte[l];
  const jetzt = jetztMs();
  const offen = jetzt >= Date.parse(u.opens_at) && jetzt <= Date.parse(u.closes_at);
  // Fragen und Modultitel in der Sprache der Person (Übersetzungen in i18n, sonst Deutsch)
  const fragen = [...u.feedback_questions].sort((a, b) => a.position - b.position)
    .map((f) => ({ id: f.id, kind: f.kind, prompt: feedbackText(f.i18n, l, "prompt", f.prompt) }));
  const modulTitel = feedbackText(u.module?.i18n, l, "title", u.module?.title ?? "");

  return (
    <main lang={l} className="mx-auto max-w-lg px-4 py-10">
      <img src="/brand/ses-logo.png" alt="SES Academy" className="h-10 w-auto" />
      <h1 className="font-display mt-8 text-3xl font-bold">{t.feedbackTitel}</h1>
      <p className="mt-1 text-lg">{modulTitel}</p>
      <p className="mt-4 text-ink-soft">{t.feedbackHallo(person.first_name, Boolean(anwesend))}</p>
      {offen && !anwesend ? (
        <p className="karte mt-6">{t.feedbackNichtDa}</p>
      ) : offen ? (
        <FeedbackFormular l={l} token={token.toLowerCase()} umfrage={u.id} fragen={fragen} gespeichert={(antwort?.answers as Record<string, number | string> | null) ?? null} />
      ) : (
        <p className="karte mt-6">{jetzt < Date.parse(u.opens_at) ? t.feedbackOeffnet : t.feedbackBeendet}</p>
      )}
    </main>
  );
}
