import { bereichTexte, type BereichSprache } from "@/lib/bereich-texte";
import type { ladeUmfrage } from "@/lib/umfrage";
import { jetztMs } from "@/lib/zeit";
import { FeedbackFormular } from "@/app/(app)/feedback/[token]/[umfrage]/FeedbackFormular";

/** Kopf und Formular der Feedback-Umfrage, gleich für den Mail-Link und den allgemeinen Link /umfrage/. */
export function UmfrageInhalt({ l, token, daten }: { l: BereichSprache; token: string; daten: NonNullable<Awaited<ReturnType<typeof ladeUmfrage>>> }) {
  const t = bereichTexte[l];
  const jetzt = jetztMs();
  const { umfrage } = daten;
  const offen = jetzt >= Date.parse(umfrage.opensAt) && jetzt <= Date.parse(umfrage.closesAt);
  return (
    <>
      <h1 className="font-display mt-8 text-3xl font-bold">{t.feedbackTitel}</h1>
      <p className="mt-1 text-lg">{daten.modulTitel}</p>
      <p className="mt-4 text-ink-soft">{t.feedbackHallo(daten.person.first_name, daten.anwesend)}</p>
      {offen && !daten.anwesend ? (
        <p className="karte mt-6">{t.feedbackNichtDa}</p>
      ) : offen ? (
        <FeedbackFormular l={l} token={token} umfrage={umfrage.id} fragen={daten.fragen} gespeichert={daten.gespeichert} />
      ) : (
        <p className="karte mt-6">{jetzt < Date.parse(umfrage.opensAt) ? t.feedbackOeffnet : t.feedbackBeendet}</p>
      )}
    </>
  );
}
