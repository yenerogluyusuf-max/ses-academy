"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { istToken } from "@/lib/codes";
import { sendeNachricht } from "@/lib/mail";
import { createClient } from "@/lib/supabase/server";

// Vier-Augen-Prinzip (Entscheidung 25.10.2026): Antrag → Freigabe durch eine zweite Person → Ausführung durch die
// anfragende Person innerhalb von 24 Stunden. Die Regeln setzt die Datenbank durch (decide_approval, claim_approval).

export async function freigabeEntscheiden(formData: FormData) {
  await requireStaff("alles");
  const id = String(formData.get("id"));
  if (!istToken(id)) redirect("/team/freigaben/?hinweis=eingabe");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("decide_approval", {
    p_id: id, p_approve: formData.get("entscheidung") === "ja", p_note: String(formData.get("notiz") ?? "").slice(0, 500),
  });
  revalidatePath("/team/freigaben/");
  redirect(`/team/freigaben/?hinweis=${error ? "fehler" : data}`);
}

/** Filter aus dem Formular (leere Felder = kein Filter). */
function leseFilter(formData: FormData) {
  const filter: Record<string, string> = {};
  for (const k of ["cohort_id", "region_id", "mentor_id", "module_id", "group_id"]) {
    const v = String(formData.get(k) ?? "");
    if (k === "region_id" ? /^\d+$/.test(v) : istToken(v)) filter[k] = v;
  }
  return filter;
}

export async function nachrichtBeantragen(formData: FormData) {
  await requireStaff("alles");
  const betreff = String(formData.get("betreff") ?? "").trim().slice(0, 200);
  const text = String(formData.get("text") ?? "").trim().slice(0, 10000);
  if (!betreff || !text) redirect("/team/nachrichten/?hinweis=eingabe");
  const filter = leseFilter(formData);
  const supabase = await createClient();
  // Die Beschreibung für die zweite Person (Empfängerzahl, Filter) baut die Datenbank selbst
  const { error } = await supabase.rpc("create_approval", { p_action: "nachricht", p_payload: { betreff, text, filter } });
  revalidatePath("/team/nachrichten/");
  redirect(`/team/nachrichten/?hinweis=${error ? (error.message.includes("no_recipients") ? "keine-empfaenger" : "fehler") : "beantragt"}`);
}

/** Freigegebene Nachricht verschicken. Empfänger werden jetzt neu ermittelt (gleiche Filter). */
export async function nachrichtSenden(formData: FormData) {
  const staff = await requireStaff("alles");
  const id = String(formData.get("id"));
  if (!istToken(id)) redirect("/team/nachrichten/?hinweis=eingabe");
  const supabase = await createClient();
  const { data: antwort } = await supabase.rpc("claim_approval", { p_id: id, p_action: "nachricht" });
  const a = antwort as { result: string; payload?: { betreff: string; text: string; filter: Record<string, string> } } | null;
  if (a?.result !== "ok" || !a.payload) redirect(`/team/nachrichten/?hinweis=${a?.result ?? "fehler"}`);
  const { data: empfaenger } = await supabase.rpc("broadcast_recipients", { p_filter: a.payload.filter });
  let gesendet = 0;
  let fehler = 0;
  const warteschlange = [...(empfaenger ?? [])];
  async function arbeiter() {
    for (let e = warteschlange.shift(); e; e = warteschlange.shift()) {
      if ((await sendeNachricht(e, a!.payload!.betreff, a!.payload!.text, id, staff.userId)).ok) gesendet++;
      else fehler++;
    }
  }
  await Promise.all(Array.from({ length: 3 }, arbeiter));
  await supabase.rpc("record_approval_result", { p_id: id, p_result: { gesendet, fehler } });
  revalidatePath("/team/nachrichten/");
  redirect(`/team/nachrichten/?hinweis=gesendet-${gesendet}-${fehler}`);
}

/** Export aller Daten der Auswertung beantragen; die Filter der Auswertung werden mitgespeichert. */
export async function exportBeantragen(formData: FormData) {
  await requireStaff("alles");
  const filter = Object.fromEntries([...formData.entries()].filter(([k]) => k !== "$ACTION_ID" && !k.startsWith("$")).map(([k, v]) => [k, String(v).slice(0, 100)]));
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_approval", { p_action: "export", p_payload: { filter } });
  redirect(`/team/auswertung/?hinweis=${error ? "fehler" : "export-beantragt"}`);
}
