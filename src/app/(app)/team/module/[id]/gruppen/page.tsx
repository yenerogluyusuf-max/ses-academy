import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Hinweis } from "@/components/team/Hinweis";
import { ModulReiter } from "@/components/team/ModulReiter";
import { TeamKopf } from "@/components/team/TeamKopf";
import { gruppeEntfernen, gruppeSpeichern, gruppenVorschlag, mitgliedZuteilen } from "@/lib/aktionen/modulwerkzeuge";
import { requireStaff } from "@/lib/auth";
import { istToken } from "@/lib/codes";
import { createClient } from "@/lib/supabase/server";
import { teamLocale, type TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";

export const metadata: Metadata = { title: "Gruppen | SES Academy" };

const de = {
  hinweise: {
    gruppe: { text: "Gruppe gespeichert.", gut: true },
    "gruppe-entfernt": { text: "Gruppe entfernt.", gut: true },
    "gruppe-doppelt": { text: "Eine Gruppe mit diesem Namen gibt es schon.", gut: false },
    zugeteilt: { text: "Zuteilung gespeichert.", gut: true },
    eingabe: { text: "Bitte die Angaben prüfen.", gut: false },
    fehler: { text: "Das hat nicht geklappt.", gut: false },
  } as Record<string, { text: string; gut: boolean }>,
  anderesLand: "anderes Land",
  vorgeschlagen: (n: number) => `${n} Personen eingeteilt. Bitte prüfen und von Hand anpassen.`,
  anwesenheitAm: "Anwesenheit am", zeigen: "Zeigen",
  einteilenNach: (n: number) => `${n} ohne Gruppe einteilen nach`, land: "Land", vorschlag: "Vorschlag übernehmen",
  da: (da: number, alle: number) => `${da}/${alle} da`,
  raumNr: (raum: string) => `Raum ${raum}`, raumOffen: "Raum und Leitung offen",
  gruppeFuer: (name: string) => `Gruppe für ${name}`, keine: "keine", ok: "OK",
  raumUndLeitung: "Raum und Leitung", raum: "Raum", leitung: "Leitung", gruppeEntfernen: "Gruppe entfernen",
  ohneGruppe: (n: number) => `Ohne Gruppe (${n})`, gruppe: "Gruppe",
  neueGruppe: "Neue Gruppe", nameBeispiel: "Name, z. B. Deutschland", anlegen: "Anlegen",
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    hinweise: {
      gruppe: { text: "Grup kaydedildi.", gut: true },
      "gruppe-entfernt": { text: "Grup kaldırıldı.", gut: true },
      "gruppe-doppelt": { text: "Bu adla bir grup zaten var.", gut: false },
      zugeteilt: { text: "Atama kaydedildi.", gut: true },
      eingabe: { text: teamTexte.tr.meldung.eingabe, gut: false },
      fehler: { text: teamTexte.tr.meldung.fehler, gut: false },
    },
    anderesLand: "başka ülke",
    vorgeschlagen: (n) => `${n} kişi gruplara ayrıldı. Lütfen kontrol et ve gerekirse elle düzelt.`,
    anwesenheitAm: "Katılım günü", zeigen: "Göster",
    einteilenNach: (n) => `Grubu olmayan ${n} kişiyi şuna göre ayır`, land: "Ülke", vorschlag: "Öneriyi uygula",
    da: (da, alle) => `${da}/${alle} burada`,
    raumNr: (raum) => `Salon ${raum}`, raumOffen: "Salon ve yürütücü belli değil",
    gruppeFuer: (name) => `Grup: ${name}`, keine: "yok", ok: "Tamam",
    raumUndLeitung: "Salon ve yürütücü", raum: "Salon", leitung: "Yürütücü", gruppeEntfernen: "Grubu kaldır",
    ohneGruppe: (n) => `Grubu olmayanlar (${n})`, gruppe: "Grup",
    neueGruppe: "Yeni grup", nameBeispiel: "Ad, ör. Almanya", anlegen: "Oluştur",
  },
  fr: {
    hinweise: {
      gruppe: { text: "Groupe enregistré.", gut: true },
      "gruppe-entfernt": { text: "Groupe supprimé.", gut: true },
      "gruppe-doppelt": { text: "Un groupe portant ce nom existe déjà.", gut: false },
      zugeteilt: { text: "Répartition enregistrée.", gut: true },
      eingabe: { text: teamTexte.fr.meldung.eingabe, gut: false },
      fehler: { text: teamTexte.fr.meldung.fehler, gut: false },
    },
    anderesLand: "autre pays",
    vorgeschlagen: (n) => `${n} personnes réparties. Vérifie et ajuste à la main si besoin.`,
    anwesenheitAm: "Présence le", zeigen: "Afficher",
    einteilenNach: (n) => `Répartir les ${n} personnes sans groupe par`, land: "Pays", vorschlag: "Appliquer la proposition",
    da: (da, alle) => `${da}/${alle} présents`,
    raumNr: (raum) => `Salle ${raum}`, raumOffen: "Salle et responsable à définir",
    gruppeFuer: (name) => `Groupe de ${name}`, keine: "aucun", ok: "OK",
    raumUndLeitung: "Salle et responsable", raum: "Salle", leitung: "Responsable", gruppeEntfernen: "Supprimer le groupe",
    ohneGruppe: (n) => `Sans groupe (${n})`, gruppe: "Groupe",
    neueGruppe: "Nouveau groupe", nameBeispiel: "Nom, p. ex. Allemagne", anlegen: "Créer",
  },
};

