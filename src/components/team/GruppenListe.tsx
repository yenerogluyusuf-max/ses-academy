import { uhrzeit } from "@/lib/einlass";

export type GruppenPerson = {
  participant_id: string;
  name: string;
  phone: string | null;
  registration_status: "confirmed" | "excused" | "cancelled" | string;
  checked_in_at: string | null;
};

function telLink(nummer: string) {
  return `tel:${nummer.replace(/[^\d+]/g, "")}`;
}

/** Eine Sorumlu-Gruppe am Eventtag: wer fehlt noch (mit Anruf-Knopf), wer ist entschuldigt, wer ist da. */
export function GruppenListe({ personen }: { personen: GruppenPerson[] }) {
  const da = personen.filter((p) => p.checked_in_at);
  const fehlt = personen.filter((p) => !p.checked_in_at && p.registration_status === "confirmed");
  const entschuldigt = personen.filter((p) => !p.checked_in_at && p.registration_status !== "confirmed");
  return (
    <div>
      <p className="text-sm text-ink-soft">{da.length} von {da.length + fehlt.length} da{entschuldigt.length ? ` · ${entschuldigt.length} entschuldigt` : ""}</p>
      {fehlt.length > 0 && (
        <ul className="mt-3 space-y-2">
          {fehlt.map((p) => (
            <li key={p.participant_id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-gelb-hell px-4 py-3 ring-1 ring-line">
              <span className="mr-auto font-semibold">{p.name}</span>
              {p.phone ? <a href={telLink(p.phone)} className="knopf" aria-label={`${p.name} anrufen`}>Anrufen</a> : <span className="text-sm text-ink-soft">keine Nummer</span>}
            </li>
          ))}
        </ul>
      )}
      {fehlt.length === 0 && da.length > 0 && <p className="mt-3 rounded-2xl bg-gruen-hell px-4 py-3 font-semibold">Alle da.</p>}
      {(da.length > 0 || entschuldigt.length > 0) && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold">Da und entschuldigt</summary>
          <ul className="mt-2 divide-y divide-line text-sm">
            {da.map((p) => <li key={p.participant_id} className="flex justify-between py-1.5"><span>{p.name}</span><span className="text-ink-soft">{uhrzeit(p.checked_in_at!, false)} Uhr</span></li>)}
            {entschuldigt.map((p) => <li key={p.participant_id} className="flex justify-between py-1.5"><span>{p.name}</span><span className="text-ink-soft">entschuldigt</span></li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
