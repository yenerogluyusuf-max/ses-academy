import type { Metadata } from "next";
import Link from "next/link";
import { AutoAktualisieren } from "@/components/team/AutoAktualisieren";
import { Hinweis } from "@/components/team/Hinweis";
import { TeamKopf } from "@/components/team/TeamKopf";
import { programmpunktAnlegen, programmpunktEntfernen, programmpunktStatus, programmVerschieben } from "@/lib/aktionen/eventtag";
import { darf, requireStaff } from "@/lib/auth";
import { uhrzeit } from "@/lib/einlass";
import { ladeModultage, programmStatus, tagBezeichnung } from "@/lib/eventtag";
import { createClient } from "@/lib/supabase/server";
import { jetztMs } from "@/lib/zeit";

export const metadata: Metadata = { title: "Regieplan | SES Academy" };

const hinweise: Record<string, { text: string; gut: boolean }> = {
  "punkt-angelegt": { text: "Programmpunkt eingetragen.", gut: true },
  "punkt-entfernt": { text: "Programmpunkt entfernt.", gut: true },
  status: { text: "Status geändert.", gut: true },
  verschoben: { text: "Verschoben. Alle sehen die neuen Zeiten.", gut: true },
  eingabe: { text: "Bitte die Angaben prüfen (Ende nach Beginn).", gut: false },
  fehler: { text: "Das hat nicht geklappt.", gut: false },
};

