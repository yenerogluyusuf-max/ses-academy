import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dokumentArt, dokumentArtNamen, dokumentStatus, dokumentStatusNamen } from "@/components/team/Dokumente";
import { Hinweis } from "@/components/team/Hinweis";
import { TeamKopf } from "@/components/team/TeamKopf";
import { dokumentSpeichern } from "@/lib/aktionen/dokumente";
import { requireStaff } from "@/lib/auth";
import { istToken } from "@/lib/codes";
import { createClient } from "@/lib/supabase/server";
import { teamLocale, type TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";

export const metadata: Metadata = { title: "Dokument | SES Academy" };

const de = {
  hinweise: {
    gespeichert: { text: "Gespeichert.", gut: true },
    "zu-gross": { text: "Die Datei ist größer als 100 MB.", gut: false },
    eingabe: { text: "Bitte die Angaben prüfen.", gut: false },
    fehler: { text: "Das hat nicht geklappt.", gut: false },
  } as Record<string, { text: string; gut: boolean }>,
  linkOeffnen: "Link öffnen ↗",
  versionen: "Versionen",
  nochKeineDatei: (mitLink: boolean) => `Noch keine Datei, nur ${mitLink ? "ein Link" : "Angaben"}.`,
  kb: "KB",
  neueVersion: "Neue Version",
  geaendert: "Was hat sich geändert?",
  angaben: "Angaben",
  kommission: "Kommission",
  schlagworte: "Schlagworte (mit Komma)",
  link: "Link",
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    hinweise: {
      gespeichert: { text: teamTexte.tr.meldung.gespeichert, gut: true },
      "zu-gross": { text: "Dosya 100 MB’tan büyük.", gut: false },
      eingabe: { text: teamTexte.tr.meldung.eingabe, gut: false },
      fehler: { text: teamTexte.tr.meldung.fehler, gut: false },
    },
    linkOeffnen: "Bağlantıyı aç ↗",
    versionen: "Sürümler",
    nochKeineDatei: (mitLink) => `Henüz dosya yok, yalnızca ${mitLink ? "bir bağlantı" : "bilgiler"} var.`,
    kb: "KB",
    neueVersion: "Yeni sürüm",
    geaendert: "Ne değişti?",
    angaben: "Bilgiler",
    kommission: "Komisyon",
    schlagworte: "Etiketler (virgülle ayır)",
    link: "Bağlantı",
  },
  fr: {
    hinweise: {
      gespeichert: { text: teamTexte.fr.meldung.gespeichert, gut: true },
      "zu-gross": { text: "Le fichier dépasse 100\u00a0Mo.", gut: false },
      eingabe: { text: teamTexte.fr.meldung.eingabe, gut: false },
      fehler: { text: teamTexte.fr.meldung.fehler, gut: false },
    },
    linkOeffnen: "Ouvrir le lien ↗",
    versionen: "Versions",
    nochKeineDatei: (mitLink) => `Pas encore de fichier, seulement ${mitLink ? "un lien" : "des informations"}.`,
    kb: "Ko",
    neueVersion: "Nouvelle version",
    geaendert: "Qu’est-ce qui a changé\u00a0?",
    angaben: "Informations",
    kommission: "Commission",
    schlagworte: "Mots-clés (séparés par des virgules)",
    link: "Lien",
  },
};

