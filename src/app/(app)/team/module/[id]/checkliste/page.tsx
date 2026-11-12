import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Hinweis } from "@/components/team/Hinweis";
import { ModulReiter } from "@/components/team/ModulReiter";
import { Rueckfrage } from "@/components/team/Rueckfrage";
import { TeamKopf } from "@/components/team/TeamKopf";
import { aufgabeEntfernen, aufgabeSpeichern, aufgabeUmschalten, checklisteAnlegen } from "@/lib/aktionen/modulwerkzeuge";
import { requireStaff } from "@/lib/auth";
import { istToken } from "@/lib/codes";
import { createClient } from "@/lib/supabase/server";
import { teamLocale, type TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";
import { jetztMs } from "@/lib/zeit";

export const metadata: Metadata = { title: "Checkliste | SES Academy" };

const de = {
  hinweise: {
    aufgabe: { text: "Gespeichert.", gut: true },
    "aufgabe-entfernt": { text: "Aufgabe entfernt.", gut: true },
    eingabe: { text: "Bitte die Angaben prüfen.", gut: false },
    fehler: { text: "Das hat nicht geklappt.", gut: false },
  } as Record<string, { text: string; gut: boolean }>,
  angelegt: (n: number) => `${n} Aufgaben aus der Vorlage angelegt.`,
  stand: (erledigt: number, alle: number) => `${erledigt} von ${alle} erledigt`,
  ueberfaellig: (n: number) => ` · ${n} überfällig`,
  ergaenzen: "Fehlende Aufgaben aus der Vorlage ergänzen",
  anlegen: "Checkliste aus der Vorlage anlegen",
  ohneTermine: "Zuerst Termine eintragen; die Fristen richten sich nach dem ersten und letzten Modultag.",
  wiederOeffnen: (titel: string) => `„${titel}“ wieder öffnen`,
  erledigt: (titel: string) => `„${titel}“ erledigt`,
  bearbeiten: "bearbeiten",
  aufgabe: "Aufgabe", frist: "Frist", zustaendig: "Zuständig", niemand: "zuständig: niemand", kommission: "Kommission",
  ohneKonto: "oder Name ohne Konto", zustaendigOhneKonto: "Zuständig ohne Konto",
  entfernen: "entfernen", entfernenJa: "Ja, entfernen", entfernenFrage: (titel: string) => `Aufgabe „${titel}“ entfernen?`,
  eigene: "Eigene Aufgabe", wasTun: "Was ist zu tun?",
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    hinweise: {
      aufgabe: { text: teamTexte.tr.meldung.gespeichert, gut: true },
      "aufgabe-entfernt": { text: "Görev kaldırıldı.", gut: true },
      eingabe: { text: teamTexte.tr.meldung.eingabe, gut: false },
      fehler: { text: teamTexte.tr.meldung.fehler, gut: false },
    },
    angelegt: (n) => `Şablondan ${n} görev oluşturuldu.`,
    stand: (erledigt, alle) => `${alle} görevden ${erledigt} tanesi tamamlandı`,
    ueberfaellig: (n) => ` · ${n} gecikmiş`,
    ergaenzen: "Eksik görevleri şablondan tamamla",
    anlegen: "Kontrol listesini şablondan oluştur",
    ohneTermine: "Önce tarihleri gir; son tarihler modülün ilk ve son gününe göre belirlenir.",
    wiederOeffnen: (titel) => `“${titel}” görevini yeniden aç`,
    erledigt: (titel) => `“${titel}” görevini tamamlandı olarak işaretle`,
    bearbeiten: "düzenle",
    aufgabe: "Görev", frist: "Son tarih", zustaendig: "Görevli", niemand: "görevli: kimse yok", kommission: "Komisyon",
    ohneKonto: "ya da hesabı olmayan kişinin adı", zustaendigOhneKonto: "Hesabı olmayan görevli",
    entfernen: "kaldır", entfernenJa: "Evet, kaldır", entfernenFrage: (titel) => `“${titel}” görevi kaldırılsın mı?`,
    eigene: "Kendi görevin", wasTun: "Ne yapılacak?",
  },
  fr: {
    hinweise: {
      aufgabe: { text: teamTexte.fr.meldung.gespeichert, gut: true },
      "aufgabe-entfernt": { text: "Tâche supprimée.", gut: true },
      eingabe: { text: teamTexte.fr.meldung.eingabe, gut: false },
      fehler: { text: teamTexte.fr.meldung.fehler, gut: false },
    },
    angelegt: (n) => `${n} tâches créées à partir du modèle.`,
    stand: (erledigt, alle) => `${erledigt} sur ${alle} terminées`,
    ueberfaellig: (n) => ` · ${n} en retard`,
    ergaenzen: "Ajouter les tâches manquantes du modèle",
    anlegen: "Créer la check-list à partir du modèle",
    ohneTermine: "Ajoute d’abord les dates\u00a0; les échéances dépendent du premier et du dernier jour du module.",
    wiederOeffnen: (titel) => `Rouvrir «\u00a0${titel}\u00a0»`,
    erledigt: (titel) => `Marquer «\u00a0${titel}\u00a0» comme terminée`,
    bearbeiten: "modifier",
    aufgabe: "Tâche", frist: "Échéance", zustaendig: "Responsable", niemand: "responsable\u00a0: personne", kommission: "Commission",
    ohneKonto: "ou nom sans compte", zustaendigOhneKonto: "Responsable sans compte",
    entfernen: "supprimer", entfernenJa: "Oui, supprimer", entfernenFrage: (titel) => `Supprimer la tâche «\u00a0${titel}\u00a0»\u00a0?`,
    eigene: "Autre tâche", wasTun: "Que faut-il faire\u00a0?",
  },
};

