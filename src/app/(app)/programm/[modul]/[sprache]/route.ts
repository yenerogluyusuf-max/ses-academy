import { notFound } from "next/navigation";
import { istToken } from "@/lib/codes";
import { tagesordnungFassung } from "@/lib/modul-programm";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Tagesordnung (PDF) eines veröffentlichten Moduls für Teilnehmende, in ihrer Sprache (sonst Englisch/Deutsch).
 * Öffentlich wie das Programm selbst; persönliche Daten stehen darin nicht.
 */
export async function GET(_: Request, { params }: RouteContext<"/programm/[modul]/[sprache]">) {
  const { modul, sprache } = await params;
  if (!istToken(modul) || !/^(de|tr|fr|en|nl)$/.test(sprache)) notFound();
  const db = createAdminClient();
  const { data: m } = await db.from("modules").select("id").eq("id", modul).eq("status", "published").is("cancelled_at", null).maybeSingle();
  if (!m) notFound();
  const fassung = await tagesordnungFassung(modul, sprache, true);
  if (!fassung) notFound();
  const { data: datei } = await db.storage.from("dokumente").download(fassung.storagePath);
  if (!datei) notFound();
  const name = fassung.fileName.replace(/[^\w.\- ]+/g, "_");
  return new Response(datei, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${name}"; filename*=UTF-8''${encodeURIComponent(fassung.fileName)}`,
      "content-security-policy": "sandbox; default-src 'none'",
      "cache-control": "public, max-age=300", "x-content-type-options": "nosniff",
    },
  });
}