/** Ein Dokument: Angaben und Status ändern, alle Versionen, neue Version hochladen. */
export default async function Dokument({ params, searchParams }: PageProps<"/team/dokumente/[id]">) {
  const staff = await requireStaff("orga");
  const l = staff.sprache;
  const t = T[l];
  const w = teamTexte[l].wort;
  const zeit = new Intl.DateTimeFormat(teamLocale[l], { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" });
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
      <main lang={l} className="mx-auto max-w-4xl px-4 py-8">
        <Link href={d.module ? `/team/module/${d.module.id}/material/` : "/team/dokumente/"} className="text-sm font-semibold text-ink-soft hover:text-ink">← {d.module ? d.module.title : teamTexte[l].bereiche.dokumente}</Link>
        <h1 className="font-display mt-2 text-3xl font-bold">{d.title}</h1>
        <p className="text-ink-soft">{dokumentArtNamen[l][d.kind] ?? dokumentArt[d.kind]} · {dokumentStatusNamen[l][d.status] ?? dokumentStatus[d.status]?.name}{d.link && <> · <a href={d.link} target="_blank" rel="noopener noreferrer" className="link">{t.linkOeffnen}</a></>}</p>
        <Hinweis code={hinweis} texte={t.hinweise} />

        <section className="karte mt-6">
          <h2 className="font-display text-xl font-bold">{t.versionen}</h2>
          {(versionen ?? []).length === 0 ? <p className="mt-2 text-ink-soft">{t.nochKeineDatei(Boolean(d.link))}</p> : (
            <ul className="mt-3 divide-y divide-line">
              {(versionen ?? []).map((v) => (
                <li key={v.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                  <span className="chip bg-paper-deep">v{v.version}</span>
                  <a href={`/team/dokumente/${id}/datei/?v=${v.version}`} target="_blank" rel="noopener" className="mr-auto font-semibold underline">{v.file_name}</a>
                  <span className="text-ink-soft">{v.size_bytes ? `${Math.round(v.size_bytes / 1024)} ${t.kb} · ` : ""}{zeit.format(new Date(v.uploaded_at))}{v.uploaded_by ? ` · ${name.get(v.uploaded_by) ?? ""}` : ""}{v.note ? ` · ${v.note}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
          <form action="/team/dokumente/hochladen/" method="post" encType="multipart/form-data" className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4">
            <input type="hidden" name="document_id" value={id} /><input type="hidden" name="zurueck" value={`/team/dokumente/${id}/`} />
            <div className="min-w-56 flex-1"><label className="etikett" htmlFor="datei">{t.neueVersion}</label><input id="datei" name="datei" type="file" required className="feld" /></div>
            <div className="min-w-56 flex-1"><label className="etikett" htmlFor="note">{t.geaendert}</label><input id="note" name="note" maxLength={500} className="feld" /></div>
            <button type="submit" className="knopf">{w.hochladen}</button>
          </form>
        </section>

        <section className="karte mt-6">
          <h2 className="font-display text-xl font-bold">{t.angaben}</h2>
          <form action={dokumentSpeichern} className="mt-3 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={id} />
            <div className="sm:col-span-2"><label className="etikett" htmlFor="title">{w.titel}</label><input id="title" name="title" required defaultValue={d.title} className="feld" /></div>
            <div><label className="etikett" htmlFor="status">{w.status}</label>
              <select id="status" name="status" defaultValue={d.status} className="feld">{Object.entries(dokumentStatus).map(([k, v]) => <option key={k} value={k}>{dokumentStatusNamen[l][k] ?? v.name}</option>)}</select></div>
            <div><label className="etikett" htmlFor="commission">{t.kommission}</label><input id="commission" name="commission" defaultValue={d.commission ?? ""} className="feld" /></div>
            <div className="sm:col-span-2"><label className="etikett" htmlFor="tags">{t.schlagworte}</label><input id="tags" name="tags" defaultValue={d.tags.join(", ")} className="feld" /></div>
            <div className="sm:col-span-2"><label className="etikett" htmlFor="link">{t.link}</label><input id="link" name="link" type="url" defaultValue={d.link ?? ""} className="feld" /></div>
            <div className="sm:col-span-2"><label className="etikett" htmlFor="description">{w.beschreibung}</label><textarea id="description" name="description" rows={3} defaultValue={d.description} className="feld" /></div>
            <div className="sm:col-span-2"><button type="submit" className="knopf-hell">{w.speichern}</button></div>
          </form>
        </section>
      </main>
    </>
  );
}
