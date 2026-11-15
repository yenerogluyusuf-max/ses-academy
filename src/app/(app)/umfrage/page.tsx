import type { Metadata } from "next";
import { bereichSprache } from "@/lib/bereich-texte";
import { umfrageTexte } from "@/lib/umfrage-texte";
import { umfrageOeffnen } from "@/lib/aktionen/umfrage";
import { SprachUmschalter } from "@/components/SprachUmschalter";

export const metadata: Metadata = { title: "Feedback | SES Academy", robots: { index: false, follow: false }, referrer: "same-origin" };

/** Allgemeiner Link zur Feedback-Umfrage (für die WhatsApp-Gruppe): E-Mail-Adresse eingeben, dann das Formular. Standard Türkisch. */
export default async function UmfrageEintritt({ searchParams }: PageProps<"/umfrage">) {
  const { sprache, fehler } = await searchParams;
  const l = bereichSprache(typeof sprache === "string" ? sprache : "tr");
  const u = umfrageTexte[l];
  const meldung = fehler === "unbekannt" ? u.eintrittUnbekannt : fehler === "keine" ? u.eintrittKeineUmfrage : null;
  return (
    <main lang={l} className="mx-auto max-w-lg px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <img src="/brand/ses-logo.png" alt="SES Academy" className="h-10 w-auto" />
        <SprachUmschalter aktiv={l} href={(x) => `/umfrage/?sprache=${x}`} />
      </div>
      <h1 className="font-display mt-8 text-3xl font-bold">{u.eintrittTitel}</h1>
      <p className="mt-4 text-ink-soft">{u.eintrittText}</p>
      <form action={umfrageOeffnen} className="karte mt-6 space-y-4">
        <input type="hidden" name="sprache" value={l} />
        <label className="block">
          <span className="text-sm font-semibold">{u.eintrittFeld}</span>
          <input type="email" name="email" required autoComplete="email" inputMode="email" className="feld mt-1" />
        </label>
        {meldung && <p role="status" className="rounded-2xl bg-gelb-hell p-4 text-sm font-semibold">{meldung}</p>}
        <button type="submit" className="knopf w-full !py-3.5 text-base">{u.eintrittWeiter}</button>
      </form>
    </main>
  );
}
