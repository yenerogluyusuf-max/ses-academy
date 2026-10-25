import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dokumentArt, dokumentStatus } from "@/components/team/Dokumente";
import { Hinweis } from "@/components/team/Hinweis";
import { TeamKopf } from "@/components/team/TeamKopf";
import { dokumentSpeichern } from "@/lib/aktionen/dokumente";
import { requireStaff } from "@/lib/auth";
import { istToken } from "@/lib/codes";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dokument | SES Academy" };

const hinweise: Record<string, { text: string; gut: boolean }> = {
  gespeichert: { text: "Gespeichert.", gut: true },
  "zu-gross": { text: "Die Datei ist größer als 100 MB.", gut: false },
  eingabe: { text: "Bitte die Angaben prüfen.", gut: false },
  fehler: { text: "Das hat nicht geklappt.", gut: false },
};
const zeit = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" });

/** Ein Dokument: Angaben und Status ändern, alle Versionen, neue Version hochladen. */
export default async function Dokument({ params, searchParams }: PageProps<"/team/dokumente/[id]">) {
  const staff = await requireStaff("orga");
  const { id } = await params;
  const { hinweis } = await searchParams;
  if (!istToken(id)) notFound();
  const supabase = await createClient();
  const [{ data: d }, { data: versionen }, { data: team }] = await Promise.all([
    supabase.from("documents").select("*, module:modules(id, title)").eq("id", id).maybeSingle(),
    supabase.from("document_versions").select("*").eq("document_id", id).order("version", { ascending: false }),
    supabase.rpc("get_team_members"),
  ]);
  if (!d) notFound();
  const name = new Map((team ?? []).map((t) => [t.user_id, t.display_name]));

  return (
    <>
      <TeamKopf staff={staff} aktiv="dokumente" />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Link href={d.module ? `/team/module/${d.module.id}/material/` : "/team/dokumente/"} className="text-sm font-semibold text-ink-soft hover:text-ink">← {d.module ? d.module.title : "Dokumente"}</Link>
        <h1 className="font-display mt-2 text-3xl font-bold">{d.title}</h1>
        <p className="text-ink-soft">{dokumentArt[d.kind]} · {dokumentStatus[d.status]?.name}{d.link && <> · <a href={d.link} target="_blank" rel="noopener noreferrer" className="link">Link öffnen ↗</a></>}</p>
        <Hinweis code={hinweis} texte={hinweise} />

        <section className="karte mt-6">
          <h2 className="font-display text-xl font-bold">Versionen</h2>
          {(versionen ?? []).length === 0 ? <p className="mt-2 text-ink-soft">Noch keine Datei, nur {d.link ? "ein Link" : "Angaben"}.</p> : (
            <ul className="mt-3 divide-y divide-line">
              {(versionen ?? []).map((v) => (
                <li key={v.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                  <span className="chip bg-paper-deep">v{v.version}</span>
                  <a href={`/team/dokumente/${id}/datei/?v=${v.version}`} target="_blank" rel="noopener" className="mr-auto font-semibold underline">{v.file_name}</a>
                  <span className="text-ink-soft">{v.size_bytes ? `${Math.round(v.size_bytes / 1024)} KB · ` : ""}{zeit.format(new Date(v.uploaded_at))}{v.uploaded_by ? ` · ${name.get(v.uploaded_by) ?? ""}` : ""}{v.note ? ` · ${v.note}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
          <form action="/team/dokumente/hochladen/" method="post" encType="multipart/form-data" className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4">
            <input type="hidden" name="document_id" value={id} /><input type="hidden" name="zurueck" value={`/team/dokumente/${id}/`} />
            <div className="min-w-56 flex-1"><label className="etikett" htmlFor="datei">Neue Version</label><input id="datei" name="datei" type="file" required className="feld" /></div>
            <div className="min-w-56 flex-1"><label className="etikett" htmlFor="note">Was hat sich geändert?</label><input id="note" name="note" maxLength={500} className="feld" /></div>
            <button type="submit" className="knopf">Hochladen</button>
          </form>
        </section>

        <section className="karte mt-6">
          <h2 className="font-display text-xl font-bold">Angaben</h2>
          <form action={dokumentSpeichern} className="mt-3 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={id} />
            <div className="sm:col-span-2"><label className="etikett" htmlFor="title">Titel</label><input id="title" name="title" required defaultValue={d.title} className="feld" /></div>
            <div><label className="etikett" htmlFor="status">Status</label>
              <select id="status" name="status" defaultValue={d.status} className="feld">{Object.entries(dokumentStatus).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select></div>
            <div><label className="etikett" htmlFor="commission">Kommission</label><input id="commission" name="commission" defaultValue={d.commission ?? ""} className="feld" /></div>
            <div className="sm:col-span-2"><label className="etikett" htmlFor="tags">Schlagworte (mit Komma)</label><input id="tags" name="tags" defaultValue={d.tags.join(", ")} className="feld" /></div>
            <div className="sm:col-span-2"><label className="etikett" htmlFor="link">Link</label><input id="link" name="link" type="url" defaultValue={d.link ?? ""} className="feld" /></div>
            <div className="sm:col-span-2"><label className="etikett" htmlFor="description">Beschreibung</label><textarea id="description" name="description" rows={3} defaultValue={d.description} className="feld" /></div>
            <div className="sm:col-span-2"><button type="submit" className="knopf-hell">Speichern</button></div>
          </form>
        </section>
      </main>
    </>
  );
}
