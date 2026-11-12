import type { Metadata } from "next";
import Link from "next/link";
import { Hinweis } from "@/components/team/Hinweis";
import { artNamen, ModulFormular, statusNamen } from "@/components/team/ModulFormular";
import { TeamKopf } from "@/components/team/TeamKopf";
import { modulAnlegen } from "@/lib/aktionen/module";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { teamLocale, type TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";

export const metadata: Metadata = { title: "Module | SES Academy" };

const de = {
  hinweise: {
    eingabe: { text: "Bitte Titel, Kurzname (nur Kleinbuchstaben, Zahlen, Bindestriche) und Art prüfen.", gut: false },
    "slug-vergeben": { text: "Diesen Kurznamen gibt es schon.", gut: false },
    fehler: { text: "Das hat nicht geklappt.", gut: false },
  } as Record<string, { text: string; gut: boolean }>,
  keinTermin: "noch kein Termin",
  tage: (n: number) => `${n} ${n === 1 ? "Tag" : "Tage"}`,
  angemeldet: (n: number) => `${n} angemeldet`,
  warteliste: (n: number) => `, ${n} Warteliste`,
  offenFuerGaeste: "offen für Gäste",
  ohneTicket: "ohne Ticket",
  abgesagt: "Abgesagt",
  neu: "Neues Modul",
  neuText: "Termine trägst du danach auf der Modulseite ein.",
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
    keinTermin: "henüz tarih yok",
    tage: (n) => `${n} gün`,
    angemeldet: (n) => `${n} kayıtlı`,
    warteliste: (n) => `, ${n} bekleme listesinde`,
    offenFuerGaeste: "misafirlere açık",
    ohneTicket: "biletsiz",
    abgesagt: "İptal edildi",
    neu: "Yeni modül",
    neuText: "Tarihleri sonra modül sayfasında girersin.",
    anlegen: "Modül oluştur",
  },
  fr: {
    hinweise: {
      eingabe: { text: "Merci de vérifier le titre, le nom court (minuscules, chiffres et tirets uniquement) et le type.", gut: false },
      "slug-vergeben": { text: "Ce nom court existe déjà.", gut: false },
      fehler: { text: teamTexte.fr.meldung.fehler, gut: false },
    },
    keinTermin: "pas encore de date",
    tage: (n) => `${n} ${n === 1 ? "jour" : "jours"}`,
    angemeldet: (n) => `${n} ${n === 1 ? "inscrit·e" : "inscrit·es"}`,
    warteliste: (n) => `, ${n} en liste d’attente`,
    offenFuerGaeste: "ouvert aux invités",
    ohneTicket: "sans billet",
    abgesagt: "Annulé",
    neu: "Nouveau module",
    neuText: "Tu ajouteras les dates ensuite sur la page du module.",
    anlegen: "Créer le module",
  },
};

export default async function ModulSeite({ searchParams }: PageProps<"/team/module">) {
  const staff = await requireStaff("alles");
  const l = staff.sprache;
  const t = T[l];
  const datum = new Intl.DateTimeFormat(teamLocale[l], { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Berlin" });
  const { hinweis } = await searchParams;
  const supabase = await createClient();
  const { data: module } = await supabase
    .from("modules")
    .select("id, title, slug, kind, status, cancelled_at, open_registration, ticket_required, module_days(starts_at), registrations(status)")
    .order("created_at");

  const liste = (module ?? [])
    .map((m) => ({ ...m, beginn: m.module_days.map((d) => d.starts_at).sort()[0] ?? null }))
    .sort((a, b) => (a.beginn ?? "9").localeCompare(b.beginn ?? "9"));

  return (
    <>
      <TeamKopf staff={staff} aktiv="module" />
      <main lang={l} className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="font-display text-3xl font-bold">{teamTexte[l].bereiche.module}</h1>
        <Hinweis code={hinweis} texte={t.hinweise} />
        <ul className="mt-6 grid gap-3">
          {liste.map((m) => {
            const angemeldet = m.registrations.filter((r) => r.status === "confirmed").length;
            const warteliste = m.registrations.filter((r) => r.status === "waitlist").length;
            return (
              <li key={m.id}>
                <Link href={`/team/module/${m.id}/`} className="flex flex-wrap items-center gap-3 rounded-3xl bg-white/80 p-5 ring-1 ring-line hover:ring-ink">
                  <div className="mr-auto">
                    <p className="font-display text-lg font-bold">{m.title}</p>
                    <p className="text-sm text-ink-soft">
                      {artNamen[l][m.kind]} · {m.beginn ? datum.format(new Date(m.beginn)) : t.keinTermin} · {t.tage(m.module_days.length)}
                      {" · "}{t.angemeldet(angemeldet)}{warteliste ? t.warteliste(warteliste) : ""}
                    </p>
                  </div>
                  {m.open_registration && <span className="rounded-full bg-signal px-3 py-1 text-xs font-semibold">{t.offenFuerGaeste}</span>}
                  {!m.ticket_required && <span className="rounded-full bg-paper-deep px-3 py-1 text-xs font-semibold">{t.ohneTicket}</span>}
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${m.cancelled_at ? "bg-red-100 text-red-950" : "bg-paper-deep"}`}>
                    {m.cancelled_at ? t.abgesagt : statusNamen[l][m.status]}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <section className="mt-10 rounded-3xl bg-white/60 p-6 ring-1 ring-line">
          <h2 className="font-display text-xl font-bold">{t.neu}</h2>
          <p className="mb-4 mt-1 text-sm text-ink-soft">{t.neuText}</p>
          <ModulFormular aktion={modulAnlegen} knopf={t.anlegen} sprache={l} />
        </section>
      </main>
    </>
  );
}
