import type { Metadata } from "next";
import Link from "next/link";
import { Hinweis } from "@/components/team/Hinweis";
import { TeamKopf } from "@/components/team/TeamKopf";
import { sitzungSpeichern } from "@/lib/aktionen/dokumente";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sitzungen | SES Academy" };

const hinweise: Record<string, { text: string; gut: boolean }> = {
  eingabe: { text: "Bitte Titel und Datum angeben.", gut: false },
  fehler: { text: "Das hat nicht geklappt.", gut: false },
};
const datum = new Intl.DateTimeFormat("de-DE", { dateStyle: "long", timeZone: "UTC" });

/** Sitzungen mit Protokoll, Beschlüssen und Aufgaben, damit Beschlüsse nicht verloren gehen (Phase 3). */
export default async function Sitzungen({ searchParams }: PageProps<"/team/sitzungen">) {
  const staff = await requireStaff("orga");
  const { hinweis } = await searchParams;
  const supabase = await createClient();
  const { data: sitzungen } = await supabase.from("meetings").select("id, title, held_on, commission, meeting_decisions(count), tasks(id, done_at)").order("held_on", { ascending: false });
  return (
    <>
      <TeamKopf staff={staff} aktiv="sitzungen" />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="font-display text-3xl font-bold">Sitzungen</h1>
        <Hinweis code={hinweis} texte={hinweise} />
        <ul className="mt-6 divide-y divide-line rounded-3xl bg-weiss px-4 ring-1 ring-line">
          {(sitzungen ?? []).map((s) => {
            const offen = s.tasks.filter((t) => !t.done_at).length;
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-2 py-3">
                <Link href={`/team/sitzungen/${s.id}/`} className="mr-auto font-semibold hover:underline">{s.title}</Link>
                <span className="text-sm text-ink-soft">{datum.format(new Date(`${s.held_on}T12:00:00Z`))}{s.commission ? ` · ${s.commission}` : ""}</span>
                <span className="chip bg-paper-deep">{s.meeting_decisions[0]?.count ?? 0} Beschlüsse</span>
                {offen > 0 && <span className="chip bg-gelb-hell">{offen} Aufgaben offen</span>}
              </li>
            );
          })}
          {(sitzungen ?? []).length === 0 && <li className="py-6 text-center text-ink-soft">Noch keine Sitzungen.</li>}
        </ul>
        <section className="karte mt-8">
          <h2 className="font-display text-xl font-bold">Neue Sitzung</h2>
          <form action={sitzungSpeichern} className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2"><label className="etikett" htmlFor="title">Titel</label><input id="title" name="title" required className="feld" placeholder="z. B. Kommissionssitzung Organisation" /></div>
            <div><label className="etikett" htmlFor="held_on">Datum</label><input id="held_on" name="held_on" type="date" required className="feld" /></div>
            <div><label className="etikett" htmlFor="commission">Kommission</label><input id="commission" name="commission" className="feld" /></div>
            <div className="sm:col-span-2"><label className="etikett" htmlFor="attendees">Anwesend</label><input id="attendees" name="attendees" className="feld" /></div>
            <div className="sm:col-span-3"><button type="submit" className="knopf">Anlegen</button></div>
          </form>
        </section>
      </main>
    </>
  );
}
