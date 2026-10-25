import type { Metadata } from "next";
import { AutoAktualisieren } from "@/components/team/AutoAktualisieren";
import { GruppenListe, type GruppenPerson } from "@/components/team/GruppenListe";
import { Hinweis } from "@/components/team/Hinweis";
import { TeamKopf } from "@/components/team/TeamKopf";
import { sorumluLinkErneuern, sorumluTelefon } from "@/lib/aktionen/gruppen";
import { darf, requireStaff } from "@/lib/auth";
import { ladeModultage, tagBezeichnung } from "@/lib/eventtag";
import { seitenUrl } from "@/lib/mail";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Gruppen | SES Academy" };

const hinweise: Record<string, { text: string; gut: boolean }> = {
  gespeichert: { text: "Gespeichert.", gut: true },
  "link-neu": { text: "Neuer Link erzeugt. Der alte Link funktioniert nicht mehr.", gut: true },
  eingabe: { text: "Bitte die Angaben prüfen.", gut: false },
  fehler: { text: "Das hat nicht geklappt.", gut: false },
};

function telLink(nummer: string) {
  return `tel:${nummer.replace(/[^\d+]/g, "")}`;
}

/** „Fehlt noch“ je Sorumlu: am Eventtag sieht das Team jede Gruppe, wer noch nicht eingecheckt ist, mit Anruf-Knopf. */
export default async function Gruppen({ searchParams }: PageProps<"/team/gruppen">) {
  const staff = await requireStaff("orga");
  const { tag: gewaehlt, hinweis } = await searchParams;
  const { tage, vorschlag } = await ladeModultage();
  const tag = tage.find((t) => t.id === gewaehlt) ?? vorschlag;
  const supabase = await createClient();

  const [{ data: zeilen }, { data: sorumlu }] = await Promise.all([
    tag ? supabase.rpc("get_group_status", { p_module_day_id: tag.id }) : Promise.resolve({ data: [] }),
    // Die geheimen Links sieht nur, wer sie auch verwalten darf
    darf.alles(staff.role) ? supabase.from("mentors").select("id, name, phone, access_token").order("name") : Promise.resolve({ data: [] }),
  ]);

  // nach Gruppe bündeln; Personen ohne Sorumlu kommen ans Ende
  const gruppen = new Map<string, { name: string; telefon: string | null; personen: GruppenPerson[] }>();
  for (const z of zeilen ?? []) {
    const schluessel = z.mentor_id ?? "ohne";
    if (!gruppen.has(schluessel)) gruppen.set(schluessel, { name: z.mentor_name ?? "Ohne Sorumlu", telefon: z.mentor_phone, personen: [] });
    gruppen.get(schluessel)!.personen.push(z);
  }
  const liste = [...gruppen.entries()].map(([id, g]) => ({ id, ...g, fehlt: g.personen.filter((p) => !p.checked_in_at && p.registration_status === "confirmed").length }))
    .sort((a, b) => (a.id === "ohne" ? 1 : b.id === "ohne" ? -1 : b.fehlt - a.fehlt || a.name.localeCompare(b.name, "de")));

  return (
    <>
      <TeamKopf staff={staff} aktiv="regieplan" />
      <AutoAktualisieren />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="font-display text-3xl font-bold">Gruppen · fehlt noch</h1>
        <Hinweis code={hinweis} texte={hinweise} />
        {!tag ? <p className="karte mt-6">Es gibt noch keine veröffentlichten Modultage.</p> : (
          <>
            <form className="mt-4 flex flex-wrap items-end gap-2" action="/team/gruppen/">
              <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
                <label htmlFor="tag" className="etikett">Modultag</label>
                <select id="tag" name="tag" defaultValue={tag.id} className="feld">
                  {tage.map((t) => <option key={t.id} value={t.id}>{tagBezeichnung(t, t.module.title)}</option>)}
                </select>
              </div>
              <button type="submit" className="knopf-hell">Öffnen</button>
            </form>

            <div className="mt-6 space-y-4">
              {liste.map((g) => (
                <section key={g.id} className="karte">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display mr-auto text-xl font-bold">{g.name}</h2>
                    {g.fehlt > 0 && <span className="chip bg-gelb-hell">{g.fehlt} fehlen</span>}
                    {g.telefon && <a href={telLink(g.telefon)} className="knopf-hell" aria-label={`Sorumlu ${g.name} anrufen`}>Sorumlu anrufen</a>}
                  </div>
                  <div className="mt-3"><GruppenListe personen={g.personen} /></div>
                </section>
              ))}
              {liste.length === 0 && <p className="rounded-3xl border-2 border-dashed border-line p-8 text-center text-ink-soft">Für diesen Tag gibt es keine Anmeldungen.</p>}
            </div>
          </>
        )}

        {(sorumlu ?? []).length > 0 && (
          <section className="karte mt-10">
            <h2 className="font-display text-xl font-bold">Links für die Sorumlu</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Jede Sorumlu sieht über ihren persönlichen Link am Eventtag ihre Gruppe mit Telefonnummern, ohne Konto. Links nur persönlich weitergeben.
            </p>
            <ul className="mt-4 divide-y divide-line">
              {(sorumlu ?? []).map((s) => (
                <li key={s.id} className="py-3">
                  <p className="font-semibold">{s.name}</p>
                  <p className="mt-1 break-all font-mono text-xs text-ink-soft">{seitenUrl(`/sorumlu/${s.access_token}/`)}</p>
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <form action={sorumluTelefon} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="id" value={s.id} />
                      {tag && <input type="hidden" name="tag" value={tag.id} />}
                      <label className="sr-only" htmlFor={`tel-${s.id}`}>Telefon {s.name}</label>
                      <input id={`tel-${s.id}`} name="phone" type="tel" defaultValue={s.phone ?? ""} placeholder="Telefon" className="feld !w-48" />
                      <button type="submit" className="knopf-hell">Speichern</button>
                    </form>
                    <form action={sorumluLinkErneuern}>
                      <input type="hidden" name="id" value={s.id} />
                      <button type="submit" className="text-sm font-semibold text-ink-soft underline">Link erneuern</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
