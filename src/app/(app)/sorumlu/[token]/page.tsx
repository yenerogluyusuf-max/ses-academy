import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AutoAktualisieren } from "@/components/team/AutoAktualisieren";
import { GruppenListe } from "@/components/team/GruppenListe";
import { istToken } from "@/lib/codes";
import { ladeModultage, tagBezeichnung } from "@/lib/eventtag";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Meine Gruppe | SES Academy", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** Persönlicher Link einer Sorumlu: ihre Gruppe am aktuellen bzw. nächsten Modultag, ohne Konto. Der Link ist der Nachweis. */
export default async function SorumluSeite({ params, searchParams }: PageProps<"/sorumlu/[token]">) {
  const { token } = await params;
  const { tag: gewaehlt } = await searchParams;
  if (!istToken(token)) notFound();
  const db = createAdminClient();
  const { data: sorumlu } = await db.from("mentors").select("name").eq("access_token", token.toLowerCase()).maybeSingle();
  if (!sorumlu) notFound();

  const { tage, vorschlag } = await ladeModultage();
  const tag = tage.find((t) => t.id === gewaehlt) ?? vorschlag;
  const { data: personen } = tag ? await db.rpc("get_group_status_by_token", { p_token: token.toLowerCase(), p_module_day_id: tag.id }) : { data: [] };

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <AutoAktualisieren />
      <img src="/brand/ses-logo.png" alt="SES Academy" className="h-10 w-auto" />
      <h1 className="font-display mt-6 text-3xl font-bold">Meine Gruppe</h1>
      <p className="mt-1 text-ink-soft">{sorumlu.name}{tag ? ` · ${tagBezeichnung(tag, tag.module.title)}` : ""}</p>
      {tag && tage.length > 1 && (
        <form className="mt-4 flex gap-2" action={`/sorumlu/${token}/`}>
          <label htmlFor="tag" className="sr-only">Modultag</label>
          <select id="tag" name="tag" defaultValue={tag.id} className="feld">
            {tage.map((t) => <option key={t.id} value={t.id}>{tagBezeichnung(t, t.module.title)}</option>)}
          </select>
          <button type="submit" className="knopf-hell">Öffnen</button>
        </form>
      )}
      <div className="karte mt-6">
        {personen && personen.length > 0 ? <GruppenListe personen={personen} /> : <p className="text-ink-soft">Für diesen Tag ist aus deiner Gruppe niemand angemeldet.</p>}
      </div>
      <p className="mt-6 text-xs text-ink-soft">Diese Seite aktualisiert sich alle 30 Sekunden. Den Link bitte nicht weitergeben.</p>
    </main>
  );
}
