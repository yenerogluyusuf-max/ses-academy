import type { Metadata } from "next";
import { telLink } from "@/lib/telefon";
import { AutoAktualisieren } from "@/components/team/AutoAktualisieren";
import { GruppenListe, type GruppenPerson } from "@/components/team/GruppenListe";
import { Hinweis } from "@/components/team/Hinweis";
import { kontaktHinweisTexte, type Kontakt } from "@/components/team/Kontakt";
import { TagWahl } from "@/components/team/TagWahl";
import { TeamKopf } from "@/components/team/TeamKopf";
import { jetztMs } from "@/lib/zeit";
import { sorumluLinkErneuern, sorumluTelefon } from "@/lib/aktionen/gruppen";
import { darf, requireStaff } from "@/lib/auth";
import { ladeModultage } from "@/lib/eventtag";
import { seitenUrl } from "@/lib/mail";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { teamLocale, type TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";

export const metadata: Metadata = { title: "Gruppen | SES Academy" };

const de = {
  hinweise: {
    gespeichert: { text: "Gespeichert.", gut: true },
    "link-neu": { text: "Neuer Link erzeugt. Der alte Link funktioniert nicht mehr.", gut: true },
    eingabe: { text: "Bitte die Angaben prüfen.", gut: false },
    fehler: { text: "Das hat nicht geklappt.", gut: false },
  } as Record<string, { text: string; gut: boolean }>,
  titel: "Gruppen · fehlt noch",
  ohneSorumlu: "Ohne Sorumlu",
  keineTage: "Es gibt noch keine veröffentlichten Modultage.",
  fehlen: (n: number) => `${n} fehlen`,
  anrufenLabel: (name: string) => `Sorumlu ${name} anrufen`,
  anrufen: "Sorumlu anrufen",
  keineAnmeldungen: "Für diesen Tag gibt es keine Anmeldungen.",
  links: "Links für die Sorumlu",
  linksText: "Jede Sorumlu sieht über ihren persönlichen Link am Eventtag ihre Gruppe mit Telefonnummern, ohne Konto. Links nur persönlich weitergeben.",
  telefonVon: (name: string) => `Telefon ${name}`,
  linkErneuern: "Link erneuern",
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    hinweise: {
      gespeichert: { text: teamTexte.tr.meldung.gespeichert, gut: true },
      "link-neu": { text: "Yeni bağlantı oluşturuldu. Eski bağlantı artık çalışmıyor.", gut: true },
      eingabe: { text: teamTexte.tr.meldung.eingabe, gut: false },
      fehler: { text: teamTexte.tr.meldung.fehler, gut: false },
    },
    titel: "Gruplar · henüz gelmeyenler",
    ohneSorumlu: "Sorumlusu olmayanlar",
    keineTage: "Henüz yayınlanmış modül günü yok.",
    fehlen: (n) => `${n} eksik`,
    anrufenLabel: (name) => `Sorumluyu ara: ${name}`,
    anrufen: "Sorumluyu ara",
    keineAnmeldungen: "Bu gün için kayıt yok.",
    links: "Sorumlular için bağlantılar",
    linksText: "Her sorumlu, kişisel bağlantısıyla program günü kendi grubunu telefon numaralarıyla birlikte görür; hesap gerekmez. Bağlantıları yalnızca kişiye özel ilet.",
    telefonVon: (name) => `Telefon: ${name}`,
    linkErneuern: "Bağlantıyı yenile",
  },
  fr: {
    hinweise: {
      gespeichert: { text: teamTexte.fr.meldung.gespeichert, gut: true },
      "link-neu": { text: "Nouveau lien créé. L’ancien lien ne fonctionne plus.", gut: true },
      eingabe: { text: teamTexte.fr.meldung.eingabe, gut: false },
      fehler: { text: teamTexte.fr.meldung.fehler, gut: false },
    },
    titel: "Groupes · encore absents",
    ohneSorumlu: "Sans Sorumlu",
    keineTage: "Il n’y a pas encore de jours de module publiés.",
    fehlen: (n) => `${n} absents`,
    anrufenLabel: (name) => `Appeler ${name} (Sorumlu)`,
    anrufen: "Appeler la Sorumlu",
    keineAnmeldungen: "Aucune inscription pour ce jour.",
    links: "Liens pour les Sorumlu",
    linksText: "Chaque Sorumlu voit, grâce à son lien personnel, son groupe avec les numéros de téléphone le jour J, sans compte. Ne transmets les liens qu’à la personne concernée.",
    telefonVon: (name) => `Téléphone de ${name}`,
    linkErneuern: "Renouveler le lien",
  },
};

