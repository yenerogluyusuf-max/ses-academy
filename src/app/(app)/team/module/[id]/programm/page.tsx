import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ModulReiter } from "@/components/team/ModulReiter";
import { TeamKopf } from "@/components/team/TeamKopf";
import { requireStaff } from "@/lib/auth";
import { istToken } from "@/lib/codes";
import { uhrzeit } from "@/lib/einlass";
import { programmStatus } from "@/lib/eventtag";
import { createClient } from "@/lib/supabase/server";
import { teamLocale, type TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";

export const metadata: Metadata = { title: "Programm | SES Academy" };

type ProgrammStatus = keyof typeof programmStatus;

const de = {
  hinweis: "Die Tagesordnung für Teilnehmende entsteht aus diesem Programm und den Kurzprofilen der Referenten.",
  drucken: "Tagesordnung drucken / als PDF",
  keineTermine: "Noch keine Termine. Termine trägt man in der Übersicht ein.",
  imRegieplan: "Im Regieplan bearbeiten",
  keinProgramm: "Noch kein Programm.",
  zeit: "Zeit", punkt: "Programmpunkt", raum: "Raum", verantwortlich: "Verantwortlich",
  status: Object.fromEntries(Object.entries(programmStatus).map(([k, v]) => [k, v.name])) as Record<ProgrammStatus, string>,
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    hinweis: "Katılımcılar için gündem bu programdan ve konuşmacıların kısa profillerinden oluşur.",
    drucken: "Gündemi yazdır / PDF olarak",
    keineTermine: "Henüz tarih yok. Tarihler genel bakış sayfasında girilir.",
    imRegieplan: "Akış planında düzenle",
    keinProgramm: "Henüz program yok.",
    zeit: "Saat", punkt: "Program maddesi", raum: "Salon", verantwortlich: "Görevli",
    status: { geplant: "planlandı", laeuft: "sürüyor", erledigt: "tamamlandı", verschoben: "ertelendi", entfaellt: "iptal" },
  },
  fr: {
    hinweis: "L’ordre du jour des participants est généré à partir de ce programme et des bios des intervenants.",
    drucken: "Imprimer l’ordre du jour / en PDF",
    keineTermine: "Pas encore de dates. Les dates se saisissent dans l’aperçu.",
    imRegieplan: "Modifier dans le déroulé",
    keinProgramm: "Pas encore de programme.",
    zeit: "Heure", punkt: "Point du programme", raum: "Salle", verantwortlich: "Responsable",
    status: { geplant: "prévu", laeuft: "en cours", erledigt: "terminé", verschoben: "reporté", entfaellt: "annulé" },
  },
};

/** Programm aller Modultage auf einen Blick; gepflegt wird es im Regieplan des jeweiligen Tages. */
export default async function Programm({ params }: PageProps<"/team/module/[id]/programm">) {
  const staff = await requireStaff("orga");
  const l = staff.sprache;
  const t = T[l];
  // wie tagBezeichnung in lib/eventtag, mit dem Datum in der Sprache des Team-Bereichs
  const tagFormat = new Intl.DateTimeFormat(teamLocale[l], { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Berlin" });
  const tagBezeichnung = (tag: { starts_at: string; label?: string | null }, modul: string) =>
    `${modul} · ${tagFormat.format(new Date(tag.starts_at))}${tag.label ? ` · ${tag.label}` : ""}`;
  const { id } = await params;
  if (!istToken(id)) notFound();
  const supabase = await createClient();
  const { data: modul } = await supabase
    .from("modules")
    .select("id, title, module_days(id, day, starts_at, ends_at, label, program_items(id, starts_at, ends_at, title, room, responsible, status))")
    .eq("id", id)
    .maybeSingle();
  if (!modul) notFound();
  const tage = [...modul.module_days].sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  return (
    <>
      <TeamKopf staff={staff} aktiv="module" breit />
      <main lang={l} className="mx-auto max-w-5xl px-4 py-8">
        <ModulReiter id={id} titel={modul.title} aktiv="programm/" />
        {tage.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <p className="mr-auto text-sm text-ink-soft">{t.hinweis}</p>
            <Link href={`/team/module/${id}/tagesordnung/`} target="_blank" className="knopf">{t.drucken}</Link>
          </div>
        )}
        {tage.length === 0 && <p className="karte">{t.keineTermine}</p>}
        <div className="space-y-6">
          {tage.map((tag) => {
            const punkte = [...tag.program_items].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
            return (
              <section key={tag.id} className="karte">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display mr-auto text-xl font-bold">{tagBezeichnung(tag, modul.title)}</h2>
                  <Link href={`/team/regieplan/?tag=${tag.id}`} className="knopf-hell">{t.imRegieplan}</Link>
                </div>
                {punkte.length === 0 ? <p className="mt-3 text-ink-soft">{t.keinProgramm}</p> : (
                  <table className="tabelle mt-3">
                    <thead><tr><th>{t.zeit}</th><th>{t.punkt}</th><th>{t.raum}</th><th>{t.verantwortlich}</th><th>{teamTexte[l].wort.status}</th></tr></thead>
                    <tbody>
                      {punkte.map((p) => (
                        <tr key={p.id}>
                          <td className="font-mono whitespace-nowrap">{uhrzeit(p.starts_at, false, l)}{p.ends_at ? `–${uhrzeit(p.ends_at, false, l)}` : ""}</td>
                          <td className={p.status === "entfaellt" ? "line-through" : "font-semibold"}>{p.title}</td>
                          <td>{p.room}</td><td>{p.responsible}</td><td>{t.status[p.status]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            );
          })}
        </div>
      </main>
    </>
  );
}
