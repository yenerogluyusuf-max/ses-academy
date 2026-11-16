import Link from "next/link";
import { darf, getStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { TeamSprache } from "@/lib/team-sprache";
import { jetztMs } from "@/lib/zeit";

type Reiter = "ueberblick" | "einlass" | "teilnehmende" | "programm" | "referenten" | "gruppen" | "unterkunft" | "kosten" | "material" | "auswertung";

/**
 * Reiter eines Moduls (Umbau 16.11.2026): alles, was zu einem Modul gehört, bleibt im Modul.
 * „Teilnehmende“ zeigt nur die Personen dieses Moduls (früher Sprung in die allgemeine Liste), „Unterkunft“ fasst
 * Hotel und Zimmerplan zusammen, „Auswertung“ bündelt Anwesenheit und Feedback des Moduls. Die Checkliste ist entfallen.
 * pfade: weitere Unterseiten, die zum selben Reiter gehören (Zimmerplan gehört zu Unterkunft).
 */
const reiter: readonly { pfad: string; id: Reiter; auch?: string[] }[] = [
  { pfad: "", id: "ueberblick" },
  { pfad: "einlass", id: "einlass" },
  { pfad: "teilnehmende/", id: "teilnehmende" },
  { pfad: "programm/", id: "programm" },
  { pfad: "referenten/", id: "referenten" },
  { pfad: "gruppen/", id: "gruppen" },
  { pfad: "hotel/", id: "unterkunft", auch: ["zimmerplan/"] },
  { pfad: "kosten/", id: "kosten" },
  { pfad: "material/", id: "material" },
  { pfad: "auswertung/", id: "auswertung" },
];

const T: Record<TeamSprache, Record<Reiter, string> & { alle: string; navi: string }> = {
  de: {
    ueberblick: "Überblick", einlass: "Einlass", teilnehmende: "Teilnehmende", programm: "Programm", referenten: "Referenten", gruppen: "Gruppen",
    unterkunft: "Unterkunft", kosten: "Kosten", material: "Material", auswertung: "Auswertung",
    alle: "Alle Module", navi: "Bereiche des Moduls",
  },
  tr: {
    ueberblick: "Özet", einlass: "Giriş", teilnehmende: "Katılımcılar", programm: "Program", referenten: "Konuşmacılar", gruppen: "Gruplar",
    unterkunft: "Konaklama", kosten: "Masraflar", material: "Materyal", auswertung: "Değerlendirme",
    alle: "Tüm modüller", navi: "Modülün bölümleri",
  },
  fr: {
    ueberblick: "Vue d’ensemble", einlass: "Accueil", teilnehmende: "Participants", programm: "Programme", referenten: "Intervenants", gruppen: "Groupes",
    unterkunft: "Hébergement", kosten: "Coûts", material: "Supports", auswertung: "Analyse",
    alle: "Tous les modules", navi: "Sections du module",
  },
};

/**
 * Kopf eines Moduls mit Reitern. Admin/Vorstand sehen alle Reiter; das Orga-Team (z. B. auf ein Modul begrenzt)
 * sieht die Reiter ohne Überblick und Auswertung.
 * Sprache: die des angemeldeten Teamkontos.
 */
export async function ModulReiter({ id, titel, aktiv, untertitel }: { id: string; titel: string; aktiv: string; untertitel?: React.ReactNode }) {
  const staff = await getStaff();
  const alles = staff ? darf.alles(staff.role) : false;
  const t = T[staff?.sprache ?? "de"];
  const sichtbar = reiter.filter((r) => alles || (r.id !== "ueberblick" && r.id !== "auswertung"));
  // Einlass gehört zum Modul (Umbau 16.11.2026): Reiter führt zum Einlass des passenden Tages (läuft gerade, sonst der
  // nächste, sonst der letzte); die Einlass-Seite zeigt dann denselben Modulkopf.
  const { data: tage } = await (await createClient()).from("module_days").select("id, starts_at, ends_at").eq("module_id", id).order("starts_at");
  const jetzt = jetztMs();
  const tag = (tage ?? []).find((x) => jetzt >= Date.parse(x.starts_at) - 4 * 3_600_000 && jetzt <= Date.parse(x.ends_at) + 6 * 3_600_000)
    ?? (tage ?? []).find((x) => Date.parse(x.ends_at) > jetzt) ?? (tage ?? []).at(-1);
  const ziel = (r: (typeof reiter)[number]) => (r.id === "einlass" ? `/team/einlass/?tag=${tag?.id ?? ""}` : `/team/module/${id}/${r.pfad}`);
  return (
    <div className="mb-6">
      <Link href="/team/module/" className="text-sm font-semibold text-ink-soft hover:text-ink">← {t.alle}</Link>
      <h1 className="font-display mt-2 text-3xl font-bold">{titel}</h1>
      {untertitel && <div className="mt-1 text-ink-soft">{untertitel}</div>}
      <nav aria-label={t.navi} className="mt-4 flex gap-1 overflow-x-auto border-b border-line pb-px">
        {sichtbar.filter((r) => r.id !== "einlass" || tag).map((r) => {
          const an = aktiv === r.pfad || (r.auch ?? []).includes(aktiv);
          return (
            <Link key={r.pfad} href={ziel(r)} aria-current={an ? "page" : undefined}
              className={`shrink-0 rounded-t-2xl px-4 py-2 text-sm font-semibold ${an ? "bg-ink text-paper" : "hover:bg-paper-deep"}`}>
              {t[r.id]}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
