import type { Metadata } from "next";
import Link from "next/link";
import { Hinweis } from "@/components/team/Hinweis";
import { LoeschVorschau } from "@/components/team/LoeschVorschau";
import { TeamKopf } from "@/components/team/TeamKopf";
import { freigabeEntscheiden } from "@/lib/aktionen/freigaben";
import { requireStaff, type StaffRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { teamLocale, type TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";
import { jetztMs } from "@/lib/zeit";

export const metadata: Metadata = { title: "Freigaben | SES Academy" };

const de = {
  hinweise: {
    approved: { text: "Freigegeben. Die anfragende Person kann die Aktion jetzt 24 Stunden lang ausführen.", gut: true },
    rejected: { text: "Abgelehnt.", gut: true },
    own_request: { text: "Den eigenen Antrag muss eine andere Person freigeben.", gut: false },
    admin_required: { text: "Team-Zugänge gibt nur ein Admin frei.", gut: false },
    already_decided: { text: "Darüber wurde schon entschieden.", gut: false },
    eingabe: { text: "Bitte die Angaben prüfen.", gut: false },
    fehler: { text: "Das hat nicht geklappt.", gut: false },
  } as Record<string, { text: string; gut: boolean }>,
  aktion: { nachricht: "Nachricht an alle", export: "Export aller Daten", team_zugang: "Team-Zugang", person_loeschen: "Person löschen" } as Record<string, string>,
  status: { offen: "wartet auf Freigabe", freigegeben: "freigegeben", abgelehnt: "abgelehnt", ausgefuehrt: "ausgeführt" } as Record<string, string>,
  intro: "Nachrichten an alle, Exporte aller Daten, neue Team-Zugänge und das Löschen von Personen bestätigt eine zweite Person (Entscheidung vom 25.10.2026).",
  wartenAufDich: (n: number) => `Warten auf dich (${n})`,
  nichtsOffen: "Nichts offen.",
  beantragtVon: (name: string) => `beantragt von ${name}`,
  deutschBetreff: "Deutsch · Betreff:", tuerkischBetreff: "Türkisch · Betreff:",
  grund: (grund: string) => `Grund der Person: „${grund}“`,
  rolle: "Rolle",
  notizOptional: "Notiz (optional)", notiz: "Notiz",
  freigeben: "Freigeben", ablehnen: "Ablehnen",
  verlauf: "Verlauf", wann: "Wann", was: "Was", von: "Von",
  entschiedenVon: (name: string) => ` · entschieden von ${name}`,
  ausfuehren: "freigegeben, jetzt ausführen",
  abgelaufen: "Freigabe abgelaufen",
  ergebnis: (gesendet: number, fehler?: number) => ` (${gesendet} verschickt${fehler ? `, ${fehler} fehlgeschlagen` : ""})`,
  notizZitat: (notiz: string) => `Notiz: „${notiz}“`,
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    hinweise: {
      approved: { text: "Onaylandı. Talep eden kişi işlemi şimdi 24 saat boyunca uygulayabilir.", gut: true },
      rejected: { text: "Reddedildi.", gut: true },
      own_request: { text: "Kendi talebini başka bir kişinin onaylaması gerekir.", gut: false },
      admin_required: { text: "Ekip erişimlerini yalnızca bir yönetici onaylar.", gut: false },
      already_decided: { text: "Bu konuda zaten karar verildi.", gut: false },
      eingabe: { text: "Lütfen bilgileri kontrol et.", gut: false },
      fehler: { text: "Bu işlem olmadı.", gut: false },
    },
    aktion: { nachricht: "Herkese mesaj", export: "Tüm verilerin dışa aktarımı", team_zugang: "Ekip erişimi", person_loeschen: "Kişiyi silme" },
    status: { offen: "onay bekliyor", freigegeben: "onaylandı", abgelehnt: "reddedildi", ausgefuehrt: "uygulandı" },
    intro: "Herkese mesajları, tüm verilerin dışa aktarımını, yeni ekip erişimlerini ve kişilerin silinmesini ikinci bir kişi onaylar (25.10.2026 tarihli karar).",
    wartenAufDich: (n) => `Seni bekleyenler (${n})`,
    nichtsOffen: "Açık bir şey yok.",
    beantragtVon: (name) => `talep eden: ${name}`,
    deutschBetreff: "Almanca · Konu:", tuerkischBetreff: "Türkçe · Konu:",
    grund: (grund) => `Kişinin gerekçesi: „${grund}“`,
    rolle: "Rol",
    notizOptional: "Not (isteğe bağlı)", notiz: "Not",
    freigeben: "Onayla", ablehnen: "Reddet",
    verlauf: "Geçmiş", wann: "Ne zaman", was: "Ne", von: "Kimden",
    entschiedenVon: (name) => ` · karar veren: ${name}`,
    ausfuehren: "onaylandı, şimdi uygula",
    abgelaufen: "Onayın süresi doldu",
    ergebnis: (gesendet, fehler) => ` (${gesendet} gönderildi${fehler ? `, ${fehler} başarısız oldu` : ""})`,
    notizZitat: (notiz) => `Not: „${notiz}“`,
  },
  fr: {
    hinweise: {
      approved: { text: "Validé. La personne qui a fait la demande peut maintenant exécuter l’action pendant 24 heures.", gut: true },
      rejected: { text: "Refusé.", gut: true },
      own_request: { text: "Ta propre demande doit être validée par une autre personne.", gut: false },
      admin_required: { text: "Seul un admin peut valider les accès à l’équipe.", gut: false },
      already_decided: { text: "Une décision a déjà été prise.", gut: false },
      eingabe: { text: "Merci de vérifier les informations.", gut: false },
      fehler: { text: "Cela n’a pas fonctionné.", gut: false },
    },
    aktion: { nachricht: "Message à tous", export: "Export de toutes les données", team_zugang: "Accès à l’équipe", person_loeschen: "Supprimer une personne" },
    status: { offen: "en attente de validation", freigegeben: "validé", abgelehnt: "refusé", ausgefuehrt: "exécuté" },
    intro: "Les messages à tous, les exports de toutes les données, les nouveaux accès à l’équipe et la suppression de personnes sont confirmés par une deuxième personne (décision du 25.10.2026).",
    wartenAufDich: (n) => `En attente de toi (${n})`,
    nichtsOffen: "Rien en attente.",
    beantragtVon: (name) => `demandé par ${name}`,
    deutschBetreff: "Allemand · Objet :", tuerkischBetreff: "Turc · Objet :",
    grund: (grund) => `Motif de la personne : « ${grund} »`,
    rolle: "Rôle",
    notizOptional: "Note (facultatif)", notiz: "Note",
    freigeben: "Valider", ablehnen: "Refuser",
    verlauf: "Historique", wann: "Quand", was: "Quoi", von: "De",
    entschiedenVon: (name) => ` · décidé par ${name}`,
    ausfuehren: "validé, exécuter maintenant",
    abgelaufen: "Validation expirée",
    ergebnis: (gesendet, fehler) => ` (${gesendet} envoyés${fehler ? `, ${fehler} en échec` : ""})`,
    notizZitat: (notiz) => `Note : « ${notiz} »`,
  },
};

const ausfuehren: Record<string, string> = { nachricht: "/team/nachrichten/", export: "/team/auswertung/", team_zugang: "/team/team/", person_loeschen: "/team/loeschantraege/" };

/** Vier-Augen-Prinzip: Anträge anderer freigeben oder ablehnen, eigene Anträge verfolgen. */
export default async function Freigaben({ searchParams }: PageProps<"/team/freigaben">) {
  const staff = await requireStaff("alles");
  const l = staff.sprache;
  const t = T[l];
  const w = teamTexte[l];
  const zeit = new Intl.DateTimeFormat(teamLocale[l], { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" });
  const { hinweis } = await searchParams;
  const supabase = await createClient();
  const [{ data: antraege }, { data: team }] = await Promise.all([
    supabase.from("approvals").select("*").order("requested_at", { ascending: false }).limit(100),
    supabase.rpc("get_team_members"),
  ]);
  const name = new Map((team ?? []).map((m) => [m.user_id, m.display_name]));
  const offenFremd = (antraege ?? []).filter((a) => a.status === "offen" && a.requested_by !== staff.userId);
  const rest = (antraege ?? []).filter((a) => !(a.status === "offen" && a.requested_by !== staff.userId));
  const jetzt = jetztMs();

  return (
    <>
      <TeamKopf staff={staff} aktiv="freigaben" />
      <main lang={l} className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="font-display text-3xl font-bold">{w.bereiche.freigaben}</h1>
        <p className="mt-1 text-ink-soft">{t.intro}</p>
        <Hinweis code={hinweis} texte={t.hinweise} />

        <section className="mt-6">
          <h2 className="font-display text-xl font-bold">{t.wartenAufDich(offenFremd.length)}</h2>
          {offenFremd.length === 0 && <p className="mt-2 text-ink-soft">{t.nichtsOffen}</p>}
          <ul className="mt-3 space-y-3">
            {offenFremd.map((a) => {
              const p = a.payload as { betreff?: string; text?: string; betreff_tr?: string; text_tr?: string; anzahl?: number; email?: string; name?: string; rolle?: string; art?: string; filter?: Record<string, string> };
              return (
                <li key={a.id} className="karte">
                  <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{t.aktion[a.action] ?? a.action} · {t.beantragtVon(name.get(a.requested_by) ?? "?")} · {zeit.format(new Date(a.requested_at))}</p>
                  <p className="mt-1 font-semibold">{a.summary}</p>
                  {p.text && <pre lang="de" className="mt-3 max-h-64 overflow-auto rounded-2xl bg-paper p-3 font-sans text-sm whitespace-pre-wrap">{p.text_tr ? <span lang={l} className="mb-1 block text-xs font-semibold text-ink-soft">{t.deutschBetreff} <span lang="de">{p.betreff}</span></span> : null}{p.text}</pre>}
                  {p.text_tr && <pre lang="tr" className="mt-3 max-h-64 overflow-auto rounded-2xl bg-paper p-3 font-sans text-sm whitespace-pre-wrap"><span lang={l} className="mb-1 block text-xs font-semibold text-ink-soft">{t.tuerkischBetreff} <span lang="tr">{p.betreff_tr}</span></span>{p.text_tr}</pre>}
                  {a.action === "person_loeschen" && (() => {
                    const d = a.payload as { email?: string | null; grund?: string; zahlen?: Record<string, number | boolean> };
                    return (
                      <div className="mt-2 text-sm">
                        {d.email && <p className="text-ink-soft">{d.email}</p>}
                        {d.grund && <p className="mt-2 rounded-2xl bg-paper p-3">{t.grund(d.grund)}</p>}
                        {d.zahlen && <LoeschVorschau zahlen={d.zahlen} sprache={l} />}
                      </div>
                    );
                  })()}
                  {a.action === "team_zugang" && (
                    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 text-sm">
                      {p.email && <><dt className="text-ink-soft">{w.wort.email}</dt><dd>{p.email}</dd></>}
                      {p.rolle && <><dt className="text-ink-soft">{t.rolle}</dt><dd className="font-semibold">{w.rollen[p.rolle as StaffRole] ?? p.rolle}</dd></>}
                    </dl>
                  )}
                  <form action={freigabeEntscheiden} className="mt-3 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={a.id} />
                    <input name="notiz" placeholder={t.notizOptional} className="feld !w-64" aria-label={t.notiz} />
                    <button type="submit" name="entscheidung" value="ja" className="knopf">{t.freigeben}</button>
                    <button type="submit" name="entscheidung" value="nein" className="knopf-hell">{t.ablehnen}</button>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-xl font-bold">{t.verlauf}</h2>
          {/* Am Handy seitlich scrollbar statt abgeschnitten */}
          <div className="mt-3 overflow-x-auto rounded-3xl bg-weiss ring-1 ring-line">
          <table className="tabelle min-w-[36rem]">
            <thead><tr><th>{t.wann}</th><th>{t.was}</th><th>{t.von}</th><th>{w.wort.status}</th></tr></thead>
            <tbody>
              {rest.map((a) => {
                const abgelaufen = a.status === "freigegeben" && a.decided_at && Date.parse(a.decided_at) < jetzt - 86_400_000;
                const r = a.result as { gesendet?: number; fehler?: number } | null;
                return (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap">{zeit.format(new Date(a.requested_at))}</td>
                    <td>{a.summary}</td>
                    <td>{name.get(a.requested_by) ?? "?"}{a.decided_by ? t.entschiedenVon(name.get(a.decided_by) ?? "?") : ""}</td>
                    <td>
                      {a.status === "freigegeben" && !abgelaufen && a.requested_by === staff.userId && ausfuehren[a.action]
                        ? <Link href={ausfuehren[a.action]} className="link">{t.ausfuehren}</Link>
                        : abgelaufen ? t.abgelaufen : t.status[a.status] ?? a.status}
                      {r?.gesendet !== undefined && t.ergebnis(r.gesendet, r.fehler)}
                      {a.decision_note && <span className={`mt-1 block text-sm ${a.status === "abgelehnt" ? "font-semibold text-rot" : "text-ink-soft"}`}>{t.notizZitat(a.decision_note)}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </section>
      </main>
    </>
  );
}
