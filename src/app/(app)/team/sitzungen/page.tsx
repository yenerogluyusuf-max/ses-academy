import type { Metadata } from "next";
import Link from "next/link";
import { Hinweis } from "@/components/team/Hinweis";
import { TeamKopf } from "@/components/team/TeamKopf";
import { sitzungSpeichern } from "@/lib/aktionen/dokumente";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { teamLocale, type TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";

export const metadata: Metadata = { title: "Sitzungen | SES Academy" };

const de = {
  hinweise: {
    eingabe: { text: "Bitte Titel und Datum angeben.", gut: false },
    fehler: { text: "Das hat nicht geklappt.", gut: false },
  } as Record<string, { text: string; gut: boolean }>,
  beschluesse: (n: number) => `${n} Beschlüsse`,
  offen: (n: number) => `${n} Aufgaben offen`,
  keine: "Noch keine Sitzungen.",
  neu: "Neue Sitzung",
  titelBeispiel: "z. B. Kommissionssitzung Organisation",
  kommission: "Kommission",
  anwesend: "Anwesend",
  anlegen: "Anlegen",
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    hinweise: {
      eingabe: { text: "Lütfen başlık ve tarih gir.", gut: false },
      fehler: { text: teamTexte.tr.meldung.fehler, gut: false },
    },
    beschluesse: (n) => `${n} karar`,
    offen: (n) => `${n} açık görev`,
    keine: "Henüz toplantı yok.",
    neu: "Yeni toplantı",
    titelBeispiel: "örn. Organizasyon komisyonu toplantısı",
    kommission: "Komisyon",
    anwesend: "Katılanlar",
    anlegen: "Oluştur",
  },
  fr: {
    hinweise: {
      eingabe: { text: "Merci d’indiquer un titre et une date.", gut: false },
      fehler: { text: teamTexte.fr.meldung.fehler, gut: false },
    },
    beschluesse: (n) => `${n}\u00a0décision${n > 1 ? "s" : ""}`,
    offen: (n) => `${n}\u00a0tâche${n > 1 ? "s" : ""} ouverte${n > 1 ? "s" : ""}`,
    keine: "Pas encore de réunions.",
    neu: "Nouvelle réunion",
    titelBeispiel: "p.\u00a0ex. réunion de la commission organisation",
    kommission: "Commission",
    anwesend: "Présents",
    anlegen: "Créer",
  },
};

/** Sitzungen mit Protokoll, Beschlüssen und Aufgaben, damit Beschlüsse nicht verloren gehen (Phase 3). */
export default async function Sitzungen({ searchParams }: PageProps<"/team/sitzungen">) {
  const staff = await requireStaff("orga");
  const l = staff.sprache;
  const t = T[l];
  const w = teamTexte[l].wort;
  const datum = new Intl.DateTimeFormat(teamLocale[l], { dateStyle: "long", timeZone: "UTC" });
  const { hinweis } = await searchParams;
  const supabase = await createClient();
  const { data: sitzungen } = await supabase.from("meetings").select("id, title, held_on, commission, meeting_decisions(count), tasks(id, done_at)").order("held_on", { ascending: false });
  return (
    <>
      <TeamKopf staff={staff} aktiv="sitzungen" />
      <main lang={l} className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="font-display text-3xl font-bold">{teamTexte[l].bereiche.sitzungen}</h1>
        <Hinweis code={hinweis} texte={t.hinweise} />
        <ul className="mt-6 divide-y divide-line rounded-3xl bg-weiss px-4 ring-1 ring-line">
          {(sitzungen ?? []).map((s) => {
            const offen = s.tasks.filter((t) => !t.done_at).length;
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-2 py-3">
                <Link href={`/team/sitzungen/${s.id}/`} className="mr-auto font-semibold hover:underline">{s.title}</Link>
                <span className="text-sm text-ink-soft">{datum.format(new Date(`${s.held_on}T12:00:00Z`))}{s.commission ? ` · ${s.commission}` : ""}</span>
                <span className="chip bg-paper-deep">{t.beschluesse(s.meeting_decisions[0]?.count ?? 0)}</span>
                {offen > 0 && <span className="chip bg-gelb-hell">{t.offen(offen)}</span>}
              </li>
            );
          })}
          {(sitzungen ?? []).length === 0 && <li className="py-6 text-center text-ink-soft">{t.keine}</li>}
        </ul>
        <section className="karte mt-8">
          <h2 className="font-display text-xl font-bold">{t.neu}</h2>
          <form action={sitzungSpeichern} className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2"><label className="etikett" htmlFor="title">{w.titel}</label><input id="title" name="title" required className="feld" placeholder={t.titelBeispiel} /></div>
            <div><label className="etikett" htmlFor="held_on">{w.datum}</label><input id="held_on" name="held_on" type="date" required className="feld" /></div>
            <div><label className="etikett" htmlFor="commission">{t.kommission}</label><input id="commission" name="commission" className="feld" /></div>
            <div className="sm:col-span-2"><label className="etikett" htmlFor="attendees">{t.anwesend}</label><input id="attendees" name="attendees" className="feld" /></div>
            <div className="sm:col-span-3"><button type="submit" className="knopf">{t.anlegen}</button></div>
          </form>
        </section>
      </main>
    </>
  );
}
