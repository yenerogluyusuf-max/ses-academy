import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Hinweis } from "@/components/team/Hinweis";
import { TeamKopf } from "@/components/team/TeamKopf";
import { beschlussHinzufuegen, sitzungsAufgabe, sitzungSpeichern } from "@/lib/aktionen/dokumente";
import { aufgabeUmschalten } from "@/lib/aktionen/modulwerkzeuge";
import { requireStaff } from "@/lib/auth";
import { istToken } from "@/lib/codes";
import { createClient } from "@/lib/supabase/server";
import { teamLocale, type TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";

export const metadata: Metadata = { title: "Sitzung | SES Academy" };

type Hinweise = Record<string, { text: string; gut: boolean }>;
const hinweiseFuer = (l: TeamSprache, angelegt: string): Hinweise => ({
  angelegt: { text: angelegt, gut: true },
  gespeichert: { text: teamTexte[l].meldung.gespeichert, gut: true },
  aufgabe: { text: teamTexte[l].meldung.gespeichert, gut: true },
  eingabe: { text: teamTexte[l].meldung.eingabe, gut: false },
  fehler: { text: teamTexte[l].meldung.fehler, gut: false },
});

const de = {
  hinweise: hinweiseFuer("de", "Sitzung angelegt. Jetzt Protokoll, Beschlüsse und Aufgaben eintragen."),
  kommission: "Kommission",
  anwesend: "Anwesend",
  protokoll: "Protokoll",
  beschluesse: "Beschlüsse",
  keineBeschluesse: "Noch keine Beschlüsse.",
  beschluss: "Beschluss",
  aufgaben: "Aufgaben",
  wiederOeffnen: (titel: string) => `„${titel}“ wieder öffnen`,
  erledigt: (titel: string) => `„${titel}“ erledigt`,
  wasTun: "Was ist zu tun?",
  aufgabe: "Aufgabe",
  frist: "Frist",
  zustaendig: "Zuständig",
  niemand: "zuständig: niemand",
  aufgabeHinzufuegen: "Aufgabe hinzufügen",
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    hinweise: hinweiseFuer("tr", "Toplantı oluşturuldu. Şimdi tutanağı, kararları ve görevleri gir."),
    kommission: "Komisyon",
    anwesend: "Katılanlar",
    protokoll: "Tutanak",
    beschluesse: "Kararlar",
    keineBeschluesse: "Henüz karar yok.",
    beschluss: "Karar",
    aufgaben: "Görevler",
    wiederOeffnen: (titel) => `“${titel}” görevini yeniden aç`,
    erledigt: (titel) => `“${titel}” görevini tamamlandı olarak işaretle`,
    wasTun: "Ne yapılacak?",
    aufgabe: "Görev",
    frist: "Son tarih",
    zustaendig: "Sorumlu",
    niemand: "sorumlu: kimse",
    aufgabeHinzufuegen: "Görev ekle",
  },
  fr: {
    hinweise: hinweiseFuer("fr", "Réunion créée. Saisis maintenant le compte rendu, les décisions et les tâches."),
    kommission: "Commission",
    anwesend: "Présents",
    protokoll: "Compte rendu",
    beschluesse: "Décisions",
    keineBeschluesse: "Pas encore de décisions.",
    beschluss: "Décision",
    aufgaben: "Tâches",
    wiederOeffnen: (titel) => `Rouvrir «\u00a0${titel}\u00a0»`,
    erledigt: (titel) => `Marquer «\u00a0${titel}\u00a0» comme faite`,
    wasTun: "Que faut-il faire\u00a0?",
    aufgabe: "Tâche",
    frist: "Échéance",
    zustaendig: "Responsable",
    niemand: "responsable\u00a0: personne",
    aufgabeHinzufuegen: "Ajouter une tâche",
  },
};