export default async function Regieplan({ searchParams }: PageProps<"/team/regieplan">) {
  const staff = await requireStaff("einlass");
  const { tag: gewaehlt, hinweis } = await searchParams;
  const { tage, vorschlag } = await ladeModultage();
  const tag = tage.find((t) => t.id === gewaehlt) ?? vorschlag;
  const darfPflegen = darf.orga(staff.role);

  const supabase = await createClient();
  const { data: punkte } = tag
    ? await supabase.from("program_items").select("*").eq("module_day_id", tag.id).order("starts_at")
    : { data: [] };
  const liste = punkte ?? [];
  const jetzt = jetztMs();
  const laufend = liste.find((p) => p.status === "laeuft");
  const naechster = liste.find((p) => (p.status === "geplant" || p.status === "verschoben") && Date.parse(p.starts_at) >= jetzt - 15 * 60_000);
  const feld = "feld";

  return (
    <>
      <TeamKopf staff={staff} aktiv="regieplan" />
      <AutoAktualisieren />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="font-display text-3xl font-bold">Regieplan</h1>
        <Hinweis code={hinweis} texte={hinweise} />
        {!tag ? (
          <p className="karte mt-6">Es gibt noch keine veröffentlichten Modultage.</p>
        ) : (
          <>
            <form className="mt-4 flex flex-wrap items-end gap-2" action="/team/regieplan/">
              <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
                <label htmlFor="tag" className="etikett">Modultag</label>
                <select id="tag" name="tag" defaultValue={tag.id} className={feld}>
                  {tage.map((t) => <option key={t.id} value={t.id}>{tagBezeichnung(t, t.module.title)}</option>)}
                </select>
              </div>
              <button type="submit" className="knopf-hell">Öffnen</button>
              {darfPflegen && <Link href={`/team/rollenplan/?tag=${tag.id}`} className="knopf-hell">Rollenplan</Link>}
            </form>

            {(laufend || naechster) && (
              <section aria-label="Jetzt und als Nächstes" className="mt-6 grid gap-3 sm:grid-cols-2">
                {laufend && (
                  <div className="rounded-3xl bg-gruen-hell p-5 ring-1 ring-line">
                    <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Läuft gerade</p>
                    <p className="font-display mt-1 text-xl font-bold">{laufend.title}</p>
                    <p className="text-sm text-ink-soft">seit {uhrzeit(laufend.starts_at, false)}{laufend.ends_at ? ` · bis ${uhrzeit(laufend.ends_at, false)}` : ""}{laufend.room ? ` · ${laufend.room}` : ""}</p>
                  </div>
                )}
                {naechster && (
                  <div className="rounded-3xl bg-weiss p-5 ring-1 ring-line">
                    <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Als Nächstes</p>
                    <p className="font-display mt-1 text-xl font-bold">{naechster.title}</p>
                    <p className="text-sm text-ink-soft">{uhrzeit(naechster.starts_at, false)} Uhr{naechster.room ? ` · ${naechster.room}` : ""}{naechster.responsible ? ` · ${naechster.responsible}` : ""}</p>
                  </div>
                )}
              </section>
            )}

            <ol className="mt-6 space-y-3">
              {liste.map((p) => {
                const s = programmStatus[p.status];
                return (
                  <li key={p.id} className={`rounded-3xl p-4 ring-1 ring-line ${s.farbe}`}>
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className={`font-mono text-lg font-bold ${p.status === "entfaellt" ? "line-through" : ""}`}>
                        {uhrzeit(p.starts_at, false)}{p.ends_at ? `–${uhrzeit(p.ends_at, false)}` : ""}
                      </span>
                      <span className={`mr-auto font-semibold ${p.status === "entfaellt" ? "line-through" : ""}`}>{p.title}</span>
                      <span className="chip bg-white/70 ring-1 ring-line">{s.name}</span>
                    </div>
                    {(p.room || p.responsible || p.note) && (
                      <p className="mt-1 text-sm text-ink-soft">{[p.room, p.responsible, p.note].filter(Boolean).join(" · ")}</p>
                    )}
                    {darfPflegen && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(["laeuft", "erledigt", "entfaellt", "geplant"] as const).filter((st) => st !== p.status).map((st) => (
                          <form key={st} action={programmpunktStatus}>
                            <input type="hidden" name="tag" value={tag.id} /><input type="hidden" name="id" value={p.id} />
                            <input type="hidden" name="status" value={st} />
                            <button type="submit" className={st === "laeuft" ? "knopf" : "knopf-hell"}>{st === "laeuft" ? "Startet jetzt" : programmStatus[st].name}</button>
                          </form>
                        ))}
                        {p.status !== "erledigt" && p.status !== "entfaellt" && [10, 15, 30].map((min) => (
                          <form key={min} action={programmVerschieben}>
                            <input type="hidden" name="tag" value={tag.id} /><input type="hidden" name="id" value={p.id} />
                            <input type="hidden" name="minuten" value={min} />
                            <button type="submit" className="knopf-hell" aria-label={`${min} Minuten später: diesen und alle folgenden Punkte verschieben`}>+{min} Min.</button>
                          </form>
                        ))}
                        <form action={programmpunktEntfernen} className="ml-auto">
                          <input type="hidden" name="tag" value={tag.id} /><input type="hidden" name="id" value={p.id} />
                          <button type="submit" className="text-sm font-semibold text-ink-soft underline">entfernen</button>
                        </form>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
            {liste.length === 0 && <p className="mt-6 rounded-3xl border-2 border-dashed border-line p-8 text-center text-ink-soft">Für diesen Tag ist noch kein Programm eingetragen.</p>}

            {darfPflegen && (
              <section className="karte mt-8">
                <h2 className="font-display text-xl font-bold">Programmpunkt eintragen</h2>
                <form action={programmpunktAnlegen} className="mt-4 grid gap-3 sm:grid-cols-4">
                  <input type="hidden" name="tag" value={tag.id} />
                  <div><label htmlFor="von" className="etikett">Beginn</label><input id="von" name="von" type="time" required className={feld} /></div>
                  <div><label htmlFor="bis" className="etikett">Ende</label><input id="bis" name="bis" type="time" className={feld} /></div>
                  <div className="sm:col-span-2"><label htmlFor="title" className="etikett">Titel</label><input id="title" name="title" required maxLength={200} className={feld} placeholder="z. B. Vortrag Ruprecht Polenz" /></div>
                  <div><label htmlFor="room" className="etikett">Raum</label><input id="room" name="room" maxLength={100} className={feld} /></div>
                  <div><label htmlFor="responsible" className="etikett">Verantwortlich</label><input id="responsible" name="responsible" maxLength={200} className={feld} /></div>
                  <div className="sm:col-span-2"><label htmlFor="note" className="etikett">Hinweis</label><input id="note" name="note" maxLength={1000} className={feld} placeholder="z. B. Mikro 2, Folien auf Laptop" /></div>
                  <div className="sm:col-span-4"><button type="submit" className="knopf">Eintragen</button></div>
                </form>
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
