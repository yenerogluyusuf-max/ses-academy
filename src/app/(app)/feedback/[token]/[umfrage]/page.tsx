import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { bereichSprache } from "@/lib/bereich-texte";
import { istToken } from "@/lib/codes";
import { createAdminClient } from "@/lib/supabase/admin";
import { ladeUmfrage } from "@/lib/umfrage";
import { UmfrageInhalt } from "@/components/UmfrageInhalt";
import { SprachUmschalter } from "@/components/SprachUmschalter";
import { linkSpracheSetzen } from "@/lib/aktionen/sprache";

export const metadata: Metadata = { title: "Feedback | SES Academy", robots: { index: false, follow: false }, referrer: "same-origin" };

/** Feedback-Umfrage über den persönlichen Link aus der Mail. Der Link-Token (nicht der QR-Inhalt) ist der Nachweis, ein Konto ist nicht nötig. */
export default async function FeedbackSeite({ params }: PageProps<"/feedback/[token]/[umfrage]">) {
  const { token, umfrage } = await params;
  if (!istToken(token) || !istToken(umfrage)) notFound();
  const { data: person } = await createAdminClient().from("participants").select("id, preferred_language").eq("link_token", token.toLowerCase()).maybeSingle();
  if (!person) notFound();
  const l = bereichSprache(person.preferred_language);
  const daten = await ladeUmfrage(person.id, umfrage, l);
  if (!daten) notFound();
  return (
    <main lang={l} className="mx-auto max-w-lg px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <img src="/brand/ses-logo.png" alt="SES Academy" className="h-10 w-auto" />
        <SprachUmschalter aktiv={l} action={linkSpracheSetzen} felder={{ token: token.toLowerCase(), umfrage: daten.umfrage.id }} />
      </div>
      <UmfrageInhalt l={l} token={token.toLowerCase()} daten={daten} />
    </main>
  );
}
