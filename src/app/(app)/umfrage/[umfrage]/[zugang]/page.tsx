import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { bereichSprache } from "@/lib/bereich-texte";
import { ladeUmfrage, pruefeZugang } from "@/lib/umfrage";
import { UmfrageInhalt } from "@/components/UmfrageInhalt";
import { SprachUmschalter } from "@/components/SprachUmschalter";

export const metadata: Metadata = { title: "Feedback | SES Academy", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** Umfrage über den allgemeinen Link, nachdem die Person ihre E-Mail-Adresse eingegeben hat (Zugang = Person-ID mit Signatur). */
export default async function UmfrageZugang({ params, searchParams }: PageProps<"/umfrage/[umfrage]/[zugang]">) {
  const { umfrage, zugang } = await params;
  const { sprache } = await searchParams;
  const pid = pruefeZugang(zugang, umfrage);
  if (!pid) notFound();
  const l = bereichSprache(typeof sprache === "string" ? sprache : "tr");
  const daten = await ladeUmfrage(pid, umfrage, l);
  if (!daten) notFound();
  return (
    <main lang={l} className="mx-auto max-w-lg px-4 py-10 lg:max-w-4xl lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <img src="/brand/ses-logo.png" alt="SES Academy" className="h-10 w-auto" />
        <SprachUmschalter aktiv={l} href={(x) => `/umfrage/${umfrage}/${zugang}/?sprache=${x}`} />
      </div>
      <UmfrageInhalt l={l} token={zugang} daten={daten} zurueck="/mein-bereich/" />
    </main>
  );
}
