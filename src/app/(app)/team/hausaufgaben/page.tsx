import type { Metadata } from "next";
import Link from "next/link";
import { TeamKopf } from "@/components/team/TeamKopf";
import { Leer, Rueckmeldung, Titel } from "@/components/team/Ui";
import { requireStaff } from "@/lib/auth";
import { hausaufgabeSpeichern } from "@/lib/aktionen/hausaufgaben";
import { createClient } from "@/lib/supabase/server";
import type { TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";

export const metadata: Metadata = { title: "Hausaufgaben | SES Academy" };

const de = {
  kicker: "Abgaben und Bewertung",
  ohnePerson: (n: number) => `${n} Abgaben ohne zugeordnete Person`,
  ohnePersonText: "Der Name im Video bzw. Dateinamen war unklar. Bitte öffnen und die richtige Person auswählen.",
  kurz: (nr: number | undefined) => `HA${nr ?? ""}`,
  aufgabe: (nr: number) => `Hausaufgabe ${nr}`,
  stand: (personen: number, aktiv: number, abgaben: number, bewertet: number) => `${personen} von ${aktiv} haben abgegeben · ${abgaben} Abgaben · ${bewertet} bewertet`,
  leer: "Noch keine Hausaufgaben. Rechts anlegen oder die Hausaufgabenliste importieren.",
  neu: "Neue Hausaufgabe",
  nr: "Nr.",
  titelBeispiel: "z. B. Rhetorik-Video",
  frist: "Frist",
  beschreibung: "Aufgabe (sehen die Teilnehmenden)",
  anlegen: "Anlegen",
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    kicker: "Teslimler ve değerlendirme",
    ohnePerson: (n) => `Kişi atanmamış ${n} teslim`,
    ohnePersonText: "Videodaki ya da dosya adındaki isim belirsizdi. Lütfen aç ve doğru kişiyi seç.",
    kurz: (nr) => `Ödev ${nr ?? ""}`,
    aufgabe: (nr) => `Ödev ${nr}`,
    stand: (personen, aktiv, abgaben, bewertet) => `${aktiv} kişiden ${personen} kişi teslim etti · ${abgaben} teslim · ${bewertet} değerlendirildi`,
    leer: "Henüz ödev yok. Sağ taraftan oluştur ya da ödev listesini içe aktar.",
    neu: "Yeni ödev",
    nr: "No.",
    titelBeispiel: "örn. Hitabet videosu",
    frist: "Son tarih",
    beschreibung: "Ödev metni (katılımcılar görür)",
    anlegen: "Oluştur",
  },
  fr: {
    kicker: "Rendus et évaluation",
    ohnePerson: (n) => `${n} rendus sans personne associée`,
    ohnePersonText: "Le nom dans la vidéo ou dans le nom du fichier n’était pas clair. Ouvre le rendu et choisis la bonne personne.",
    kurz: (nr) => `Devoir ${nr ?? ""}`,
    aufgabe: (nr) => `Devoir ${nr}`,
    stand: (personen, aktiv, abgaben, bewertet) => `${personen} sur ${aktiv} ont rendu · ${abgaben} rendus · ${bewertet} évalués`,
    leer: "Pas encore de devoirs. Crée-en un à droite ou importe la liste des devoirs.",
    neu: "Nouveau devoir",
    nr: "N°",
    titelBeispiel: "p.\u00a0ex. vidéo de rhétorique",
    frist: "Échéance",
    beschreibung: "Consigne (visible par les participants)",
    anlegen: "Créer",
  },
};

export default async function Hausaufgaben({ searchParams }: PageProps<"/team/hausaufgaben">) {
  const staff = await requireStaff("orga");
  const l = staff.sprache;
  const t = T[l];
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: jahrgang } = await supabase.from("cohorts").select("id,name").eq("is_current", true).maybeSingle();
  const [{ data: aufgaben }, { data: verzeichnis }, { data: offen }] = await Promise.all([
    supabase.from("assignments").select("id,number,title,due_date,submissions(id,submission_participants(participant_id),reviews(id))").eq("cohort_id", jahrgang?.id ?? "").order("number"),
    supabase.rpc("get_participant_directory"),
    supabase.from("submissions").select("id,label,assignments(number),submission_participants(participant_id)"),
  ]);
  const aktiv = (verzeichnis ?? []).filter((p) => p.active).length;
  const ohnePerson = (offen ?? []).filter((a) => !a.submission_participants.length);
  const naechste = Math.max(0, ...(aufgaben ?? []).map((a) => a.number)) + 1;

  return (
    <>
      <TeamKopf staff={staff} aktiv="hausaufgaben" breit />
      <main lang={l} className="mx-auto max-w-7xl px-4 py-10">
        <Titel kicker={`${jahrgang?.name ?? ""} · ${t.kicker}`}>{teamTexte[l].bereiche.hausaufgaben}</Titel>
        <Rueckmeldung hinweis={sp.hinweis} fehler={sp.fehler} sprache={l} />

        {ohnePerson.length > 0 && (
          <section className="mb-8 rounded-3xl bg-gelb-hell p-6 ring-1 ring-line">
            <h2 className="font-display text-xl font-bold">{t.ohnePerson(ohnePerson.length)}</h2>
            <p className="mt-1 text-sm">{t.ohnePersonText}</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {ohnePerson.map((a) => (
                <li key={a.id}><Link href={`/team/abgaben/${a.id}/`} className="chip bg-weiss px-3 py-1.5 text-sm ring-1 ring-line hover:bg-paper">{t.kurz((a.assignments as { number: number } | null)?.number)}: {a.label}</Link></li>
              ))}
            </ul>
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          {aufgaben?.length ? (
            <ul className="space-y-3">
              {aufgaben.map((h) => {
                const personen = new Set(h.submissions.flatMap((a) => a.submission_participants.map((p) => p.participant_id)));
                const bewertet = h.submissions.filter((a) => a.reviews.length).length;
                return (
                  <li key={h.id}>
                    <Link href={`/team/hausaufgaben/${h.id}/`} className="block rounded-3xl bg-weiss p-5 ring-1 ring-line transition hover:ring-ink">
                      <p className="font-display text-xl font-bold">{t.aufgabe(h.number)}: {h.title}</p>
                      <p className="mt-1 text-sm text-ink-soft">{t.stand(personen.size, aktiv, h.submissions.length, bewertet)}</p>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper-deep"><div className="h-full bg-mint" style={{ width: `${aktiv ? (personen.size / aktiv) * 100 : 0}%` }} /></div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Leer>{t.leer}</Leer>
          )}
          <section className="karte self-start">
            <h2 className="font-display mb-4 text-2xl font-bold">{t.neu}</h2>
            <form action={hausaufgabeSpeichern} className="space-y-3">
              <div className="grid grid-cols-[6rem_1fr] gap-3">
                <div><label className="etikett" htmlFor="number">{t.nr}</label><input id="number" name="number" type="number" min={1} defaultValue={naechste} required className="feld" /></div>
                <div><label className="etikett" htmlFor="title">{teamTexte[l].wort.titel}</label><input id="title" name="title" required className="feld" placeholder={t.titelBeispiel} /></div>
              </div>
              <div><label className="etikett" htmlFor="due_date">{t.frist}</label><input id="due_date" name="due_date" type="date" className="feld" /></div>
              <div><label className="etikett" htmlFor="description">{t.beschreibung}</label><textarea id="description" name="description" rows={3} className="feld" /></div>
              <button className="knopf">{t.anlegen}</button>
            </form>
          </section>
        </div>
      </main>
    </>
  );
}
