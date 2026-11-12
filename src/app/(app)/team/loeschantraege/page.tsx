import type { Metadata } from "next";
import Link from "next/link";
import { Hinweis } from "@/components/team/Hinweis";
import { Rueckfrage } from "@/components/team/Rueckfrage";
import { TeamKopf } from "@/components/team/TeamKopf";
import { LoeschVorschau } from "@/components/team/LoeschVorschau";
import { loeschungAblehnen, loeschungAusfuehren, loeschungVorlegen } from "@/lib/aktionen/datenschutz";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { teamLocale, type TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";
import { jetztMs } from "@/lib/zeit";

export const metadata: Metadata = { title: "Löschanträge | SES Academy" };

const de = {
  hinweise: {
    vorgelegt: { text: "Zur Freigabe vorgelegt. Eine zweite Person (Admin oder Vorstand) gibt unter „Freigaben“ frei, danach kannst du hier löschen.", gut: true },
    "schon-vorgelegt": { text: "Diese Löschung liegt schon zur Freigabe vor.", gut: false },
    abgelaufen: { text: "Die Freigabe ist älter als 24 Stunden. Bitte neu vorlegen.", gut: false },
    geloescht: { text: "Erledigt: Konto und Kontaktdaten gelöscht, Anwesenheiten und Hausaufgaben ohne Namen erhalten.", gut: true },
    abgelehnt: { text: "Abgelehnt. Die Person sieht die Notiz in „Mein Bereich“.", gut: true },
    "notiz-fehlt": { text: "Zum Ablehnen bitte eine Notiz für die Person schreiben (Grund).", gut: false },
    "schon-erledigt": { text: "Dieser Antrag ist schon erledigt.", gut: false },
    bestaetigen: { text: "Bitte die Rückfrage bestätigen. Es wurde nichts gelöscht.", gut: false },
    eingabe: { text: "Bitte die Angaben prüfen.", gut: false },
    fehler: { text: "Das hat nicht geklappt.", gut: false },
  } as Record<string, { text: string; gut: boolean }>,
  status: { offen: "offen", erledigt: "erledigt", abgelehnt: "abgelehnt", zurueckgezogen: "zurückgezogen" } as Record<string, string>,
  intro: "Teilnehmende beantragen in „Mein Bereich“ die Löschung ihres Kontos. Gelöscht werden Login, Kontaktdaten, Foto, Notizen und Übernachtungsangaben; Anwesenheiten und Hausaufgaben bleiben ohne Namen für die Auswertung. Gelöscht wird nach dem Vier-Augen-Prinzip: Ein Admin legt vor, eine zweite Person (Admin oder Vorstand) gibt unter „Freigaben“ frei, dann löscht die vorlegende Person.",
  offen: (n: number) => `Offen (${n})`,
  nichtsOffen: "Nichts offen.",
  beantragtAm: (datum: string) => `beantragt am ${datum}`,
  liegtVor: (name: string) => `Liegt zur Freigabe vor (von ${name}). Eine zweite Person gibt unter „Freigaben“ frei.`,
  freigegebenVon: (name: string, notiz: string | null) => `Freigegeben von ${name}${notiz ? `: „${notiz}“` : ""}. Ausführen innerhalb von 24 Stunden.`,
  notizOptional: "Notiz (optional)", notizLoeschung: "Notiz zur Löschung",
  jetztLoeschen: "Jetzt löschen", jaLoeschen: "Ja, endgültig löschen",
  frageLoeschen: (name: string | null) => `${name ?? "Diese Person"} jetzt endgültig löschen und anonymisieren? Das lässt sich nicht rückgängig machen.`,
  nurVorlegende: (name: string | null) => `Freigegeben. Löschen kann ${name ?? "die vorlegende Person"}, die es vorgelegt hat.`,
  letzteAbgelehnt: (notiz: string | null) => `Letzte Vorlage abgelehnt${notiz ? `: „${notiz}“` : ""}.`,
  letzteAbgelaufen: "Die letzte Freigabe ist abgelaufen.",
  vorlegen: "Zur Freigabe vorlegen", jaVorlegen: "Ja, vorlegen",
  frageVorlegen: (name: string | null) => `Löschung von ${name ?? "dieser Person"} zur Freigabe vorlegen? Eine zweite Person sieht diese Übersicht und gibt frei; danach löschst du hier.`,
  grundPlatzhalter: "Grund für die Person", grundAblehnung: "Grund für die Ablehnung", ablehnen: "Ablehnen",
  verlauf: "Verlauf", beantragt: "Beantragt", entschieden: "Entschieden", notiz: "Notiz",
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    hinweise: {
      vorgelegt: { text: "Onaya sunuldu. İkinci bir kişi (yönetici ya da yönetim kurulu) „Onaylar“ bölümünde onaylar, ardından buradan silebilirsin.", gut: true },
      "schon-vorgelegt": { text: "Bu silme işlemi zaten onayda bekliyor.", gut: false },
      abgelaufen: { text: "Onay 24 saatten eski. Lütfen yeniden onaya sun.", gut: false },
      geloescht: { text: "Tamamlandı: Hesap ve iletişim bilgileri silindi, katılım ve ödev kayıtları isimsiz olarak saklandı.", gut: true },
      abgelehnt: { text: "Reddedildi. Kişi notu „Mein Bereich“ sayfasında görür.", gut: true },
      "notiz-fehlt": { text: "Reddetmek için lütfen kişiye bir not (gerekçe) yaz.", gut: false },
      "schon-erledigt": { text: "Bu talep zaten sonuçlandı.", gut: false },
      bestaetigen: { text: "Lütfen onay sorusunu onayla. Hiçbir şey silinmedi.", gut: false },
      eingabe: { text: "Lütfen bilgileri kontrol et.", gut: false },
      fehler: { text: "Bu işlem olmadı.", gut: false },
    },
    status: { offen: "açık", erledigt: "tamamlandı", abgelehnt: "reddedildi", zurueckgezogen: "geri çekildi" },
    intro: "Katılımcılar hesaplarının silinmesini „Mein Bereich“ sayfasında talep eder. Giriş hesabı, iletişim bilgileri, fotoğraf, notlar ve konaklama bilgileri silinir; katılım ve ödev kayıtları değerlendirme için isimsiz olarak kalır. Silme dört göz ilkesiyle yapılır: Bir yönetici onaya sunar, ikinci bir kişi (yönetici ya da yönetim kurulu) „Onaylar“ bölümünde onaylar, ardından onaya sunan kişi siler.",
    offen: (n) => `Açık (${n})`,
    nichtsOffen: "Açık bir şey yok.",
    beantragtAm: (datum) => `talep tarihi: ${datum}`,
    liegtVor: (name) => `Onayda bekliyor (sunan: ${name}). İkinci bir kişi „Onaylar“ bölümünde onaylar.`,
    freigegebenVon: (name, notiz) => `Onaylayan: ${name}${notiz ? `: „${notiz}“` : ""}. 24 saat içinde uygula.`,
    notizOptional: "Not (isteğe bağlı)", notizLoeschung: "Silme notu",
    jetztLoeschen: "Şimdi sil", jaLoeschen: "Evet, kalıcı olarak sil",
    frageLoeschen: (name) => `${name ?? "Bu kişi"} şimdi kalıcı olarak silinsin ve anonimleştirilsin mi? Bu geri alınamaz.`,
    nurVorlegende: (name) => `Onaylandı. Silme işlemini yalnızca onaya sunan kişi yapabilir: ${name ?? "onaya sunan kişi"}.`,
    letzteAbgelehnt: (notiz) => `Son sunum reddedildi${notiz ? `: „${notiz}“` : ""}.`,
    letzteAbgelaufen: "Son onayın süresi doldu.",
    vorlegen: "Onaya sun", jaVorlegen: "Evet, onaya sun",
    frageVorlegen: (name) => `${name ?? "Bu kişi"} için silme işlemi onaya sunulsun mu? İkinci bir kişi bu özeti görür ve onaylar; ardından silme işlemini sen burada yaparsın.`,
    grundPlatzhalter: "Kişi için gerekçe", grundAblehnung: "Reddetme gerekçesi", ablehnen: "Reddet",
    verlauf: "Geçmiş", beantragt: "Talep", entschieden: "Karar", notiz: "Not",
  },
  fr: {
    hinweise: {
      vorgelegt: { text: "Soumis pour validation. Une deuxième personne (admin ou bureau) valide dans « Validations », ensuite tu peux supprimer ici.", gut: true },
      "schon-vorgelegt": { text: "Cette suppression est déjà en attente de validation.", gut: false },
      abgelaufen: { text: "La validation date de plus de 24 heures. Merci de la soumettre à nouveau.", gut: false },
      geloescht: { text: "C’est fait : compte et coordonnées supprimés, présences et devoirs conservés sans nom.", gut: true },
      abgelehnt: { text: "Refusé. La personne voit la note dans « Mon espace ».", gut: true },
      "notiz-fehlt": { text: "Pour refuser, merci d’écrire une note pour la personne (motif).", gut: false },
      "schon-erledigt": { text: "Cette demande est déjà traitée.", gut: false },
      bestaetigen: { text: "Merci de confirmer la question. Rien n’a été supprimé.", gut: false },
      eingabe: { text: "Merci de vérifier les informations.", gut: false },
      fehler: { text: "Cela n’a pas fonctionné.", gut: false },
    },
    status: { offen: "en attente", erledigt: "traitée", abgelehnt: "refusée", zurueckgezogen: "retirée" },
    intro: "Les participants demandent la suppression de leur compte dans « Mon espace ». Sont supprimés : connexion, coordonnées, photo, notes et informations d’hébergement ; les présences et les devoirs restent sans nom pour l’analyse. La suppression suit le principe des quatre yeux : un admin soumet, une deuxième personne (admin ou bureau) valide dans « Validations », puis la personne qui a soumis supprime.",
    offen: (n) => `En attente (${n})`,
    nichtsOffen: "Rien en attente.",
    beantragtAm: (datum) => `demandé le ${datum}`,
    liegtVor: (name) => `En attente de validation (soumis par ${name}). Une deuxième personne valide dans « Validations ».`,
    freigegebenVon: (name, notiz) => `Validé par ${name}${notiz ? ` : « ${notiz} »` : ""}. À exécuter dans les 24 heures.`,
    notizOptional: "Note (facultatif)", notizLoeschung: "Note sur la suppression",
    jetztLoeschen: "Supprimer maintenant", jaLoeschen: "Oui, supprimer définitivement",
    frageLoeschen: (name) => `Supprimer et anonymiser définitivement ${name ?? "cette personne"} maintenant ? Cette action est irréversible.`,
    nurVorlegende: (name) => `Validé. Seule la personne qui a soumis la demande peut supprimer : ${name ?? "la personne qui l’a soumise"}.`,
    letzteAbgelehnt: (notiz) => `Dernière demande refusée${notiz ? ` : « ${notiz} »` : ""}.`,
    letzteAbgelaufen: "La dernière validation a expiré.",
    vorlegen: "Soumettre pour validation", jaVorlegen: "Oui, soumettre",
    frageVorlegen: (name) => `Soumettre la suppression de ${name ?? "cette personne"} pour validation ? Une deuxième personne voit ce récapitulatif et valide ; ensuite, tu supprimes ici.`,
    grundPlatzhalter: "Motif pour la personne", grundAblehnung: "Motif du refus", ablehnen: "Refuser",
    verlauf: "Historique", beantragt: "Demandé", entschieden: "Décidé", notiz: "Note",
  },
};

