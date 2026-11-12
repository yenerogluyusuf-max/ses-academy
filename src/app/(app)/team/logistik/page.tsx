import type { Metadata } from "next";
import Link from "next/link";
import { BedDouble, ClipboardList, Euro, Hotel, IdCard, Siren } from "lucide-react";
import { TeamKopf } from "@/components/team/TeamKopf";
import { Leer, Titel } from "@/components/team/Ui";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { teamLocale, type TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";
import { jetztMs } from "@/lib/zeit";

export const metadata: Metadata = { title: "Logistik | SES Academy" };

const de = {
  kicker: "Hotel, Zimmer, Material, Kosten",
  keinModul: "Kein kommendes Modul.",
  abgesagt: "abgesagt",
  hotels: (n: number) => (n === 1 ? "Hotel" : `${n} Hotels`),
  nochKeins: "noch keins",
  betten: "Betten / übernachten",
  zimmerplan: "Zimmerplan",
  keineAngaben: "noch keine Angaben",
  ohneZimmer: (n: number) => `${n} noch ohne Zimmer`,
  alleEingeteilt: "alle eingeteilt",
  materialliste: "Materialliste",
  leer: "leer",
  offen: (n: number, von: number) => `${n} von ${von} offen`,
  allesErledigt: "alles erledigt",
  stornofrist: "Stornofrist Hotel:",
  hotelZimmer: "Hotel und Zimmer",
  material: "Material",
  kosten: "Kosten",
  namensschilder: "Namensschilder",
  notfall: "Notfall-Liste",
  nurKommende: "Nur kommende Module",
  frueher: (n: number) => `Frühere Module (${n}) anzeigen`,
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    kicker: "Otel, oda, malzeme, masraflar",
    keinModul: "Yaklaşan modül yok.",
    abgesagt: "iptal edildi",
    hotels: (n) => (n === 1 ? "Otel" : `${n} otel`),
    nochKeins: "henüz yok",
    betten: "Yatak / konaklayan",
    zimmerplan: "Oda planı",
    keineAngaben: "henüz bilgi yok",
    ohneZimmer: (n) => `${n} kişi henüz odasız`,
    alleEingeteilt: "herkes yerleştirildi",
    materialliste: "Malzeme listesi",
    leer: "boş",
    offen: (n, von) => `${n} açık (toplam ${von})`,
    allesErledigt: "hepsi tamam",
    stornofrist: "Otelde ücretsiz iptal son tarihi:",
    hotelZimmer: "Otel ve odalar",
    material: "Malzeme",
    kosten: "Masraflar",
    namensschilder: "Yaka kartları",
    notfall: "Acil durum listesi",
    nurKommende: "Sadece yaklaşan modüller",
    frueher: (n) => `Önceki modülleri göster (${n})`,
  },
  fr: {
    kicker: "Hôtel, chambres, matériel, coûts",
    keinModul: "Aucun module à venir.",
    abgesagt: "annulé",
    hotels: (n) => (n === 1 ? "Hôtel" : `${n} hôtels`),
    nochKeins: "pas encore",
    betten: "Lits / personnes hébergées",
    zimmerplan: "Plan des chambres",
    keineAngaben: "pas encore de réponses",
    ohneZimmer: (n) => `${n} encore sans chambre`,
    alleEingeteilt: "tout le monde est réparti",
    materialliste: "Liste du matériel",
    leer: "vide",
    offen: (n, von) => `${n} sur ${von} à faire`,
    allesErledigt: "tout est fait",
    stornofrist: "Annulation gratuite à l’hôtel jusqu’au\u00a0:",
    hotelZimmer: "Hôtel et chambres",
    material: "Matériel",
    kosten: "Coûts",
    namensschilder: "Badges",
    notfall: "Liste d’urgence",
    nurKommende: "Seulement les modules à venir",
    frueher: (n) => `Afficher les modules passés (${n})`,
  },
};

/**
 * Logistik auf einen Blick (ab Orga-Team, wie Hotel und Zimmerplan): je kommendes Modul Hotels und Betten, Stand des
 * Zimmerplans, offene Materialliste, Stornofrist; Wege zu Logistik, Zimmerplan, Material, Kosten, Namensschildern und
 * Notfall-Liste. Vergangene Module über „Frühere Module“.
 */
