import { requireStaff } from "@/lib/auth";
import { postfachBereit, postfachGesendetFinden } from "@/lib/postfach";

/**
 * „ansehen“ im Versandprotokoll: sucht die in „Gesendet“ abgelegte Kopie einer App-Mail (Empfänger, Versandtag)
 * und leitet auf die Mail im Postfach weiter. Ohne Kopie zurück zum Ordner mit Hinweis.
 */
export async function GET(req: Request) {
  await requireStaff("orga");
  const sp = new URL(req.url).searchParams;
  const an = (sp.get("an") ?? "").trim().toLowerCase();
  const zeit = Date.parse(sp.get("zeit") ?? "");
  const weiter = (pfad: string) => new Response(null, { status: 303, headers: { Location: pfad } });
  if (!postfachBereit() || !an.includes("@") || Number.isNaN(zeit)) return weiter("/team/postfach/?ordner=gesendet&kopie=fehlt");
  const uid = await postfachGesendetFinden(an, new Date(zeit - 24 * 3600_000)).catch(() => null);
  return weiter(uid ? `/team/postfach/gesendet/${uid}/` : "/team/postfach/?ordner=gesendet&kopie=fehlt");
}
