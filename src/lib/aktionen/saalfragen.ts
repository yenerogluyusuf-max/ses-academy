"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { istToken } from "@/lib/codes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const COOKIE = "ses_geraet";

/** Gerätekennung fürs Publikum: zufällig im Cookie, in der Datenbank nur als Hash (Spamschutz, eine Stimme je Gerät). */
async function geraet(anlegen: boolean): Promise<string> {
  const speicher = await cookies();
  let roh = speicher.get(COOKIE)?.value;
  if (!roh && anlegen) {
    roh = randomUUID();
    speicher.set(COOKIE, roh, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30, path: "/fragen", secure: (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://") });
  }
  return roh ? createHash("sha256").update(roh).digest("hex").slice(0, 32) : "";
}

export async function geraetLesen(): Promise<string> {
  return geraet(false);
}

const codeOk = (c: string) => /^[A-Za-z2-9]{5}$/.test(c);

export async function frageStellen(formData: FormData) {
  const code = String(formData.get("code") ?? "").toUpperCase();
  if (!codeOk(code)) redirect("/fragen/");
  const { data } = await createAdminClient().rpc("ask_question", {
    p_code: code, p_text: String(formData.get("text") ?? "").slice(0, 500), p_name: String(formData.get("name") ?? "").slice(0, 80), p_device: await geraet(true),
  });
  redirect(`/fragen/${code}/?hinweis=${data ?? "fehler"}`);
}

export async function frageZustimmen(formData: FormData) {
  const code = String(formData.get("code") ?? "").toUpperCase();
  const id = String(formData.get("id") ?? "");
  if (!codeOk(code) || !istToken(id)) redirect("/fragen/");
  await createAdminClient().rpc("vote_question", { p_question: id, p_device: await geraet(true) });
  redirect(`/fragen/${code}/`);
}

export async function codeOeffnen(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  redirect(codeOk(code) ? `/fragen/${code}/` : "/fragen/?hinweis=code");
}

// ---------------------------------------------------------------------------
// Team: Runden und Moderation
// ---------------------------------------------------------------------------
export async function rundeAnlegen(formData: FormData) {
  const staff = await requireStaff("orga");
  const titel = String(formData.get("title") ?? "").trim().slice(0, 200);
  const modul = String(formData.get("module_id") ?? "");
  if (!titel) redirect("/team/fragen/?hinweis=eingabe");
  const supabase = await createClient();
  const { data, error } = await supabase.from("question_rounds").insert({
    title: titel, module_id: istToken(modul) ? modul : null, moderated: formData.get("moderated") !== "nein", created_by: staff.userId,
  }).select("id").single();
  if (error || !data) redirect("/team/fragen/?hinweis=fehler");
  redirect(`/team/fragen/${data.id}/`);
}

const erlaubt = ["neu", "sichtbar", "dran", "beantwortet", "ausgeblendet"];

export async function frageStatus(formData: FormData) {
  await requireStaff("orga");
  const runde = String(formData.get("round_id"));
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!istToken(runde) || !istToken(id) || !erlaubt.includes(status)) redirect(`/team/fragen/${runde}/`);
  const supabase = await createClient();
  // „dran“ ist immer nur eine Frage: die vorherige gilt als beantwortet
  if (status === "dran") await supabase.from("audience_questions").update({ status: "beantwortet" }).eq("round_id", runde).eq("status", "dran");
  await supabase.from("audience_questions").update({ status }).eq("id", id).eq("round_id", runde);
  revalidatePath(`/team/fragen/${runde}/`);
  redirect(`/team/fragen/${runde}/`);
}

export async function rundeUmschalten(formData: FormData) {
  await requireStaff("orga");
  const runde = String(formData.get("round_id"));
  if (!istToken(runde)) redirect("/team/fragen/");
  const supabase = await createClient();
  const wert = formData.get("wert") === "1";
  await supabase.from("question_rounds").update(formData.get("feld") === "moderated" ? { moderated: wert } : { open: wert }).eq("id", runde);
  revalidatePath(`/team/fragen/${runde}/`);
  redirect(`/team/fragen/${runde}/`);
}