/** „Fehlt noch“ je Sorumlu: am Eventtag sieht das Team jede Gruppe, wer noch nicht eingecheckt ist, mit Anruf-Knopf. */
export default async function Gruppen({ searchParams }: PageProps<"/team/gruppen">) {
  const staff = await requireStaff("orga");
  const l = staff.sprache;
  const t = T[l];
  const { tag: gewaehlt, hinweis } = await searchParams;
  const { tage, vorschlag } = await ladeModultage();
  const tag = tage.find((x) => x.id === gewaehlt) ?? vorschlag;
  const supabase = await createClient();

  const [{ data: zeilen }, { data: kontakte }, { data: sorumlu }] = await Promise.all([
    tag ? supabase.rpc("get_group_status", { p_module_day_id: tag.id }) : Promise.resolve({ data: [] }),
    tag ? supabase.rpc("get_contacts", { p_module_id: tag.module_id }) : Promise.resolve({ data: [] }),
    // Die geheimen Links sind für Teamkonten nicht lesbar; Admin/Vorstand bekommen sie über den Server
    darf.alles(staff.role) ? createAdminClient().from("mentors").select("id, name, phone, access_token").order("name") : Promise.resolve({ data: [] }),
  ]);

  // nach Gruppe bündeln; Personen ohne Sorumlu kommen ans Ende
  const gruppen = new Map<string, { name: string; telefon: string | null; personen: GruppenPerson[] }>();
  for (const z of zeilen ?? []) {
    const schluessel = z.mentor_id ?? "ohne";
    if (!gruppen.has(schluessel)) gruppen.set(schluessel, { name: z.mentor_name ?? t.ohneSorumlu, telefon: z.mentor_phone, personen: [] });
    gruppen.get(schluessel)!.personen.push(z);
  }
  // neuester Kontakt je Person (get_contacts liefert neueste zuerst)
  const letzte = new Map<string, Kontakt>();
  for (const k of kontakte ?? []) if (!letzte.has(k.participant_id)) letzte.set(k.participant_id, k);
  const zurueck = `/team/gruppen/${tag ? `?tag=${tag.id}` : ""}`;
  const liste = [...gruppen.entries()].map(([id, g]) => ({ id, ...g, fehlt: g.personen.filter((p) => !p.checked_in_at && p.registration_status === "confirmed").length }))
    .sort((a, b) => (a.id === "ohne" ? 1 : b.id === "ohne" ? -1 : b.fehlt - a.fehlt || a.name.localeCompare(b.name, teamLocale[l])));

  return (
    <>
      <TeamKopf staff={staff} aktiv="gruppen" />
      <AutoAktualisieren />
      <main lang={l} className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="font-display text-3xl font-bold">{t.titel}</h1>
        <Hinweis code={hinweis} texte={{ ...t.hinweise, ...kontaktHinweisTexte[l] }} />
        {!tag ? <p className="karte mt-6">{t.keineTage}</p> : (
          <>
            <TagWahl tage={tage} aktiv={tag.id} pfad="/team/gruppen/" jetzt={jetztMs()} sprache={l} />

            <div className="mt-6 space-y-4">
              {liste.map((g) => (
                <section key={g.id} className="karte">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display mr-auto text-xl font-bold">{g.name}</h2>
                    {g.fehlt > 0 && <span className="chip bg-gelb-hell">{t.fehlen(g.fehlt)}</span>}
                    {g.telefon && <a href={telLink(g.telefon)} className="knopf-hell" aria-label={t.anrufenLabel(g.name)}>{t.anrufen}</a>}
                  </div>
                  <div className="mt-3"><GruppenListe personen={g.personen} kontakt={{ moduleId: tag.module_id, zurueck, letzte }} sprache={l} /></div>
                </section>
              ))}
              {liste.length === 0 && <p className="rounded-3xl border-2 border-dashed border-line p-8 text-center text-ink-soft">{t.keineAnmeldungen}</p>}
            </div>
          </>
        )}

        {(sorumlu ?? []).length > 0 && (
          <section className="karte mt-10">
            <h2 className="font-display text-xl font-bold">{t.links}</h2>
            <p className="mt-1 text-sm text-ink-soft">
              {t.linksText}
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
                      <label className="sr-only" htmlFor={`tel-${s.id}`}>{t.telefonVon(s.name)}</label>
                      <input id={`tel-${s.id}`} name="phone" type="tel" defaultValue={s.phone ?? ""} placeholder={teamTexte[l].wort.telefon} className="feld !w-48" />
                      <button type="submit" className="knopf-hell">{teamTexte[l].wort.speichern}</button>
                    </form>
                    <form action={sorumluLinkErneuern}>
                      <input type="hidden" name="id" value={s.id} />
                      <button type="submit" className="text-sm font-semibold text-ink-soft underline">{t.linkErneuern}</button>
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
