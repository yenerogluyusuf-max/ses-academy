import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Hinweis } from "@/components/team/Hinweis";
import { ModulReiter } from "@/components/team/ModulReiter";
import { TeamKopf } from "@/components/team/TeamKopf";
import { gruppeEntfernen, gruppeSpeichern, gruppenVorschlag, mitgliedZuteilen } from "@/lib/aktionen/modulwerkzeuge";
import { requireStaff } from "@/lib/auth";
import { istToken } from "@/lib/codes";
import { tagBezeichnung } from "@/lib/eventtag";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Gruppen | SES Academy" };

const hinweise: Record<string, { text: string; gut: boolean }> = {
  gruppe: { text: "Gruppe gespeichert.", gut: true },
  "gruppe-entfernt": { text: "Gruppe entfernt.", gut: true },
  "gruppe-doppelt": { text: "Eine Gruppe mit diesem Namen gibt es schon.", gut: false },
  zugeteilt: { text: "Zuteilung gespeichert.", gut: true },
  eingabe: { text: "Bitte die Angaben prüfen.", gut: false },
  fehler: { text: "Das hat nicht geklappt.", gut: false },
};
const laender: Record<string, string> = { DE: "DE", AT: "AT", FR: "FR", CH: "CH", NL: "NL", BE: "BE", other: "anderes Land" };

