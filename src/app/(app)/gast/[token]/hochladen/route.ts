import type { NextRequest } from "next/server";
import { istToken } from "@/lib/codes";
import { createAdminClient } from "@/lib/supabase/admin";
import { weiterleiten } from "@/lib/weiterleitung";

const FOLIEN = 50 * 1024 * 1024;
const FOTO = 5 * 1024 * 1024;

/** Upload über den Gast-Link. Der Link ist der Nachweis (nur bei Zusage gültig, siehe get_guest_sheet). */
export async function POST(request: NextRequest, { params }: RouteContext<"/gast/[token]/hochladen">) {
  const { token } = await params;
  if (!istToken(token)) return weiterleiten("/", 303);
  const zurueck = (h: string) => weiterleiten(`/gast/${token}/?hinweis=${h}`, 303);
  const laenge = Number(request.headers.get("content-length") ?? NaN);
  if (!Number.isFinite(laenge) || laenge > FOLIEN + FOTO + 1024 * 1024) return zurueck("zu-gross");
  const db = createAdminClient();
  const { data: blatt } = await db.rpc("get_guest_sheet", { p_token: token.toLowerCase() });
  if (!blatt) return weiterleiten("/", 303);
  const id = (blatt as { id: string }).id;
  const form = await request.formData().catch(() => null);
  if (!form) return zurueck("fehler");

  const aenderung: { slides_path?: string; photo_path?: string; slides_received?: boolean; bio_received?: boolean } = {};
  const folien = form.get("folien");
  if (folien instanceof File && folien.size > 0) {
    if (folien.size > FOLIEN) return zurueck("zu-gross");
    const pfad = `${id}/folien-${Date.now()}-${folien.name.normalize("NFKD").replace(/[^\w.-]+/g, "_").slice(-100)}`;
    if ((await db.storage.from("gaeste").upload(pfad, folien, { contentType: folien.type || "application/octet-stream" })).error) return zurueck("fehler");
    Object.assign(aenderung, { slides_path: pfad, slides_received: true });
  }
  const foto = form.get("foto");
  if (foto instanceof File && foto.size > 0) {
    if (!["image/jpeg", "image/png"].includes(foto.type)) return zurueck("art");
    if (foto.size > FOTO) return zurueck("zu-gross");
    const pfad = `${id}/foto-${Date.now()}.${foto.type === "image/png" ? "png" : "jpg"}`;
    if ((await db.storage.from("gaeste").upload(pfad, foto, { contentType: foto.type })).error) return zurueck("fehler");
    aenderung.photo_path = pfad;
  }
  const bio = String(form.get("bio") ?? "").trim().slice(0, 3000);
  const { data: ms } = await db.from("module_speakers").select("speaker_id").eq("id", id).single();
  if (bio && ms) {
    await db.from("speakers").update({ bio }).eq("id", ms.speaker_id);
    aenderung.bio_received = true;
  }
  if (Object.keys(aenderung).length) await db.from("module_speakers").update(aenderung).eq("id", id);
  return zurueck("gespeichert");
}