/**
 * Löschanträge aus „Mein Bereich“ (nur Admin): Was gelöscht und was ohne Namen für die Auswertung behalten wird,
 * bestätigen oder mit Notiz ablehnen. Keine Selbstlöschung: Anwesenheiten und Hausaufgaben gehören zur Auswertung.
 */
export default async function Loeschantraege({ searchParams }: PageProps<"/team/loeschantraege">) {
  const staff = await requireStaff("admin");
  const l = staff.sprache;
  const t = T[l];
  const zeit = new Intl.DateTimeFormat(teamLocale[l], { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" });
  const { hinweis } = await searchParams;
  const supabase = await createClient();
  const [{ data: antraege }, { data: freigaben }, { data: team }] = await Promise.all([
    supabase.from("deletion_requests").select("*").order("requested_at", { ascending: false }).limit(100),
    supabase.from("approvals").select("id, status, requested_by, decided_by, decided_at, decision_note, payload").eq("action", "person_loeschen").order("requested_at", { ascending: false }),
    supabase.rpc("get_team_members"),
  ]);
  const name = new Map((team ?? []).map((m) => [m.user_id, m.display_name]));
  const jetzt = jetztMs();
  // Jüngste Vorlage je Antrag (Vier-Augen-Prinzip)
  const vorlage = (antragId: string) => (freigaben ?? []).find((f) => (f.payload as { antrag?: string }).antrag === antragId);
  const offen = (antraege ?? []).filter((a) => a.status === "offen");
  const rest = (antraege ?? []).filter((a) => a.status !== "offen");
  const vorschau = new Map(await Promise.all(offen.map(async (a) => {
    const { data } = await supabase.rpc("deletion_preview", { p_request_id: a.id });
    return [a.id, data as { name: string; email: string | null; zahlen: Record<string, number | boolean> } | null] as const;
  })));

  return (
    <>
      <TeamKopf staff={staff} aktiv="loeschantraege" />
      <main lang={l} className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="font-display text-3xl font-bold">{teamTexte[l].bereiche.loeschantraege}</h1>
        <p className="mt-1 max-w-3xl text-ink-soft">{t.intro}</p>
        <Hinweis code={hinweis} texte={t.hinweise} />

        <section className="mt-6">
          <h2 className="font-display text-xl font-bold">{t.offen(offen.length)}</h2>
          {offen.length === 0 && <p className="mt-2 text-ink-soft">{t.nichtsOffen}</p>}
          <ul className="mt-3 space-y-4">
            {offen.map((a) => {
              const v = vorschau.get(a.id);
              const z = v?.zahlen ?? {};
              return (
                <li key={a.id} className="karte">
                  <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{t.beantragtAm(zeit.format(new Date(a.requested_at)))}</p>
                  <p className="mt-1 text-lg font-semibold">
                    {a.participant_id ? <Link href={`/team/teilnehmende/${a.participant_id}/`} className="hover:underline">{v?.name ?? "?"}</Link> : v?.name ?? "?"}
                    {v?.email && <span className="ml-2 text-sm font-normal text-ink-soft">{v.email}</span>}
                  </p>
                  {a.reason && <p className="mt-2 rounded-2xl bg-paper p-3 text-sm">„{a.reason}“</p>}
                  <LoeschVorschau zahlen={z} sprache={l} />
                  {(() => {
                    const f = vorlage(a.id);
                    const gueltig = f?.status === "freigegeben" && f.decided_at && Date.parse(f.decided_at) > jetzt - 86_400_000;
                    if (f?.status === "offen") return <p className="mt-4 rounded-2xl bg-gelb-hell p-3 text-sm font-semibold">{t.liegtVor(name.get(f.requested_by) ?? "?")}</p>;
                    if (gueltig && f.requested_by === staff.userId) return (
                      <form action={loeschungAusfuehren} className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4">
                        <input type="hidden" name="freigabe" value={f.id} />
                        <p className="basis-full text-sm font-semibold text-emerald-900">{t.freigegebenVon(name.get(f.decided_by ?? "") ?? "?", f.decision_note)}</p>
                        <input name="notiz" placeholder={t.notizOptional} aria-label={t.notizLoeschung} className="feld !w-64" />
                        <Rueckfrage sprache={l} knopf={t.jetztLoeschen} knopfKlasse="rounded-full bg-red-800 px-4 py-2 text-sm font-semibold text-white" gefahr ja={t.jaLoeschen}
                          frage={t.frageLoeschen(v?.name ?? null)} />
                      </form>
                    );
                    if (gueltig) return <p className="mt-4 rounded-2xl bg-paper-deep p-3 text-sm">{t.nurVorlegende(name.get(f.requested_by) ?? null)}</p>;
                    return (
                      <form action={loeschungVorlegen} className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4">
                        <input type="hidden" name="id" value={a.id} />
                        {f?.status === "abgelehnt" && <p className="basis-full text-sm text-rot">{t.letzteAbgelehnt(f.decision_note)}</p>}
                        {f?.status === "freigegeben" && <p className="basis-full text-sm text-ink-soft">{t.letzteAbgelaufen}</p>}
                        <Rueckfrage sprache={l} knopf={t.vorlegen} knopfKlasse="knopf" ja={t.jaVorlegen}
                          frage={t.frageVorlegen(v?.name ?? null)} />
                      </form>
                    );
                  })()}
                  <form action={loeschungAblehnen} className="mt-2 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={a.id} />
                    <input name="notiz" placeholder={t.grundPlatzhalter} aria-label={t.grundAblehnung} className="feld !w-64" />
                    <button type="submit" className="knopf-hell">{t.ablehnen}</button>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>

        {rest.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-xl font-bold">{t.verlauf}</h2>
            <div className="mt-3 overflow-x-auto rounded-3xl bg-weiss ring-1 ring-line">
              <table className="tabelle min-w-[32rem]">
                <thead><tr><th>{t.beantragt}</th><th>{teamTexte[l].wort.status}</th><th>{t.entschieden}</th><th>{t.notiz}</th></tr></thead>
                <tbody>
                  {rest.map((a) => (
                    <tr key={a.id}>
                      <td className="whitespace-nowrap">{zeit.format(new Date(a.requested_at))}</td>
                      <td>{t.status[a.status] ?? a.status}</td>
                      <td className="whitespace-nowrap">{a.decided_at ? zeit.format(new Date(a.decided_at)) : "–"}</td>
                      <td>{a.decision_note ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
