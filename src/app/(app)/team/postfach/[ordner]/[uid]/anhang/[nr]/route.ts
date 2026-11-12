import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { istOrdner, postfachAnhang } from "@/lib/postfach";

/**
 * Anhang einer Mail aus dem Postfach herunterladen (nur Orga-Team und höher). Immer als Download und mit
 * Sandbox-CSP, damit ein fremder Anhang (z. B. HTML) nie als Seite unserer Domain läuft.
 */
export async function GET(_request: Request, { params }: RouteContext<"/team/postfach/[ordner]/[uid]/anhang/[nr]">) {
  await requireStaff("orga");
  const { ordner, uid: uidText, nr: nrText } = await params;
  const uid = Number(uidText);
  const nr = Number(nrText);
  if (!istOrdner(ordner) || !Number.isInteger(uid) || uid <= 0 || !Number.isInteger(nr) || nr < 0) notFound();
  const anhang = await postfachAnhang(ordner, uid, nr).catch(() => null);
  if (!anhang) notFound();
  const sicher = /^(application\/pdf|image\/(png|jpeg|gif|webp))$/i.test(anhang.typ) ? anhang.typ : "application/octet-stream";
  const ascii = anhang.name.replace(/[^\w.\- ]+/g, "_");
  return new Response(new Uint8Array(anhang.inhalt), {
    headers: {
      "content-type": sicher,
      "content-disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(anhang.name)}`,
      "content-security-policy": "sandbox; default-src 'none'",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
