import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { Hinweis } from "@/components/team/Hinweis";
import { artNamen, ModulFormular } from "@/components/team/ModulFormular";
import { TeamKopf } from "@/components/team/TeamKopf";
import { modulAnlegen } from "@/lib/aktionen/module";
import { darf, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { teamLocale, type TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";
import { jetztMs } from "@/lib/zeit";

export const metadata: Metadata = { title: "Module | SES Academy" };

const de = {
  hinweise: {
    eingabe: { text: "Bitte Titel, Kurzname (nur Kleinbuchstaben, Zahlen, Bindestriche) und Art prüfen.", gut: false },
    "slug-vergeben": { text: "Diesen Kurznamen gibt es schon.", gut: false },
    fehler: { text: "Das hat nicht geklappt.", gut: false },
  } as Record<string, { text: string; gut: boolean }>,
  kommend: "Als Nächstes",
  vergangen: "Stattgefunden",
  keinTermin: "noch kein Termin",
  ortFolgt: "Ort folgt",
  inTagen: (n: number) => (n === 0 ? "heute" : n === 1 ? "morgen" : `in ${n} Tagen`),
  laeuft: "läuft gerade",
  abgesagt: "Abgesagt",
  entwurf: "Entwurf",
  angemeldet: "angemeldet",
  zugesagt: "zugesagt",
  da: "waren da",
  quote: "Anwesenheit",
  neu: "Neues Modul anlegen",
  neuText: "Titel und Art reichen; Termine trägst du danach auf der Modulseite ein.",
  anlegen: "Modul anlegen",
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    hinweise: {
      eingabe: { text: "Lütfen başlığı, kısa adı (yalnızca küçük harf, rakam ve tire) ve türü kontrol et.", gut: false },
      "slug-vergeben": { text: "Bu kısa ad zaten var.", gut: false },
      fehler: { text: teamTexte.tr.meldung.fehler, gut: false },
    },
    kommend: "Sıradaki",
    vergangen: "Gerçekleşti",
    keinTermin: "henüz tarih yok",
    ortFolgt: "yer bildirilecek",
    inTagen: (n) => (n === 0 ? "bugün" : n === 1 ? "yarın" : `${n} gün sonra`),
    laeuft: "şu an devam ediyor",
    abgesagt: "İptal edildi",
    entwurf: "Taslak",
    angemeldet: "kayıtlı",
    zugesagt: "katılacak",
    da: "katıldı",
    quote: "Katılım",
    neu: "Yeni modül oluştur",
    neuText: "Başlık ve tür yeterli; tarihleri sonra modül sayfasında girersin.",
    anlegen: "Modül oluştur",
  },
  fr: {
    hinweise: {
      eingabe: { text: "Merci de vérifier le titre, le nom court (minuscules, chiffres et tirets uniquement) et le type.", gut: false },
      "slug-vergeben": { text: "Ce nom court existe déjà.", gut: false },
      fehler: { text: teamTexte.fr.meldung.fehler, gut: false },
    },
    kommend: "À venir",
    vergangen: "Passés",
    keinTermin: "pas encore de date",
    ortFolgt: "lieu à venir",
    inTagen: (n) => (n === 0 ? "aujourd’hui" : n === 1 ? "demain" : `dans ${n} jours`),
    laeuft: "en cours",
    abgesagt: "Annulé",
    entwurf: "Brouillon",
    angemeldet: "inscrits",
    zugesagt: "confirment",
    da: "présents",
    quote: "Présence",
    neu: "Créer un nouveau module",
    neuText: "Le titre et le type suffisent ; tu ajouteras les dates ensuite sur la page du module.",
    anlegen: "Créer le module",
  },
};

/**
 * Alle Module auf einen Blick (Umbau 16.11.2026): oben die kommenden, darunter die vergangenen, jeweils mit Datum, Ort
 * und den Zahlen, die man wirklich braucht. Ein Klick öffnet das Modul. Neues Modul anlegen steht eingeklappt unten.
 * Orga-Team sieht die Liste ebenfalls und landet direkt bei den Teilnehmenden des Moduls.
 */
export default async function ModulSeite({ searchParams }: PageProps<"/team/module">) {
  const staff = await requireStaff("orga");
  const l = staff.sprache;
  const t = T[l];
  const alles = darf.alles(staff.role);
  const tag = new Intl.DateTimeFormat(teamLocale[l], { day: "numeric", month: "short", timeZone: "Europe/Berlin" });
  const jahr = new Intl.DateTimeFormat(teamLocale[l], { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Berlin" });
  const { hinweis } = await searchParams;
  const supabase = await createClient();
  const [{ data: module }, { data: stats }] = await Promise.all([
    supabase.from("modules")
      .select("id, title, subtitle, kind, status, location, cancelled_at, module_days(starts_at, ends_at), registrations(status, rsvp)")
      .order("created_at"),
    alles ? supabase.rpc("get_module_stats") : Promise.resolve({ data: [] as { module_id: string; attended_people: number; attendance_rate: number }[] }),
  ]);
  const jetzt = jetztMs();
  const zuStats = new Map((stats ?? []).map((s) => [s.module_id, s]));

  const liste = (module ?? []).map((m) => {
    const tage = m.module_days.map((d) => ({ von: Date.parse(d.starts_at), bis: Date.parse(d.ends_at) })).sort((a, b) => a.von - b.von);
    const beginn = tage[0]?.von ?? null;
    const ende = tage.at(-1)?.bis ?? null;
    const angemeldet = m.registrations.filter((r) => r.status === "confirmed").length;
    const zugesagt = m.registrations.filter((r) => r.status === "confirmed" && r.rsvp === "zugesagt").length;
    return { ...m, beginn, ende, angemeldet, zugesagt, stats: zuStats.get(m.id) };
  });
  const kommend = liste.filter((m) => m.ende === null || m.ende >= jetzt).sort((a, b) => (a.beginn ?? Infinity) - (b.beginn ?? Infinity));
  const vergangen = liste.filter((m) => m.ende !== null && m.ende < jetzt).sort((a, b) => (b.beginn ?? 0) - (a.beginn ?? 0));

  const zeitraum = (m: (typeof liste)[number]) => {
    if (!m.beginn || !m.ende) return t.keinTermin;
    const a = new Date(m.beginn), b = new Date(m.ende);
    return tag.format(a) === tag.format(b) ? jahr.format(a) : `${tag.format(a)} – ${jahr.format(b)}`;
  };
  const zustand = (m: (typeof liste)[number]) => {
    if (m.cancelled_at) return { text: t.abgesagt, klasse: "bg-rot-hell text-rot" };
    if (m.status === "draft") return { text: t.entwurf, klasse: "bg-paper-deep" };
    if (m.beginn && m.ende && m.beginn <= jetzt && jetzt <= m.ende) return { text: t.laeuft, klasse: "bg-signal" };
    if (m.beginn && m.beginn > jetzt) return { text: t.inTagen(Math.floor((m.beginn - jetzt) / 86_400_000)), klasse: "bg-gruen-hell" };
    return null;
  };

  const Karte = ({ m }: { m: (typeof liste)[number] }) => {
    const z = zustand(m);
    const vorbei = m.ende !== null && m.ende < jetzt;
    const zahlen = vorbei && m.stats
      ? [[m.angemeldet, t.angemeldet], [m.stats.attended_people, t.da], [`${Math.round(m.stats.attendance_rate)} %`, t.quote]]
      : [[m.angemeldet, t.angemeldet], [m.zugesagt, t.zugesagt]];
    return (
      <li>
        <Link href={`/team/module/${m.id}/${alles ? "" : "teilnehmende/"}`}
          className="grid gap-4 rounded-3xl bg-weiss p-5 ring-1 ring-line transition hover:ring-ink sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-xl font-bold">{m.title}</p>
              <span className="text-sm text-ink-soft">{artNamen[l][m.kind]}</span>
              {z && <span className={`chip py-0.5 ${z.klasse}`}>{z.text}</span>}
            </div>
            {m.subtitle && <p className="mt-0.5 truncate text-sm text-ink-soft">{m.subtitle}</p>}
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className="inline-flex items-center gap-1.5"><CalendarDays aria-hidden className="h-4 w-4 text-ink-soft" />{zeitraum(m)}</span>
              <span className="inline-flex items-center gap-1.5"><MapPin aria-hidden className="h-4 w-4 text-ink-soft" />{m.location || t.ortFolgt}</span>
            </p>
          </div>
          <dl className="flex gap-5 sm:justify-end">
            {zahlen.map(([wert, text]) => (
              <div key={String(text)} className="text-right">
                <dt className="sr-only">{text}</dt>
                <dd className="font-display text-2xl leading-none font-extrabold tabular-nums">{wert}</dd>
                <dd aria-hidden className="mt-1 text-xs text-ink-soft">{text}</dd>
              </div>
            ))}
          </dl>
        </Link>
      </li>
    );
  };

  return (
    <>
      <TeamKopf staff={staff} aktiv="module" />
      <main lang={l} className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="font-display text-4xl font-extrabold">{teamTexte[l].bereiche.module}</h1>
        <Hinweis code={hinweis} texte={t.hinweise} />

        {kommend.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-ink-soft uppercase">{t.kommend}</h2>
            <ul className="grid gap-3">{kommend.map((m) => <Karte key={m.id} m={m} />)}</ul>
          </section>
        )}
        {vergangen.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-ink-soft uppercase">{t.vergangen}</h2>
            <ul className="grid gap-3">{vergangen.map((m) => <Karte key={m.id} m={m} />)}</ul>
          </section>
        )}

        {alles && (
          <details className="mt-10 rounded-3xl bg-white/60 ring-1 ring-line">
            <summary className="cursor-pointer px-6 py-4 font-semibold">+ {t.neu}</summary>
            <div className="px-6 pb-6">
              <p className="mb-4 text-sm text-ink-soft">{t.neuText}</p>
              <ModulFormular aktion={modulAnlegen} knopf={t.anlegen} sprache={l} />
            </div>
          </details>
        )}
      </main>
    </>
  );
}
