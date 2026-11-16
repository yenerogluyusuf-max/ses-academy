import Link from "next/link";
import { darf, getStaff } from "@/lib/auth";
import type { TeamSprache } from "@/lib/team-sprache";

type Reiter = "ueberblick" | "teilnehmende" | "programm" | "referenten" | "gruppen" | "unterkunft" | "kosten" | "material" | "auswertung";

/**
 * Reiter eines Moduls (Umbau 16.11.2026): alles, was zu einem Modul gehört, bleibt im Modul.
 * „Teilnehmende“ zeigt nur die Personen dieses Moduls (früher Sprung in die allgemeine Liste), „Unterkunft“ fasst
 * Hotel und Zimmerplan zusammen, „Auswertung“ bündelt Anwesenheit und Feedback des Moduls. Die Checkliste ist entfallen.
 * pfade: weitere Unterseiten, die zum selben Reiter gehören (Zimmerplan gehört zu Unterkunft).
 */
const reiter: readonly { pfad: string; id: Reiter; auch?: string[] }[] = [
  { pfad: "", id: "ueberblick" },
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
    ueberblick: "Überblick", teilnehmende: "Teilnehmende", programm: "Programm", referenten: "Referenten", gruppen: "Gruppen",
    unterkunft: "Unterkunft", kosten: "Kosten", material: "Material", auswertung: "Auswertung",
    alle: "Alle Module", navi: "Bereiche des Moduls",
  },
  tr: {
    ueberblick: "Özet", teilnehmende: "Katılımcılar", programm: "Program", referenten: "Konuşmacılar", gruppen: "Gruplar",
    unterkunft: "Konaklama", kosten: "Masraflar", material: "Materyal", auswertung: "Değerlendirme",
    alle: "Tüm modüller", navi: "Modülün bölümleri",
  },
  fr: {
    ueberblick: "Vue d’ensemble", teilnehmende: "Participants", programm: "Programme", referenten: "Intervenants", gruppen: "Groupes",
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
  return (
    <div className="mb-6">
      <Link href="/team/module/" className="text-sm font-semibold text-ink-soft hover:text-ink">← {t.alle}</Link>
      <h1 className="font-display mt-2 text-3xl font-bold">{titel}</h1>
      {untertitel && <div className="mt-1 text-ink-soft">{untertitel}</div>}
      <nav aria-label={t.navi} className="mt-4 flex gap-1 overflow-x-auto border-b border-line pb-px">
        {sichtbar.map((r) => {
          const an = aktiv === r.pfad || (r.auch ?? []).includes(aktiv);
          return (
            <Link key={r.pfad} href={`/team/module/${id}/${r.pfad}`} aria-current={an ? "page" : undefined}
              className={`shrink-0 rounded-t-2xl px-4 py-2 text-sm font-semibold ${an ? "bg-ink text-paper" : "hover:bg-paper-deep"}`}>
              {t[r.id]}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
