import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Hinweis } from "@/components/team/Hinweis";
import { ModulReiter } from "@/components/team/ModulReiter";
import { TeamKopf } from "@/components/team/TeamKopf";
import { MailHinweis } from "@/components/team/MailHinweis";
import { infoMailAnAlle, infoMailTest } from "@/lib/aktionen/infomail";
import { requireStaff } from "@/lib/auth";
import { istToken } from "@/lib/codes";
import { infoMailInhalt, infoMailSprache, ladeInfoMail } from "@/lib/infomail";
import { infoMailKopf, infoMailWallet, mailBereit, seitenUrl, tagesordnungAnhaenge } from "@/lib/mail";
import { createClient } from "@/lib/supabase/server";
import type { TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";
import { qrPng } from "@/lib/tickets";

export const metadata: Metadata = { title: "Info-Mail | SES Academy" };

const de = {
  hinweise: {
    bestaetigen: { text: "Bitte zuerst bestätigen, dass die Vorschau geprüft ist. Es wurde nichts verschickt.", gut: false },
    "test-gesendet": { text: "Testmail an deine eigene Adresse geschickt. Sie zählt nicht als versendet.", gut: true },
    "test-fehler": { text: "Die Testmail konnte nicht verschickt werden.", gut: false },
    "keine-eigene-mail": { text: "Für dein Konto ist keine E-Mail-Adresse hinterlegt.", gut: false },
    eingabe: { text: "Bitte die Angaben prüfen.", gut: false },
    abgesagt: { text: "Das Modul ist abgesagt. Es wurde nichts verschickt.", gut: false },
  } as Record<string, { text: string; gut: boolean }>,
  versendet: (n: number) => `${n} Info-Mails verschickt`,
  versandFehler: (n: number) => `, ${n} fehlgeschlagen (unten in der Liste).`,
  titel: "Info-Mail",
  text1: "Eine Mail mit allem: Ticket (QR und Kurzcode), Termin und Ort, Übernachtung mit Hotel und Zimmer (das Zimmer nur, wenn es unter Logistik freigegeben ist) und die Tagesordnung.",
  text2: "Deutsch, Türkisch oder Französisch nach der Sprache im Profil.",
  stand: (gesendet: number, alle: number) => `${gesendet} von ${alle} haben sie bekommen`,
  fehlgeschlagen: (n: number) => ` · ${n} fehlgeschlagen`,
  ohneMail: (n: number) => ` · ${n} ohne E-Mail-Adresse`,
  anAlle: "An alle senden",
  abgesagt: "Das Modul ist abgesagt. Info-Mails gehen dafür nicht mehr raus.",
  nurZugesagte: (n: number) => `Nur an Zugesagte (${n} offen)`,
  alleOhneAbsage: (n: number) => `An alle Angemeldeten ohne Absage (${n} offen)`,
  bestaetigung: "Ich habe die Vorschau geprüft. Die Mail geht jetzt wirklich raus; wer sie schon bekommen hat, bekommt sie nicht noch einmal.",
  senden: "Info-Mail jetzt senden",
  vorschauFuer: "Vorschau für",
  ohneEmail: " · ohne E-Mail",
  anzeigen: "Anzeigen",
  testAnMich: "Diese Mail als Test an mich schicken",
  fehlgeschlagenTitel: "Fehlgeschlagen",
  an: "An:",
  keineAdresse: "keine E-Mail-Adresse",
  betreff: "Betreff:",
  vorschauTitel: "Vorschau der Info-Mail",
  textfassung: "Textfassung (für Mailprogramme ohne HTML)",
  niemand: "Für dieses Modul ist noch niemand angemeldet.",
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    hinweise: {
      bestaetigen: { text: "Lütfen önce önizlemeyi kontrol ettiğini onayla. Hiçbir şey gönderilmedi.", gut: false },
      "test-gesendet": { text: "Test e-postası kendi adresine gönderildi. Gönderilmiş sayılmaz.", gut: true },
      "test-fehler": { text: "Test e-postası gönderilemedi.", gut: false },
      "keine-eigene-mail": { text: "Hesabında kayıtlı bir e-posta adresi yok.", gut: false },
      eingabe: { text: teamTexte.tr.meldung.eingabe, gut: false },
      abgesagt: { text: "Modül iptal edildi. Hiçbir şey gönderilmedi.", gut: false },
    },
    versendet: (n) => `${n} bilgi e-postası gönderildi`,
    versandFehler: (n) => `, ${n} başarısız (aşağıdaki listede).`,
    titel: "Bilgi e-postası",
    text1: "Her şey tek e-postada: bilet (QR ve kısa kod), tarih ve yer, otel ve odayla konaklama (oda yalnızca Lojistik’te yayınlandıysa) ve gündem.",
    text2: "Profildeki dile göre Almanca, Türkçe veya Fransızca.",
    stand: (gesendet, alle) => `${alle} kişiden ${gesendet} kişi aldı`,
    fehlgeschlagen: (n) => ` · ${n} başarısız`,
    ohneMail: (n) => ` · ${n} kişinin e-posta adresi yok`,
    anAlle: "Herkese gönder",
    abgesagt: "Modül iptal edildi. Bu modül için artık bilgi e-postası gönderilmez.",
    nurZugesagte: (n) => `Yalnızca katılacak olanlara (${n} bekliyor)`,
    alleOhneAbsage: (n) => `Katılmayacağını bildirmeyen tüm kayıtlılara (${n} bekliyor)`,
    bestaetigung: "Önizlemeyi kontrol ettim. E-posta şimdi gerçekten gönderilecek; daha önce alan kişi tekrar almaz.",
    senden: "Bilgi e-postasını şimdi gönder",
    vorschauFuer: "Kimin için önizleme",
    ohneEmail: " · e-posta yok",
    anzeigen: "Göster",
    testAnMich: "Bu e-postayı test olarak bana gönder",
    fehlgeschlagenTitel: "Başarısız",
    an: "Alıcı:",
    keineAdresse: "e-posta adresi yok",
    betreff: "Konu:",
    vorschauTitel: "Bilgi e-postası önizlemesi",
    textfassung: "Düz metin sürümü (HTML göstermeyen e-posta programları için)",
    niemand: "Bu modüle henüz kimse kayıtlı değil.",
  },
  fr: {
    hinweise: {
      bestaetigen: { text: "Merci de confirmer d’abord que l’aperçu a été vérifié. Rien n’a été envoyé.", gut: false },
      "test-gesendet": { text: "E-mail de test envoyé à ta propre adresse. Il ne compte pas comme envoyé.", gut: true },
      "test-fehler": { text: "L’e-mail de test n’a pas pu être envoyé.", gut: false },
      "keine-eigene-mail": { text: "Aucune adresse e-mail n’est enregistrée pour ton compte.", gut: false },
      eingabe: { text: teamTexte.fr.meldung.eingabe, gut: false },
      abgesagt: { text: "Le module est annulé. Rien n’a été envoyé.", gut: false },
    },
    versendet: (n) => `${n} e-mails d’information envoyés`,
    versandFehler: (n) => `, ${n} en échec (dans la liste ci-dessous).`,
    titel: "E-mail d’information",
    text1: "Un seul e-mail avec tout\u00a0: le billet (QR et code court), la date et le lieu, l’hébergement avec hôtel et chambre (la chambre seulement si elle est validée sous Logistique) et l’ordre du jour.",
    text2: "En allemand, en turc ou en français, selon la langue du profil.",
    stand: (gesendet, alle) => `${gesendet} sur ${alle} l’ont reçu`,
    fehlgeschlagen: (n) => ` · ${n} en échec`,
    ohneMail: (n) => ` · ${n} sans adresse e-mail`,
    anAlle: "Envoyer à tous",
    abgesagt: "Le module est annulé. Plus aucun e-mail d’information n’est envoyé pour celui-ci.",
    nurZugesagte: (n) => `Seulement aux personnes qui viennent (${n} en attente)`,
    alleOhneAbsage: (n) => `À toutes les personnes inscrites qui ne se sont pas désistées (${n} en attente)`,
    bestaetigung: "J’ai vérifié l’aperçu. L’e-mail part maintenant pour de bon\u00a0; les personnes qui l’ont déjà reçu ne le recevront pas une seconde fois.",
    senden: "Envoyer l’e-mail d’information maintenant",
    vorschauFuer: "Aperçu pour",
    ohneEmail: " · sans e-mail",
    anzeigen: "Afficher",
    testAnMich: "M’envoyer cet e-mail en test",
    fehlgeschlagenTitel: "En échec",
    an: "À\u00a0:",
    keineAdresse: "pas d’adresse e-mail",
    betreff: "Objet\u00a0:",
    vorschauTitel: "Aperçu de l’e-mail d’information",
    textfassung: "Version texte (pour les logiciels de messagerie sans HTML)",
    niemand: "Personne n’est encore inscrit à ce module.",
  },
};

