import type { NextRequest } from "next/server";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { istToken } from "@/lib/codes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { weiterleiten } from "@/lib/weiterleitung";

/**
 * Foto und Lebenslauf einer Person (Umbau 16.11.2026). Nur Admin/Vorstand.
 * POST: art=foto|lebenslauf, aktion=hochladen|entfernen (Datei im Feld „datei“). GET ?art=lebenslauf: Lebenslauf öffnen.
 * Fotos liegen wie die selbst hochgeladenen im Speicher „fotos“ (Pfad <id>/<zeit>.<endung>, siehe update_my_profile),
 * Lebensläufe im privaten Speicher „lebenslaeufe“.
 */
const FOTO = { grenze: 5 * 1024 * 1024, typen: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as Record<string, string> };
const CV = {
  grenze: 10 * 1024 * 1024,
  typen: {
    "application/pdf": "pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/msword": "doc", "image/jpeg": "jpg", "image/png": "png",
  } as Record<string, string>,
};

export async function POST(request: NextRequest, { params }: RouteContext<"/team/teilnehmende/[id]/dateien">) {
  const staff = await requireStaff("alles");
  const { id } = await params;
  if (!istToken(id)) notFound();
  const zurueck = (h: string) => weiterleiten(`/team/teilnehmende/${id}/?hinweis=${h}#dateien`, 303);
  const laenge = Number(request.headers.get("content-length") ?? NaN);
  const form = Number.isFinite(laenge) && laenge <= CV.grenze + 512 * 1024 ? await request.formData().catch(() => null) : null;
  if (!form) return zurueck("datei-zu-gross");
  const art = String(form.get("art"));
  const aktion = String(form.get("aktion"));
  const supabase = await createClient();
  const admin = createAdminClient();

  if (art === "foto") {
    const { data: p } = await supabase.from("participants").select("photo_path").eq("id", id).maybeSingle();
    if (!p) notFound();
    if (aktion === "entfernen") {
      if (p.photo_path) await admin.storage.from("fotos").remove([p.photo_path]);
      await supabase.from("participants").update({ photo_path: null }).eq("id", id);
      return zurueck("foto-entfernt");
    }
    const datei = form.get("datei");
    if (!(datei instanceof File) || datei.size === 0) return zurueck("datei-fehlt");
    const endung = FOTO.typen[datei.type];
    if (!endung) return zurueck("datei-art");
    if (datei.size > FOTO.grenze) return zurueck("datei-zu-gross");
    const pfad = `${id}/${Date.now()}.${endung}`;
    const { error } = await admin.storage.from("fotos").upload(pfad, datei, { contentType: datei.type });
    if (error) return zurueck("datei-fehler");
    const { error: fehler } = await supabase.from("participants").update({ photo_path: pfad }).eq("id", id);
    if (fehler) { await admin.storage.from("fotos").remove([pfad]); return zurueck("datei-fehler"); }
    if (p.photo_path) await admin.storage.from("fotos").remove([p.photo_path]);
    return zurueck("foto-gespeichert");
  }

  if (art === "lebenslauf") {
    const { data: profil } = await supabase.from("participant_profiles").select("cv_path").eq("participant_id", id).maybeSingle();
    if (aktion === "entfernen") {
      if (profil?.cv_path) await admin.storage.from("lebenslaeufe").remove([profil.cv_path]);
      await supabase.from("participant_profiles").update({ cv_path: null, cv_name: null, updated_by: staff.userId }).eq("participant_id", id);
      return zurueck("cv-entfernt");
    }
    const datei = form.get("datei");
    if (!(datei instanceof File) || datei.size === 0) return zurueck("datei-fehlt");
    const endung = CV.typen[datei.type];
    if (!endung) return zurueck("datei-art");
    if (datei.size > CV.grenze) return zurueck("datei-zu-gross");
    const pfad = `${id}/${Date.now()}.${endung}`;
    const { error } = await admin.storage.from("lebenslaeufe").upload(pfad, datei, { contentType: datei.type });
    if (error) return zurueck("datei-fehler");
    const { error: fehler } = await supabase.from("participant_profiles")
      .upsert({ participant_id: id, cv_path: pfad, cv_name: datei.name.slice(0, 200), updated_by: staff.userId });
    if (fehler) { await admin.storage.from("lebenslaeufe").remove([pfad]); return zurueck("datei-fehler"); }
    if (profil?.cv_path) await admin.storage.from("lebenslaeufe").remove([profil.cv_path]);
    return zurueck("cv-gespeichert");
  }
  return zurueck("eingabe");
}

/** Lebenslauf ansehen (PDF und Bilder im Browser, Word als Download). */
export async function GET(request: NextRequest, { params }: RouteContext<"/team/teilnehmende/[id]/dateien">) {
  await requireStaff("alles");
  const { id } = await params;
  if (!istToken(id) || request.nextUrl.searchParams.get("art") !== "lebenslauf") notFound();
  const { data: profil } = await (await createClient()).from("participant_profiles").select("cv_path, cv_name").eq("participant_id", id).maybeSingle();
  if (!profil?.cv_path) notFound();
  const { data: datei } = await createAdminClient().storage.from("lebenslaeufe").download(profil.cv_path);
  if (!datei) notFound();
  const typ = datei.type || "application/octet-stream";
  const imBrowser = typ === "application/pdf" || typ.startsWith("image/");
  const name = (profil.cv_name ?? "Lebenslauf").replace(/[^\w.\- äöüÄÖÜßçğıöşüÇĞİÖŞÜ]+/g, "_");
  return new Response(datei, {
    headers: {
      "content-type": typ, "cache-control": "private, no-store", "x-content-type-options": "nosniff",
      "content-disposition": `${imBrowser ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(name)}`,
      ...(imBrowser ? {} : { "content-security-policy": "sandbox" }),
    },
  });
}
