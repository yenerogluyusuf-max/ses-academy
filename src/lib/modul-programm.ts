import "server-only";

import { feedbackText } from "@/lib/feedback";
import { createAdminClient } from "@/lib/supabase/admin";

/** Programm eines Moduls für Teilnehmende (Ticket-Seite, Mein Bereich), Titel in ihrer Sprache (Spalte i18n). */
export type ProgrammTag = { beginn: string; ende: string; punkte: { von: string; bis: string | null; titel: string }[] };

export async function ladeModulProgramm(moduleId: string, sprache: string | null | undefined): Promise<ProgrammTag[]> {
  const { data } = await createAdminClient().from("module_days")
    .select("starts_at, ends_at, program_items(starts_at, ends_at, title, i18n, status)")
    .eq("module_id", moduleId).order("starts_at");
  return (data ?? []).map((d) => ({
    beginn: d.starts_at,
    ende: d.ends_at,
    punkte: d.program_items.filter((p) => p.status !== "entfaellt").sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .map((p) => ({ von: p.starts_at, bis: p.ends_at, titel: feedbackText(p.i18n, sprache, "title", p.title) })),
  }));
}

/** Sprachname am Ende der Dokumenttitel („Tagesordnung Teilnehmende · Deutsch“). */
const sprachName: Record<string, string> = { de: "Deutsch", tr: "Türkçe", fr: "Français", en: "English" };

/**
 * Aktuelle Tagesordnung (PDF) für Teilnehmende in einer Sprache: Dokument des Moduls mit Schlagwort „Tagesordnung“,
 * „Teilnehmende“ im Titel, Sprachname am Ende, nicht archiviert. Ohne Fassung in der Sprache: ersatzweise Englisch
 * (für nl) bzw. nichts – die Info-Mail hängt dann nichts an.
 */
export async function tagesordnungFassung(moduleId: string, sprache: string, ersatz = false): Promise<{ storagePath: string; fileName: string } | null> {
  const kandidaten = ersatz ? [sprache, sprache === "nl" ? "en" : null, "de"].filter(Boolean) as string[] : [sprache];
  const db = createAdminClient();
  const { data: dokumente } = await db.from("documents").select("id, title, current_version")
    .eq("module_id", moduleId).neq("status", "archiv").gt("current_version", 0).contains("tags", ["Tagesordnung"]);
  for (const l of kandidaten) {
    const name = sprachName[l];
    const dok = name ? (dokumente ?? []).find((d) => /teilnehmende/i.test(d.title) && d.title.trim().endsWith(name)) : undefined;
    if (!dok) continue;
    const { data: v } = await db.from("document_versions").select("storage_path, file_name").eq("document_id", dok.id).eq("version", dok.current_version).maybeSingle();
    if (v && /\.pdf$/i.test(v.file_name)) return { storagePath: v.storage_path, fileName: v.file_name };
  }
  return null;
}
