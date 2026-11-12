import { KontaktFormular, LetzterKontakt, type Kontakt } from "@/components/team/Kontakt";
import { telLink } from "@/lib/telefon";
import { uhrzeit } from "@/lib/einlass";
import type { TeamSprache } from "@/lib/team-sprache";

export type GruppenPerson = {
  participant_id: string;
  name: string;
  phone: string | null;
  registration_status: "confirmed" | "excused" | "cancelled" | string;
  checked_in_at: string | null;
};

const T = {
  de: {
    zaehlung: (da: number, alle: number) => `${da} von ${alle} da`, entschuldigtZahl: (n: number) => ` · ${n} entschuldigt`,
    anrufen: "Anrufen", anrufenLabel: (name: string) => `${name} anrufen`, keineNummer: "keine Nummer", alleDa: "Alle da.",
    daUndEntschuldigt: "Da und entschuldigt", uhr: (zeit: string) => `${zeit} Uhr`, entschuldigt: "entschuldigt",
  },
  tr: {
    zaehlung: (da: number, alle: number) => `${alle} kişiden ${da} kişi burada`, entschuldigtZahl: (n: number) => ` · ${n} mazeretli`,
    anrufen: "Ara", anrufenLabel: (name: string) => `Ara: ${name}`, keineNummer: "numara yok", alleDa: "Herkes burada.",
    daUndEntschuldigt: "Gelenler ve mazeretliler", uhr: (zeit: string) => `saat ${zeit}`, entschuldigt: "mazeretli",
  },
  fr: {
    zaehlung: (da: number, alle: number) => `${da} sur ${alle} présents`, entschuldigtZahl: (n: number) => ` · ${n} excusé·es`,
    anrufen: "Appeler", anrufenLabel: (name: string) => `Appeler ${name}`, keineNummer: "pas de numéro", alleDa: "Tout le monde est là.",
    daUndEntschuldigt: "Présents et excusés", uhr: (zeit: string) => zeit, entschuldigt: "excusé·e",
  },
};

/**
 * Eine Sorumlu-Gruppe am Eventtag: wer fehlt noch (mit Anruf-Knopf), wer ist entschuldigt, wer ist da.
 * Mit kontakt (nur Team-Bereich, nicht auf der Sorumlu-Seite) lässt sich nach dem Anruf das Ergebnis vermerken.
 * sprache: Sprache des Team-Bereichs (die Sorumlu-Seite bleibt Deutsch).
 */
export function GruppenListe({ personen, kontakt, sprache = "de" }: {
  personen: GruppenPerson[];
  kontakt?: { moduleId: string; zurueck: string; letzte: Map<string, Kontakt> };
  sprache?: TeamSprache;
}) {
  const t = T[sprache];
  const da = personen.filter((p) => p.checked_in_at);
  const fehlt = personen.filter((p) => !p.checked_in_at && p.registration_status === "confirmed");
  const entschuldigt = personen.filter((p) => !p.checked_in_at && p.registration_status !== "confirmed");
  return (
    <div>
      <p className="text-sm text-ink-soft">{t.zaehlung(da.length, da.length + fehlt.length)}{entschuldigt.length ? t.entschuldigtZahl(entschuldigt.length) : ""}</p>
      {fehlt.length > 0 && (
        <ul className="mt-3 space-y-2">
          {fehlt.map((p) => {
            const letzter = kontakt?.letzte.get(p.participant_id);
            return (
              <li key={p.participant_id} id={`p-${p.participant_id}`} className="flex flex-wrap items-center gap-3 rounded-2xl bg-gelb-hell px-4 py-3 ring-1 ring-line">
                <span className="mr-auto font-semibold">{p.name}</span>
                {p.phone ? <a href={telLink(p.phone)} className="knopf" aria-label={t.anrufenLabel(p.name)}>{t.anrufen}</a> : <span className="text-sm text-ink-soft">{t.keineNummer}</span>}
                {kontakt && (
                  <div className="flex w-full flex-wrap items-center justify-between gap-2">
                    {letzter ? <LetzterKontakt at={letzter.created_at} outcome={letzter.outcome} channel={letzter.channel} by={letzter.by_name} note={letzter.note} sprache={sprache} /> : <span />}
                    <KontaktFormular participantId={p.participant_id} moduleId={kontakt.moduleId} zurueck={kontakt.zurueck} kompakt sprache={sprache} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {fehlt.length === 0 && da.length > 0 && <p className="mt-3 rounded-2xl bg-gruen-hell px-4 py-3 font-semibold">{t.alleDa}</p>}
      {(da.length > 0 || entschuldigt.length > 0) && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold">{t.daUndEntschuldigt}</summary>
          <ul className="mt-2 divide-y divide-line text-sm">
            {da.map((p) => <li key={p.participant_id} className="flex justify-between py-1.5"><span>{p.name}</span><span className="text-ink-soft">{t.uhr(uhrzeit(p.checked_in_at!, false, sprache))}</span></li>)}
            {entschuldigt.map((p) => <li key={p.participant_id} className="flex justify-between py-1.5"><span>{p.name}</span><span className="text-ink-soft">{t.entschuldigt}</span></li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
