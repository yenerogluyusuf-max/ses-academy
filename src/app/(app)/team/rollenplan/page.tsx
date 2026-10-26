import type { Metadata } from "next";
import Link from "next/link";
import { Hinweis } from "@/components/team/Hinweis";
import { TagWahl } from "@/components/team/TagWahl";
import { TeamKopf } from "@/components/team/TeamKopf";
import { jetztMs } from "@/lib/zeit";
import { einsaetzeUebernehmen, einsatzAnlegen, einsatzEntfernen } from "@/lib/aktionen/eventtag";
import { requireStaff } from "@/lib/auth";
import { uhrzeit } from "@/lib/einlass";
import { ladeModultage, tagBezeichnung } from "@/lib/eventtag";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Rollenplan | SES Academy" };

const hinweise: Record<string, { text: string; gut: boolean }> = {
  "einsatz-angelegt": { text: "Einsatz eingetragen.", gut: true },
  "einsatz-entfernt": { text: "Einsatz entfernt.", gut: true },
  nichts: { text: "Am gewählten Tag gibt es keine Einsätze zum Übernehmen.", gut: false },
  eingabe: { text: "Bitte die Angaben prüfen (Ende nach Beginn).", gut: false },
  fehler: { text: "Das hat nicht geklappt.", gut: false },
};

/** Telefonnummer für tel:-Links: nur Ziffern und führendes Plus. */
function telLink(nummer: string) {
  return `tel:${nummer.replace(/[^\d+]/g, "")}`;
}

export default async function Rollenplan({ searchParams }: PageProps<"/team/rollenplan">) {
  const staff = await requireStaff("orga");
  const { tag: gewaehlt, hinweis } = await searchParams;
  const { tage, vorschlag } = await ladeModultage();
  const tag = tage.find((t) => t.id === gewaehlt) ?? vorschlag;

  const supabase = await createClient();
  const { data: einsaetze } = tag
    ? await supabase.from("duty_assignments").select("*").eq("module_day_id", tag.id).order("is_lead", { ascending: false }).order("starts_at", { nullsFirst: true }).order("person_name")
    : { data: [] };
  const liste = einsaetze ?? [];
  const leitung = liste.filter((e) => e.is_lead);
  const andereTage = tag ? tage.filter((t) => t.module_id === tag.module_id && t.id !== tag.id) : [];
  const code = typeof hinweis === "string" && hinweis.startsWith("uebernommen-") ? undefined : hinweis;
  const uebernommen = typeof hinweis === "string" && hinweis.startsWith("uebernommen-") ? Number(hinweis.split("-")[1]) : 0;

  return (
    <>
      <TeamKopf staff={staff} aktiv="rollenplan" />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="font-display text-3xl font-bold">Rollenplan</h1>
        <Hinweis code={code} texte={hinweise} />
        {uebernommen > 0 && <p role="status" className="mt-4 rounded-2xl bg-emerald-100 p-4 text-emerald-950">{uebernommen} Einsätze übernommen.</p>}
        {!tag ? (
          <p className="karte mt-6">Es gibt noch keine veröffentlichten Modultage.</p>
        ) : (
          <>
            <TagWahl tage={tage} aktiv={tag.id} pfad="/team/rollenplan/" jetzt={jetztMs()} />
            <div className="mt-3 flex flex-wrap gap-2"><Link href={`/team/regieplan/?tag=${tag.id}`} className="knopf-hell">Regieplan</Link></div>

            {leitung.length > 0 && (
              <section className="mt-6 rounded-3xl bg-gelb-hell p-5 ring-1 ring-line">
                <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Entscheidet bei Problemen</p>
                {leitung.map((e) => (
                  <p key={e.id} className="mt-1 text-lg font-semibold">
                    {e.person_name}{e.phone && <> · <a href={telLink(e.phone)} className="link">{e.phone}</a></>}
                  </p>
                ))}
              </section>
            )}

            <ul className="mt-6 space-y-3">
              {liste.map((e) => (
                <li key={e.id} className="karte flex flex-wrap items-center gap-3 !p-4">
                  <div className="mr-auto min-w-0">
                    <p className="font-semibold">{e.person_name}{e.is_lead && <span className="chip ml-2 bg-gelb-hell">Leitung</span>}</p>
                    <p className="text-sm text-ink-soft">
                      {e.task}{e.starts_at ? ` · ${uhrzeit(e.starts_at, false)}${e.ends_at ? `–${uhrzeit(e.ends_at, false)}` : ""} Uhr` : ""}
                    </p>
                  </div>
                  {e.phone && <a href={telLink(e.phone)} className="knopf" aria-label={`${e.person_name} anrufen`}>Anrufen</a>}
                  <form action={einsatzEntfernen}>
                    <input type="hidden" name="tag" value={tag.id} /><input type="hidden" name="id" value={e.id} />
                    <button type="submit" className="text-sm font-semibold text-ink-soft underline">entfernen</button>
                  </form>
                </li>
              ))}
            </ul>
            {liste.length === 0 && <p className="mt-6 rounded-3xl border-2 border-dashed border-line p-8 text-center text-ink-soft">Für diesen Tag ist noch niemand eingeteilt.</p>}

            <section className="karte mt-8">
              <h2 className="font-display text-xl font-bold">Einsatz eintragen</h2>
              <form action={einsatzAnlegen} className="mt-4 grid gap-3 sm:grid-cols-4">
                <input type="hidden" name="tag" value={tag.id} />
                <div className="sm:col-span-2"><label htmlFor="person_name" className="etikett">Name</label><input id="person_name" name="person_name" required maxLength={200} className="feld" /></div>
                <div className="sm:col-span-2"><label htmlFor="phone" className="etikett">Telefon</label><input id="phone" name="phone" type="tel" maxLength={40} className="feld" /></div>
                <div className="sm:col-span-2"><label htmlFor="task" className="etikett">Aufgabe</label><input id="task" name="task" required maxLength={300} className="feld" placeholder="z. B. Einlass Tür 1, Technik, Gästebetreuung" /></div>
                <div><label htmlFor="von" className="etikett">von</label><input id="von" name="von" type="time" className="feld" /></div>
                <div><label htmlFor="bis" className="etikett">bis</label><input id="bis" name="bis" type="time" className="feld" /></div>
                <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-4"><input type="checkbox" name="is_lead" /> Entscheidet bei Problemen vor Ort</label>
                <div className="sm:col-span-4"><button type="submit" className="knopf">Eintragen</button></div>
              </form>
            </section>

            {andereTage.length > 0 && (
              <section className="karte mt-6">
                <h2 className="font-display text-xl font-bold">Einsätze übernehmen</h2>
                <form action={einsaetzeUebernehmen} className="mt-3 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="tag" value={tag.id} />
                  <div className="min-w-0 flex-1">
                    <label htmlFor="von_tag" className="etikett">Alle Einsätze kopieren von</label>
                    <select id="von_tag" name="von_tag" className="feld">
                      {andereTage.map((t) => <option key={t.id} value={t.id}>{tagBezeichnung(t, t.module.title)}</option>)}
                    </select>
                  </div>
                  <button type="submit" className="knopf-hell">Übernehmen</button>
                </form>
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
