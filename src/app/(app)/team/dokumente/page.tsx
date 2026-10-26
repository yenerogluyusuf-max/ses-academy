import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { DokumentFormular, DokumentListe, dokumentArt } from "@/components/team/Dokumente";
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
  const archiv = wert("status") === "archiv";
  const gefiltert = Boolean(suche || wert("art") || wert("kommission") || wert("status"));
  // Nach Modul gruppieren: Module zuerst (zuletzt geändert oben), allgemeine Dokumente am Ende
  const gruppen = new Map<string, NonNullable<typeof dokumente>>();
  for (const d of dokumente ?? []) {
    const g = d.module?.title ?? "Allgemein";
    gruppen.set(g, [...(gruppen.get(g) ?? []), d]);
  }
  const reihenfolge = [...gruppen.keys()].sort((a, b) => (a === "Allgemein" ? 1 : b === "Allgemein" ? -1 : 0));

  return (
    <>
      <TeamKopf staff={staff} aktiv="dokumente" breit />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-3xl font-bold">{archiv ? "Archiv" : "Dokumente"}</h1>
          <Link href={archiv ? "/team/dokumente/" : "/team/dokumente/?status=archiv"} className="text-sm font-semibold text-ink-soft underline-offset-4 hover:text-ink hover:underline">{archiv ? "← zurück zu den Dokumenten" : "Archiv ansehen"}</Link>
        </div>
        <Hinweis code={sp.hinweis} texte={dokumentHinweise} />

        <div className="mt-4 flex flex-wrap items-start gap-2">
          <form className="flex min-w-0 flex-1 flex-wrap gap-2" action="/team/dokumente/">
            {archiv && <input type="hidden" name="status" value="archiv" />}
            <label className="sr-only" htmlFor="suche">Suchen</label>
            <div className="relative min-w-56 flex-1">
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink-soft" />
              <input id="suche" name="suche" type="search" defaultValue={wert("suche")} placeholder="Suchen nach Titel oder Schlagwort" className="feld pl-10" />
            </div>
            <select name="art" defaultValue={wert("art")} className="feld w-auto" aria-label="Art"><option value="">alle Arten</option>{Object.entries(dokumentArt).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            {komListe.length > 1 && <select name="kommission" defaultValue={wert("kommission")} className="feld w-auto" aria-label="Kommission"><option value="">alle Kommissionen</option>{komListe.map((k) => <option key={k} value={k}>{k}</option>)}</select>}
            <button type="submit" className="knopf">Suchen</button>
            {gefiltert && !archiv && <Link href="/team/dokumente/" className="knopf-hell">Zurücksetzen</Link>}
          </form>
          <details className="group w-full sm:w-auto [&[open]]:w-full">
            <summary className="knopf cursor-pointer list-none bg-forest [&::-webkit-details-marker]:hidden"><Plus aria-hidden className="h-4 w-4" />Neues Dokument</summary>
            <div className="mt-3"><DokumentFormular zurueck="/team/dokumente/" module={module ?? []} /></div>
          </details>
        </div>

        {(dokumente ?? []).length === 0
          ? <div className="mt-6"><DokumentListe dokumente={[]} /></div>
          : reihenfolge.map((g) => (
              <section key={g} className="mt-6">
                <h2 className="mb-2 px-1 text-xs font-semibold tracking-wide text-ink-soft uppercase">{g} · {gruppen.get(g)!.length}</h2>
                <DokumentListe dokumente={gruppen.get(g)!} ohneModul />
              </section>
            ))}
      </main>
    </>
  );
}
