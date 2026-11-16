"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { istToken } from "@/lib/codes";
import { mailBereit, sendeBewerbungStatus, sendeTicketMail } from "@/lib/mail";
import { createClient } from "@/lib/supabase/server";

function zurueck(hinweis: string, filter: FormDataEntryValue | null): never {
  const params = new URLSearchParams({ hinweis });
  if (filter) params.set("status", String(filter));
  revalidatePath("/team/bewerbungen/");
  redirect(`/team/bewerbungen/?${params}`);
}

/** Annehmen: Person anlegen, für alle offenen Module des Jahrgangs anmelden, Ticket-Mail senden. */
export async function annehmen(formData: FormData) {
  const staff = await requireStaff("alles");
  const id = String(formData.get("id"));
  // Folgenschwer (Anmeldung für alle Module, Ticket-Mail): nur nach der Rückfrage
  if (formData.get("bestaetigt") !== "ja") zurueck("bestaetigen", formData.get("filter"));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_application", { p_application_id: id });
  if (error || !data) zurueck("annahme-fehler", formData.get("filter"));
  const participantId = (data as { participant_id: string }).participant_id;
  const mail = await sendeTicketMail(participantId, staff.userId);
  zurueck(mail.ok ? "angenommen" : "angenommen-ohne-mail", formData.get("filter"));
}

/**
 * Status setzen ohne Annahme (in Prüfung, Warteliste, abgelehnt). Warteliste und Ablehnung nur nach Rückfrage; dabei
 * auf Wunsch eine Mail an die Person (Deutsch/Türkisch nach der Sprache der Bewerbung), wenn der Mailversand steht.
 */
export async function statusSetzen(formData: FormData) {
  const staff = await requireStaff("alles");
  const status = String(formData.get("status"));
  const id = String(formData.get("id"));
  if ((status !== "in_pruefung" && status !== "warteliste" && status !== "abgelehnt") || !istToken(id)) zurueck("fehler", formData.get("filter"));
  if (status !== "in_pruefung" && formData.get("bestaetigt") !== "ja") zurueck("bestaetigen", formData.get("filter"));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .update({ status, reviewed_by: staff.userId, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .neq("status", "angenommen")
    .neq("status", status)
    .select("email, first_name, language");
  if (error) zurueck("fehler", formData.get("filter"));
  const b = data?.[0];
  if (!b || status === "in_pruefung") zurueck("gespeichert", formData.get("filter"));
  // Ohne Mailversand klar sagen, dass die Person nichts bekommen hat (die Rückfrage bietet dann keine Mail an)
  if (!mailBereit()) zurueck("status-mail-aus", formData.get("filter"));
  if (formData.get("mail") !== "ja") zurueck("gespeichert", formData.get("filter"));
  const mail = await sendeBewerbungStatus({ email: b.email, vorname: b.first_name, sprache: b.language, status }, staff.userId);
  zurueck(mail.ok ? `${status}-mail` : "status-mail-fehler", formData.get("filter"));
}

/** Ticket-Mail erneut senden, z. B. wenn die erste im Spam gelandet ist. */
export async function ticketErneutSenden(formData: FormData) {
  const staff = await requireStaff("alles");
  const mail = await sendeTicketMail(String(formData.get("participant_id")), staff.userId);
  zurueck(mail.ok ? "ticket-gesendet" : "mail-fehler", formData.get("filter"));
}

/**
 * Bewerbungen mit der Teilnehmendenliste abgleichen (Umbau 16.11.2026, Wunsch Yusuf: „einige, die bei offen sind,
 * sind bereits angenommen“). Maßstab ist die Teilnehmendenliste: Hat eine aktive Person keine angenommene Bewerbung,
 * wird ihre neueste schon verknüpfte Bewerbung auf „angenommen“ gesetzt (ältere, z. B. eine frühere Absage vor dem
 * Nachrück-Formular, bleiben als Verlauf stehen). Keine Mails, keine neuen Anmeldungen: Die Personen sind ja schon
 * angemeldet. Verknüpft wird hier nichts: Gleiche E-Mail-Adressen bestätigt ein Admin einzeln (mitPersonVerknuepfen),
 * weil im Formular jede Adresse eingetragen werden kann.
 */
export async function mitTeilnehmendenAbgleichen(formData: FormData) {
  const staff = await requireStaff("alles");
  if (formData.get("bestaetigt") !== "ja") zurueck("bestaetigen", formData.get("filter"));
  const supabase = await createClient();
  const [{ data: bewerbungen }, { data: personen }] = await Promise.all([
    supabase.from("applications").select("id, status, participant_id, created_at, review_note").not("participant_id", "is", null),
    supabase.from("participants").select("id").eq("active", true),
  ]);
  const aktiv = new Set((personen ?? []).map((p) => p.id));
  const jePerson = new Map<string, NonNullable<typeof bewerbungen>>();
  for (const b of bewerbungen ?? []) jePerson.set(b.participant_id!, [...(jePerson.get(b.participant_id!) ?? []), b]);
  const stand = new Date().toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });
  let angenommen = 0;
  for (const [pid, liste] of jePerson) {
    if (!aktiv.has(pid) || liste.some((b) => b.status === "angenommen")) continue;
    const neueste = [...liste].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    const { error } = await supabase.from("applications").update({
      status: "angenommen", reviewed_by: staff.userId, reviewed_at: new Date().toISOString(),
      review_note: `${neueste.review_note ? `${neueste.review_note}\n` : ""}Abgleich mit der Teilnehmendenliste am ${stand}: nimmt teil (vorher ${neueste.status}).`,
    }).eq("id", neueste.id);
    if (!error) angenommen++;
  }
  zurueck(`abgleich-${angenommen}-0`, formData.get("filter"));
}

/** Eine Bewerbung mit der Person verknüpfen, die dieselbe E-Mail-Adresse hat (nach Prüfung durch ein Teammitglied). */
export async function mitPersonVerknuepfen(formData: FormData) {
  await requireStaff("alles");
  const id = String(formData.get("id"));
  const person = String(formData.get("participant_id"));
  if (!istToken(id) || !istToken(person)) zurueck("fehler", formData.get("filter"));
  const supabase = await createClient();
  const [{ data: b }, { data: p }] = await Promise.all([
    supabase.from("applications").select("email, participant_id").eq("id", id).maybeSingle(),
    supabase.from("participants").select("email").eq("id", person).maybeSingle(),
  ]);
  // Nur bei wirklich gleicher Adresse und noch ohne Verknüpfung
  if (!b || !p?.email || b.participant_id || b.email !== p.email) zurueck("fehler", formData.get("filter"));
  const { error } = await supabase.from("applications").update({ participant_id: person }).eq("id", id).is("participant_id", null);
  zurueck(error ? "fehler" : "verknuepft", formData.get("filter"));
}
