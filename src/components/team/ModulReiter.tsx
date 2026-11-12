import Link from "next/link";
import { darf, getStaff } from "@/lib/auth";
import type { TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";

type Reiter = "uebersicht" | "teilnehmende" | "programm" | "referenten" | "checkliste" | "gruppen" | "logistik" | "zimmerplan" | "kosten" | "material";

// href: Reiter, der auf eine allgemeine Seite führt (Teilnehmende: die Liste, gefiltert auf dieses Modul)
const reiter: readonly { pfad: string; id: Reiter; href?: (id: string) => string }[] = [
  { pfad: "", id: "uebersicht" },
  { pfad: "teilnehmende", id: "teilnehmende", href: (id) => `/team/teilnehmende/?modul=${id}` },
  { pfad: "programm/", id: "programm" },
  { pfad: "referenten/", id: "referenten" },
  { pfad: "checkliste/", id: "checkliste" },
  { pfad: "gruppen/", id: "gruppen" },
  { pfad: "hotel/", id: "logistik" },
  { pfad: "zimmerplan/", id: "zimmerplan" },
  { pfad: "kosten/", id: "kosten" },
  { pfad: "material/", id: "material" },
];

function texte(l: TeamSprache) {
  const b = teamTexte[l].bereiche;
  const eigene = {
    de: { programm: "Programm", referenten: "Referenten", checkliste: "Checkliste", zimmerplan: "Zimmerplan", kosten: "Kosten", material: "Material", alle: "Alle Module", navi: "Bereiche des Moduls" },
    tr: { programm: "Program", referenten: "Konuşmacılar", checkliste: "Kontrol listesi", zimmerplan: "Oda planı", kosten: "Masraflar", material: "Materyal", alle: "Tüm modüller", navi: "Modülün bölümleri" },
    fr: { programm: "Programme", referenten: "Intervenants", checkliste: "Check-list", zimmerplan: "Plan des chambres", kosten: "Coûts", material: "Supports", alle: "Tous les modules", navi: "Sections du module" },
  }[l];
  const namen: Record<Reiter, string> = {
    uebersicht: b.start, teilnehmende: b.teilnehmende, programm: eigene.programm, referenten: eigene.referenten, checkliste: eigene.checkliste,
    gruppen: b.gruppen, logistik: b.logistik, zimmerplan: eigene.zimmerplan, kosten: eigene.kosten, material: eigene.material,
  };
  return { namen, alle: eigene.alle, navi: eigene.navi, logistik: b.logistik };
}

/**
 * Reiter eines Moduls (Plan: Programm, Referenten, Material, Logistik, Medien; dazu Checkliste und Gruppen).
 * Übersicht und Modulliste sind Admin/Vorstand vorbehalten; das Orga-Team sieht nur seine Reiter.
 * Sprache: die des angemeldeten Teamkontos.
 */
export async function ModulReiter({ id, titel, aktiv }: { id: string; titel: string; aktiv: string }) {
  const staff = await getStaff();
  const alles = staff ? darf.alles(staff.role) : false;
  const t = texte(staff?.sprache ?? "de");
  return (
    <div className="mb-6">
      {alles
        ? <Link href="/team/module/" className="text-sm font-semibold text-ink-soft hover:text-ink">← {t.alle}</Link>
        : <Link href="/team/logistik/" className="text-sm font-semibold text-ink-soft hover:text-ink">← {t.logistik}</Link>}
      <h1 className="font-display mt-2 text-3xl font-bold">{titel}</h1>
      <nav aria-label={t.navi} className="mt-4 flex gap-1 overflow-x-auto border-b border-line pb-px">
        {reiter.filter((r) => alles || r.pfad !== "").map((r) => (
          <Link key={r.pfad} href={r.href ? r.href(id) : `/team/module/${id}/${r.pfad}`} aria-current={aktiv === r.pfad ? "page" : undefined}
            className={`shrink-0 rounded-t-2xl px-4 py-2 text-sm font-semibold ${aktiv === r.pfad ? "bg-ink text-paper" : "hover:bg-paper-deep"}`}>
            {t.namen[r.id]}
          </Link>
        ))}
      </nav>
    </div>
  );
}
