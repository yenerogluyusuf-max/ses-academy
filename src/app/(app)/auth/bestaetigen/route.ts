import type { EmailOtpType } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { weiterleiten } from "@/lib/weiterleitung";

// Ziel des Links aus der Anmelde-Mail für Teilnehmende. Funktioniert auch in einem anderen Browser als dem,
// in dem der Code angefordert wurde.
export async function GET(request: NextRequest) {
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  const type = (request.nextUrl.searchParams.get("type") ?? "email") as EmailOtpType;
  const supabase = await createClient();
  if (token_hash) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) {
      if (type === "email_change") return weiterleiten("/mein-bereich/?profil=email-bestaetigt#profil");
      await supabase.rpc("link_my_account");
      return weiterleiten("/mein-bereich/");
    }
  }
  return weiterleiten("/mein-bereich/login/?fehler=link");
}
