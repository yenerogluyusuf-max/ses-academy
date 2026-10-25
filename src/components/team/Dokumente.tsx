import Link from "next/link";

export const dokumentArt: Record<string, string> = { dokument: "Dokument", material: "Material", medien: "Medien", vorlage: "Vorlage", protokoll: "Protokoll" };
export const dokumentStatus: Record<string, { name: string; farbe: string }> = {
  entwurf: { name: "Entwurf", farbe: "bg-paper-deep" }, pruefung: { name: "in Prüfung", farbe: "bg-gelb-hell" },
  final: { name: "final", farbe: "bg-gruen-hell" }, archiv: { name: "Archiv", farbe: "bg-white" },
};

type Dok = { id: string; title: string; kind: string; status: string; commission: string | null; tags: string[]; link: string | null; current_version: number; updated_at: string; module?: { title: string } | null };
const datum = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: "Europe/Berlin" });

/** Liste der Dokumente mit Status, Art, Kommission, Version und Direktlink zur Datei. */
export function DokumentListe({ dokumente }: { dokumente: Dok[] }) {
  if (dokumente.length === 0) return <p className="rounded-3xl border-2 border-dashed border-line p-8 text-center text-ink-soft">Keine Dokumente.</p>;
  return (
    <ul className="divide-y divide-line rounded-3xl bg-weiss px-4 ring-1 ring-line">
      {dokumente.map((d) => (
        <li key={d.id} className="flex flex-wrap items-center gap-2 py-3">
          <div className="mr-auto min-w-0">
            <Link href={`/team/dokumente/${d.id}/`} className="font-semibold hover:underline">{d.title}</Link>
            <p className="text-xs text-ink-soft">
              {[dokumentArt[d.kind], d.commission, d.module?.title, d.current_version ? `Version ${d.current_version}` : null, `geändert ${datum.format(new Date(d.updated_at))}`].filter(Boolean).join(" · ")}
              {d.tags.length > 0 && ` · ${d.tags.map((t) => `#${t}`).join(" ")}`}
            </p>
          </div>
          <span className={`chip ${dokumentStatus[d.status]?.farbe ?? ""}`}>{dokumentStatus[d.status]?.name ?? d.status}</span>
          {d.current_version > 0 && <a href={`/team/dokumente/${d.id}/datei/`} className="text-sm font-semibold underline" target="_blank" rel="noopener">öffnen</a>}
          {d.link && <a href={d.link} className="text-sm font-semibold underline" target="_blank" rel="noopener noreferrer">Link ↗</a>}
        </li>
      ))}
    </ul>
  );
}

/** Formular für ein neues Dokument (Datei oder Link). Mit module_id/kind vorbelegt im Modul-Reiter. */
export function DokumentFormular({ zurueck, modulId, art = "dokument", module }: { zurueck: string; modulId?: string; art?: string; module?: { id: string; title: string }[] }) {
  return (
    <form action="/team/dokumente/hochladen/" method="post" encType="multipart/form-data" className="karte grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="zurueck" value={zurueck} />
      {modulId && <input type="hidden" name="module_id" value={modulId} />}
      <div className="sm:col-span-2"><label className="etikett" htmlFor="d-title">Titel</label><input id="d-title" name="title" required maxLength={200} className="feld" /></div>
      <div><label className="etikett" htmlFor="d-kind">Art</label>
        <select id="d-kind" name="kind" defaultValue={art} className="feld">{Object.entries(dokumentArt).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div><label className="etikett" htmlFor="d-status">Status</label>
        <select id="d-status" name="status" defaultValue="entwurf" className="feld">{Object.entries(dokumentStatus).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select></div>
      <div><label className="etikett" htmlFor="d-com">Kommission</label><input id="d-com" name="commission" className="feld" placeholder="z. B. PR" /></div>
      {!modulId && module && (
        <div><label className="etikett" htmlFor="d-mod">Modul</label>
          <select id="d-mod" name="module_id" defaultValue="" className="feld"><option value="">kein Modul</option>{module.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</select></div>
      )}
      <div className={modulId || !module ? "sm:col-span-3" : "sm:col-span-2"}><label className="etikett" htmlFor="d-tags">Schlagworte (mit Komma)</label><input id="d-tags" name="tags" className="feld" /></div>
      <div className="sm:col-span-2"><label className="etikett" htmlFor="d-datei">Datei (bis 100 MB)</label><input id="d-datei" name="datei" type="file" className="feld" /></div>
      <div className="sm:col-span-2"><label className="etikett" htmlFor="d-link">oder Link (Video, Drive, Website)</label><input id="d-link" name="link" type="url" placeholder="https://" className="feld" /></div>
      <div className="sm:col-span-4"><label className="etikett" htmlFor="d-desc">Beschreibung</label><input id="d-desc" name="description" maxLength={2000} className="feld" /></div>
      <div className="sm:col-span-4"><button type="submit" className="knopf">Ablegen</button></div>
    </form>
  );
}
