"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const rolle = z.enum(["admin", "vorstand", "orga_team", "checkin_helper"]);

function zurueck(hinweis: string): never {
  revalidatePath("/team/team/");
  redirect(`/team/team/?hinweis=${hinweis}`);
}

/** Zeitraum eines Moduls für einen Zugang auf Zeit: 4 Stunden vor dem ersten Tag bis 6 Stunden nach dem letzten (wie der Einlass). */
async function modulZeitraum(modulId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("modules").select("title, module_days(starts_at, ends_at)").eq("id", modulId).maybeSingle();
  if (!data || data.module_days.length === 0) return null;
  const beginn = Math.min(...data.module_days.map((d) => Date.parse(d.starts_at))) - 4 * 3600_000;
  const ende = Math.max(...data.module_days.map((d) => Date.parse(d.ends_at))) + 6 * 3600_000;
  return { valid_from: new Date(beginn).toISOString(), valid_until: new Date(ende).toISOString(), titel: data.title };
}

/** Zugang auf ein Modul begrenzen oder wieder unbefristet machen. */
export async function zugangZeitraum(formData: FormData) {
  const staff = await requireStaff("admin");
  const userId = String(formData.get("user_id"));
  const modul = String(formData.get("modul") ?? "");
  if (userId === staff.userId) zurueck("selbst");
  const supabase = await createClient();
  if (!modul) {
    const { error } = await supabase.from("staff_members").update({ valid_from: null, valid_until: null, label: null }).eq("user_id", userId);
    zurueck(error ? "fehler" : "gespeichert");
  }
  const z = await modulZeitraum(modul);
  if (!z) zurueck("modul-ohne-termin");
  const { data: m } = await supabase.from("staff_members").select("role").eq("user_id", userId).maybeSingle();
  const { error } = await supabase.from("staff_members").update({
    valid_from: z.valid_from, valid_until: z.valid_until, label: `${m?.role === "checkin_helper" ? "Helfer" : "Team"} · ${z.titel}`,
  }).eq("user_id", userId);
  zurueck(error ? "fehler" : "gespeichert");
}

/** Neues Team-Konto mit Startpasswort. Das Passwort gibt der Admin persönlich weiter; ändern unter „Passwort“. */
export async function mitgliedAnlegen(formData: FormData) {
  await requireStaff("admin");
  const d = z.object({
    email: z.string().trim().toLowerCase().pipe(z.email()),
    name: z.string().trim().min(1).max(80),
    rolle,
    passwort: z.string().min(10).max(72),
  }).safeParse({ email: formData.get("email"), name: formData.get("name"), rolle: formData.get("rolle"), passwort: formData.get("passwort") });
  if (!d.success) zurueck("eingabe");

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({ email: d.data.email, password: d.data.passwort, email_confirm: true });
  if (error?.code === "email_exists") zurueck("existiert");
  if (error || !data.user) zurueck("fehler");

  const supabase = await createClient();
  const modul = String(formData.get("modul") ?? "");
  const zeitraum = modul ? await modulZeitraum(modul) : null;
  const { error: fehler } = await supabase.from("staff_members").insert({
    user_id: data.user.id, role: d.data.rolle, display_name: d.data.name,
    ...(zeitraum ? { valid_from: zeitraum.valid_from, valid_until: zeitraum.valid_until, label: `${d.data.rolle === "checkin_helper" ? "Helfer" : "Team"} · ${zeitraum.titel}` } : {}),
  });
  if (fehler) {
    await admin.auth.admin.deleteUser(data.user.id);
    zurueck("fehler");
  }
  zurueck("angelegt");
}

async function anzahlAdmins() {
  const supabase = await createClient();
  const { count } = await supabase.from("staff_members").select("user_id", { count: "exact", head: true }).eq("role", "admin");
  return count ?? 0;
}

export async function rolleAendern(formData: FormData) {
  const staff = await requireStaff("admin");
  const userId = String(formData.get("user_id"));
  const neu = rolle.safeParse(formData.get("rolle"));
  if (!neu.success) zurueck("eingabe");
  if (userId === staff.userId && neu.data !== "admin" && (await anzahlAdmins()) <= 1) zurueck("letzter-admin");
  const supabase = await createClient();
  const { error } = await supabase.from("staff_members").update({ role: neu.data }).eq("user_id", userId);
  zurueck(error ? "fehler" : "gespeichert");
}

/** Konto entfernen: Login wird gelöscht, bisherige Check-ins bleiben im Protokoll erhalten. */
export async function mitgliedEntfernen(formData: FormData) {
  const staff = await requireStaff("admin");
  const userId = String(formData.get("user_id"));
  if (userId === staff.userId) zurueck("selbst");
  const supabase = await createClient();
  await supabase.from("staff_members").delete().eq("user_id", userId);
  // Fremdschlüssel auf auth.users (checked_in_by, actor_id, ...) verhindern das Löschen, wenn das Konto
  // schon gearbeitet hat; dann wird es stattdessen gesperrt.
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
  zurueck("entfernt");
}

export type PasswortZustand = { meldung: string | null; ok: boolean };

export async function passwortAendern(_vorher: PasswortZustand, formData: FormData): Promise<PasswortZustand> {
  await requireStaff("einlass");
  const neu = String(formData.get("neu") ?? "");
  if (neu.length < 10) return { meldung: "Das Passwort braucht mindestens 10 Zeichen.", ok: false };
  if (neu !== String(formData.get("wiederholung") ?? "")) return { meldung: "Die beiden Eingaben stimmen nicht überein.", ok: false };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: neu });
  return error ? { meldung: "Das hat nicht geklappt. Ist das neue Passwort gleich dem alten?", ok: false } : { meldung: "Passwort geändert.", ok: true };
}
