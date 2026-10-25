import type { NextRequest } from "next/server";
import { istToken } from "@/lib/codes";
import { sendeAbgabeBestaetigung } from "@/lib/mail";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { weiterleiten } from "@/lib/weiterleitung";

const GRENZE = 100 * 1024 * 1024; // wie der Speicher „abgaben“

function zurueck(_: NextRequest, hinweis: string) {
  return weiterleiten(`/mein-bereich/?abgabe=${hinweis}#hausaufgaben`, 303);
}

/**
 * Hausaufgabe selbst abgeben (Formular in „Mein Bereich“). Die Datei geht über diesen Server in den privaten Speicher,
 * weil die Datenbank im Betrieb nur auf dem Server erreichbar ist. Eingetragen wird mit der Sitzung der Person
 * (submit_own_assignment prüft Jahrgang und Pfad); schlägt das fehl, wird die Datei wieder gelöscht.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return weiterleiten("/mein-bereich/login/", 303);

  const form = await request.formData().catch(() => null);
  if (!form) return zurueck(request, "zu_gross");
  const aufgabe = String(form.get("assignment_id") ?? "");
  const link = String(form.get("link") ?? "").trim();
  const datei = form.get("datei");
  const mitDatei = datei instanceof File && datei.size > 0;
  if (!istToken(aufgabe)) return zurueck(request, "fehler");
  if (!mitDatei && !link) return zurueck(request, "leer");
  if (link && !/^https?:\/\//i.test(link)) return zurueck(request, "link");
  if (mitDatei && datei.size > GRENZE) return zurueck(request, "zu_gross");

  const { data: ich } = await supabase.from("participants").select("id").eq("user_id", auth.user.id).maybeSingle();
  if (!ich) return zurueck(request, "fehler");

  let pfad: string | null = null;
  if (mitDatei) {
    const name = datei.name.normalize("NFKD").replace(/[^\w.-]+/g, "_").slice(-120) || "abgabe";
    pfad = `${aufgabe}/${ich.id}/${Date.now()}-${name}`;
    const { error } = await createAdminClient().storage.from("abgaben").upload(pfad, datei, { contentType: datei.type || "application/octet-stream" });
    if (error) return zurueck(request, "fehler");
  }

  const { data, error } = await supabase.rpc("submit_own_assignment", {
    p_assignment_id: aufgabe, p_link: link || undefined, p_storage_path: pfad ?? undefined,
    p_file_name: mitDatei ? datei.name : undefined, p_size_bytes: mitDatei ? datei.size : undefined,
  });
  const antwort = data as { result?: string; status?: string; submission_id?: string } | null;
  if (error || antwort?.result !== "saved") {
    if (pfad) await createAdminClient().storage.from("abgaben").remove([pfad]);
    return zurueck(request, antwort?.result === "invalid_link" ? "link" : antwort?.result === "empty" ? "leer" : "fehler");
  }
  await sendeAbgabeBestaetigung(ich.id, antwort.submission_id!);
  return zurueck(request, antwort.status === "verspaetet" ? "verspaetet" : "puenktlich");
}
