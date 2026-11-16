"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { beitraege as festeBeitraege } from "@/i18n/stimmen";

// „Beitrag einreichen“ (16.11.2026): Teilnehmende reichen in „Mein Bereich“ ein (mit Einwilligung), Admin/Vorstand
// prüfen unter /team/stimmen/ und schalten frei. Erst dann steht der Beitrag unter /stimmen/ (alle Sprachen).

export type EinreichenZustand = { ergebnis?: string; nr?: number };

/** /stimmen/ in allen Sprachen neu aufbauen (Liste und Einzelseiten). */
function stimmenNeu() {
  revalidatePath("/stimmen", "layout");
  revalidatePath("/[lang]/stimmen", "layout");
}

export async function beitragEinreichen(vorher: EinreichenZustand, formData: FormData): Promise<EinreichenZustand> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/mein-bereich/login/");
  const s = (k: string) => String(formData.get(k) ?? "");
  const heute = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
  const datum = /^\d{4}-\d{2}-\d{2}$/.test(s("datum")) ? s("datum") : heute;
  const { data, error } = await supabase.rpc("submit_own_contribution", {
    p_kind: s("art"),
    p_title: s("titel"),
    p_url: s("link"),
    p_outlet: s("medium"),
    p_published_on: datum,
    p_summary: s("text").replace(/\r\n/g, "\n"),
    p_language: s("sprache"),
    p_country: s("land"),
    p_city: s("stadt"),
    p_full_name: s("name") === "voll",
    p_consent: formData.get("einwilligung") === "ja",
  });
  const ergebnis = error ? "fehler" : String((data as { result?: string } | null)?.result ?? "fehler");
  if (ergebnis === "saved") revalidatePath("/mein-bereich/");
  // nr zählt mit, damit das Formular nach jedem Erfolg neu (leer) aufgebaut wird
  return { ergebnis, nr: (vorher.nr ?? 0) + (ergebnis === "saved" ? 1 : 0) };
}

/** Eigene Einreichung zurückziehen (= Einwilligung widerrufen): wird gelöscht, auch von der Website. */
export async function beitragZurueckziehen(formData: FormData) {
  if (formData.get("bestaetigt") !== "ja") return;
  const supabase = await createClient();
  const { data } = await supabase.rpc("withdraw_own_contribution", { p_id: String(formData.get("id") ?? "") });
  const r = data as { result?: string; slug?: string | null } | null;
  if (r?.slug) stimmenNeu();
  revalidatePath("/mein-bereich/");
  redirect(`/mein-bereich/?beitrag=${r?.result === "withdrawn" ? "withdrawn" : "fehler"}#beitraege`);
}

// ---------------------------------------------------------------------------
// Prüfung im Team (Admin/Vorstand; die Datenbank prüft dasselbe über has_full_access)
// ---------------------------------------------------------------------------

/** Adresse auf der Website aus Name und Titel, z. B. „zeynep-k-demokratie-braucht-uns“. */
function slugAus(text: string): string {
  const ersetzt = text.toLocaleLowerCase("tr")
    .replace(/ä/g, "ae").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss")
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i").replace(/ş/g, "s")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (ersetzt.length <= 64) return ersetzt || "beitrag";
  const kurz = ersetzt.slice(0, 64);
  return kurz.slice(0, kurz.lastIndexOf("-") > 20 ? kurz.lastIndexOf("-") : 64);
}

const zurueck = (hinweis: string): never => redirect(`/team/stimmen/?hinweis=${hinweis}`);

export async function beitragVeroeffentlichen(formData: FormData) {
  const staff = await requireStaff("alles");
  const id = String(formData.get("id") ?? "");
  const titel = String(formData.get("titel") ?? "").trim();
  const text = String(formData.get("text") ?? "").replace(/\r\n/g, "\n").trim();
  const medium = String(formData.get("medium") ?? "").trim();
  if (!titel || titel.length > 200 || text.length < 40 || text.length > 8000 || medium.length > 120) zurueck("eingabe");
  const supabase = await createClient();
  const { data: c } = await supabase.from("contributions").select("id, website_slug, author_name, consent_at, submitted_at").eq("id", id).maybeSingle();
  if (!c) zurueck("fehler");
  if (c!.submitted_at && !c!.consent_at) zurueck("einwilligung");

  let slug = c!.website_slug;
  if (!slug) {
    const basis = slugAus(`${c!.author_name ?? ""} ${titel}`);
    const { data: belegt } = await supabase.from("contributions").select("website_slug").like("website_slug", `${basis}%`);
    const vergeben = new Set([...festeBeitraege.map((b) => b.slug), ...(belegt ?? []).map((b) => b.website_slug)]);
    slug = basis;
    for (let i = 2; vergeben.has(slug); i++) slug = `${basis}-${i}`;
  }
  const { error } = await supabase.from("contributions").update({
    title: titel, summary: text, outlet: medium || null, status: "veroeffentlicht", website_slug: slug,
    reviewed_by: staff.userId, reviewed_at: new Date().toISOString(), review_note: null,
  }).eq("id", id);
  if (error) zurueck("fehler");
  stimmenNeu();
  revalidatePath("/team/stimmen/");
  zurueck("veroeffentlicht");
}

export async function beitragNichtUebernehmen(formData: FormData) {
  const staff = await requireStaff("alles");
  const notiz = String(formData.get("notiz") ?? "").trim().slice(0, 1000);
  const supabase = await createClient();
  const { error } = await supabase.from("contributions").update({
    status: "nicht_uebernommen", review_note: notiz || null, reviewed_by: staff.userId, reviewed_at: new Date().toISOString(),
  }).eq("id", String(formData.get("id") ?? ""));
  if (error) zurueck("fehler");
  stimmenNeu();
  revalidatePath("/team/stimmen/");
  zurueck("nicht_uebernommen");
}

/** Von der Website nehmen bzw. eine Entscheidung zurücknehmen: zurück in „wartet auf Prüfung“. */
export async function beitragZurueckstellen(formData: FormData) {
  const staff = await requireStaff("alles");
  const supabase = await createClient();
  const { error } = await supabase.from("contributions").update({
    status: "eingereicht", reviewed_by: staff.userId, reviewed_at: new Date().toISOString(),
  }).eq("id", String(formData.get("id") ?? "")).in("status", ["veroeffentlicht", "nicht_uebernommen"]).not("submitted_at", "is", null);
  if (error) zurueck("fehler");
  stimmenNeu();
  revalidatePath("/team/stimmen/");
  zurueck("zurueckgestellt");
}
