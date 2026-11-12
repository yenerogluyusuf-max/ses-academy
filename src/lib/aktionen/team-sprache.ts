"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TEAM_SPRACH_COOKIE, teamSprachen, type TeamSprache } from "@/lib/team-sprache";

/** Zurück auf dieselbe Seite des Team-Bereichs (aus dem Referer, nur eigene /team/-Pfade), sonst zur Übersicht. */
async function zurueckPfad(): Promise<string> {
  const h = await headers();
  try {
    const url = new URL(h.get("referer") ?? "");
    if (url.host === h.get("host") && url.pathname.startsWith("/team/")) return url.pathname + url.search;
  } catch {}
  return "/team/";
}

/**
 * Sprache des Team-Bereichs setzen: angemeldet im Konto (user_metadata.team_sprache, gilt auf allen Geräten),
 * zusätzlich als Cookie für die Anmeldeseite.
 */
export async function teamSpracheSetzen(formData: FormData) {
  const sprache = String(formData.get("sprache") ?? "") as TeamSprache;
  const ziel = await zurueckPfad();
  if (!(teamSprachen as readonly string[]).includes(sprache)) redirect(ziel);
  (await cookies()).set(TEAM_SPRACH_COOKIE, sprache, { path: "/team/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true });
  if (await getStaff()) {
    const supabase = await createClient();
    await supabase.auth.updateUser({ data: { team_sprache: sprache } });
  }
  redirect(ziel);
}