export default async function Logistik({ searchParams }: PageProps<"/team/logistik">) {
  const staff = await requireStaff("orga");
  const l = staff.sprache;
  const t = T[l];
  const datum = new Intl.DateTimeFormat(teamLocale[l], { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" });
  const { alle } = await searchParams;
  const supabase = await createClient();
  const { data: module } = await supabase.from("modules")
    .select("id, title, location, cancelled_at, status, module_days(day, ends_at), hotels(id, name, cancellation_deadline, rooms(capacity, room_assignments(participant_id))), module_materials(done_at)")
    .neq("status", "draft");
  const jetzt = new Date(jetztMs()).toISOString();
  const liste = (module ?? [])
    .map((m) => ({ ...m, tage: [...m.module_days].sort((a, b) => a.day.localeCompare(b.day)) }))
    .filter((m) => m.tage.length)
    .sort((a, b) => a.tage[0].day.localeCompare(b.tage[0].day));
  const kommend = liste.filter((m) => !m.cancelled_at && m.tage.some((t) => t.ends_at >= jetzt));
  const frueher = liste.filter((m) => !kommend.includes(m)).reverse();
  const zeigen = alle === "1" ? [...kommend, ...frueher] : kommend;
  // Übernachtende und Eingeteilte je Modul (gleiche Zahlen wie im Zimmerplan)
  const planung = new Map(await Promise.all(zeigen.slice(0, 8).map(async (m) => {
    const { data } = await supabase.rpc("get_room_planning", { p_module_id: m.id });
    return [m.id, data ?? []] as const;
  })));

  return (
    <>
      <TeamKopf staff={staff} aktiv="logistik" />
      <main lang={l} className="mx-auto max-w-6xl px-4 py-10">
        <Titel kicker={t.kicker}>{teamTexte[l].bereiche.logistik}</Titel>
        {zeigen.length === 0 && <Leer>{t.keinModul}</Leer>}
        <div className="grid gap-5">
          {zeigen.map((m) => {
            const p = planung.get(m.id) ?? [];
            const uebernachten = p.filter((x) => x.registration_status === "confirmed" && x.nights.length > 0);
            const ohneZimmer = uebernachten.filter((x) => !x.room_id).length;
            const betten = m.hotels.reduce((s, h) => s + h.rooms.reduce((t, z) => t + z.capacity, 0), 0);
            const offen = m.module_materials.filter((x) => !x.done_at).length;
            const frist = m.hotels.map((h) => h.cancellation_deadline).filter(Boolean).sort()[0];
            const vorbei = !kommend.includes(m);
            const link = (pfad: string) => `/team/module/${m.id}/${pfad}`;
            return (
              <section key={m.id} className={`karte ${vorbei ? "opacity-80" : ""}`}>
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <h2 className="font-display mr-auto text-2xl font-bold">{m.title}{m.cancelled_at && <span className="chip ml-2 bg-rot-hell align-middle text-rot">{t.abgesagt}</span>}</h2>
                  <p className="text-sm text-ink-soft">{datum.format(new Date(`${m.tage[0].day}T12:00:00Z`))}{m.location ? ` · ${m.location}` : ""}</p>
                </div>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-2xl bg-paper p-3">
                    <dt className="text-xs text-ink-soft">{t.hotels(m.hotels.length)}</dt>
                    <dd className="font-semibold">{m.hotels.length ? m.hotels.map((h) => h.name).join(", ") : <span className="text-amber-900">{t.nochKeins}</span>}</dd>
                  </div>
                  <div className={`rounded-2xl p-3 ${betten < uebernachten.length ? "bg-gelb-hell" : "bg-paper"}`}>
                    <dt className="text-xs text-ink-soft">{t.betten}</dt>
                    <dd className="font-semibold">{betten} / {uebernachten.length}</dd>
                  </div>
                  <div className={`rounded-2xl p-3 ${ohneZimmer ? "bg-gelb-hell" : "bg-paper"}`}>
                    <dt className="text-xs text-ink-soft">{t.zimmerplan}</dt>
                    <dd className="font-semibold">{uebernachten.length === 0 ? t.keineAngaben : ohneZimmer ? t.ohneZimmer(ohneZimmer) : t.alleEingeteilt}</dd>
                  </div>
                  <div className={`rounded-2xl p-3 ${offen ? "bg-gelb-hell" : "bg-paper"}`}>
                    <dt className="text-xs text-ink-soft">{t.materialliste}</dt>
                    <dd className="font-semibold">{m.module_materials.length === 0 ? t.leer : offen ? t.offen(offen, m.module_materials.length) : t.allesErledigt}</dd>
                  </div>
                </dl>
                {frist && !vorbei && <p className="mt-3 text-sm">{t.stornofrist} <span className="font-semibold">{datum.format(new Date(`${frist}T12:00:00Z`))}</span></p>}
                <nav aria-label={`${teamTexte[l].bereiche.logistik} ${m.title}`} className="mt-4 flex flex-wrap gap-2">
                  <Link href={link("hotel/")} className="knopf"><Hotel aria-hidden className="h-4 w-4" /> {t.hotelZimmer}</Link>
                  <Link href={link("zimmerplan/")} className="knopf-hell"><BedDouble aria-hidden className="h-4 w-4" /> {t.zimmerplan}</Link>
                  <Link href={link("material/")} className="knopf-hell"><ClipboardList aria-hidden className="h-4 w-4" /> {t.material}</Link>
                  <Link href={link("kosten/")} className="knopf-hell"><Euro aria-hidden className="h-4 w-4" /> {t.kosten}</Link>
                  <Link href={link("namensschilder/")} className="knopf-hell"><IdCard aria-hidden className="h-4 w-4" /> {t.namensschilder}</Link>
                  <a href={link("notfall/")} className="knopf-hell"><Siren aria-hidden className="h-4 w-4" /> {t.notfall}</a>
                </nav>
              </section>
            );
          })}
        </div>
        {frueher.length > 0 && (
          <p className="mt-6 text-sm">
            {alle === "1" ? <Link href="/team/logistik/" className="link">{t.nurKommende}</Link> : <Link href="/team/logistik/?alle=1" className="link">{t.frueher(frueher.length)}</Link>}
          </p>
        )}
      </main>
    </>
  );
}
