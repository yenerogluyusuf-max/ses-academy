"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff, rollenName } from "@/lib/auth";
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

/**
 * Neuen Team-Zugang beantragen (Vier-Augen-Prinzip, Entscheidung 25.10.2026): ein zweiter Admin gibt frei, danach legt
 * die anfragende Person das Konto an. Ein Passwort gibt es nicht mehr; die Person meldet sich per E-Mail-Code an.
 */
export async function mitgliedAnlegen(formData: FormData) {
  await requireStaff("admin");
  const d = z.object({
    email: z.string().trim().toLowerCase().pipe(z.email()),
    name: z.string().trim().min(1).max(80),
    rolle,
  }).safeParse({ email: formData.get("email"), name: formData.get("name"), rolle: formData.get("rolle") });
  if (!d.success) zurueck("eingabe");
  const modul = String(formData.get("modul") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.from("approvals").insert({
    action: "team_zugang",
    summary: `Team-Zugang für ${d.data.name} <${d.data.email}> als ${rollenName[d.data.rolle]}${modul ? " (befristet auf ein Modul)" : ""}`,
    payload: { art: "neu", email: d.data.email, name: d.data.name, rolle: d.data.rolle, modul: modul || null },
  });
  zurueck(error ? "fehler" : "beantragt");
}

const rang: Record<z.infer<typeof rolle>, number> = { checkin_helper: 0, orga_team: 1, vorstand: 2, admin: 3 };

/** Freigegebenen Antrag ausführen: Konto anlegen bzw. Rolle hochstufen. */
export async function teamZugangAusfuehren(formData: FormData) {
  await requireStaff("admin");
  const id = String(formData.get("id"));
  const supabase = await createClient();
  const { data: antwort } = await supabase.rpc("claim_approval", { p_id: id, p_action: "team_zugang" });
  const a = antwort as { result: string; payload?: { art: "neu" | "rolle"; email?: string; name?: string; rolle: z.infer<typeof rolle>; modul?: string | null; user_id?: string } } | null;
  if (a?.result !== "ok" || !a.payload) zurueck(a?.result === "expired" ? "abgelaufen" : "fehler");
  const p = a.payload;
  if (p.art === "rolle" && p.user_id) {
    const { error } = await supabase.from("staff_members").update({ role: p.rolle }).eq("user_id", p.user_id);
    zurueck(error ? "fehler" : "gespeichert");
  }
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({ email: p.email!, email_confirm: true });
  if (error?.code === "email_exists") zurueck("existiert");
  if (error || !data.user) zurueck("fehler");
  const zeitraum = p.modul ? await modulZeitraum(p.modul) : null;
  const { error: fehler } = await supabase.from("staff_members").insert({
    user_id: data.user.id, role: p.rolle, display_name: p.name!,
    ...(zeitraum ? { valid_from: zeitraum.valid_from, valid_until: zeitraum.valid_until, label: `${p.rolle === "checkin_helper" ? "Helfer" : "Team"} · ${zeitraum.titel}` } : {}),
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

/** Rolle ändern. Herabstufen geht sofort; Hochstufen (mehr Rechte) braucht die Freigabe eines zweiten Admins. */
export async function rolleAendern(formData: FormData) {
  const staff = await requireStaff("admin");
  const userId = String(formData.get("user_id"));
  const neu = rolle.safeParse(formData.get("rolle"));
  if (!neu.success) zurueck("eingabe");
  if (userId === staff.userId && neu.data !== "admin" && (await anzahlAdmins()) <= 1) zurueck("letzter-admin");
  const supabase = await createClient();
  const { data: bisher } = await supabase.from("staff_members").select("role, display_name").eq("user_id", userId).maybeSingle();
  if (bisher && rang[neu.data] > rang[bisher.role]) {
    const { error } = await supabase.from("approvals").insert({
      action: "team_zugang",
      summary: `${bisher.display_name}: Rolle von ${rollenName[bisher.role]} auf ${rollenName[neu.data]} hochstufen`,
      payload: { art: "rolle", user_id: userId, rolle: neu.data },
    });
    zurueck(error ? "fehler" : "beantragt");
  }
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

/** Zweiten Faktor eines Teammitglieds löschen (z. B. Handy verloren). Beim nächsten Login wird neu eingerichtet. */
export async function faktorZuruecksetzen(formData: FormData) {
  const staff = await requireStaff("admin");
  const userId = String(formData.get("user_id"));
  if (userId === staff.userId) zurueck("selbst");
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.mfa.listFactors({ userId });
  for (const f of data?.factors ?? []) {
    const { error } = await admin.auth.admin.mfa.deleteFactor({ userId, id: f.id });
    if (error) zurueck("fehler");
  }
  // Laufende Sitzungen beenden (samt Refresh-Tokens), damit niemand mit dem alten Handy weiterarbeitet.
  // Bereits ausgestellte Zugriffstoken laufen spätestens nach einer Stunde ab.
  const { error } = await admin.rpc("end_user_sessions", { p_user_id: userId });
  zurueck(error ? "fehler" : "faktor-zurueckgesetzt");
}
