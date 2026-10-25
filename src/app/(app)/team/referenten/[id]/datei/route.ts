import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { istToken } from "@/lib/codes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Folien oder Foto, die ein Gast über seinen Link hochgeladen hat (ab Orga-Team). ?art=folien|foto */
export async function GET(request: Request, { params }: RouteContext<"/team/referenten/[id]/datei">) {
  await requireStaff("orga");
  const { id } = await params;
  if (!istToken(id)) notFound();
  const art = new URL(request.url).searchParams.get("art") === "foto" ? "photo_path" : "slides_path";
  const { data: ms } = await (await createClient()).from("module_speakers").select("slides_path, photo_path").eq("id", id).maybeSingle();
  const pfad = ms?.[art];
  if (!pfad) notFound();
  const { data: datei } = await createAdminClient().storage.from("gaeste").download(pfad);
  if (!datei) notFound();
  const sicher = /^image\/(png|jpeg)$|^application\/pdf$/.test(datei.type);
  return new Response(datei, {
    headers: {
      "content-type": sicher ? datei.type : "application/octet-stream",
      "content-disposition": `${sicher ? "inline" : "attachment"}; filename="${pfad.split("/").pop()}"`,
      "content-security-policy": "sandbox; default-src 'none'; img-src 'self'; object-src 'self'", "cache-control": "private, no-store", "x-content-type-options": "nosniff",
    },
  });
}