/** Eine Sitzung: Protokoll, Beschlüsse, Aufgaben mit Zuständigen und Fristen (erscheinen auf der Startseite). */
export default async function Sitzung({ params, searchParams }: PageProps<"/team/sitzungen/[id]">) {
  const staff = await requireStaff("orga");
  const l = staff.sprache;
  const t = T[l];
  const w = teamTexte[l].wort;
  const datum = new Intl.DateTimeFormat(teamLocale[l], { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const { id } = await params;
  const { hinweis } = await searchParams;
  if (!istToken(id)) notFound();
  const supabase = await createClient();
  const [{ data: s }, { data: team }] = await Promise.all([
    supabase.from("meetings").select("*, meeting_decisions(id, text, created_at), tasks(id, title, due_date, done_at, assignee_user, assignee_name)").eq("id", id).maybeSingle(),
    supabase.rpc("get_team_members"),
  ]);
  if (!s) notFound();
  const name = new Map((team ?? []).map((t) => [t.user_id, t.display_name]));
  const beschluesse = [...s.meeting_decisions].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const aufgaben = [...s.tasks].sort((a, b) => (a.due_date ?? "9").localeCompare(b.due_date ?? "9"));

  return (
    <>
      <TeamKopf staff={staff} aktiv="sitzungen" />
      <main lang={l} className="mx-auto max-w-4xl px-4 py-8">
        <Link href="/team/sitzungen/" className="text-sm font-semibold text-ink-soft hover:text-ink">← {teamTexte[l].bereiche.sitzungen}</Link>
        <h1 className="font-display mt-2 text-3xl font-bold">{s.title}</h1>
        <Hinweis code={hinweis} texte={t.hinweise} />

        <section className="karte mt-6">
          <form action={sitzungSpeichern} className="grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="id" value={id} />
            <div className="sm:col-span-2"><label className="etikett" htmlFor="title">{w.titel}</label><input id="title" name="title" required defaultValue={s.title} className="feld" /></div>
            <div><label className="etikett" htmlFor="held_on">{w.datum}</label><input id="held_on" name="held_on" type="date" required defaultValue={s.held_on} className="feld" /></div>
            <div><label className="etikett" htmlFor="commission">{t.kommission}</label><input id="commission" name="commission" defaultValue={s.commission ?? ""} className="feld" /></div>
            <div className="sm:col-span-2"><label className="etikett" htmlFor="attendees">{t.anwesend}</label><input id="attendees" name="attendees" defaultValue={s.attendees} className="feld" /></div>
            <div className="sm:col-span-3"><label className="etikett" htmlFor="protocol">{t.protokoll}</label><textarea id="protocol" name="protocol" rows={10} defaultValue={s.protocol} className="feld" /></div>
            <div className="sm:col-span-3"><button type="submit" className="knopf-hell">{w.speichern}</button></div>
          </form>
        </section>

        <script dangerouslySetInnerHTML={{ __html: "document.addEventListener('submit',function(e){var f=e.target;if(!f.hasAttribute||!f.hasAttribute('data-mit-protokoll'))return;var t=document.getElementById('protocol');var h=f.querySelector('input[name=protocol]');if(t&&h)h.value=t.value;},true)" }} />
        <section id="beschluesse" className="karte mt-6">
          <h2 className="font-display text-xl font-bold">{t.beschluesse}</h2>
          <ol className="mt-3 list-decimal space-y-1 pl-5">{beschluesse.map((b) => <li key={b.id}>{b.text}</li>)}</ol>
          {beschluesse.length === 0 && <p className="mt-2 text-ink-soft">{t.keineBeschluesse}</p>}
          <form action={beschlussHinzufuegen} data-mit-protokoll className="mt-3 flex gap-2">
            <input type="hidden" name="protocol" defaultValue={s.protocol} />
            <input type="hidden" name="meeting_id" value={id} />
            <input name="text" required placeholder={t.beschluss} className="feld" aria-label={t.beschluss} />
            <button type="submit" className="knopf-hell">{w.hinzufuegen}</button>
          </form>
        </section>

        <section id="aufgaben" className="karte mt-6">
          <h2 className="font-display text-xl font-bold">{t.aufgaben}</h2>
          <ul className="mt-3 space-y-2">
            {aufgaben.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2">
                <form action={aufgabeUmschalten}>
                  <input type="hidden" name="id" value={a.id} /><input type="hidden" name="erledigt" value={a.done_at ? "0" : "1"} />
                  <input type="hidden" name="zurueck" value={`/team/sitzungen/${id}/`} />
                  <button type="submit" aria-label={a.done_at ? t.wiederOeffnen(a.title) : t.erledigt(a.title)} className={`flex h-6 w-6 items-center justify-center rounded-full ring-2 ${a.done_at ? "bg-ink text-paper ring-ink" : "ring-line"}`}>{a.done_at ? "✓" : ""}</button>
                </form>
                <span className={`mr-auto ${a.done_at ? "line-through text-ink-soft" : "font-semibold"}`}>{a.title}</span>
                <span className="text-sm text-ink-soft">{[a.assignee_user ? name.get(a.assignee_user) : a.assignee_name, a.due_date && datum.format(new Date(`${a.due_date}T12:00:00Z`))].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
          </ul>
          <form action={sitzungsAufgabe} data-mit-protokoll className="mt-4 grid gap-2 sm:grid-cols-4">
            <input type="hidden" name="protocol" defaultValue={s.protocol} />
            <input type="hidden" name="meeting_id" value={id} />
            <input name="title" required placeholder={t.wasTun} className="feld sm:col-span-2" aria-label={t.aufgabe} />
            <input name="due_date" type="date" className="feld" aria-label={t.frist} />
            <select name="assignee_user" defaultValue="" className="feld" aria-label={t.zustaendig}><option value="">{t.niemand}</option>{(team ?? []).map((t) => <option key={t.user_id} value={t.user_id}>{t.display_name}</option>)}</select>
            <div className="sm:col-span-4"><button type="submit" className="knopf-hell">{t.aufgabeHinzufuegen}</button></div>
          </form>
        </section>
      </main>
    </>
  );
}