/** Checkliste eines Moduls: Aufgaben aus der Vorlage mit Fristen und Zuständigen, dazu eigene Aufgaben. */
export default async function Checkliste({ params, searchParams }: PageProps<"/team/module/[id]/checkliste">) {
  const staff = await requireStaff("orga");
  const l = staff.sprache;
  const t = T[l];
  const w = teamTexte[l].wort;
  const datum = new Intl.DateTimeFormat(teamLocale[l], { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const { id } = await params;
  const { hinweis } = await searchParams;
  if (!istToken(id)) notFound();
  const supabase = await createClient();
  const [{ data: modul }, { data: aufgaben }, { data: team }] = await Promise.all([
    supabase.from("modules").select("id, title, module_days(day)").eq("id", id).maybeSingle(),
    supabase.from("tasks").select("*").eq("module_id", id).order("due_date", { nullsFirst: false }).order("created_at"),
    supabase.rpc("get_team_members"),
  ]);
  if (!modul) notFound();
  const angelegt = typeof hinweis === "string" && hinweis.startsWith("angelegt-") ? Number(hinweis.split("-")[1]) : null;
  const heute = new Date(jetztMs()).toISOString().slice(0, 10);
  const liste = aufgaben ?? [];
  const offen = liste.filter((a) => !a.done_at);
  const ueberfaellig = offen.filter((a) => a.due_date && a.due_date < heute);
  const namen = new Map((team ?? []).map((x) => [x.user_id, x.display_name]));

  return (
    <>
      <TeamKopf staff={staff} aktiv="module" breit />
      <main lang={l} className="mx-auto max-w-5xl px-4 py-8">
        <ModulReiter id={id} titel={modul.title} aktiv="checkliste/" />
        <Hinweis code={angelegt !== null ? undefined : hinweis} texte={t.hinweise} />
        {angelegt !== null && <p role="status" className="mt-4 rounded-2xl bg-emerald-100 p-4 text-emerald-950">{t.angelegt(angelegt)}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="mr-auto text-ink-soft">{t.stand(liste.length - offen.length, liste.length)}{ueberfaellig.length ? t.ueberfaellig(ueberfaellig.length) : ""}</p>
          {modul.module_days.length > 0 && (
            <form action={checklisteAnlegen}>
              <input type="hidden" name="module_id" value={id} />
              <button type="submit" className={liste.length ? "knopf-hell" : "knopf"}>{liste.length ? t.ergaenzen : t.anlegen}</button>
            </form>
          )}
        </div>
        {modul.module_days.length === 0 && <p className="karte mt-4">{t.ohneTermine}</p>}

        <ul className="mt-6 space-y-2">
          {liste.map((a) => {
            const zuSpaet = !a.done_at && a.due_date && a.due_date < heute;
            return (
              <li key={a.id} className={`rounded-2xl px-4 py-3 ring-1 ring-line ${a.done_at ? "bg-paper-deep/60" : zuSpaet ? "bg-rot-hell" : "bg-weiss"}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <form action={aufgabeUmschalten}>
                    <input type="hidden" name="id" value={a.id} /><input type="hidden" name="erledigt" value={a.done_at ? "0" : "1"} />
                    <input type="hidden" name="zurueck" value={`/team/module/${id}/checkliste/`} />
                    <button type="submit" aria-label={a.done_at ? t.wiederOeffnen(a.title) : t.erledigt(a.title)} className={`flex h-7 w-7 items-center justify-center rounded-full ring-2 ${a.done_at ? "bg-ink text-paper ring-ink" : "ring-line"}`}>{a.done_at ? "✓" : ""}</button>
                  </form>
                  <span className={`mr-auto font-semibold ${a.done_at ? "line-through text-ink-soft" : ""}`}>{a.title}</span>
                  {a.commission && <span className="chip bg-paper-deep">{a.commission}</span>}
                  <span className="text-sm text-ink-soft">{a.assignee_user ? namen.get(a.assignee_user) : a.assignee_name}</span>
                  {a.due_date && <span className={`text-sm ${zuSpaet ? "font-semibold text-rot" : "text-ink-soft"}`}>{datum.format(new Date(`${a.due_date}T12:00:00Z`))}</span>}
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-semibold text-ink-soft">{t.bearbeiten}</summary>
                  <form action={aufgabeSpeichern} className="mt-2 grid gap-2 sm:grid-cols-4">
                    <input type="hidden" name="id" value={a.id} /><input type="hidden" name="module_id" value={id} />
                    <input name="title" defaultValue={a.title} required className="feld sm:col-span-2" aria-label={t.aufgabe} />
                    <input name="due_date" type="date" defaultValue={a.due_date ?? ""} className="feld" aria-label={t.frist} />
                    <select name="assignee_user" defaultValue={a.assignee_user ?? ""} className="feld" aria-label={t.zustaendig}>
                      <option value="">{t.niemand}</option>{(team ?? []).map((x) => <option key={x.user_id} value={x.user_id}>{x.display_name}</option>)}
                    </select>
                    <input name="commission" defaultValue={a.commission ?? ""} placeholder={t.kommission} className="feld" aria-label={t.kommission} />
                    <input name="assignee_name" defaultValue={a.assignee_name ?? ""} placeholder={t.ohneKonto} className="feld" aria-label={t.zustaendigOhneKonto} />
                    <input name="notes" defaultValue={a.notes} placeholder={w.notiz} className="feld sm:col-span-2" aria-label={w.notiz} />
                    <div className="flex gap-3 sm:col-span-4"><button type="submit" className="knopf-hell">{w.speichern}</button></div>
                  </form>
                  <form action={aufgabeEntfernen} className="mt-1 flex flex-wrap">
                    <input type="hidden" name="id" value={a.id} /><input type="hidden" name="module_id" value={id} />
                    <Rueckfrage knopf={t.entfernen} knopfKlasse="text-xs font-semibold text-ink-soft underline" gefahr ja={t.entfernenJa} frage={t.entfernenFrage(a.title)} sprache={l} />
                  </form>
                </details>
              </li>
            );
          })}
        </ul>

        <section className="karte mt-8">
          <h2 className="font-display text-xl font-bold">{t.eigene}</h2>
          <form action={aufgabeSpeichern} className="mt-3 grid gap-2 sm:grid-cols-4">
            <input type="hidden" name="module_id" value={id} />
            <input name="title" required placeholder={t.wasTun} className="feld sm:col-span-2" aria-label={t.aufgabe} />
            <input name="due_date" type="date" className="feld" aria-label={t.frist} />
            <select name="assignee_user" defaultValue="" className="feld" aria-label={t.zustaendig}>
              <option value="">{t.niemand}</option>{(team ?? []).map((x) => <option key={x.user_id} value={x.user_id}>{x.display_name}</option>)}
            </select>
            <div className="sm:col-span-4"><button type="submit" className="knopf">{w.hinzufuegen}</button></div>
          </form>
        </section>
      </main>
    </>
  );
}
