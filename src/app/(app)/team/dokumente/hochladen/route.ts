import type { NextRequest } from "next/server";
import { requireStaff } from "@/lib/auth";
import { istToken } from "@/lib/codes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { weiterleiten } from "@/lib/weiterleitung";

const GRENZE = 100 * 1024 * 1024;
const arten = ["dokument", "material", "medien", "vorlage", "protokoll"];
const status = ["entwurf", "pruefung", "final", "archiv"];

/**
 * Neues Dokument (mit Datei oder Link) oder neue Version eines bestehenden Dokuments.
 * Die Datei geht über den Server in den privaten Speicher „dokumente“; die Version trägt add_document_version ein.
 */
export async function POST(request: NextRequest) {
  await requireStaff("orga");
  const laenge = Number(request.headers.get("content-length") ?? NaN);
  const form = Number.isFinite(laenge) && laenge <= GRENZE + 1024 * 1024 ? await request.formData().catch(() => null) : null;
  const zurueck = String(form?.get("zurueck") ?? "/team/dokumente/");
  const ziel = zurueck.startsWith("/team/") ? zurueck : "/team/dokumente/";
  const melden = (h: string) => weiterleiten(`${ziel}${ziel.includes("?") ? "&" : "?"}hinweis=${h}`, 303);
  if (!form) return melden("zu-gross");

  const supabase = await createClient();
  let dokumentId = String(form.get("document_id") ?? "");
  const datei = form.get("datei");
  const mitDatei = datei instanceof File && datei.size > 0;
  const link = String(form.get("link") ?? "").trim();
  if (!istToken(dokumentId)) {
    const titel = String(form.get("title") ?? "").trim().slice(0, 200);
    if (!titel || (!mitDatei && !link)) return melden("eingabe");
    if (link && !/^https?:\/\//i.test(link)) return melden("eingabe");
    const modul = String(form.get("module_id") ?? "");
    const { data, error } = await supabase.from("documents").insert({
      title: titel,
      kind: arten.includes(String(form.get("kind"))) ? String(form.get("kind")) : "dokument",
      status: status.includes(String(form.get("status"))) ? String(form.get("status")) : "entwurf",
      commission: String(form.get("commission") ?? "").trim().slice(0, 100) || null,
      module_id: istToken(modul) ? modul : null,
      tags: String(form.get("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20),
      description: String(form.get("description") ?? "").trim().slice(0, 2000),
      link: link || null,
    }).select("id").single();
    if (error || !data) return melden("fehler");
    dokumentId = data.id;
  }
  if (mitDatei) {
    if (datei.size > GRENZE) return melden("zu-gross");
    const name = datei.name.normalize("NFKD").replace(/[^\w.-]+/g, "_").slice(-120) || "datei";
    const pfad = `${dokumentId}/${Date.now()}-${name}`;
    const { error } = await createAdminClient().storage.from("dokumente").upload(pfad, datei, { contentType: datei.type || "application/octet-stream" });
    if (error) return melden("fehler");
    const { error: fehler } = await supabase.rpc("add_document_version", {
      p_document_id: dokumentId, p_storage_path: pfad, p_file_name: datei.name, p_mime: datei.type || "application/octet-stream", p_note: String(form.get("note") ?? ""),
    });
    if (fehler) {
      await createAdminClient().storage.from("dokumente").remove([pfad]);
      return melden("fehler");
    }
  }
  return melden("gespeichert");
}
