import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { PDFDocument } from "pdf-lib";
import { chromium } from "playwright";
import { requireStaff } from "@/lib/auth";
import { istToken } from "@/lib/codes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { TeamSprache } from "@/lib/team-sprache";

const fehlerText: Record<TeamSprache, string> = {
  de: "Die PDF konnte nicht erzeugt werden. Bitte die Druckansicht der Akte nutzen.",
  tr: "PDF oluşturulamadı. Lütfen dosyanın yazdırma görünümünü kullan.",
  fr: "Le PDF n’a pas pu être créé. Merci d’utiliser la version imprimable du dossier.",
};

/**
 * Akte einer Person als fertige PDF (Admin/Vorstand). Wie die Zimmerliste druckt der Server die Druckseite
 * /team/teilnehmende/[id]/akte/ mit Chromium und der Sitzung der anfragenden Person; ein Lebenslauf als PDF wird
 * mit pdf-lib als weitere Seiten angehängt (Bilder stehen schon auf der Druckseite, Word-Dateien nicht).
 */
export async function GET(_: Request, { params }: RouteContext<"/team/teilnehmende/[id]/akte/pdf">) {
  const staff = await requireStaff("alles");
  const { id } = await params;
  if (!istToken(id)) notFound();
  const supabase = await createClient();
  const [{ data: p }, { data: profil }] = await Promise.all([
    supabase.from("participants").select("first_name, last_name").eq("id", id).maybeSingle(),
    supabase.from("participant_profiles").select("cv_path").eq("participant_id", id).maybeSingle(),
  ]);
  if (!p) notFound();
  const datei = `Akte ${`${p.first_name} ${p.last_name}`.trim()}.pdf`;

  const intern = `http://127.0.0.1:${process.env.PORT ?? "3000"}`;
  const sitzung = (await cookies()).getAll().map(({ name, value }) => ({ name, value, url: intern }));
  const browser = await chromium.launch();
  try {
    const kontext = await browser.newContext();
    await kontext.addCookies(sitzung);
    const seite = await kontext.newPage();
    const antwort = await seite.goto(`${intern}/team/teilnehmende/${id}/akte/`, { waitUntil: "networkidle", timeout: 30_000 });
    if (!antwort?.ok() || !new URL(seite.url()).pathname.endsWith("/akte/")) {
      throw new Error(`Druckseite nicht geladen: ${antwort?.status() ?? "keine Antwort"} ${new URL(seite.url()).pathname}`);
    }
    await seite.evaluate(async () => { await document.fonts.ready; });
    let pdf: Uint8Array = await seite.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });

    // Lebenslauf als PDF anhängen
    if (profil?.cv_path?.endsWith(".pdf")) {
      const { data: cv } = await createAdminClient().storage.from("lebenslaeufe").download(profil.cv_path);
      if (cv) {
        try {
          const akte = await PDFDocument.load(pdf);
          const anhang = await PDFDocument.load(await cv.arrayBuffer(), { ignoreEncryption: true });
          const seiten = await akte.copyPages(anhang, anhang.getPageIndices());
          seiten.forEach((s) => akte.addPage(s));
          akte.setTitle(datei.replace(/\.pdf$/, ""));
          pdf = await akte.save();
        } catch (fehler) {
          // Beschädigter oder geschützter Lebenslauf: die Akte kommt trotzdem, nur ohne Anhang
          console.error("Akte: Lebenslauf nicht angehängt:", fehler);
        }
      }
    }

    const ascii = datei.normalize("NFKD").replace(/[^\w .-]/g, "_");
    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(datei)}`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "x-robots-tag": "noindex",
      },
    });
  } catch (fehler) {
    console.error("Akte als PDF:", fehler);
    return new Response(fehlerText[staff.sprache], { status: 500, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  } finally {
    await browser.close();
  }
}
