import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { weiterleiten } from "@/lib/weiterleitung";

const FOTO_GRENZE = 5 * 1024 * 1024;
const endungen: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function zurueck(hinweis: string) {
  return weiterleiten(`/mein-bereich/?profil=${hinweis}#profil`, 303);
}

/**
 * Eigene Profilangaben speichern (Formular in „Mein Bereich“): Telefon, Sprache, Kontakt für Mitglieder freigeben,
 * Einwilligung für Fotos, optional ein neues Profilfoto. Foto geht über den Server in den privaten Speicher „fotos“.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return weiterleiten("/mein-bereich/login/", 303);
  const laenge = Number(request.headers.get("content-length") ?? NaN);
  if (!Number.isFinite(laenge) || laenge > FOTO_GRENZE + 256 * 1024) return zurueck("foto-gross");
  const form = await request.formData().catch(() => null);
  if (!form) return zurueck("fehler");

  const { data: ich } = await supabase.from("participants").select("id, photo_path").eq("user_id", auth.user.id).maybeSingle();
  if (!ich) return zurueck("fehler");

  let fotoPfad: string | undefined;
  const foto = form.get("foto");
  if (foto instanceof File && foto.size > 0) {
    const endung = endungen[foto.type];
    if (!endung) return zurueck("foto-art");
    if (foto.size > FOTO_GRENZE) return zurueck("foto-gross");
    fotoPfad = `${ich.id}/${Date.now()}.${endung}`;
    const { error } = await createAdminClient().storage.from("fotos").upload(fotoPfad, foto, { contentType: foto.type });
    if (error) return zurueck("fehler");
  }

  const { data, error } = await supabase.rpc("update_my_profile", {
    p_phone: String(form.get("phone") ?? ""),
    p_language: String(form.get("sprache") ?? "de"),
    p_share_contact: form.get("share_contact") === "on",
    p_photo_consent: form.get("photo_consent") === "on",
    p_photo_path: fotoPfad,
  });
  if (error || data !== "saved") {
    if (fotoPfad) await createAdminClient().storage.from("fotos").remove([fotoPfad]);
    return zurueck("fehler");
  }
  // altes Foto entfernen
  if (fotoPfad && ich.photo_path) await createAdminClient().storage.from("fotos").remove([ich.photo_path]);
  return zurueck("gespeichert");
}
