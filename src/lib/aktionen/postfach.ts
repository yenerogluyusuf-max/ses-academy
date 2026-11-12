"use server";

import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { sendeAntwortMail } from "@/lib/mail";
import { istOrdner, postfachMail, postfachNachAntwort } from "@/lib/postfach";
import { createAdminClient } from "@/lib/supabase/admin";
import { teamLocale } from "@/lib/team-sprache";

/** Zitatzeile über dem Original, in der Sprache des Teammitglieds, das antwortet. */
const schrieb = {
  de: (wann: string | null, wer: string) => (wann ? `Am ${wann} schrieb ${wer}:` : `${wer} schrieb:`),
  tr: (wann: string | null, wer: string) => (wann ? `${wann} tarihinde ${wer} şunu yazdı:` : `${wer} şunu yazdı:`),
  fr: (wann: string | null, wer: string) => (wann ? `Le ${wann}, ${wer} a écrit\u00a0:` : `${wer} a écrit\u00a0:`),
};

/** Antwort auf eine Mail im Postfach, als info@ (nur Orga-Team und höher). Zitiert das Original als Text. */
export async function postfachAntworten(formData: FormData) {
  const staff = await requireStaff("orga");
  const ordner = formData.get("ordner");
  const uid = Number(formData.get("uid"));
  if (!istOrdner(ordner) || ordner === "gesendet" || !Number.isInteger(uid) || uid <= 0) redirect("/team/postfach/");
  const zurueck = (hinweis: string): never => redirect(`/team/postfach/${ordner}/${uid}/?hinweis=${hinweis}#antwort`);
  const text = String(formData.get("text") ?? "").replace(/\r\n/g, "\n").trim();
  if (!text) zurueck("leer");
  if (text.length > 20_000) zurueck("zu-lang");

  const mail = await postfachMail(ordner, uid).catch(() => null);
  if (!mail) zurueck("nicht-erreichbar");
  const an = mail!.antwortAn[0]?.adresse || mail!.von?.adresse;
  if (!an) zurueck("keine-adresse");
  const betreff = /^\s*(re|aw|antw)\s*:/i.test(mail!.betreff) ? mail!.betreff : `Re: ${mail!.betreff}`;
  const wann = mail!.datum ? new Intl.DateTimeFormat(teamLocale[staff.sprache], { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(mail!.datum)) : null;
  const wer = mail!.von ? (mail!.von.name ? `${mail!.von.name} <${mail!.von.adresse}>` : mail!.von.adresse) : "";
  const original = mail!.text.trim().slice(0, 10_000);
  const zitat = original ? `\n\n${schrieb[staff.sprache](wann, wer)}\n${original.split("\n").map((z) => `> ${z}`).join("\n")}` : "";

  const e = await sendeAntwortMail({ an: an!, betreff, text: text + zitat, inReplyTo: mail!.messageId, references: mail!.references });
  await createAdminClient().from("email_log").insert({
    kind: "postfach_antwort", recipient: an!, status: e.ok ? "sent" : "failed", error: e.ok ? null : e.fehler.slice(0, 500), triggered_by: staff.userId,
  });
  if (!e.ok) return zurueck("fehler");
  // Kopie in „Gesendet“ und Original als beantwortet; scheitert das, ist die Antwort trotzdem raus
  const abgelegt = await postfachNachAntwort(ordner, uid, e.roh).then(() => true, () => false);
  zurueck(abgelegt ? "gesendet" : "gesendet-ohne-kopie");
}
