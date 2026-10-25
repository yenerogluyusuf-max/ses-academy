import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { istToken } from "@/lib/codes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Hochgeladene Datei einer Abgabe ansehen (ab Orga-Team). Der Speicher ist nur auf dem Server erreichbar. */
export async function GET(_: Request, { params }: RouteContext<"/team/abgaben/[id]/datei">) {
  await requireStaff("orga");
  const { id } = await params;
  if (!istToken(id)) notFound();
  // Lesen mit der Sitzung: RLS bestätigt, dass die Rolle die Abgabe sehen darf
  const { data: abgabe } = await (await createClient()).from("submissions").select("storage_path, file_name").eq("id", id).maybeSingle();
  if (!abgabe?.storage_path) notFound();
  const { data: datei } = await createAdminClient().storage.from("abgaben").download(abgabe.storage_path);
  if (!datei) notFound();
  const name = (abgabe.file_name ?? "abgabe").replace(/[^\w.\- ]+/g, "_");
  // Hochgeladene Dateien sind fremde Inhalte: nur Medien und PDF im Browser zeigen, alles andere (HTML, SVG, …)
  // als Download; die Sandbox verhindert Skripte auch bei falsch deklarierten Dateien.
  const sicher = /^(video|audio)\/|^image\/(png|jpeg|gif|webp)$|^application\/pdf$/.test(datei.type);
  return new Response(datei, {
    headers: {
      "content-type": sicher ? datei.type : "application/octet-stream",
      "content-disposition": `${sicher ? "inline" : "attachment"}; filename="${name}"`,
      "content-security-policy": "sandbox; default-src 'none'; img-src 'self'; media-src 'self'; object-src 'self'",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex",
    },
  });
}
