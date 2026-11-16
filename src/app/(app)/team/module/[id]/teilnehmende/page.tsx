import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Phone, Search } from "lucide-react";
import { ModulReiter } from "@/components/team/ModulReiter";
import { TeamKopf } from "@/components/team/TeamKopf";
import { laenderNamen } from "@/components/team/Ui";
import { requireStaff } from "@/lib/auth";
import { istToken } from "@/lib/codes";
import { createClient } from "@/lib/supabase/server";
import { teamLocale, type TeamSprache } from "@/lib/team-sprache";
import { telLink } from "@/lib/telefon";
import { jetztMs } from "@/lib/zeit";

export const metadata: Metadata = { title: "Teilnehmende des Moduls | SES Academy" };

const de = {
  suche: "Name, Region oder Telefon",
  filter: { alle: "Alle", zugesagt: "Zugesagt", abgesagt: "Abgesagt", offen: "Ohne Rückmeldung", da: "Waren da", fehlt: "Zugesagt, aber nicht gekommen" },
  daAm: (tag: string) => `Da am ${tag}`,
  aufheben: "Filter aufheben",
  personen: (n: number) => `${n} ${n === 1 ? "Person" : "Personen"}`,
  name: "Name", zusage: "Zusage", gruppe: "Gruppe", zimmer: "Zimmer", telefon: "Telefon",
  rsvp: { zugesagt: "zugesagt", abgesagt: "abgesagt", offen: "keine Rückmeldung" },
  status: { waitlist: "Warteliste", pending: "wird geprüft", excused: "entschuldigt", cancelled: "abgemeldet", rejected: "abgelehnt" } as Record<string, string>,
  nichtDa: "nicht da",
  fehlt: "fehlt",
  zugesagtFehlt: "zugesagt, nicht gekommen",
  ohneZusageDa: "ohne Zusage gekommen",
  kommt: "–",
  da: "da",
  handLang: "Von Hand eingetragen, daher keine Ankunftszeit",
  excel: "Als Excel herunterladen",
  leer: "Niemand in dieser Auswahl.",
  hinweis: "Uhrzeit = Ankunft per QR-Code am Einlass; „✓ da“ = von Hand eingetragen. Ein Klick auf den Namen öffnet das Profil mit allen Angaben.",
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    suche: "Ad, bölge veya telefon",
    filter: { alle: "Tümü", zugesagt: "Katılacak", abgesagt: "Katılmayacak", offen: "Cevap yok", da: "Katıldı", fehlt: "Katılacaktı ama gelmedi" },
    daAm: (tag) => `${tag} katılanlar`,
    aufheben: "Filtreyi kaldır",
    personen: (n) => `${n} kişi`,
    name: "Ad", zusage: "Katılım cevabı", gruppe: "Grup", zimmer: "Oda", telefon: "Telefon",
    rsvp: { zugesagt: "katılacak", abgesagt: "katılmayacak", offen: "cevap yok" },
    status: { waitlist: "bekleme listesi", pending: "inceleniyor", excused: "mazeretli", cancelled: "kayıt iptal", rejected: "reddedildi" },
    nichtDa: "gelmedi",
    fehlt: "gelmedi",
    zugesagtFehlt: "katılacaktı, gelmedi",
    ohneZusageDa: "cevapsız geldi",
    kommt: "–",
    da: "katıldı",
    handLang: "Elle girildi, bu yüzden geliş saati yok",
    excel: "Excel olarak indir",
    leer: "Bu seçimde kimse yok.",
    hinweis: "Saat = girişte QR kodla geliş; „✓ katıldı“ = elle girildi. İsme tıklayınca tüm bilgilerle profil açılır.",
  },
  fr: {
    suche: "Nom, région ou téléphone",
    filter: { alle: "Tous", zugesagt: "Confirment", abgesagt: "Se désistent", offen: "Sans réponse", da: "Présents", fehlt: "Confirmé mais absent" },
    daAm: (tag) => `Présents ${tag}`,
    aufheben: "Retirer le filtre",
    personen: (n) => `${n} ${n === 1 ? "personne" : "personnes"}`,
    name: "Nom", zusage: "Réponse", gruppe: "Groupe", zimmer: "Chambre", telefon: "Téléphone",
    rsvp: { zugesagt: "vient", abgesagt: "ne vient pas", offen: "pas de réponse" },
    status: { waitlist: "liste d’attente", pending: "en cours d’examen", excused: "excusé·e", cancelled: "désinscrit·e", rejected: "refusé·e" },
    nichtDa: "absent·e",
    fehlt: "absent·e",
    zugesagtFehlt: "confirmé, absent",
    ohneZusageDa: "venu sans réponse",
    kommt: "–",
    da: "présent·e",
    handLang: "Saisi à la main, donc sans heure d’arrivée",
    excel: "Télécharger en Excel",
    leer: "Personne dans cette sélection.",
    hinweis: "Heure = arrivée par QR code à l’accueil\u00a0; «\u00a0✓ présent·e\u00a0» = saisi à la main. Un clic sur le nom ouvre le profil complet.",
  },
};

