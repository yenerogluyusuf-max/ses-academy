import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/** Übersetzung aus einer i18n-Spalte ({"fr": {"prompt": …}}), sonst der deutsche Text. */
export function feedbackText(i18n: unknown, sprache: string | null | undefined, feld: string, deutsch: string): string {
  if (!sprache || sprache === "de" || !i18n || typeof i18n !== "object") return deutsch;
  const eintrag = (i18n as Record<string, unknown>)[sprache];
  const wert = eintrag && typeof eintrag === "object" ? (eintrag as Record<string, unknown>)[feld] : null;
  return typeof wert === "string" && wert.trim() ? wert : deutsch;
}

export type OffeneUmfrage = { surveyId: string; modulTitel: string; beantwortet: boolean };

/**
 * Umfragen, die eine Person JETZT ausfüllen kann: offen (opens_at bis closes_at) und die Person war an mindestens
 * einem Tag des Moduls eingecheckt. Für die Feedback-Karte auf der Ticket-Seite und in „Mein Bereich“.
 */
export async function offeneUmfragen(participantId: string, sprache: string | null | undefined): Promise<OffeneUmfrage[]> {
  const db = createAdminClient();
  const { data: besucht } = await db.from("attendances").select("registrations!inner(participant_id, module_id)").eq("registrations.participant_id", participantId);
  const modulIds = [...new Set((besucht ?? []).map((a) => a.registrations.module_id))];
  if (modulIds.length === 0) return [];
  const jetzt = new Date().toISOString();
  const { data: umfragen } = await db.from("feedback_surveys").select("id, module:modules(title, i18n)")
    .in("module_id", modulIds).lte("opens_at", jetzt).gt("closes_at", jetzt);
  if (!umfragen?.length) return [];
  const { data: antworten } = await db.from("feedback_responses").select("survey_id").eq("participant_id", participantId).in("survey_id", umfragen.map((u) => u.id));
  const fertig = new Set((antworten ?? []).map((a) => a.survey_id));
  return umfragen.map((u) => ({
    surveyId: u.id,
    modulTitel: feedbackText(u.module?.i18n, sprache, "title", u.module?.title ?? ""),
    beantwortet: fertig.has(u.id),
  }));
}
