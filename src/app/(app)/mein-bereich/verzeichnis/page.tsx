import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TeamKopf } from "@/components/team/TeamKopf";
import { getStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mitglieder | SES Academy", robots: { index: false, follow: false } };

function telLink(nummer: string) {
  return `tel:${nummer.replace(/[^\d+]/g, "")}`;
}

/**
 * Mitgliederverzeichnis für angemeldete Mitglieder (und das Team): Name, Foto, Region, Abzeichen; E-Mail und Telefon
 * nur, wenn die Person sie freigegeben hat. Filter über die Adresse (?suche=, ?region=, ?abzeichen=).
 */
export default async function Verzeichnis({ searchParams }: PageProps<"/mein-bereich/verzeichnis">) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/mein-bereich/login/");
  const staff = await getStaff();
  const { suche, region, abzeichen } = await searchParams;
  const { data } = await supabase.rpc("get_member_directory");
  const alle = data ?? [];
  const regionen = [...new Set(alle.map((m) => m.region).filter(Boolean))].sort() as string[];
  const abzeichenListe = [...new Set(alle.flatMap((m) => m.badges ?? []))].sort();
  const s = typeof suche === "string" ? suche.trim().toLowerCase() : "";
  const liste = alle.filter((m) =>
    (!s || m.name.toLowerCase().includes(s)) &&
    (typeof region !== "string" || !region || m.region === region) &&
    (typeof abzeichen !== "string" || !abzeichen || (m.badges ?? []).includes(abzeichen)));

  return (
    <>
    {staff && <TeamKopf staff={staff} aktiv="mitglieder" />}
    <main className="mx-auto max-w-5xl px-4 py-8">
      {!staff && <Link href="/mein-bereich/" className="text-sm font-semibold text-ink-soft hover:text-ink">← Mein Bereich</Link>}
      <h1 className="font-display mt-2 text-4xl font-extrabold">Mitglieder</h1>
      <p className="mt-1 text-ink-soft">{liste.length} von {alle.length}. E-Mail und Telefon erscheinen nur, wenn die Person sie in ihrem Profil freigegeben hat.</p>
      <form className="mt-6 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]" action="/mein-bereich/verzeichnis/">
        <label className="sr-only" htmlFor="suche">Name suchen</label>
        <input id="suche" name="suche" defaultValue={typeof suche === "string" ? suche : ""} placeholder="Name suchen" className="feld" />
        <label className="sr-only" htmlFor="region">Region</label>
        <select id="region" name="region" defaultValue={typeof region === "string" ? region : ""} className="feld"><option value="">alle Regionen</option>{regionen.map((r) => <option key={r} value={r}>{r}</option>)}</select>
        <label className="sr-only" htmlFor="abzeichen">Abzeichen</label>
        <select id="abzeichen" name="abzeichen" defaultValue={typeof abzeichen === "string" ? abzeichen : ""} className="feld"><option value="">alle Abzeichen</option>{abzeichenListe.map((a) => <option key={a} value={a}>{a}</option>)}</select>
        <button type="submit" className="knopf">Filtern</button>
      </form>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {liste.map((m) => (
          <li key={m.participant_id} className="karte flex gap-4 !p-4">
            {m.has_photo
              ? <img src={`/portal/foto/${m.participant_id}/`} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-full object-cover ring-1 ring-line" />
              : <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-paper-deep font-display text-2xl font-bold" aria-hidden>{m.name[0]}</div>}
            <div className="min-w-0">
              <p className="font-semibold">{m.name}</p>
              <p className="text-sm text-ink-soft">{[m.region, m.branch].filter(Boolean).join(" · ")}</p>
              <ul className="mt-1 flex flex-wrap gap-1">{(m.badges ?? []).map((b) => <li key={b} className="chip bg-gruen-hell">{b}</li>)}</ul>
              {(m.email || m.phone) && (
                <p className="mt-2 space-x-3 text-sm">
                  {m.email && <a href={`mailto:${m.email}`} className="link">{m.email}</a>}
                  {m.phone && <a href={telLink(m.phone)} className="link">{m.phone}</a>}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
      {liste.length === 0 && <p className="mt-6 rounded-3xl border-2 border-dashed border-line p-8 text-center text-ink-soft">Niemand gefunden.</p>}
    </main>
    </>
  );
}