/**
 * Info-Mail eines Moduls (Admin/Vorstand): Vorschau für jede angemeldete Person, Testmail an sich selbst,
 * Versand an alle mit Bestätigung. Eine Mail mit Ticket, Ort, Übernachtung und Tagesordnung.
 * Übersetzt ist nur der Rahmen der Seite; die Vorschau zeigt die Mail in der Sprache der Person.
 */
export default async function InfoMail({ params, searchParams }: PageProps<"/team/module/[id]/infomail">) {
  const staff = await requireStaff("alles");
  const l = staff.sprache;
  const t = T[l];
  const rsvp = teamTexte[l].rsvp;
  const { id } = await params;
  const sp = await searchParams;
  if (!istToken(id)) notFound();
  const supabase = await createClient();
  const [{ data: modul }, { data: status }] = await Promise.all([
    supabase.from("modules").select("id, title, cancelled_at").eq("id", id).maybeSingle(),
    supabase.rpc("get_info_status", { p_module_id: id }),
  ]);
  if (!modul) notFound();
  const liste = status ?? [];
  const gewaehlt = typeof sp.person === "string" && istToken(sp.person) ? sp.person : undefined;
  const person = liste.find((z) => z.participant_id === gewaehlt) ?? liste.find((z) => z.rsvp === "zugesagt" && z.email) ?? liste.find((z) => z.email) ?? liste[0];
  const daten = person ? await ladeInfoMail(person.participant_id, id) : null;
  const pdfs = daten ? await tagesordnungAnhaenge(daten.modul.id, infoMailSprache(daten.p.preferred_language)) : [];
  // Sprache der Mail selbst (die der Person), für lang an Betreff und Textfassung
  const mailSprache = daten ? infoMailSprache(daten.p.preferred_language) : undefined;
  const inhalt = daten ? infoMailInhalt(daten, seitenUrl(`/ticket/${daten.p.link_token}/`), infoMailWallet(daten.p), pdfs.map((x) => x.sprache)) : null;
  // In der Vorschau steckt der QR-Code direkt im HTML (in der echten Mail als Anhang)
  const vorschau = inhalt && daten ? inhalt.html
    .replace("cid:ticket-qr", `data:image/png;base64,${(await qrPng(daten.p.checkin_token)).toString("base64")}`)
    .replace("cid:info-kopf", `data:image/png;base64,${(await infoMailKopf(daten)).toString("base64")}`) : null;

  const zahl = (s: string) => liste.filter((z) => z.info_status === s).length;
  const empfaenger = (nurZugesagt: boolean) => liste.filter((z) => (z.info_status === "offen" || z.info_status === "fehlgeschlagen") && z.rsvp !== "abgesagt" && (!nurZugesagt || z.rsvp === "zugesagt")).length;
  const versand = typeof sp.hinweis === "string" && sp.hinweis.startsWith("info-") ? sp.hinweis.split("-").slice(1).map(Number) : null;

  return (
    <>
      <TeamKopf staff={staff} aktiv="module" breit />
      <main lang={l} className="mx-auto max-w-7xl px-4 py-8">
        <ModulReiter id={id} titel={modul.title} aktiv="" />
        <Hinweis code={sp.hinweis} texte={t.hinweise} />
        {versand && (
          <p role="status" className={`mt-4 rounded-2xl p-4 ${versand[1] ? "bg-amber-100 text-amber-950" : "bg-emerald-100 text-emerald-950"}`}>
            {t.versendet(versand[0])}{versand[1] ? t.versandFehler(versand[1]) : "."}
          </p>
        )}

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <div className="space-y-6">
            <section className="karte">
              <h2 className="font-display text-2xl font-bold">{t.titel}</h2>
              <p className="mt-1 text-sm text-ink-soft">
                {t.text1}
                {" "}{t.text2}
              </p>
              <p className="mt-3">
                {t.stand(zahl("gesendet"), liste.length)}
                {zahl("fehlgeschlagen") > 0 && t.fehlgeschlagen(zahl("fehlgeschlagen"))}
                {zahl("keine_mail") > 0 && t.ohneMail(zahl("keine_mail"))}
              </p>
            </section>

            <section className="karte">
              <h3 className="font-display text-xl font-bold">{t.anAlle}</h3>
              {modul.cancelled_at ? (
                <p className="mt-3 rounded-2xl bg-rot-hell p-3 text-sm font-semibold text-rot">{t.abgesagt}</p>
              ) : !mailBereit() ? <MailHinweis knapp className="mt-3" sprache={l} /> : (
                <form action={infoMailAnAlle} className="mt-3 space-y-3">
                  <input type="hidden" name="module_id" value={id} />
                  <fieldset className="space-y-1.5 text-sm">
                    <label className="flex gap-2"><input type="radio" name="empfaenger" value="zugesagt" defaultChecked className="mt-0.5" /> {t.nurZugesagte(empfaenger(true))}</label>
                    <label className="flex gap-2"><input type="radio" name="empfaenger" value="alle" className="mt-0.5" /> {t.alleOhneAbsage(empfaenger(false))}</label>
                  </fieldset>
                  <label className="flex gap-2 rounded-2xl bg-gelb-hell p-3 text-sm">
                    <input type="checkbox" name="bestaetigt" value="ja" required className="mt-0.5" />
                    {t.bestaetigung}
                  </label>
                  <button className="knopf">{t.senden}</button>
                </form>
              )}
            </section>

            <section className="karte">
              <h3 className="font-display text-xl font-bold">{t.vorschauFuer}</h3>
              <form className="mt-3 flex gap-2" action={`/team/module/${id}/infomail/`}>
                <select name="person" defaultValue={person?.participant_id} className="feld" aria-label={teamTexte[l].wort.person}>
                  {liste.map((z) => <option key={z.participant_id} value={z.participant_id}>{z.name}{z.rsvp === "zugesagt" ? ` · ${rsvp.zugesagt}` : z.rsvp === "abgesagt" ? ` · ${rsvp.abgesagt}` : ""}{!z.email ? t.ohneEmail : ""}</option>)}
                </select>
                <button className="knopf-hell">{t.anzeigen}</button>
              </form>
              {person && mailBereit() && (
                <form action={infoMailTest} className="mt-3">
                  <input type="hidden" name="module_id" value={id} /><input type="hidden" name="participant_id" value={person.participant_id} />
                  <button className="text-sm font-semibold underline">{t.testAnMich}</button>
                </form>
              )}
            </section>

            {liste.some((z) => z.info_status === "fehlgeschlagen") && (
              <section className="karte">
                <h3 className="font-display text-xl font-bold">{t.fehlgeschlagenTitel}</h3>
                <ul className="mt-2 divide-y divide-line text-sm">
                  {liste.filter((z) => z.info_status === "fehlgeschlagen").map((z) => (
                    <li key={z.participant_id} className="py-2"><Link href={`/team/teilnehmende/${z.participant_id}/`} className="font-semibold underline">{z.name}</Link> · {z.last_error}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <section className="karte !p-0 overflow-hidden">
            {inhalt && vorschau ? (
              <>
                <div className="border-b border-line px-5 py-4 text-sm">
                  <p><span className="text-ink-soft">{t.an}</span> {person?.email ?? <span className="text-rot">{t.keineAdresse}</span>}</p>
                  <p><span className="text-ink-soft">{t.betreff}</span> <span lang={mailSprache} className="font-semibold">{inhalt.betreff}</span></p>
                </div>
                <iframe title={t.vorschauTitel} srcDoc={vorschau} sandbox="" className="h-[80vh] w-full bg-[#f3efe4]" />
                <details className="border-t border-line px-5 py-3 text-sm">
                  <summary className="cursor-pointer font-semibold">{t.textfassung}</summary>
                  <pre lang={mailSprache} className="mt-2 whitespace-pre-wrap font-sans">{inhalt.text}</pre>
                </details>
              </>
            ) : <p className="p-6 text-ink-soft">{t.niemand}</p>}
          </section>
        </div>
      </main>
    </>
  );
}
