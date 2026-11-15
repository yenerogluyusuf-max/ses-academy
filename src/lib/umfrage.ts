import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { feedbackText } from "@/lib/feedback";
import { istToken } from "@/lib/codes";

/** Eine Frage, wie das Formular sie zeigt (schon in der Sprache der Person). */
export type UmfrageFrage = {
  id: string;
  kind: string;
  prompt: string;
  /** Skala 1 bis max (5 oder 10) */
  max: number;
  pflicht: boolean;
  /** Auswahl: wert = gespeicherter (deutscher) Text, text = Anzeige in der Sprache der Person */
  optionen: { wert: string; text: string }[];
  andere: boolean;
};

function optionenText(i18n: unknown, sprache: string, deutsch: string[]): string[] {
  const eintrag = i18n && typeof i18n === "object" ? (i18n as Record<string, unknown>)[sprache] : null;
  const liste = eintrag && typeof eintrag === "object" ? (eintrag as Record<string, unknown>).options : null;
  return Array.isArray(liste) && liste.length === deutsch.length ? liste.map(String) : deutsch;
}

/**
 * Umfrage für eine Person: Fragen in ihrer Sprache (Ländergruppen-Fragen nur fürs eigene Land; ohne Land alle),
 * ob sie schon teilgenommen hat (Antworten sind anonym) und ob sie beim Modul eingecheckt war. Für den Mail-Link und den allgemeinen Link.
 */
export async function ladeUmfrage(participantId: string, surveyId: string, sprache: string) {
  const db = createAdminClient();
  const [{ data: person }, { data: u }] = await Promise.all([
    db.from("participants").select("id, first_name, country, preferred_language").eq("id", participantId).maybeSingle(),
    db.from("feedback_surveys")
      .select("id, module_id, opens_at, closes_at, module:modules(title, i18n), feedback_questions(id, position, kind, prompt, i18n, scale_max, required, options, other_option, country)")
      .eq("id", surveyId).maybeSingle(),
  ]);
  if (!person || !u) return null;
  const [{ data: teilnahme }, { count: anwesend }] = await Promise.all([
    db.from("feedback_teilnahmen").select("survey_id").eq("survey_id", u.id).eq("participant_id", person.id).maybeSingle(),
    db.from("attendances").select("registration_id, registrations!inner(participant_id, module_id)", { count: "exact", head: true })
      .eq("registrations.participant_id", person.id).eq("registrations.module_id", u.module_id),
  ]);
  const fragen: UmfrageFrage[] = [...u.feedback_questions]
    .filter((f) => !f.country || !person.country || f.country === person.country)
    .sort((a, b) => a.position - b.position)
    .map((f) => {
      const werte = Array.isArray(f.options) ? f.options.map(String) : [];
      const texte = optionenText(f.i18n, sprache, werte);
      return {
        id: f.id, kind: f.kind, prompt: feedbackText(f.i18n, sprache, "prompt", f.prompt), max: f.scale_max ?? 5,
        pflicht: f.required, optionen: werte.map((wert, i) => ({ wert, text: texte[i] })), andere: f.other_option,
      };
    });
  return {
    person,
    umfrage: { id: u.id, opensAt: u.opens_at, closesAt: u.closes_at },
    modulTitel: feedbackText(u.module?.i18n, sprache, "title", u.module?.title ?? ""),
    fragen,
    anwesend: Boolean(anwesend),
    /** schon teilgenommen; die Antworten selbst sind anonym und lassen sich nicht mehr zuordnen */
    beantwortet: Boolean(teilnahme),
  };
}

/**
 * Zugang über den allgemeinen Link (/umfrage/): Person-ID plus Signatur für genau diese Umfrage. Öffnet nur das
 * Formular, nicht die Ticket-Seite (anders als der link_token aus der Mail).
 */
function signatur(participantId: string, surveyId: string): string {
  const schluessel = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!schluessel) throw new Error("SUPABASE_SERVICE_ROLE_KEY fehlt");
  return createHmac("sha256", schluessel).update(`umfrage:${participantId}:${surveyId}`).digest("base64url").slice(0, 24);
}

export function umfrageZugang(participantId: string, surveyId: string): string {
  return `${participantId}.${signatur(participantId, surveyId)}`;
}

/** Person-ID aus einem Zugang, wenn die Signatur zur Umfrage passt; sonst null. */
export function pruefeZugang(zugang: string, surveyId: string): string | null {
  const [pid, sig] = zugang.split(".");
  if (!pid || !sig || !istToken(pid) || !istToken(surveyId)) return null;
  const soll = Buffer.from(signatur(pid.toLowerCase(), surveyId));
  const ist = Buffer.from(sig);
  return soll.length === ist.length && timingSafeEqual(soll, ist) ? pid.toLowerCase() : null;
}
