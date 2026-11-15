"use server";

import { redirect } from "next/navigation";
import { bereichSprache } from "@/lib/bereich-texte";
import { createAdminClient } from "@/lib/supabase/admin";
import { umfrageZugang } from "@/lib/umfrage";

/**
 * Allgemeiner Umfrage-Link (/umfrage/, z. B. für die WhatsApp-Gruppe): Person per E-Mail-Adresse erkennen und zur
 * Umfrage des Moduls schicken, bei dem sie eingecheckt war. Der Zugang öffnet nur das Formular, nicht die Ticket-Seite.
 */
export async function umfrageOeffnen(formData: FormData) {
  const sprache = bereichSprache(String(formData.get("sprache") ?? "tr"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const zurueck = (fehler: string) => redirect(`/umfrage/?sprache=${sprache}&fehler=${fehler}`);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) zurueck("unbekannt");
  const db = createAdminClient();
  const { data: person } = await db.from("participants").select("id").eq("email", email).maybeSingle();
  if (!person) zurueck("unbekannt");
  // Umfragen, die offen sind oder heute noch öffnen (der Link kann schon vorher in der Gruppe stehen)
  const jetzt = new Date();
  const bisHeuteAbend = new Date(jetzt.getTime() + 18 * 3_600_000).toISOString();
  const { data: umfragen } = await db.from("feedback_surveys").select("id, module_id, opens_at")
    .lte("opens_at", bisHeuteAbend).gt("closes_at", jetzt.toISOString()).order("opens_at", { ascending: false });
  if (!umfragen?.length) zurueck("keine");
  const { data: besucht } = await db.from("attendances").select("registrations!inner(participant_id, module_id)").eq("registrations.participant_id", person!.id);
  const module = new Set((besucht ?? []).map((a) => a.registrations.module_id));
  const umfrage = umfragen!.find((u) => module.has(u.module_id)) ?? umfragen![0];
  redirect(`/umfrage/${umfrage.id}/${umfrageZugang(person!.id, umfrage.id)}/?sprache=${sprache}`);
}
