import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * „Anmelden“ von der Website: ein Einstieg für Teilnehmende und Team.
 * Schon angemeldet: Teamkonten in den Team-Bereich, alle anderen in „Mein Bereich“.
 * Sonst zur Anmeldung per E-Mail (Code oder Link); Teamkonten finden dort auch den Weg zum Passwort.
 * ?sprache= kommt von der Website (de, tr, en, fr, nl); die Anmeldeseite gibt es auf Deutsch und Türkisch,
 * für die übrigen Sprachen entscheidet dort die Browsersprache.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect((await getStaff()) ? "/team/" : "/mein-bereich/");
  const sprache = new URL(request.url).searchParams.get("sprache");
  redirect(`/mein-bereich/login/${sprache === "de" || sprache === "tr" ? `?sprache=${sprache}` : ""}`);
}
