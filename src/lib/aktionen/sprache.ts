"use server";

import { redirect } from "next/navigation";
import { istToken } from "@/lib/codes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Sprachen des Umschalters (Wunsch 12.11.2026); Profil kennt zusätzlich en/nl (Website, Ticket-Seite). */
const erlaubt = new Set(["de", "tr", "fr"]);

/** „Mein Bereich“: eigene Profilsprache setzen (auch für spätere Mails), dann zurück zur Seite. */
export async function meineSpracheSetzen(formData: FormData) {
  const sprache = String(formData.get("sprache") ?? "");
  if (erlaubt.has(sprache)) {
    const supabase = await createClient();
    await supabase.rpc("set_my_language", { p_language: sprache });
  }
  redirect("/mein-bereich/");
}

/**
 * Ticket-Seite und Feedback ohne Konto: Sprache über den Link aus der Mail (link_token) setzen. Mit dem Inhalt des
 * QR-Codes (checkin_token) geht das nicht; dort wechselt die Seite nur die Anzeige (?sprache=).
 */
export async function linkSpracheSetzen(formData: FormData) {
  const token = String(formData.get("token") ?? "").toLowerCase();
  const sprache = String(formData.get("sprache") ?? "");
  const umfrage = String(formData.get("umfrage") ?? "");
  if (!istToken(token)) redirect("/");
  if (erlaubt.has(sprache)) {
    await createAdminClient().from("participants").update({ preferred_language: sprache }).eq("link_token", token);
  }
  redirect(istToken(umfrage) ? `/feedback/${token}/${umfrage}/` : `/ticket/${token}/`);
}
