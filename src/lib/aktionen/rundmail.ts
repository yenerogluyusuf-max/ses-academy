"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { istToken } from "@/lib/codes";
import { mailBereit, sendeNachricht } from "@/lib/mail";
import { createClient } from "@/lib/supabase/server";

// Rundmails (Nachrichten an alle bzw. an eine Auswahl): erst prüfen (Empfängerzahl, Testmail an sich selbst), dann zur
// Freigabe vorlegen. Versand nach dem Vier-Augen-Prinzip in freigaben.ts. Nur Admin/Vorstand ohne Modulbegrenzung
// (requireStaff("alles"), in der Datenbank has_full_access()).

const text = (max: number) => z.string().max(max).transform((s) => s.trim());
const schema = z.object({
  betreff: text(200), text: text(10000), betreffTr: text(200), textTr: text(10000),
  sprache: z.enum(["de", "tr", "konto"]),
  filter: z.record(z.string(), z.string()).default({}),
  ids: z.array(z.string()).max(3000).optional(),
  auswahl: z.string().max(300).optional(),
});
export type RundmailEingabe = z.input<typeof schema>;
type Geprueft = z.output<typeof schema>;

/**
 * Kennungen statt Texten: RundmailFormular zeigt sie in der Sprache des Team-Bereichs an.
 * eingabe: Angaben ungültig · text-de/text-tr: Betreff oder Text fehlt · niemand: niemand ausgewählt ·
 * empfaenger: Empfänger nicht ermittelbar · keine-empfaenger: keine Empfänger mit Adresse · mail-aus: kein Mailversand ·
 * test-fehler: Testmail abgelehnt · vorlage-*: Vorlagen speichern und löschen · fehler: sonstiger Fehler.
 */
export type RundmailFehler =
  | "eingabe" | "text-de" | "text-tr" | "niemand" | "empfaenger" | "keine-empfaenger" | "mail-aus" | "test-fehler"
  | "vorlage-name" | "vorlage-betreff" | "vorlage-fehler" | "vorlage-unbekannt" | "fehler";

export type RundmailPruefung =
  | { ok: true; anzahl: number; tuerkisch: number; ohneAdresse: number }
  | { ok: false; fehler: RundmailFehler };

/** Ergebnis der Testmail: gesendet (eine oder zwei Fassungen an email) oder Fehlerkennung. */
export type RundmailTest = { ok: true; zwei: boolean; email: string } | { ok: false; fehler: RundmailFehler };

/** Ergebnis beim Speichern oder Löschen einer Vorlage. */
export type VorlageMeldung =
  | { ok: true; erfolg: "gespeichert" | "aktualisiert" | "geloescht"; name?: string; id?: string }
  | { ok: false; fehler: RundmailFehler };

/** Nur bekannte Filter mit gültigen Werten; bei einer Auswahl genau diese Personen. */
function filterAus(d: Geprueft) {
  const f: Record<string, string | string[]> = {};
  for (const k of ["cohort_id", "region_id", "mentor_id", "module_id", "group_id"]) {
    const v = d.filter[k] ?? "";
    if (k === "region_id" ? /^\d+$/.test(v) : istToken(v)) f[k] = v;
  }
  if (d.ids) f.participant_ids = [...new Set(d.ids.filter(istToken))];
  return f;
}

function pruefeTexte(d: Geprueft): RundmailFehler | null {
  if ((d.sprache === "de" || d.sprache === "konto") && (!d.betreff || !d.text)) return "text-de";
  if ((d.sprache === "tr" || d.sprache === "konto") && (!d.betreffTr || !d.textTr)) return "text-tr";
  return null;
}

