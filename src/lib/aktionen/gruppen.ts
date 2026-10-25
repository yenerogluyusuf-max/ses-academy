"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { istToken } from "@/lib/codes";
import { createClient } from "@/lib/supabase/server";

/** Telefonnummer einer Sorumlu speichern (für den Anruf-Knopf in der Gruppenansicht). */
export async function sorumluTelefon(formData: FormData) {
  await requireStaff("alles");
  const id = String(formData.get("id"));
  const tag = String(formData.get("tag") ?? "");
  const telefon = z.string().trim().max(40).safeParse(formData.get("phone") ?? "");
  const pfad = `/team/gruppen/${istToken(tag) ? `?tag=${tag}&` : "?"}`;
  if (!istToken(id) || !telefon.success) redirect(`${pfad}hinweis=eingabe`);
  const supabase = await createClient();
  const { error } = await supabase.from("mentors").update({ phone: telefon.data || null }).eq("id", id);
  revalidatePath("/team/gruppen/");
  redirect(`${pfad}hinweis=${error ? "fehler" : "gespeichert"}`);
}

/** Neuer geheimer Link für eine Sorumlu, z. B. wenn der alte weitergegeben wurde. Der alte gilt danach nicht mehr. */
export async function sorumluLinkErneuern(formData: FormData) {
  await requireStaff("alles");
  const id = String(formData.get("id"));
  if (!istToken(id)) redirect("/team/gruppen/?hinweis=eingabe");
  const supabase = await createClient();
  const { error } = await supabase.from("mentors").update({ access_token: crypto.randomUUID() }).eq("id", id);
  revalidatePath("/team/gruppen/");
  redirect(`/team/gruppen/?hinweis=${error ? "fehler" : "link-neu"}`);
}
