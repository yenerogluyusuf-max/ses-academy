"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { istToken } from "@/lib/codes";
import { createClient } from "@/lib/supabase/server";

/** Liste aus Komma- oder Zeilen-getrennter Eingabe: getrimmt, ohne Doppelte (ohne Groß/Klein), höchstens 30 × 60 Zeichen. */
function liste(wert: FormDataEntryValue | null): string[] {
  const gesehen = new Set<string>();
  return String(wert ?? "")
    .split(/[,\n;]+/)
    .map((x) => x.trim().replace(/\s+/g, " ").slice(0, 60))
    .filter((x) => x && !gesehen.has(x.toLocaleLowerCase("de")) && gesehen.add(x.toLocaleLowerCase("de")))
    .slice(0, 30);
}

/**
 * Stärken, Aufgaben und Einschätzung des Teams zu einer Person speichern (participant_profiles, nur Admin/Vorstand).
 * Umbau 16.11.2026: „Wir wissen, wer was kann, wer wofür verantwortlich ist – das muss man hier einfügen können.“
 */
export async function profilSpeichern(formData: FormData) {
  const staff = await requireStaff("alles");
  const id = String(formData.get("participant_id"));
  if (!istToken(id)) redirect("/team/teilnehmende/");
  const supabase = await createClient();
  const { error } = await supabase.from("participant_profiles").upsert({
    participant_id: id,
    skills: liste(formData.get("skills")),
    tasks: liste(formData.get("tasks")),
    assessment: String(formData.get("assessment") ?? "").trim().slice(0, 4000),
    updated_by: staff.userId,
  });
  revalidatePath(`/team/teilnehmende/${id}/`);
  redirect(`/team/teilnehmende/${id}/?hinweis=${error ? "profil-fehler" : "profil-gespeichert"}#staerken`);
}