/** Empfänger zählen (gleiche Regeln wie beim Versand), je Sprache. */
export async function rundmailPruefen(eingabe: RundmailEingabe): Promise<RundmailPruefung> {
  await requireStaff("alles");
  const d = schema.safeParse(eingabe);
  if (!d.success) return { ok: false, fehler: "eingabe" };
  const textFehler = pruefeTexte(d.data);
  if (textFehler) return { ok: false, fehler: textFehler };
  const filter = filterAus(d.data);
  if (Array.isArray(filter.participant_ids) && filter.participant_ids.length === 0) return { ok: false, fehler: "niemand" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("broadcast_recipients", { p_filter: filter });
  if (error) return { ok: false, fehler: "empfaenger" };
  const liste = data ?? [];
  const tuerkisch = d.data.sprache === "tr" ? liste.length : d.data.sprache === "konto" ? liste.filter((e) => e.preferred_language === "tr").length : 0;
  const ohneAdresse = Array.isArray(filter.participant_ids) ? filter.participant_ids.length - liste.length : 0;
  return { ok: true, anzahl: liste.length, tuerkisch, ohneAdresse };
}

/** Testmail an die eigene Adresse; bei „nach Kontosprache“ beide Fassungen. */
export async function rundmailTesten(eingabe: RundmailEingabe): Promise<RundmailTest> {
  const staff = await requireStaff("alles");
  const d = schema.safeParse(eingabe);
  if (!d.success) return { ok: false, fehler: "eingabe" };
  const textFehler = pruefeTexte(d.data);
  if (textFehler) return { ok: false, fehler: textFehler };
  if (!mailBereit()) return { ok: false, fehler: "mail-aus" };
  const an = { participant_id: null, email: staff.email, first_name: staff.name.split(" ")[0] };
  const fassungen = [
    ...(d.data.sprache !== "tr" ? [{ betreff: d.data.betreff, text: d.data.text, sprache: "de" as const }] : []),
    ...(d.data.sprache !== "de" ? [{ betreff: d.data.betreffTr, text: d.data.textTr, sprache: "tr" as const }] : []),
  ];
  for (const f of fassungen) {
    const r = await sendeNachricht(an, f, "test", staff.userId, true);
    if (!r.ok) return { ok: false, fehler: "test-fehler" };
  }
  return { ok: true, zwei: fassungen.length > 1, email: staff.email };
}

/** Zur Freigabe vorlegen. Empfängerzahl und Beschreibung für die zweite Person baut die Datenbank (create_approval). */
export async function rundmailVorlegen(eingabe: RundmailEingabe): Promise<{ fehler: RundmailFehler }> {
  await requireStaff("alles");
  const d = schema.safeParse(eingabe);
  if (!d.success) return { fehler: "eingabe" };
  const textFehler = pruefeTexte(d.data);
  if (textFehler) return { fehler: textFehler };
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_approval", {
    p_action: "nachricht",
    p_payload: {
      betreff: d.data.sprache === "tr" ? "" : d.data.betreff, text: d.data.sprache === "tr" ? "" : d.data.text,
      betreff_tr: d.data.sprache === "de" ? "" : d.data.betreffTr, text_tr: d.data.sprache === "de" ? "" : d.data.textTr,
      sprache: d.data.sprache, filter: filterAus(d.data), auswahl: d.data.auswahl ?? "",
    },
  });
  if (error) return { fehler: error.message.includes("no_recipients") ? "keine-empfaenger" : "fehler" };
  revalidatePath("/team/nachrichten/");
  revalidatePath("/team/freigaben/");
  redirect("/team/nachrichten/?hinweis=beantragt");
}

const vorlageSchema = z.object({
  name: z.string().trim().min(1).max(100),
  betreff: text(200), text: text(10000), betreffTr: text(200), textTr: text(10000),
});

/** Vorlage speichern; gleicher Name überschreibt die vorhandene. */
export async function vorlageSpeichern(eingabe: z.input<typeof vorlageSchema>): Promise<VorlageMeldung> {
  await requireStaff("alles");
  const d = vorlageSchema.safeParse(eingabe);
  if (!d.success) return { ok: false, fehler: "vorlage-name" };
  if (!d.data.betreff && !d.data.betreffTr) return { ok: false, fehler: "vorlage-betreff" };
  const supabase = await createClient();
  const werte = { name: d.data.name, subject_de: d.data.betreff, body_de: d.data.text, subject_tr: d.data.betreffTr, body_tr: d.data.textTr };
  const { data: vorhanden } = await supabase.from("message_templates").select("id, name");
  const gleich = (vorhanden ?? []).find((v) => v.name.trim().toLowerCase() === d.data.name.toLowerCase());
  const { data, error } = gleich
    ? await supabase.from("message_templates").update(werte).eq("id", gleich.id).select("id").single()
    : await supabase.from("message_templates").insert(werte).select("id").single();
  if (error || !data) return { ok: false, fehler: "vorlage-fehler" };
  revalidatePath("/team/nachrichten/");
  revalidatePath("/team/teilnehmende/");
  return { ok: true, erfolg: gleich ? "aktualisiert" : "gespeichert", name: d.data.name, id: data.id };
}

export async function vorlageLoeschen(id: string): Promise<VorlageMeldung> {
  await requireStaff("alles");
  if (!istToken(id)) return { ok: false, fehler: "vorlage-unbekannt" };
  const supabase = await createClient();
  const { error } = await supabase.from("message_templates").delete().eq("id", id);
  revalidatePath("/team/nachrichten/");
  revalidatePath("/team/teilnehmende/");
  return error ? { ok: false, fehler: "fehler" } : { ok: true, erfolg: "geloescht" };
}