type Filter = keyof typeof de.filter;
const filterListe: Filter[] = ["alle", "zugesagt", "abgesagt", "offen", "da", "fehlt"];

type Reg = {
  id: string; status: string; rsvp: string | null;
  participants: { id: string; first_name: string; last_name: string; phone: string | null; country: string | null; branch: string | null; regions: { name: string } | null } | null;
  attendances: { module_day_id: string; checked_in_at: string; method: string }[];
};

/**
 * Teilnehmende eines Moduls (Umbau 16.11.2026; vorher sprang der Reiter in die allgemeine Liste).
 * Je Person: Zusage, Ankunftszeit an jedem Modultag, Workshop-Gruppe und Zimmer. Filter über Knöpfe statt Formular.
 */
export default async function ModulTeilnehmende({ params, searchParams }: PageProps<"/team/module/[id]/teilnehmende">) {
  const staff = await requireStaff("orga");
  const l = staff.sprache;
  const t = T[l];
  const { id } = await params;
  const sp = await searchParams;
  if (!istToken(id)) notFound();
  const filter: Filter = sp.filter === "nichtda" ? "fehlt" : filterListe.includes(sp.filter as Filter) ? (sp.filter as Filter) : "alle";
  const tagFilter = typeof sp.tag === "string" && istToken(sp.tag) ? sp.tag : null;
  const suche = typeof sp.q === "string" ? sp.q.trim().toLocaleLowerCase("de") : "";

  const supabase = await createClient();
  const { data: modul } = await supabase.from("modules").select("id, title, module_days(id, starts_at, ends_at)").eq("id", id).maybeSingle();
  if (!modul) notFound();
  const [{ data: regs }, { data: gruppen }, { data: hotels }] = await Promise.all([
    supabase.from("registrations")
      .select("id, status, rsvp, participants(id, first_name, last_name, phone, country, branch, regions(name)), attendances(module_day_id, checked_in_at, method)")
      .eq("module_id", id),
    supabase.from("group_members").select("participant_id, module_groups(name, room)").eq("module_id", id),
    supabase.from("hotels").select("id, name, rooms(label, room_assignments(participant_id))").eq("module_id", id),
  ]);

  const jetzt = jetztMs();
  const tage = [...modul.module_days].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const vorbei = tage.some((x) => Date.parse(x.starts_at) < jetzt);
  const kurzTag = new Intl.DateTimeFormat(teamLocale[l], { weekday: "short", day: "numeric", month: "numeric", timeZone: "Europe/Berlin" });
  const uhr = new Intl.DateTimeFormat(teamLocale[l], { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
  const gruppeVon = new Map((gruppen ?? []).map((g) => {
    const mg = g.module_groups as unknown as { name: string; room: string | null } | null;
    return [g.participant_id, mg ? { kurz: mg.name.split("·")[0].trim(), name: mg.name, raum: mg.room } : null];
  }));
  const zimmerVon = new Map<string, string>();
  for (const h of hotels ?? []) {
    const kurz = h.name.replace(/^B&B\s+Hotel\s+/i, "").replace(/^Köln[- ]/, "");
    for (const r of h.rooms ?? []) for (const a of r.room_assignments ?? []) zimmerVon.set(a.participant_id, `${r.label} · ${kurz}`);
  }

  const alle = ((regs ?? []) as unknown as Reg[])
    .filter((r) => r.participants && (r.status === "confirmed" || r.status === "waitlist" || r.status === "excused"))
    .map((r) => {
      const p = r.participants!;
      return {
        ...r, p, name: `${p.first_name} ${p.last_name}`.trim(),
        da: r.attendances.length > 0,
        gruppe: gruppeVon.get(p.id) ?? null, zimmer: zimmerVon.get(p.id) ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
  const bestaetigt = alle.filter((r) => r.status === "confirmed");
  const zaehle: Record<Filter, number> = {
    alle: alle.length,
    zugesagt: bestaetigt.filter((r) => r.rsvp === "zugesagt").length,
    abgesagt: alle.filter((r) => r.rsvp === "abgesagt").length,
    offen: bestaetigt.filter((r) => !r.rsvp).length,
    da: alle.filter((r) => r.da).length,
    fehlt: bestaetigt.filter((r) => r.rsvp === "zugesagt" && !r.da).length,
  };
  const passt = (r: (typeof alle)[number]) =>
    (filter === "alle" ||
      (filter === "zugesagt" && r.status === "confirmed" && r.rsvp === "zugesagt") ||
      (filter === "abgesagt" && r.rsvp === "abgesagt") ||
      (filter === "offen" && r.status === "confirmed" && !r.rsvp) ||
      (filter === "da" && r.da) ||
      (filter === "fehlt" && r.status === "confirmed" && r.rsvp === "zugesagt" && !r.da)) &&
    (!tagFilter || r.attendances.some((a) => a.module_day_id === tagFilter)) &&
    (!suche || [r.name, r.p.regions?.name, r.p.phone].some((x) => x?.toLocaleLowerCase("de").includes(suche)));
  const liste = alle.filter(passt);
  const tagTitel = tagFilter ? tage.find((x) => x.id === tagFilter) : null;
  const laender = laenderNamen[l];

  const adresse = (f: Filter) => {
    const q = new URLSearchParams();
    if (f !== "alle") q.set("filter", f);
    if (suche) q.set("q", suche);
    return `/team/module/${id}/teilnehmende/${q.size ? `?${q}` : ""}`;
  };
  // Nach dem Modul zählt der Unterschied: zugesagt und nicht gekommen (rot) ist etwas anderes als nie geantwortet (grau)
  const zusageChip = (r: (typeof alle)[number]) =>
    r.status !== "confirmed" ? <span className="chip bg-paper-deep">{t.status[r.status] ?? r.status}</span>
      : r.rsvp === "zugesagt" ? (vorbei && !r.da ? <span className="chip bg-rot-hell text-rot">{t.zugesagtFehlt}</span> : <span className="chip bg-gruen-hell">{t.rsvp.zugesagt}</span>)
      : r.rsvp === "abgesagt" ? <span className="chip bg-paper-deep">{t.rsvp.abgesagt}</span>
      : vorbei && r.da ? <span className="chip bg-gruen-hell">{t.ohneZusageDa}</span>
      : <span className="chip bg-paper-deep text-ink-soft">{t.rsvp.offen}</span>;

  return (
    <>
      <TeamKopf staff={staff} aktiv="module" />
      <main lang={l} className="mx-auto max-w-6xl px-4 py-8">
        <ModulReiter id={id} titel={modul.title} aktiv="teilnehmende/" />

        <div className="flex flex-wrap items-center gap-2">
          {filterListe.filter((f) => vorbei || (f !== "da" && f !== "fehlt")).map((f) => (
            <Link key={f} href={adresse(f)} aria-current={f === filter && !tagFilter ? "page" : undefined}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${f === filter && !tagFilter ? "bg-ink text-paper" : f === "fehlt" && zaehle.fehlt > 0 ? "bg-rot-hell text-rot ring-1 ring-rot/20 hover:ring-rot" : "bg-weiss ring-1 ring-line hover:ring-ink"}`}>
              {t.filter[f]} <span className="tabular-nums opacity-70">{zaehle[f]}</span>
            </Link>
          ))}
          {tagTitel && (
            <span className="inline-flex items-center gap-2 rounded-full bg-ink px-3.5 py-1.5 text-sm font-semibold text-paper">
              {t.daAm(kurzTag.format(new Date(tagTitel.starts_at)))} · {liste.length}
              <Link href={adresse(filter)} className="underline">{t.aufheben}</Link>
            </span>
          )}
        </div>

        <form className="mt-4 flex flex-wrap items-center gap-3" action={`/team/module/${id}/teilnehmende/`}>
          {filter !== "alle" && <input type="hidden" name="filter" value={filter} />}
          <label className="relative min-w-60 flex-1">
            <span className="sr-only">{t.suche}</span>
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink-soft" />
            <input name="q" defaultValue={suche} placeholder={t.suche} className="feld pl-10" />
          </label>
          <span className="text-sm text-ink-soft">{t.personen(liste.length)}</span>
          <a href={`/team/teilnehmende/export/?modul=${id}`} className="knopf-hell" download>{t.excel}</a>
        </form>

        <div className="karte mt-4 overflow-x-auto p-0">
          {liste.length ? (
            <table className="tabelle">
              <thead>
                <tr>
                  <th className="pl-5">{t.name}</th>
                  <th>{t.zusage}</th>
                  {tage.map((x) => <th key={x.id} className="text-center">{kurzTag.format(new Date(x.starts_at))}</th>)}
                  <th>{t.gruppe}</th>
                  <th>{t.zimmer}</th>
                  <th className="pr-5">{t.telefon}</th>
                </tr>
              </thead>
              <tbody>
                {liste.map((r) => (
                  <tr key={r.id}>
                    <td className="pl-5">
                      <Link href={`/team/teilnehmende/${r.p.id}/?modul=${id}`} className="font-semibold hover:underline">{r.name}</Link>
                      <span className="block text-xs text-ink-soft">
                        {[r.p.regions?.name, r.p.country && r.p.country !== "other" ? laender[r.p.country] : null, r.p.branch].filter(Boolean).join(" · ")}
                      </span>
                    </td>
                    <td>{zusageChip(r)}</td>
                    {tage.map((x) => {
                      const a = r.attendances.find((y) => y.module_day_id === x.id);
                      const kommt = Date.parse(x.starts_at) > jetzt;
                      return (
                        <td key={x.id} className="text-center tabular-nums whitespace-nowrap">
                          {a ? (a.method === "manual"
                              ? <span className="chip bg-gruen-hell" title={t.handLang}>✓ {t.da}</span>
                              : <span className="chip bg-gruen-hell">{uhr.format(new Date(a.checked_in_at))}</span>)
                            : kommt ? <span className="text-ink-soft">{t.kommt}</span>
                            : r.rsvp === "zugesagt" ? <span className="text-xs font-semibold text-rot">{t.fehlt}</span>
                            : <span className="text-ink-soft/50">–</span>}
                        </td>
                      );
                    })}
                    <td className="whitespace-nowrap" title={r.gruppe?.name}>{r.gruppe ? <>{r.gruppe.kurz}{r.gruppe.raum && <span className="block text-xs text-ink-soft">{r.gruppe.raum}</span>}</> : <span className="text-ink-soft">–</span>}</td>
                    <td className="whitespace-nowrap">{r.zimmer ?? <span className="text-ink-soft">–</span>}</td>
                    <td className="pr-5 whitespace-nowrap">
                      {r.p.phone ? <a href={telLink(r.p.phone)} className="inline-flex items-center gap-1.5 hover:underline"><Phone aria-hidden className="h-3.5 w-3.5 text-ink-soft" />{r.p.phone}</a> : <span className="text-ink-soft">–</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="p-8 text-center text-ink-soft">{t.leer}</p>}
        </div>
        <p className="mt-3 text-xs text-ink-soft">{t.hinweis}</p>
      </main>
    </>
  );
}
