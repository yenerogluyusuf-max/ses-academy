"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { istToken } from "@/lib/codes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";

// Teilnehmende ausschließen, wieder aufnehmen und sofort löschen (18.11.2026). Was dabei genau passiert, steht in der
// Datenbank (exclude_participant, readmit_participant, delete_participant_now).

const fehlerTexte: Record<TeamSprache, { selbst: string; schonGeloescht: string }> = {
  de: { selbst: "Die eigene Person kann man hier nicht ausschließen oder löschen.", schonGeloescht: "Diese Person ist schon gelöscht." },
  tr: { selbst: "Kendi kaydını burada programdan çıkaramaz veya silemezsin.", schonGeloescht: "Bu kişi zaten silinmiş." },
  fr: { selbst: "On ne peut pas s’exclure ni se supprimer soi-même ici.", schonGeloescht: "Cette personne est déjà supprimée." },
};

function neuLaden(id: string) {
  revalidatePath(`/team/teilnehmende/${id}/`);
  revalidatePath("/team/teilnehmende/");
  revalidatePath("/team/", "layout");
}

function fehler(id: string, sprache: TeamSprache, ergebnis: string | undefined): never {
  const t = fehlerTexte[sprache];
  const text = ergebnis === "self" ? t.selbst : ergebnis === "already_deleted" ? t.schonGeloescht : teamTexte[sprache].meldung.fehler;
  redirect(`/team/teilnehmende/${id}/?fehler=${encodeURIComponent(text)}#ausschluss`);
}

const notiz = (formData: FormData) => String(formData.get("notiz") ?? "").trim().slice(0, 1000);

/** Ausschließen (Admin und Vorstand): abmelden, sperren, kommende Module absagen. Daten bleiben. */
export async function personAusschliessen(formData: FormData) {
  const staff = await requireStaff("alles");
  const id = String(formData.get("id") ?? "");
  if (!istToken(id)) fehler(id, staff.sprache, undefined);
  // Folgenschwer: nur nach der Rückfrage (Rueckfrage schickt bestaetigt=ja)
  if (formData.get("bestaetigt") !== "ja") return;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("exclude_participant", { p_participant_id: id, p_note: notiz(formData) });
  const r = data as { result?: string } | null;
  if (error || r?.result !== "ok") fehler(id, staff.sprache, r?.result);
  neuLaden(id);
  redirect(`/team/teilnehmende/${id}/?hinweis=ausgeschlossen#ausschluss`);
}

export async function personWiederAufnehmen(formData: FormData) {
  const staff = await requireStaff("alles");
  const id = String(formData.get("id") ?? "");
  if (!istToken(id)) fehler(id, staff.sprache, undefined);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("readmit_participant", { p_participant_id: id });
  if (error || (data as { result?: string } | null)?.result !== "ok") fehler(id, staff.sprache, undefined);
  neuLaden(id);
  redirect(`/team/teilnehmende/${id}/?hinweis=wieder-aufgenommen#ausschluss`);
}

/**
 * Endgültig löschen (nur Admin, ohne zweite Person – Entscheidung 18.11.2026): dasselbe Löschen und Anonymisieren wie
 * bei einem Löschantrag der Person, danach Foto und Lebenslauf aus dem Speicher entfernen.
 */
export async function personLoeschen(formData: FormData) {
  const staff = await requireStaff("admin");
  const id = String(formData.get("id") ?? "");
  if (!istToken(id)) fehler(id, staff.sprache, undefined);
  if (formData.get("bestaetigt") !== "ja") return;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_participant_now", { p_participant_id: id, p_note: notiz(formData) });
  const r = data as { result?: string; photo_path?: string | null; cv_path?: string | null } | null;
  if (error || r?.result !== "ok") fehler(id, staff.sprache, r?.result);
  const admin = createAdminClient();
  if (r.photo_path) await admin.storage.from("fotos").remove([r.photo_path]);
  if (r.cv_path) await admin.storage.from("lebenslaeufe").remove([r.cv_path]);
  neuLaden(id);
  revalidatePath("/team/loeschantraege/");
  redirect("/team/teilnehmende/?hinweis=person-geloescht");
}
