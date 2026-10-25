import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { istToken } from "@/lib/codes";
import { namensschilderHtml } from "@/lib/namensschilder";

/** Namensschilder zum Drucken (ab Orga-Team): acht je A4-Seite mit QR-Code für den Einlass. */
export async function GET(_: Request, { params }: RouteContext<"/team/module/[id]/namensschilder">) {
  await requireStaff("orga");
  const { id } = await params;
  if (!istToken(id)) notFound();
  const html = await namensschilderHtml(id);
  if (!html) notFound();
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
}