/** Gruppen und Räume eines Moduls (z. B. Ländergruppen), Einteilung mit Vorschlag nach Land oder GT/KGT, Anwesenheit je Gruppe. */
export default async function Gruppen({ params, searchParams }: PageProps<"/team/module/[id]/gruppen">) {
  const staff = await requireStaff("orga");
  const { id } = await params;
  const { hinweis, tag: gewaehlterTag } = await searchParams;
  if (!istToken(id)) notFound();
  const supabase = await createClient();
  const [{ data: modul }, { data: gruppen }, { data: kandidaten }] = await Promise.all([
    supabase.from("modules").select("id, title, module_days(id, day, starts_at, label)").eq("id", id).maybeSingle(),
    supabase.from("module_groups").select("id, name, room, leader, position").eq("module_id", id).order("position").order("name"),
    supabase.rpc("get_grouping_candidates", { p_module_id: id }),
  ]);
  if (!modul) notFound();
  const tage = [...modul.module_days].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const tag = tage.find((t) => t.id === gewaehlterTag) ?? tage[0];
  // Anwesenheit und Mitglieder je Gruppe für den gewählten Tag
  const { data: zeilen } = tag ? await supabase.rpc("get_group_attendance", { p_module_day_id: tag.id }) : { data: [] };
  const ohneGruppe = (kandidaten ?? []).filter((k) => !k.group_id);
  const code = typeof hinweis === "string" && hinweis.startsWith("vorschlag-") ? undefined : hinweis;
  const vorgeschlagen = typeof hinweis === "string" && hinweis.startsWith("vorschlag-") ? Number(hinweis.split("-")[1]) : null;

  return (
    <>
      <TeamKopf staff={staff} aktiv="module" breit />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <ModulReiter id={id} titel={modul.title} aktiv="gruppen/" />
        <Hinweis code={code} texte={hinweise} />
        {vorgeschlagen !== null && <p role="status" className="mt-4 rounded-2xl bg-emerald-100 p-4 text-emerald-950">{vorgeschlagen} Personen eingeteilt. Bitte prüfen und von Hand anpassen.</p>}

        <div className="mt-2 flex flex-wrap items-end gap-2">
          {tage.length > 1 && (
            <form action={`/team/module/${id}/gruppen/`} className="mr-auto flex items-end gap-2">
              <div><label className="etikett" htmlFor="tag">Anwesenheit am</label>
                <select id="tag" name="tag" defaultValue={tag?.id} className="feld">{tage.map((t) => <option key={t.id} value={t.id}>{tagBezeichnung(t, modul.title)}</option>)}</select></div>
              <button type="submit" className="knopf-hell">Zeigen</button>
            </form>
          )}
          {ohneGruppe.length > 0 && (
            <form action={gruppenVorschlag} className="flex items-end gap-2">
              <input type="hidden" name="module_id" value={id} />
              <div><label className="etikett" htmlFor="nach">{ohneGruppe.length} ohne Gruppe einteilen nach</label>
                <select id="nach" name="nach" className="feld"><option value="country">Land</option><option value="branch">GT/KGT</option></select></div>
              <button type="submit" className="knopf">Vorschlag übernehmen</button>
            </form>
          )}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(gruppen ?? []).map((g) => {
            const mitglieder = (zeilen ?? []).filter((z) => z.group_id === g.id);
            const da = mitglieder.filter((m) => m.checked_in).length;
            return (
              <section key={g.id} className="karte">
                <div className="flex items-baseline gap-2">
                  <h2 className="font-display mr-auto text-xl font-bold">{g.name}</h2>
                  <span className="chip bg-paper-deep">{da}/{mitglieder.length} da</span>
                </div>
                <p className="text-sm text-ink-soft">{[g.room && `Raum ${g.room}`, g.leader].filter(Boolean).join(" · ") || "Raum und Leitung offen"}</p>
                <ul className="mt-3 divide-y divide-line text-sm">
                  {mitglieder.map((m) => (
                    <li key={m.participant_id} className="flex items-center gap-2 py-1.5">
                      <span className={`h-2 w-2 rounded-full ${m.checked_in ? "bg-emerald-600" : "bg-line"}`} aria-hidden />
                      <span className="mr-auto">{m.name}</span>
                      <span className="text-xs text-ink-soft">{[m.country && laender[m.country], m.branch].filter(Boolean).join(" · ")}</span>
                      <form action={mitgliedZuteilen}>
                        <input type="hidden" name="module_id" value={id} /><input type="hidden" name="participant_id" value={m.participant_id} />
                        <label className="sr-only" htmlFor={`g-${m.participant_id}`}>Gruppe für {m.name}</label>
                        <select id={`g-${m.participant_id}`} name="group_id" defaultValue={g.id} className="rounded-lg bg-white px-1 py-0.5 text-xs ring-1 ring-line">
                          {(gruppen ?? []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}<option value="">keine</option>
                        </select>
                        <button type="submit" className="ml-1 text-xs font-semibold underline">OK</button>
                      </form>
                    </li>
                  ))}
                </ul>
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold text-ink-soft">Raum und Leitung</summary>
                  <form action={gruppeSpeichern} className="mt-2 grid gap-2">
                    <input type="hidden" name="module_id" value={id} /><input type="hidden" name="id" value={g.id} />
                    <input name="name" defaultValue={g.name} required className="feld" aria-label="Name" />
                    <input name="room" defaultValue={g.room ?? ""} placeholder="Raum" className="feld" aria-label="Raum" />
                    <input name="leader" defaultValue={g.leader ?? ""} placeholder="Leitung" className="feld" aria-label="Leitung" />
                    <button type="submit" className="knopf-hell justify-self-start">Speichern</button>
                  </form>
                  {mitglieder.length === 0 && (
                    <form action={gruppeEntfernen} className="mt-1">
                      <input type="hidden" name="module_id" value={id} /><input type="hidden" name="id" value={g.id} />
                      <button type="submit" className="text-xs font-semibold text-ink-soft underline">Gruppe entfernen</button>
                    </form>
                  )}
                </details>
              </section>
            );
          })}
        </div>

        {ohneGruppe.length > 0 && (
          <section className="karte mt-6">
            <h2 className="font-display text-xl font-bold">Ohne Gruppe ({ohneGruppe.length})</h2>
            <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {ohneGruppe.map((a) => (
                <li key={a.participant_id} className="flex items-center gap-2">
                  <span className="mr-auto">{a.name}</span>
                  {(gruppen ?? []).length > 0 && (
                    <form action={mitgliedZuteilen}>
                      <input type="hidden" name="module_id" value={id} /><input type="hidden" name="participant_id" value={a.participant_id} />
                      <label className="sr-only" htmlFor={`o-${a.participant_id}`}>Gruppe</label>
                      <select id={`o-${a.participant_id}`} name="group_id" className="rounded-lg bg-white px-1 py-0.5 text-xs ring-1 ring-line">{(gruppen ?? []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
                      <button type="submit" className="ml-1 text-xs font-semibold underline">OK</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="karte mt-6">
          <h2 className="font-display text-xl font-bold">Neue Gruppe</h2>
          <form action={gruppeSpeichern} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="module_id" value={id} />
            <input name="name" required placeholder="Name, z. B. Deutschland" className="feld !w-56" aria-label="Name" />
            <input name="room" placeholder="Raum" className="feld !w-40" aria-label="Raum" />
            <input name="leader" placeholder="Leitung" className="feld !w-56" aria-label="Leitung" />
            <button type="submit" className="knopf-hell">Anlegen</button>
          </form>
        </section>
      </main>
    </>
  );
}
