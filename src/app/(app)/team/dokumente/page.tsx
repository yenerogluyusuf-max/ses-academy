import type { Metadata } from "next";
import { DokumentFormular, DokumentListe, dokumentArt, dokumentStatus } from "@/components/team/Dokumente";
import { Hinweis } from "@/components/team/Hinweis";
import { TeamKopf } from "@/components/team/TeamKopf";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dokumente | SES Academy" };

export const dokumentHinweise: Record<string, { text: string; gut: boolean }> = {
  gespeichert: { text: "Gespeichert.", gut: true },
  "zu-gross": { text: "Die Datei ist größer als 100 MB. Bitte als Link ablegen.", gut: false },
  eingabe: { text: "Bitte Titel und eine Datei oder einen Link angeben.", gut: false },
  fehler: { text: "Das hat nicht geklappt.", gut: false },
};

/** Dokumentenablage (Phase 3): Suche, Filter nach Art, Status, Kommission und Modul; ersetzt nach und nach den Drive. */
export default async function Dokumente({ searchParams }: PageProps<"/team/dokumente">) {
  const staff = await requireStaff("orga");
  const sp = await searchParams;
  const wert = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const supabase = await createClient();
  let abfrage = supabase.from("documents").select("id, title, kind, status, commission, tags, link, current_version, updated_at, module:modules(title)").order("updated_at", { ascending: false }).limit(300);
  const suche = wert("suche").replace(/[%,()]/g, " ").trim();
  if (suche) abfrage = abfrage.or(`title.ilike.%${suche}%,description.ilike.%${suche}%,tags.cs.{${suche}}`);
  if (wert("art")) abfrage = abfrage.eq("kind", wert("art"));
  if (wert("status")) abfrage = abfrage.eq("status", wert("status"));
  else abfrage = abfrage.neq("status", "archiv");
  if (wert("kommission")) abfrage = abfrage.eq("commission", wert("kommission"));
  const [{ data: dokumente }, { data: module }, { data: kommissionen }] = await Promise.all([
    abfrage,
    supabase.from("modules").select("id, title").order("created_at", { ascending: false }),
    supabase.from("documents").select("commission").not("commission", "is", null),
  ]);
  const komListe = [...new Set((kommissionen ?? []).map((k) => k.commission!))].sort();

  return (
    <>
      <TeamKopf staff={staff} aktiv="dokumente" breit />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="font-display text-3xl font-bold">Dokumente</h1>
        <Hinweis code={sp.hinweis} texte={dokumentHinweise} />
        <form className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]" action="/team/dokumente/">
          <label className="sr-only" htmlFor="suche">Suchen</label>
          <input id="suche" name="suche" defaultValue={wert("suche")} placeholder="Titel, Beschreibung, Schlagwort" className="feld" />
          <select name="art" defaultValue={wert("art")} className="feld" aria-label="Art"><option value="">alle Arten</option>{Object.entries(dokumentArt).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select name="status" defaultValue={wert("status")} className="feld" aria-label="Status"><option value="">ohne Archiv</option>{Object.entries(dokumentStatus).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select>
          <select name="kommission" defaultValue={wert("kommission")} className="feld" aria-label="Kommission"><option value="">alle Kommissionen</option>{komListe.map((k) => <option key={k} value={k}>{k}</option>)}</select>
          <button type="submit" className="knopf">Suchen</button>
        </form>
        <div className="mt-6"><DokumentListe dokumente={dokumente ?? []} /></div>
        <h2 className="font-display mt-10 mb-3 text-xl font-bold">Neues Dokument</h2>
        <DokumentFormular zurueck="/team/dokumente/" module={module ?? []} />
      </main>
    </>
  );
}