/** Texte der Leseansicht (Umbau 16.11.2026). */
const V: Record<TeamSprache, { bearbeiten: string; fertig: string; keine: string; stand: (g: number, p: number, o: number) => string }> = {
  de: { bearbeiten: "Gruppen bearbeiten", fertig: "Fertig", keine: "Noch keine Gruppen. Über „Gruppen bearbeiten“ anlegen.",
    stand: (g, p, o) => `${g} Gruppen · ${p} Personen${o ? ` · ${o} ohne Gruppe` : ""}` },
  tr: { bearbeiten: "Grupları düzenle", fertig: "Bitti", keine: "Henüz grup yok. „Grupları düzenle“ ile oluştur.",
    stand: (g, p, o) => `${g} grup · ${p} kişi${o ? ` · ${o} kişi grupsuz` : ""}` },
  fr: { bearbeiten: "Modifier les groupes", fertig: "Terminé", keine: "Pas encore de groupes. Les créer via «\u00a0Modifier les groupes\u00a0».",
    stand: (g, p, o) => `${g} groupes · ${p} personnes${o ? ` · ${o} sans groupe` : ""}` },
};

/** Gruppen und Räume eines Moduls (z. B. Ländergruppen), Einteilung mit Vorschlag nach Land oder GT/KGT, Anwesenheit je Gruppe. */
export default async function Gruppen({ params, searchParams }: PageProps<"/team/module/[id]/gruppen">) {
  const staff = await requireStaff("orga");
  const l = staff.sprache;
  const t = T[l];
  const w = teamTexte[l].wort;
  const laender: Record<string, string> = { DE: "DE", AT: "AT", FR: "FR", CH: "CH", NL: "NL", BE: "BE", other: t.anderesLand };
  // wie tagBezeichnung in lib/eventtag, mit dem Datum in der Sprache des Team-Bereichs
  const tagFormat = new Intl.DateTimeFormat(teamLocale[l], { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Berlin" });
  const tagBezeichnung = (tag: { starts_at: string; label?: string | null }, modul: string) =>
    `${modul} · ${tagFormat.format(new Date(tag.starts_at))}${tag.label ? ` · ${tag.label}` : ""}`;
  const { id } = await params;
  const { hinweis, tag: gewaehlterTag, bearbeiten: bearbeitenWahl } = await searchParams;
  // Lesen ist der Normalfall (übersichtlich, nur Namen); Auswahlfelder zum Umsetzen erst nach „Bearbeiten“ (Umbau 16.11.2026)
  const bearbeiten = bearbeitenWahl === "1";
  const v = V[l];
  if (!istToken(id)) notFound();
  const supabase = await createClient();
  const [{ data: modul }, { data: gruppen }, { data: kandidaten }] = await Promise.all([
    supabase.from("modules").select("id, title, module_days(id, day, starts_at, label)").eq("id", id).maybeSingle(),
    supabase.from("module_groups").select("id, name, room, leader, position").eq("module_id", id).order("position").order("name"),
    supabase.rpc("get_grouping_candidates", { p_module_id: id }),
  ]);
  if (!modul) notFound();
  const tage = [...modul.module_days].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const tag = tage.find((x) => x.id === gewaehlterTag) ?? tage[0];
  // Anwesenheit und Mitglieder je Gruppe für den gewählten Tag
  const { data: zeilen } = tag ? await supabase.rpc("get_group_attendance", { p_module_day_id: tag.id }) : { data: [] };
  const ohneGruppe = (kandidaten ?? []).filter((k) => !k.group_id);
  const code = typeof hinweis === "string" && hinweis.startsWith("vorschlag-") ? undefined : hinweis;
  const vorgeschlagen = typeof hinweis === "string" && hinweis.startsWith("vorschlag-") ? Number(hinweis.split("-")[1]) : null;

  return (
    <>
      <TeamKopf staff={staff} aktiv="module" breit />
      <main lang={l} className="mx-auto max-w-7xl px-4 py-8">
        <ModulReiter id={id} titel={modul.title} aktiv="gruppen/" />
        <Hinweis code={code} texte={t.hinweise} />
        {vorgeschlagen !== null && <p role="status" className="mt-4 rounded-2xl bg-emerald-100 p-4 text-emerald-950">{t.vorgeschlagen(vorgeschlagen)}</p>}

        <div className="flex flex-wrap items-center gap-2">
          {tage.length > 1 && <span className="text-sm font-semibold">{t.anwesenheitAm}</span>}
          {tage.length > 1 && tage.map((x) => (
            <Link key={x.id} href={`/team/module/${id}/gruppen/?tag=${x.id}${bearbeiten ? "&bearbeiten=1" : ""}`} aria-current={x.id === tag?.id ? "page" : undefined}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${x.id === tag?.id ? "bg-ink text-paper" : "bg-weiss ring-1 ring-line hover:ring-ink"}`}>
              {tagFormat.format(new Date(x.starts_at))}
            </Link>
          ))}
          <span className="ml-auto text-sm text-ink-soft">{v.stand((gruppen ?? []).length, (zeilen ?? []).length, ohneGruppe.length)}</span>
          <Link href={`/team/module/${id}/gruppen/?tag=${tag?.id ?? ""}${bearbeiten ? "" : "&bearbeiten=1"}`} className={bearbeiten ? "knopf" : "knopf-hell"}>{bearbeiten ? v.fertig : v.bearbeiten}</Link>
        </div>

        {!bearbeiten && (
          <div className="mt-6 space-y-8">
            {[...new Set((gruppen ?? []).map((g) => g.room ?? ""))].map((raum) => {
              const imRaum = (gruppen ?? []).filter((g) => (g.room ?? "") === raum);
              return (
                <section key={raum || "ohne"}>
                  <h2 className="mb-3 text-sm font-semibold tracking-wide text-ink-soft uppercase">{raum || t.raumOffen}</h2>
                  <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    {imRaum.map((g) => {
                      const mitglieder = (zeilen ?? []).filter((z) => z.group_id === g.id);
                      const da = mitglieder.filter((m) => m.checked_in).length;
                      const [kopf, ...rest] = g.name.split("·");
                      return (
                        <li key={g.id} className="rounded-2xl bg-weiss p-4 ring-1 ring-line">
                          <p className="flex items-baseline justify-between gap-2">
                            <span className="font-display text-lg font-bold">{kopf.trim()}</span>
                            <span className="text-xs text-ink-soft tabular-nums">{t.da(da, mitglieder.length)}</span>
                          </p>
                          {rest.length > 0 && <p className="text-sm leading-snug text-ink-soft">{rest.join("·").trim()}</p>}
                          {g.leader && <p className="mt-1 text-xs text-ink-soft">{g.leader}</p>}
                          <ul className="mt-2 space-y-0.5 text-sm">
                            {mitglieder.map((m) => (
                              <li key={m.participant_id} className="flex items-center gap-2">
                                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${m.checked_in ? "bg-forest" : "bg-line"}`} aria-hidden />
                                <Link href={`/team/teilnehmende/${m.participant_id}/?modul=${id}`} className="truncate hover:underline">{m.name}</Link>
                                {m.country && <span className="ml-auto shrink-0 text-[11px] text-ink-soft">{laender[m.country]}</span>}
                              </li>
                            ))}
                          </ul>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
            {ohneGruppe.length > 0 && (
              <details className="rounded-2xl bg-white/60 p-4 text-sm ring-1 ring-line">
                <summary className="cursor-pointer font-semibold">{t.ohneGruppe(ohneGruppe.length)}</summary>
                <p className="mt-2 text-ink-soft">{ohneGruppe.map((a) => a.name).join(", ")}</p>
              </details>
            )}
            {(gruppen ?? []).length === 0 && <p className="karte text-ink-soft">{v.keine}</p>}
          </div>
        )}

        {bearbeiten && <>
        <div className="mt-6 flex flex-wrap items-end gap-2">
          {ohneGruppe.length > 0 && (
            <form action={gruppenVorschlag} className="flex items-end gap-2">
              <input type="hidden" name="module_id" value={id} />
              <div><label className="etikett" htmlFor="nach">{t.einteilenNach(ohneGruppe.length)}</label>
                <select id="nach" name="nach" className="feld"><option value="country">{t.land}</option><option value="branch">GT/KGT</option></select></div>
              <button type="submit" className="knopf">{t.vorschlag}</button>
            </form>
          )}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(gruppen ?? []).map((g) => {
            const mitglieder = (zeilen ?? []).filter((z) => z.group_id === g.id);
            const da = mitglieder.filter((m) => m.checked_in).length;
            return (
              <section key={g.id} className="karte">
                <div className="flex items-baseline gap-2">
                  <h2 className="font-display mr-auto text-xl font-bold">{g.name}</h2>
                  <span className="chip bg-paper-deep">{t.da(da, mitglieder.length)}</span>
                </div>
                <p className="text-sm text-ink-soft">{[g.room && t.raumNr(g.room), g.leader].filter(Boolean).join(" · ") || t.raumOffen}</p>
                <ul className="mt-3 divide-y divide-line text-sm">
                  {mitglieder.map((m) => (
                    <li key={m.participant_id} className="flex items-center gap-2 py-1.5">
                      <span className={`h-2 w-2 rounded-full ${m.checked_in ? "bg-emerald-600" : "bg-line"}`} aria-hidden />
                      <span className="mr-auto">{m.name}</span>
                      <span className="text-xs text-ink-soft">{[m.country && laender[m.country], m.branch].filter(Boolean).join(" · ")}</span>
                      <form action={mitgliedZuteilen}>
                        <input type="hidden" name="module_id" value={id} /><input type="hidden" name="participant_id" value={m.participant_id} />
                        <label className="sr-only" htmlFor={`g-${m.participant_id}`}>{t.gruppeFuer(m.name)}</label>
                        <select id={`g-${m.participant_id}`} name="group_id" defaultValue={g.id} className="rounded-lg bg-white px-1 py-0.5 text-xs ring-1 ring-line">
                          {(gruppen ?? []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}<option value="">{t.keine}</option>
                        </select>
                        <button type="submit" className="ml-1 text-xs font-semibold underline">{t.ok}</button>
                      </form>
                    </li>
                  ))}
                </ul>
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold text-ink-soft">{t.raumUndLeitung}</summary>
                  <form action={gruppeSpeichern} className="mt-2 grid gap-2">
                    <input type="hidden" name="module_id" value={id} /><input type="hidden" name="id" value={g.id} />
                    <input name="name" defaultValue={g.name} required className="feld" aria-label={w.name} />
                    <input name="room" defaultValue={g.room ?? ""} placeholder={t.raum} className="feld" aria-label={t.raum} />
                    <input name="leader" defaultValue={g.leader ?? ""} placeholder={t.leitung} className="feld" aria-label={t.leitung} />
                    <button type="submit" className="knopf-hell justify-self-start">{w.speichern}</button>
                  </form>
                  {mitglieder.length === 0 && (
                    <form action={gruppeEntfernen} className="mt-1">
                      <input type="hidden" name="module_id" value={id} /><input type="hidden" name="id" value={g.id} />
                      <button type="submit" className="text-xs font-semibold text-ink-soft underline">{t.gruppeEntfernen}</button>
                    </form>
                  )}
                </details>
              </section>
            );
          })}
        </div>

        {ohneGruppe.length > 0 && (
          <section className="karte mt-6">
            <h2 className="font-display text-xl font-bold">{t.ohneGruppe(ohneGruppe.length)}</h2>
            <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {ohneGruppe.map((a) => (
                <li key={a.participant_id} className="flex items-center gap-2">
                  <span className="mr-auto">{a.name}</span>
                  {(gruppen ?? []).length > 0 && (
                    <form action={mitgliedZuteilen}>
                      <input type="hidden" name="module_id" value={id} /><input type="hidden" name="participant_id" value={a.participant_id} />
                      <label className="sr-only" htmlFor={`o-${a.participant_id}`}>{t.gruppe}</label>
                      <select id={`o-${a.participant_id}`} name="group_id" className="rounded-lg bg-white px-1 py-0.5 text-xs ring-1 ring-line">{(gruppen ?? []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
                      <button type="submit" className="ml-1 text-xs font-semibold underline">{t.ok}</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="karte mt-6">
          <h2 className="font-display text-xl font-bold">{t.neueGruppe}</h2>
          <form action={gruppeSpeichern} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="module_id" value={id} />
            <input name="name" required placeholder={t.nameBeispiel} className="feld !w-56" aria-label={w.name} />
            <input name="room" placeholder={t.raum} className="feld !w-40" aria-label={t.raum} />
            <input name="leader" placeholder={t.leitung} className="feld !w-56" aria-label={t.leitung} />
            <button type="submit" className="knopf-hell">{t.anlegen}</button>
          </form>
        </section>
        </>}
      </main>
    </>
  );
}
