"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type LoginZustand = { fehler: string | null };

export async function anmelden(_vorher: LoginZustand, formData: FormData): Promise<LoginZustand> {
  const daten = z.object({ email: z.email(), passwort: z.string().min(1) }).safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    passwort: String(formData.get("passwort") ?? ""),
  });
  if (!daten.success) return { fehler: "Bitte E-Mail und Passwort eingeben." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: daten.data.email, password: daten.data.passwort });
  if (error) return { fehler: "E-Mail oder Passwort stimmt nicht." };
  redirect("/team/");
}

export async function abmelden() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/team/login/");
}

// ---------------------------------------------------------------------------
// Zweiter Faktor (Authenticator-App, TOTP)
// ---------------------------------------------------------------------------
export type FaktorZustand = { schritt: "start" | "einrichten" | "pruefen"; faktorId?: string; qr?: string; geheimnis?: string; fehler?: string };

/** Neuen TOTP-Faktor anlegen; liefert QR-Code und Geheimnis zum Abtippen. Alte, nie bestätigte Versuche werden entfernt. */
export async function faktorEinrichten(): Promise<FaktorZustand> {
  const supabase = await createClient();
  const { data: liste } = await supabase.auth.mfa.listFactors();
  for (const f of liste?.all ?? []) if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `SES ${new Date().toISOString().slice(0, 10)}` });
  if (error || !data) return { schritt: "start", fehler: "Das Einrichten hat nicht geklappt. Bitte neu laden." };
  return { schritt: "einrichten", faktorId: data.id, qr: data.totp.qr_code, geheimnis: data.totp.secret };
}

/** Code aus der App prüfen; danach hat die Sitzung den zweiten Faktor (aal2). */
export async function faktorPruefen(vorher: FaktorZustand, formData: FormData): Promise<FaktorZustand> {
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  const faktorId = String(formData.get("faktor_id") ?? "");
  if (code.length !== 6) return { ...vorher, fehler: "Der Code hat 6 Ziffern." };
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: faktorId, code });
  if (error) return { ...vorher, fehler: "Der Code stimmt nicht. Bitte den aktuellen Code aus der App eingeben." };
  redirect("/team/");
}

/** Pflicht für alle Teamkonten ein- oder ausschalten (nur Admin, und nur mit eigenem zweiten Faktor). */
export async function zweiterFaktorPflicht(formData: FormData) {
  const supabase = await createClient();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const { data: auth } = await supabase.auth.getUser();
  const { data: ich } = await supabase.from("staff_members").select("role").eq("user_id", auth.user?.id ?? "").maybeSingle();
  if (ich?.role !== "admin") redirect("/team/?fehler=rechte");
  const an = formData.get("an") === "1";
  if (an && aal?.currentLevel !== "aal2") redirect("/team/team/?hinweis=erst-selbst");
  const { error } = await supabase.from("settings").upsert({ key: "zweiter_faktor", value: an, updated_by: auth.user!.id, updated_at: new Date().toISOString() });
  redirect(`/team/team/?hinweis=${error ? "fehler" : an ? "faktor-an" : "faktor-aus"}`);
}
