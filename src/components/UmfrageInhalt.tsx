import { bereichTexte, type BereichSprache } from "@/lib/bereich-texte";
import { umfrageTexte } from "@/lib/umfrage-texte";
import type { ladeUmfrage } from "@/lib/umfrage";
import { jetztMs } from "@/lib/zeit";
import { FeedbackFormular } from "@/app/(app)/feedback/[token]/[umfrage]/FeedbackFormular";

/**
 * Kopf und Formular der Feedback-Umfrage, gleich für den Mail-Link und den allgemeinen Link /umfrage/.
 * Die Umfrage ist anonym (seit 15.11.2026): gespeichert wird nur, DASS jemand teilgenommen hat; wer das hat, sieht
 * nur den Dank, abgeschickte Antworten lassen sich nicht mehr ansehen oder ändern.
 */
export function UmfrageInhalt({ l, token, daten }: { l: BereichSprache; token: string; daten: NonNullable<Awaited<ReturnType<typeof ladeUmfrage>>> }) {
  const t = bereichTexte[l];
  const u = umfrageTexte[l];
  const jetzt = jetztMs();
  const { umfrage } = daten;
  const offen = jetzt >= Date.parse(umfrage.opensAt) && jetzt <= Date.parse(umfrage.closesAt);
  return (
    <>
      <h1 className="font-display mt-8 text-3xl font-bold">{t.feedbackTitel}</h1>
      <p className="mt-1 text-lg">{daten.modulTitel}</p>
      <p className="mt-4 text-ink-soft">{daten.anwesend ? u.hallo(daten.person.first_name) : t.feedbackHallo(daten.person.first_name, false).split(".")[0] + "."}</p>
      {daten.beantwortet ? (
        <p className="karte mt-6 font-semibold">{u.schonBeantwortet}</p>
      ) : offen && !daten.anwesend ? (
        <p className="karte mt-6">{t.feedbackNichtDa}</p>
      ) : offen ? (
        <>
          <p className="mt-3 rounded-2xl bg-gruen-hell p-4 text-sm">{u.anonym}</p>
          <FeedbackFormular l={l} token={token} umfrage={umfrage.id} fragen={daten.fragen} />
        </>
      ) : (
        <p className="karte mt-6">{jetzt < Date.parse(umfrage.opensAt) ? t.feedbackOeffnet : t.feedbackBeendet}</p>
      )}
    </>
  );
}
