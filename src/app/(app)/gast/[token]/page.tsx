import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { istToken } from "@/lib/codes";
import { uhrzeit } from "@/lib/einlass";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Ihr Einsatz | SES Academy", robots: { index: false, follow: false }, referrer: "no-referrer" };

type Blatt = {
  name: string; bio: string; role: string; topic: string; module: string; location: string | null; host: string | null;
  arrival_at: string | null; arrival_info: string; departure_at: string | null; hotel: string; tech: string; slides: boolean; photo: boolean;
  program: { starts_at: string; ends_at: string | null; title: string; room: string | null }[];
};
const tag = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Berlin" });
const zeitpunkt = (iso: string | null) => (iso ? `${tag.format(new Date(iso))}, ${uhrzeit(iso, false)} Uhr` : "noch offen");
const hinweise: Record<string, string> = { gespeichert: "Danke, gespeichert.", "zu-gross": "Die Datei ist zu groß (Folien bis 50 MB, Foto bis 5 MB).", art: "Bitte ein Foto als JPG oder PNG.", fehler: "Das hat nicht geklappt. Bitte später noch einmal versuchen." };

/**
 * Zugang für Referentinnen und Referenten (Erweiterung aus dem Gesamtplan): persönlicher Link ohne Konto mit Ablauf,
 * Anreise, Hotel und Ansprechperson; Folien, Foto und Kurzprofil lädt der Gast selbst hoch. Gilt nur bei Zusage.
 */
export default async function Gast({ params, searchParams }: PageProps<"/gast/[token]">) {
  const { token } = await params;
  const { hinweis } = await searchParams;
  if (!istToken(token)) notFound();
  const { data } = await createAdminClient().rpc("get_guest_sheet", { p_token: token.toLowerCase() });
  if (!data) notFound();
  const b = data as unknown as Blatt;
  const tage = [...new Set(b.program.map((p) => tag.format(new Date(p.starts_at))))];

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <img src="/brand/ses-logo.png" alt="SES Academy" className="h-10 w-auto" />
      <h1 className="font-display mt-8 text-3xl font-bold">Willkommen, {b.name}</h1>
      <p className="mt-1 text-lg">{b.module}{b.topic ? ` · ${b.topic}` : ""}</p>
      {typeof hinweis === "string" && hinweise[hinweis] && <p role="status" className="mt-4 rounded-2xl bg-gruen-hell p-4 font-semibold">{hinweise[hinweis]}</p>}

      <section className="karte mt-6 grid gap-3 sm:grid-cols-2">
        <div><p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Ort</p><p>{b.location ?? "folgt"}</p></div>
        <div><p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Ihre Ansprechperson</p><p>{b.host ?? "folgt"}</p></div>
        <div><p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Anreise</p><p>{zeitpunkt(b.arrival_at)}</p>{b.arrival_info && <p className="text-sm text-ink-soft">{b.arrival_info}</p>}</div>
        <div><p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Abreise</p><p>{zeitpunkt(b.departure_at)}</p></div>
        {b.hotel && <div className="sm:col-span-2"><p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Hotel</p><p>{b.hotel}</p></div>}
        {b.tech && <div className="sm:col-span-2"><p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Technik vor Ort</p><p>{b.tech}</p></div>}
      </section>

      {b.program.length > 0 && (
        <section className="karte mt-6">
          <h2 className="font-display text-xl font-bold">Ablauf</h2>
          {tage.map((t) => (
            <div key={t} className="mt-3">
              <p className="font-semibold">{t}</p>
              <ul className="mt-1 space-y-1 text-sm">
                {b.program.filter((p) => tag.format(new Date(p.starts_at)) === t).map((p, i) => (
                  <li key={i} className="flex gap-3"><span className="w-24 shrink-0 font-mono">{uhrzeit(p.starts_at, false)}{p.ends_at ? `–${uhrzeit(p.ends_at, false)}` : ""}</span><span>{p.title}{p.room ? ` · ${p.room}` : ""}</span></li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      <form action={`/gast/${token}/hochladen/`} method="post" encType="multipart/form-data" className="karte mt-6 grid gap-3">
        <h2 className="font-display text-xl font-bold">Ihre Unterlagen</h2>
        <div><label className="etikett" htmlFor="folien">Folien (PDF oder PowerPoint, bis 50 MB){b.slides ? " · erhalten ✓" : ""}</label><input id="folien" name="folien" type="file" accept=".pdf,.ppt,.pptx,.key" className="feld" /></div>
        <div><label className="etikett" htmlFor="foto">Foto für Programm und Website (JPG oder PNG, bis 5 MB){b.photo ? " · erhalten ✓" : ""}</label><input id="foto" name="foto" type="file" accept="image/jpeg,image/png" className="feld" /></div>
        <div><label className="etikett" htmlFor="bio">Kurzprofil (3 bis 5 Sätze)</label><textarea id="bio" name="bio" rows={5} maxLength={3000} defaultValue={b.bio} className="feld" /></div>
        <button type="submit" className="knopf justify-self-start">Speichern</button>
      </form>
      <p className="mt-6 text-sm text-ink-soft">Fragen? Schreiben Sie an ses@islamrat.de. Diesen Link bitte nicht weitergeben.</p>
    </main>
  );
}
