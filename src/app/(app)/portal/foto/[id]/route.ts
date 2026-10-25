import { notFound } from "next/navigation";
import { istToken } from "@/lib/codes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Profilfoto eines Mitglieds. Sehen darf es, wer das Mitgliederverzeichnis sehen darf (angemeldete Mitglieder und Team);
 * das prüft get_member_directory mit der Sitzung. Der Speicher selbst ist nur auf dem Server erreichbar.
 */
export async function GET(_: Request, { params }: RouteContext<"/portal/foto/[id]">) {
  const { id } = await params;
  if (!istToken(id)) notFound();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) notFound();
  const { data: sichtbar } = await supabase.rpc("get_member_directory").eq("participant_id", id).maybeSingle();
  const eigenes = (await supabase.from("participants").select("id").eq("user_id", auth.user.id).eq("id", id).maybeSingle()).data;
  if (!sichtbar?.has_photo && !eigenes) notFound();
  const admin = createAdminClient();
  const { data: p } = await admin.from("participants").select("photo_path").eq("id", id).maybeSingle();
  if (!p?.photo_path) notFound();
  const { data: datei } = await admin.storage.from("fotos").download(p.photo_path);
  if (!datei) notFound();
  return new Response(datei, {
    headers: { "content-type": datei.type || "image/jpeg", "cache-control": "private, max-age=300", "x-content-type-options": "nosniff", "content-security-policy": "sandbox" },
  });
}
