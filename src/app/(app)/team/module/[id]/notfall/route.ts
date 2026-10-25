import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { istToken } from "@/lib/codes";
import { ladeNotfallListe, notfallHtml } from "@/lib/notfall-liste";

/** Druckansicht der Notfall-Liste (ab Orga-Team). Das nächtliche Skript erzeugt dieselbe Liste als PDF. */
export async function GET(_: Request, { params }: RouteContext<"/team/module/[id]/notfall">) {
  await requireStaff("orga");
  const { id } = await params;
  if (!istToken(id)) notFound();
  const daten = await ladeNotfallListe(id);
  if (!daten) notFound();
  return new Response(notfallHtml(daten, true), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
}
