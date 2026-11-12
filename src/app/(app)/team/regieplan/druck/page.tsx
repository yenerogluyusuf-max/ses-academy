import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Drucken } from "./Drucken";
import { punktEnde, zustaendigWaehrend } from "@/lib/ablauf";
import { darf, getStaff, requireStaff } from "@/lib/auth";
import { uhrzeit } from "@/lib/einlass";
import { ladeModultage } from "@/lib/eventtag";
import { createClient } from "@/lib/supabase/server";
import { teamLocale, type TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";

const de = {
  seitentitel: "Regieplan drucken | SES Academy",
  titel: "Regieplan",
  stand: (datum: string) => `Stand ${datum}`,
  zeit: "Zeit",
  programmpunkt: "Programmpunkt",
  zustaendig: "Zuständig",
  entfaellt: " (entfällt)",
  teamDesTages: "Team des Tages",
  niemand: "Noch niemand eingeteilt.",
  leitung: " · Leitung",
  ganztaegig: "ganztägig",
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    seitentitel: "Akış planını yazdır | SES Academy",
    titel: teamTexte.tr.bereiche.regieplan,
    stand: (datum) => `${datum} itibarıyla`,
    zeit: "Saat",
    programmpunkt: "Program maddesi",
    zustaendig: "Sorumlu",
    entfaellt: " (yapılmayacak)",
    teamDesTages: "Günün ekibi",
    niemand: "Henüz kimse atanmadı.",
    leitung: " · Lider",
    ganztaegig: "tüm gün",
  },
  fr: {
    seitentitel: "Imprimer le déroulé | SES Academy",
    titel: teamTexte.fr.bereiche.regieplan,
    stand: (datum) => `Mis à jour le ${datum}`,
    zeit: "Horaire",
    programmpunkt: "Point du programme",
    zustaendig: "Responsable",
    entfaellt: " (annulé)",
    teamDesTages: "Équipe du jour",
    niemand: "Personne n’est encore affecté.",
    leitung: " · Coordination",
    ganztaegig: "toute la journée",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const l = (await getStaff())?.sprache ?? "de";
  return { title: T[l].seitentitel };
}

/** Regieplan und Rollenplan eines Tages auf A4 quer: Zeit, Programmpunkt, Zuständige; darunter das Team mit Telefon. */
export default async function RegieplanDruck({ searchParams }: PageProps<"/team/regieplan/druck">) {
  const staff = await requireStaff("einlass");
  const l = staff.sprache;
  const t = T[l];
  const tagFormat = new Intl.DateTimeFormat(teamLocale[l], { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" });
  const standFormat = new Intl.DateTimeFormat(teamLocale[l], { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Berlin" });
  const { tag: gewaehlt } = await searchParams;
  const { tage } = await ladeModultage(staff.modulId);
  const tag = tage.find((x) => x.id === gewaehlt);
  if (!tag) notFound();
  const mitTeam = darf.orga(staff.role);
  const supabase = await createClient();
  const [{ data: punkte }, { data: einsaetzeRoh }] = await Promise.all([
    supabase.from("program_items").select("*").eq("module_day_id", tag.id).order("starts_at"),
    mitTeam
      ? supabase.from("duty_assignments").select("*").eq("module_day_id", tag.id).order("is_lead", { ascending: false }).order("starts_at", { nullsFirst: true }).order("person_name")
      : Promise.resolve({ data: [] }),
  ]);
  const liste = punkte ?? [];
  const einsaetze = einsaetzeRoh ?? [];

  return (
    <main lang={l} className="mx-auto max-w-[1100px] bg-white px-8 py-8 text-[13px] text-ink print:max-w-none print:p-0">
      <style>{"@page { size: A4 landscape; margin: 12mm; } @media print { body { background: white !important; padding: 0 !important; } }"}</style>
      <div className="mb-5 flex items-end justify-between gap-4 border-b-2 border-ink pb-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{t.titel} · {tag.module.title}</p>
          <h1 className="font-display text-2xl font-extrabold">{tagFormat.format(new Date(tag.starts_at))}</h1>
        </div>
        <div className="text-right">
          <Drucken sprache={l} />
          <p className="mt-1 text-xs text-ink-soft">{t.stand(standFormat.format(new Date()))}</p>
        </div>
      </div>

      <div className={`grid gap-6 ${mitTeam ? "grid-cols-[minmax(0,1fr)_17rem]" : ""}`}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left text-[11px] tracking-wide text-ink-soft uppercase">
              <th className="w-24 border-b border-line py-1.5 pr-2">{t.zeit}</th>
              <th className="border-b border-line py-1.5 pr-2">{t.programmpunkt}</th>
              {mitTeam && <th className="w-[38%] border-b border-line py-1.5">{t.zustaendig}</th>}
            </tr>
          </thead>
          <tbody>
            {liste.map((p, i) => {
              const wer = zustaendigWaehrend(liste, i, einsaetze);
              const entfaellt = p.status === "entfaellt";
              return (
                <tr key={p.id} className={`break-inside-avoid align-top ${entfaellt ? "text-ink-soft line-through" : ""}`}>
                  <td className="border-b border-line py-1.5 pr-2 font-mono font-semibold tabular-nums">
                    {uhrzeit(p.starts_at, false)}–{uhrzeit(new Date(punktEnde(liste, i)).toISOString(), false)}
                  </td>
                  <td className="border-b border-line py-1.5 pr-2">
                    <span className="font-semibold">{p.title}</span>{entfaellt && t.entfaellt}
                    {(p.room || p.note) && <span className="block text-xs text-ink-soft">{[p.room, p.note].filter(Boolean).join(" · ")}</span>}
                  </td>
                  {mitTeam && (
                    <td className="border-b border-line py-1.5 text-xs">
                      {[p.responsible, ...wer.map((e) => `${e.person_name} (${e.task})`)].filter(Boolean).join(", ") || "–"}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {mitTeam && (
          <aside className="break-inside-avoid">
            <h2 className="border-b border-line pb-1.5 text-[11px] font-semibold tracking-wide text-ink-soft uppercase">{t.teamDesTages}</h2>
            {einsaetze.length === 0 && <p className="py-2 text-ink-soft">{t.niemand}</p>}
            <ul>
              {einsaetze.map((e) => (
                <li key={e.id} className={`border-b border-line py-1.5 ${e.is_lead ? "font-semibold" : ""}`}>
                  {e.person_name}{e.is_lead && t.leitung}
                  <span className="block text-xs font-normal text-ink-soft">
                    {e.task} · {e.starts_at ? `${uhrzeit(e.starts_at, false)}${e.ends_at ? `–${uhrzeit(e.ends_at, false)}` : ""}` : t.ganztaegig}{e.phone ? ` · ${e.phone}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </main>
  );
}
