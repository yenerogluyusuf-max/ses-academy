import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TagesordnungKnoepfe } from "@/components/team/Dokumente";
import { Hinweis } from "@/components/team/Hinweis";
import { ModulFormular } from "@/components/team/ModulFormular";
import { ModulReiter } from "@/components/team/ModulReiter";
import { TeamKopf } from "@/components/team/TeamKopf";
import { MailHinweis } from "@/components/team/MailHinweis";
import { feedbackEinladen, frageEntfernen, frageHinzufuegen, umfrageAnlegen, umfrageJetztOeffnen } from "@/lib/aktionen/feedback";
import { jetztMs } from "@/lib/zeit";
import { absageZuruecknehmen, modulAbsagen, modulSpeichern, tagEntfernen, tagHinzufuegen } from "@/lib/aktionen/module";
import { requireStaff } from "@/lib/auth";
import { anmeldestatusTexte } from "@/lib/einlass";
import { createClient } from "@/lib/supabase/server";
import { istToken } from "@/lib/codes";
import { teamLocale, type TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";

export const metadata: Metadata = { title: "Modul | SES Academy" };

type Hinweise = Record<string, { text: string; gut: boolean }>;

const de = {
  hinweise: {
    angelegt: { text: "Modul angelegt. Jetzt Termine eintragen und veröffentlichen.", gut: true },
    gespeichert: { text: "Gespeichert.", gut: true },
    eingabe: { text: "Bitte die Angaben prüfen.", gut: false },
    "slug-vergeben": { text: "Diesen Kurznamen gibt es schon.", gut: false },
    "tag-eingabe": { text: "Bitte Datum und Uhrzeiten prüfen (Ende nach Beginn).", gut: false },
    "tag-doppelt": { text: "Für diesen Tag gibt es schon einen Termin.", gut: false },
    "tag-angelegt": { text: "Termin eingetragen.", gut: true },
    "tag-entfernt": { text: "Termin entfernt.", gut: true },
    "tag-hat-checkins": { text: "An diesem Tag wurde schon eingecheckt. Der Termin bleibt deshalb bestehen.", gut: false },
    abgesagt: { text: "Modul abgesagt. Der Einlass ist gesperrt, Tickets gelten für dieses Modul nicht mehr.", gut: true },
    "absage-bestaetigen": { text: "Bitte das Absagen ausdrücklich bestätigen. Es wurde nichts geändert.", gut: false },
    reaktiviert: { text: "Absage zurückgenommen.", gut: true },
    "feedback-angelegt": { text: "Umfrage mit Standardfragen angelegt. Fragen prüfen, dann nach dem Modul die Einladung senden.", gut: true },
    "feedback-offen": { text: "Umfrage ist freigeschaltet. Anwesende sehen sie jetzt auf der Ticket-Seite und in „Mein Bereich“; die Einladung per Mail geht mit dem Knopf darunter.", gut: true },
    "feedback-ohne-termin": { text: "Zuerst Termine eintragen, die Umfrage öffnet am letzten Modultag.", gut: false },
    "frage-gespeichert": { text: "Frage hinzugefügt.", gut: true },
    "frage-entfernt": { text: "Frage entfernt.", gut: true },
    "frage-hat-antworten": { text: "Es gibt schon Antworten. Fragen lassen sich jetzt nicht mehr entfernen.", gut: false },
    fehler: { text: "Das hat nicht geklappt.", gut: false },
  } as Hinweise,
  abgesagt: "Abgesagt",
  abgesagtGrund: (grund: string) => `Abgesagt: ${grund}`,
  informiert: (n: number) => `${n} Angemeldete per Mail informiert.`,
  neuAngemeldet: (n: number) => `${n} angenommene Teilnehmende wurden automatisch angemeldet.`,
  anmeldungen: (liste: string) => `Anmeldungen: ${liste}`,
  zaehlung: (n: number, name: string) => `${n} ${name.toLowerCase()}`,
  nochKeine: "noch keine",
  termine: "Termine",
  termineText: "Eingecheckt wird pro Termin. Einlass ist 4 Stunden vor Beginn bis 6 Stunden nach Ende möglich.",
  zeitraum: (von: string, bis: string, n: number) => `${von} bis ${bis} Uhr · ${n} eingecheckt`,
  entfernen: "entfernen",
  keineTermine: "Noch keine Termine.",
  beginn: "Beginn",
  ende: "Ende",
  bezeichnung: "Bezeichnung (optional)",
  bezeichnungBeispiel: "z. B. Tag 1",
  terminEintragen: "Termin eintragen",
  infoTitel: "Info-Mail und Unterlagen",
  infoText: "Eine Mail an alle mit Ticket (QR-Code), Ort, Übernachtung mit Hotel und Zimmer und der Tagesordnung. Vorher in der Vorschau prüfen.",
  infoStand: (gesendet: number, alle: number) => `${gesendet} von ${alle} haben die Info-Mail`,
  fehlgeschlagen: (n: number) => ` · ${n} fehlgeschlagen`,
  ohneMail: (n: number) => ` · ${n} ohne E-Mail-Adresse`,
  infoAbgesagt: "Info-Mail: Modul abgesagt",
  infoVorschau: "Info-Mail: Vorschau und Versand",
  tagesordnung: "Tagesordnung drucken",
  notfall: "Notfall-Liste drucken",
  namensschilder: "Namensschilder drucken",
  hotel: "Übernachtung und Hotel",
  abfrageOffen: " (Abfrage offen)",
  feedback: "Feedback",
  einladungen: (n: number) => `${n} Einladungen verschickt`,
  einladungenFehler: (n: number) => `, ${n} fehlgeschlagen (meist fehlt die E-Mail-Adresse).`,
  umfrageText: "Die Umfrage öffnet am letzten Modultag um 13 Uhr und bleibt 14 Tage offen. Antworten können nur Anwesende.",
  umfrageAnlegen: "Umfrage anlegen",
  offen: (von: string, zeit: string, bis: string) => `Offen ${von}, ${zeit} Uhr bis ${bis}`,
  zuletzt: (tag: string) => ` · Einladung zuletzt am ${tag} verschickt`,
  antworten: (n: number) => `${n} Antworten`,
  freischalten: "Jetzt freischalten",
  sonstAutomatisch: "Sonst öffnet sie automatisch zur oben genannten Zeit.",
  offenJetzt: "Offen: Anwesende sehen die Umfrage auf der Ticket-Seite und in „Mein Bereich“",
  einladen: "Einladung an alle Anwesenden ohne Antwort senden",
  niemandDa: "Noch niemand eingecheckt.",
  durchschnitt: (wert: string) => `Durchschnitt ${wert} von 5`,
  keineAntworten: "noch keine Antworten",
  verteilung: (werte: string) => `Verteilung 1 bis 5: ${werte}`,
  fragenBearbeiten: (n: number) => `Fragen bearbeiten (${n})`,
  skala: "Skala 1–5",
  freitext: "Freitext",
  neueFrage: "Neue Frage",
  art: "Art",
  einstellungen: "Einstellungen",
  absage: "Absage",
  absagen: "Modul absagen",
  zuruecknehmen: "Absage zurücknehmen",
  grund: "Grund (intern)",
  benachrichtigen: "Alle Angemeldeten und die Warteliste per Mail informieren",
  bestaetigen: "Ja, das Modul wirklich absagen. Der Einlass wird gesperrt.",
  absagenKnopf: "Absagen",
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    hinweise: {
      angelegt: { text: "Modül oluşturuldu. Şimdi tarihleri gir ve yayınla.", gut: true },
      gespeichert: { text: teamTexte.tr.meldung.gespeichert, gut: true },
      eingabe: { text: teamTexte.tr.meldung.eingabe, gut: false },
      "slug-vergeben": { text: "Bu kısa ad zaten var.", gut: false },
      "tag-eingabe": { text: "Lütfen tarihi ve saatleri kontrol et (bitiş başlangıçtan sonra olmalı).", gut: false },
      "tag-doppelt": { text: "Bu gün zaten eklenmiş.", gut: false },
      "tag-angelegt": { text: "Tarih eklendi.", gut: true },
      "tag-entfernt": { text: "Tarih kaldırıldı.", gut: true },
      "tag-hat-checkins": { text: "Bu günde giriş yapanlar var. Bu yüzden tarih kaldırılmadı.", gut: false },
      abgesagt: { text: "Modül iptal edildi. Giriş kapatıldı, biletler bu modül için artık geçerli değil.", gut: true },
      "absage-bestaetigen": { text: "Lütfen iptali açıkça onayla. Hiçbir şey değiştirilmedi.", gut: false },
      reaktiviert: { text: "İptal geri alındı.", gut: true },
      "feedback-angelegt": { text: "Standart sorularla anket oluşturuldu. Soruları kontrol et, modülden sonra daveti gönder.", gut: true },
      "feedback-offen": { text: "Anket açıldı. Katılanlar onu artık bilet sayfasında ve „Mein Bereich“ alanında görüyor; e-posta daveti aşağıdaki düğmeyle gönderilir.", gut: true },
      "feedback-ohne-termin": { text: "Önce tarihleri gir; anket modülün son gününde açılır.", gut: false },
      "frage-gespeichert": { text: "Soru eklendi.", gut: true },
      "frage-entfernt": { text: "Soru kaldırıldı.", gut: true },
      "frage-hat-antworten": { text: "Zaten cevaplar var. Sorular artık kaldırılamaz.", gut: false },
      fehler: { text: teamTexte.tr.meldung.fehler, gut: false },
    },
    abgesagt: "İptal edildi",
    abgesagtGrund: (grund) => `İptal edildi: ${grund}`,
    informiert: (n) => `${n} kayıtlı kişiye e-postayla bilgi verildi.`,
    neuAngemeldet: (n) => `Kabul edilen ${n} katılımcı otomatik olarak kaydedildi.`,
    anmeldungen: (liste) => `Kayıtlar: ${liste}`,
    zaehlung: (n, name) => `${name}: ${n}`,
    nochKeine: "henüz yok",
    termine: "Tarihler",
    termineText: "Giriş her tarih için ayrı yapılır. Giriş, başlangıçtan 4 saat önce ile bitişten 6 saat sonrası arasında mümkündür.",
    zeitraum: (von, bis, n) => `${von}–${bis} · ${n} kişi giriş yaptı`,
    entfernen: "kaldır",
    keineTermine: "Henüz tarih yok.",
    beginn: "Başlangıç",
    ende: "Bitiş",
    bezeichnung: "Etiket (isteğe bağlı)",
    bezeichnungBeispiel: "ör. 1. gün",
    terminEintragen: "Tarih ekle",
    infoTitel: "Bilgi e-postası ve belgeler",
    infoText: "Herkese tek bir e-posta: bilet (QR kod), yer, otel ve odayla konaklama ve gündem. Önce önizlemede kontrol et.",
    infoStand: (gesendet, alle) => `${alle} kişiden ${gesendet} kişi bilgi e-postasını aldı`,
    fehlgeschlagen: (n) => ` · ${n} başarısız`,
    ohneMail: (n) => ` · ${n} kişinin e-posta adresi yok`,
    infoAbgesagt: "Bilgi e-postası: modül iptal edildi",
    infoVorschau: "Bilgi e-postası: önizleme ve gönderim",
    tagesordnung: "Gündemi yazdır",
    notfall: "Acil durum listesini yazdır",
    namensschilder: "Yaka kartlarını yazdır",
    hotel: "Konaklama ve otel",
    abfrageOffen: " (form açık)",
    feedback: "Geri bildirim",
    einladungen: (n) => `${n} davet gönderildi`,
    einladungenFehler: (n) => `, ${n} başarısız (çoğunlukla e-posta adresi eksik).`,
    umfrageText: "Anket modülün son gününde saat 13:00’te açılır ve 14 gün açık kalır. Yalnızca katılmış olanlar cevap verebilir.",
    umfrageAnlegen: "Anket oluştur",
    offen: (von, zeit, bis) => `Açık: ${von}, saat ${zeit} – ${bis}`,
    zuletzt: (tag) => ` · davet en son ${tag} tarihinde gönderildi`,
    antworten: (n) => `${n} cevap`,
    freischalten: "Şimdi aç",
    sonstAutomatisch: "Aksi halde yukarıda belirtilen saatte otomatik olarak açılır.",
    offenJetzt: "Açık: katılanlar anketi bilet sayfasında ve „Mein Bereich“ alanında görüyor",
    einladen: "Cevap vermeyen tüm katılanlara davet gönder",
    niemandDa: "Henüz kimse giriş yapmadı.",
    durchschnitt: (wert) => `Ortalama 5 üzerinden ${wert}`,
    keineAntworten: "henüz cevap yok",
    verteilung: (werte) => `1’den 5’e dağılım: ${werte}`,
    fragenBearbeiten: (n) => `Soruları düzenle (${n})`,
    skala: "Ölçek 1–5",
    freitext: "Serbest metin",
    neueFrage: "Yeni soru",
    art: "Tür",
    einstellungen: "Ayarlar",
    absage: "İptal",
    absagen: "Modülü iptal et",
    zuruecknehmen: "İptali geri al",
    grund: "Neden (dahili)",
    benachrichtigen: "Tüm kayıtlılara ve bekleme listesine e-postayla bilgi ver",
    bestaetigen: "Evet, modülü gerçekten iptal et. Giriş kapatılır.",
    absagenKnopf: "İptal et",
  },
  fr: {
    hinweise: {
      angelegt: { text: "Module créé. Ajoute maintenant les dates, puis publie-le.", gut: true },
      gespeichert: { text: teamTexte.fr.meldung.gespeichert, gut: true },
      eingabe: { text: teamTexte.fr.meldung.eingabe, gut: false },
      "slug-vergeben": { text: "Ce nom court existe déjà.", gut: false },
      "tag-eingabe": { text: "Merci de vérifier la date et les heures (la fin doit suivre le début).", gut: false },
      "tag-doppelt": { text: "Il y a déjà une date pour ce jour.", gut: false },
      "tag-angelegt": { text: "Date ajoutée.", gut: true },
      "tag-entfernt": { text: "Date supprimée.", gut: true },
      "tag-hat-checkins": { text: "Des personnes ont déjà été enregistrées ce jour-là. La date est donc conservée.", gut: false },
      abgesagt: { text: "Module annulé. L’accueil est bloqué, les billets ne sont plus valables pour ce module.", gut: true },
      "absage-bestaetigen": { text: "Merci de confirmer expressément l’annulation. Rien n’a été modifié.", gut: false },
      reaktiviert: { text: "Annulation retirée.", gut: true },
      "feedback-angelegt": { text: "Questionnaire créé avec les questions standard. Vérifie les questions, puis envoie l’invitation après le module.", gut: true },
      "feedback-offen": { text: "Le questionnaire est ouvert. Les personnes présentes le voient maintenant sur la page du billet et dans «\u00a0Mon espace\u00a0»\u00a0; l’invitation par e-mail part avec le bouton ci-dessous.", gut: true },
      "feedback-ohne-termin": { text: "Ajoute d’abord les dates\u00a0; le questionnaire ouvre le dernier jour du module.", gut: false },
      "frage-gespeichert": { text: "Question ajoutée.", gut: true },
      "frage-entfernt": { text: "Question supprimée.", gut: true },
      "frage-hat-antworten": { text: "Il y a déjà des réponses. Les questions ne peuvent plus être supprimées.", gut: false },
      fehler: { text: teamTexte.fr.meldung.fehler, gut: false },
    },
    abgesagt: "Annulé",
    abgesagtGrund: (grund) => `Annulé\u00a0: ${grund}`,
    informiert: (n) => `${n} personnes inscrites informées par e-mail.`,
    neuAngemeldet: (n) => `${n} participants acceptés ont été inscrits automatiquement.`,
    anmeldungen: (liste) => `Inscriptions\u00a0: ${liste}`,
    zaehlung: (n, name) => `${name}\u00a0: ${n}`,
    nochKeine: "aucune pour l’instant",
    termine: "Dates",
    termineText: "L’enregistrement se fait par date. L’accueil est possible de 4\u00a0heures avant le début jusqu’à 6\u00a0heures après la fin.",
    zeitraum: (von, bis, n) => `de ${von} à ${bis} · ${n} enregistré·es`,
    entfernen: "supprimer",
    keineTermine: "Pas encore de dates.",
    beginn: "Début",
    ende: "Fin",
    bezeichnung: "Libellé (facultatif)",
    bezeichnungBeispiel: "p. ex. Jour 1",
    terminEintragen: "Ajouter la date",
    infoTitel: "E-mail d’information et documents",
    infoText: "Un seul e-mail à tous, avec le billet (code QR), le lieu, l’hébergement avec hôtel et chambre, et l’ordre du jour. Vérifie d’abord l’aperçu.",
    infoStand: (gesendet, alle) => `${gesendet} sur ${alle} ont reçu l’e-mail d’information`,
    fehlgeschlagen: (n) => ` · ${n} en échec`,
    ohneMail: (n) => ` · ${n} sans adresse e-mail`,
    infoAbgesagt: "E-mail d’information\u00a0: module annulé",
    infoVorschau: "E-mail d’information\u00a0: aperçu et envoi",
    tagesordnung: "Imprimer l’ordre du jour",
    notfall: "Imprimer la liste d’urgence",
    namensschilder: "Imprimer les badges",
    hotel: "Hébergement et hôtel",
    abfrageOffen: " (formulaire ouvert)",
    feedback: "Retours",
    einladungen: (n) => `${n} invitations envoyées`,
    einladungenFehler: (n) => `, ${n} en échec (le plus souvent, l’adresse e-mail manque).`,
    umfrageText: "Le questionnaire ouvre le dernier jour du module à 13\u00a0h et reste ouvert 14\u00a0jours. Seules les personnes présentes peuvent répondre.",
    umfrageAnlegen: "Créer le questionnaire",
    offen: (von, zeit, bis) => `Ouvert du ${von}, ${zeit}, au ${bis}`,
    zuletzt: (tag) => ` · dernière invitation envoyée le ${tag}`,
    antworten: (n) => `${n} réponses`,
    freischalten: "Ouvrir maintenant",
    sonstAutomatisch: "Sinon, il s’ouvre automatiquement à l’heure indiquée ci-dessus.",
    offenJetzt: "Ouvert\u00a0: les personnes présentes voient le questionnaire sur la page du billet et dans «\u00a0Mon espace\u00a0»",
    einladen: "Envoyer l’invitation à toutes les personnes présentes qui n’ont pas répondu",
    niemandDa: "Personne n’est encore enregistré.",
    durchschnitt: (wert) => `Moyenne ${wert} sur 5`,
    keineAntworten: "pas encore de réponses",
    verteilung: (werte) => `Répartition de 1 à 5\u00a0: ${werte}`,
    fragenBearbeiten: (n) => `Modifier les questions (${n})`,
    skala: "Échelle 1–5",
    freitext: "Texte libre",
    neueFrage: "Nouvelle question",
    art: "Type",
    einstellungen: "Paramètres",
    absage: "Annulation",
    absagen: "Annuler le module",
    zuruecknehmen: "Retirer l’annulation",
    grund: "Motif (interne)",
    benachrichtigen: "Informer par e-mail toutes les personnes inscrites et la liste d’attente",
    bestaetigen: "Oui, vraiment annuler le module. L’accueil sera bloqué.",
    absagenKnopf: "Annuler le module",
  },
};

export default async function ModulDetail({ params, searchParams }: PageProps<"/team/module/[id]">) {
  const staff = await requireStaff("alles");
  const l = staff.sprache;
  const t = T[l];
  const w = teamTexte[l];
  const tagFormat = new Intl.DateTimeFormat(teamLocale[l], { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" });
  const zeitFormat = new Intl.DateTimeFormat(teamLocale[l], { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
  const { id } = await params;
  const { hinweis } = await searchParams;
  if (!istToken(id)) notFound();
  const supabase = await createClient();
  const { data: m } = await supabase
    .from("modules")
    .select("*, module_days(id, day, starts_at, ends_at, label, attendances(count)), registrations(status)")
    .eq("id", id)
    .maybeSingle();
  if (!m) notFound();

  const { data: infoRoh } = await supabase.rpc("get_info_status", { p_module_id: m.id });
  const info = infoRoh ?? [];
  const infoAnzahl = (s: string) => info.filter((t) => t.info_status === s).length;

  // Fertige Tagesordnungen (PDF) aus „Material“ mit dem Schlagwort „Tagesordnung“, zum direkten Herunterladen
  const { data: tagesordnungen } = await supabase.from("documents").select("id, title").eq("module_id", m.id)
    .contains("tags", ["Tagesordnung"]).gt("current_version", 0).neq("status", "archiv");

  const { data: umfrage } = await supabase.from("feedback_surveys").select("id, opens_at, closes_at, sent_at, feedback_questions(id, position, kind, prompt)").eq("module_id", m.id).maybeSingle();
  const { data: ergebnisse } = umfrage ? await supabase.rpc("get_feedback_results", { p_survey_id: umfrage.id }) : { data: null };
  const { count: anwesende } = await supabase.from("attendances").select("registration_id, registrations!inner(module_id)", { count: "exact", head: true }).eq("registrations.module_id", m.id);
  const fragen = umfrage ? [...umfrage.feedback_questions].sort((a, b) => a.position - b.position) : [];
  const feedbackVersand = typeof hinweis === "string" && /^feedback-\d+-\d+$/.test(hinweis) ? hinweis.split("-").slice(1).map(Number) : null;
  const antworten = Math.max(0, ...(ergebnisse ?? []).map((e) => e.answers));

  const code = typeof hinweis === "string" && hinweis.startsWith("gespeichert-") ? "gespeichert" : typeof hinweis === "string" && hinweis.startsWith("abgesagt-") ? "abgesagt" : hinweis;
  const absageInformiert = typeof hinweis === "string" && hinweis.startsWith("abgesagt-") ? Number(hinweis.split("-")[1]) : null;
  const neuAngemeldet = typeof hinweis === "string" && hinweis.startsWith("gespeichert-") ? Number(hinweis.split("-")[1]) : 0;
  const tage = [...m.module_days].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const zaehlung = Object.entries(anmeldestatusTexte[l])
    .map(([s, name]) => ({ name, anzahl: m.registrations.filter((r) => r.status === s).length }))
    .filter((z) => z.anzahl > 0);
  const feld = "rounded-2xl bg-white px-4 py-3 ring-1 ring-line";

  return (
    <>
      <TeamKopf staff={staff} aktiv="module" />
      <main lang={l} className="mx-auto max-w-5xl px-4 py-8">
        <ModulReiter id={m.id} titel={m.title} aktiv="" />
        {m.cancelled_at && <p className="mt-2 font-semibold text-red-900">{m.cancellation_reason ? t.abgesagtGrund(m.cancellation_reason) : t.abgesagt}</p>}
        <Hinweis code={code} texte={t.hinweise} />
        {absageInformiert !== null && absageInformiert > 0 && <p role="status" className="mt-2 rounded-2xl bg-emerald-100 p-4 text-emerald-950">{t.informiert(absageInformiert)}</p>}
        {neuAngemeldet > 0 && <p role="status" className="mt-2 rounded-2xl bg-emerald-100 p-4 text-emerald-950">{t.neuAngemeldet(neuAngemeldet)}</p>}

        <p className="mt-4 text-ink-soft">
          {t.anmeldungen(zaehlung.length ? zaehlung.map((z) => t.zaehlung(z.anzahl, z.name)).join(" · ") : t.nochKeine)}
        </p>

        <section className="mt-8 rounded-3xl bg-white/60 p-6 ring-1 ring-line">
          <h2 className="font-display text-xl font-bold">{t.termine}</h2>
          <p className="mt-1 text-sm text-ink-soft">{t.termineText}</p>
          <ul className="mt-4 divide-y divide-line">
            {tage.map((tag) => {
              const checkins = tag.attendances[0]?.count ?? 0;
              return (
                <li key={tag.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="mr-auto">
                    <p className="font-semibold">{tagFormat.format(new Date(tag.starts_at))}{tag.label ? ` · ${tag.label}` : ""}</p>
                    <p className="text-sm text-ink-soft">{t.zeitraum(zeitFormat.format(new Date(tag.starts_at)), zeitFormat.format(new Date(tag.ends_at)), checkins)}</p>
                  </div>
                  <Link href={`/team/einlass/?tag=${tag.id}`} className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-line">{w.bereiche.einlass}</Link>
                  <Link href={`/team/regieplan/?tag=${tag.id}`} className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-line">{w.bereiche.regieplan}</Link>
                  {checkins === 0 && (
                    <form action={tagEntfernen}>
                      <input type="hidden" name="module_id" value={m.id} /><input type="hidden" name="day_id" value={tag.id} />
                      <button type="submit" className="text-sm font-semibold text-ink-soft underline">{t.entfernen}</button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
          {tage.length === 0 && <p className="mt-3 text-ink-soft">{t.keineTermine}</p>}
          <form action={tagHinzufuegen} className="mt-5 flex flex-wrap items-end gap-2">
            <input type="hidden" name="module_id" value={m.id} />
            <div><label htmlFor="day" className="mb-1 block text-sm font-semibold">{w.wort.datum}</label><input id="day" name="day" type="date" required className={feld} /></div>
            <div><label htmlFor="von" className="mb-1 block text-sm font-semibold">{t.beginn}</label><input id="von" name="von" type="time" required defaultValue="10:00" className={feld} /></div>
            <div><label htmlFor="bis" className="mb-1 block text-sm font-semibold">{t.ende}</label><input id="bis" name="bis" type="time" required defaultValue="18:00" className={feld} /></div>
            <div className="min-w-40 flex-1"><label htmlFor="label" className="mb-1 block text-sm font-semibold">{t.bezeichnung}</label><input id="label" name="label" placeholder={t.bezeichnungBeispiel} className={`${feld} w-full`} /></div>
            <button type="submit" className="rounded-full bg-ink px-5 py-3 font-semibold text-paper">{t.terminEintragen}</button>
          </form>
        </section>


        <section id="tickets" className="mt-8 rounded-3xl bg-white/60 p-6 ring-1 ring-line">
          <h2 className="font-display text-xl font-bold">{t.infoTitel}</h2>
          <p className="mt-1 text-sm text-ink-soft">
            {t.infoText}
          </p>
          <p className="mt-3">
            {t.infoStand(infoAnzahl("gesendet"), info.length)}
            {infoAnzahl("fehlgeschlagen") > 0 && t.fehlgeschlagen(infoAnzahl("fehlgeschlagen"))}
            {infoAnzahl("keine_mail") > 0 && t.ohneMail(infoAnzahl("keine_mail"))}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {m.cancelled_at
              ? <span className="rounded-full bg-paper-deep px-5 py-3 font-semibold text-ink-soft" aria-disabled="true">{t.infoAbgesagt}</span>
              : <Link href={`/team/module/${m.id}/infomail/`} className="rounded-full bg-ink px-5 py-3 font-semibold text-paper">{t.infoVorschau}</Link>}
            <Link href={`/team/module/${m.id}/tagesordnung/`} target="_blank" className="rounded-full bg-white px-5 py-3 font-semibold ring-1 ring-line">{t.tagesordnung}</Link>
            <Link href={`/team/module/${m.id}/notfall/`} className="rounded-full bg-white px-5 py-3 font-semibold ring-1 ring-line">{t.notfall}</Link>
            <Link href={`/team/module/${m.id}/namensschilder/`} className="rounded-full bg-white px-5 py-3 font-semibold ring-1 ring-line">{t.namensschilder}</Link>
            <Link href={`/team/module/${m.id}/hotel/`} className="rounded-full bg-white px-5 py-3 font-semibold ring-1 ring-line">{t.hotel}{m.stay_form_open ? t.abfrageOffen : ""}</Link>
          </div>
          <MailHinweis knapp className="mt-3" sprache={l} />
          <TagesordnungKnoepfe dokumente={tagesordnungen ?? []} />
        </section>


        <section id="feedback" className="mt-8 rounded-3xl bg-white/60 p-6 ring-1 ring-line">
          <h2 className="font-display text-xl font-bold">{t.feedback}</h2>
          {feedbackVersand && (
            <p role="status" className={`mt-3 rounded-2xl p-4 ${feedbackVersand[1] ? "bg-amber-100 text-amber-950" : "bg-emerald-100 text-emerald-950"}`}>
              {t.einladungen(feedbackVersand[0])}{feedbackVersand[1] ? t.einladungenFehler(feedbackVersand[1]) : "."}
            </p>
          )}
          {!umfrage ? (
            <form action={umfrageAnlegen} className="mt-3">
              <p className="text-sm text-ink-soft">{t.umfrageText}</p>
              <input type="hidden" name="module_id" value={m.id} />
              <button type="submit" className="mt-3 rounded-full bg-ink px-5 py-3 font-semibold text-paper">{t.umfrageAnlegen}</button>
            </form>
          ) : (
            <>
              <p className="mt-1 text-sm text-ink-soft">
                {t.offen(tagFormat.format(new Date(umfrage.opens_at)), zeitFormat.format(new Date(umfrage.opens_at)), tagFormat.format(new Date(umfrage.closes_at)))}
                {umfrage.sent_at ? t.zuletzt(tagFormat.format(new Date(umfrage.sent_at))) : ""} · {t.antworten(antworten)}
              </p>
              {Date.parse(umfrage.opens_at) > jetztMs() ? (
                <form action={umfrageJetztOeffnen} className="mt-3">
                  <input type="hidden" name="module_id" value={m.id} /><input type="hidden" name="survey_id" value={umfrage.id} />
                  <button type="submit" className="rounded-full bg-signal px-5 py-3 font-semibold text-ink ring-1 ring-forest/30">{t.freischalten}</button>
                  <span className="ml-3 text-sm text-ink-soft">{t.sonstAutomatisch}</span>
                </form>
              ) : Date.parse(umfrage.closes_at) > jetztMs() ? (
                <p className="mt-3 inline-block rounded-full bg-gruen-hell px-4 py-2 text-sm font-semibold">{t.offenJetzt}</p>
              ) : null}
              <form action={feedbackEinladen} className="mt-3">
                <input type="hidden" name="module_id" value={m.id} /><input type="hidden" name="survey_id" value={umfrage.id} />
                <button type="submit" disabled={!anwesende} className="rounded-full bg-ink px-5 py-3 font-semibold text-paper disabled:opacity-50">
                  {t.einladen}
                </button>
                {!anwesende && <span className="ml-3 text-sm text-ink-soft">{t.niemandDa}</span>}
                <MailHinweis knapp className="mt-3" sprache={l} />
              </form>

              {antworten > 0 && (
                <div className="mt-6 space-y-4">
                  {(ergebnisse ?? []).map((e) => (
                    <div key={e.question_id}>
                      <p className="font-semibold">{e.nr}. {e.prompt}</p>
                      {e.kind === "skala" ? (
                        <div className="mt-1">
                          <p className="text-sm text-ink-soft">{e.average !== null ? t.durchschnitt(String(e.average).replace(".", ",")) : t.keineAntworten} · {t.antworten(e.answers)}</p>
                          <div className="mt-2 flex h-6 overflow-hidden rounded-full ring-1 ring-line" role="img" aria-label={t.verteilung((e.distribution ?? []).join(", "))}>
                            {(e.distribution ?? []).map((n, i) => n > 0 && (
                              <div key={i} className={["bg-rot-hell", "bg-amber-100", "bg-paper-deep", "bg-emerald-100", "bg-emerald-300"][i]} style={{ width: `${(n / e.answers) * 100}%` }}>
                                <span className="block text-center text-xs leading-6 font-semibold">{i + 1}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{(e.texts ?? []).map((x, i) => <li key={i}>{x}</li>)}</ul>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <details className="mt-6">
                <summary className="cursor-pointer font-semibold">{t.fragenBearbeiten(fragen.length)}</summary>
                <ol className="mt-3 space-y-2">
                  {fragen.map((f) => (
                    <li key={f.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="mr-auto">{f.position}. {f.prompt} <span className="text-ink-soft">({f.kind === "skala" ? t.skala : t.freitext})</span></span>
                      {antworten === 0 && (
                        <form action={frageEntfernen}>
                          <input type="hidden" name="module_id" value={m.id} /><input type="hidden" name="survey_id" value={umfrage.id} /><input type="hidden" name="id" value={f.id} />
                          <button type="submit" className="font-semibold text-ink-soft underline">{t.entfernen}</button>
                        </form>
                      )}
                    </li>
                  ))}
                </ol>
                <form action={frageHinzufuegen} className="mt-4 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="module_id" value={m.id} /><input type="hidden" name="survey_id" value={umfrage.id} />
                  <div className="min-w-60 flex-1"><label htmlFor="prompt" className="mb-1 block text-sm font-semibold">{t.neueFrage}</label><input id="prompt" name="prompt" required minLength={3} maxLength={300} className={`${feld} w-full`} /></div>
                  <div><label htmlFor="kind" className="mb-1 block text-sm font-semibold">{t.art}</label>
                    <select id="kind" name="kind" className={feld}><option value="skala">{t.skala}</option><option value="text">{t.freitext}</option></select></div>
                  <button type="submit" className="rounded-full bg-white px-5 py-3 font-semibold ring-1 ring-line">{w.wort.hinzufuegen}</button>
                </form>
              </details>
            </>
          )}
        </section>

        <section className="mt-8 rounded-3xl bg-white/60 p-6 ring-1 ring-line">
          <h2 className="mb-4 font-display text-xl font-bold">{t.einstellungen}</h2>
          <ModulFormular modul={m} aktion={modulSpeichern} knopf={w.wort.speichern} sprache={l} />
        </section>

        <section className="mt-8 rounded-3xl bg-white/60 p-6 ring-1 ring-line">
          <h2 className="font-display text-xl font-bold">{m.cancelled_at ? t.absage : t.absagen}</h2>
          {m.cancelled_at ? (
            <form action={absageZuruecknehmen} className="mt-3">
              <input type="hidden" name="id" value={m.id} />
              <button type="submit" className="rounded-full bg-white px-5 py-3 font-semibold ring-1 ring-line">{t.zuruecknehmen}</button>
            </form>
          ) : (
            <form action={modulAbsagen} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={m.id} />
              <div className="min-w-60 flex-1"><label htmlFor="grund" className="mb-1 block text-sm font-semibold">{t.grund}</label><input id="grund" name="grund" className={`${feld} w-full`} /></div>
              <div className="w-full space-y-1.5 text-sm">
                <label className="flex gap-2"><input type="checkbox" name="benachrichtigen" value="ja" defaultChecked className="mt-0.5" /> {t.benachrichtigen}</label>
                <MailHinweis knapp sprache={l} />
                <label className="flex gap-2 rounded-2xl bg-rot-hell p-3 text-rot"><input type="checkbox" name="bestaetigt" value="ja" required className="mt-0.5" /> {t.bestaetigen}</label>
              </div>
              <button type="submit" className="rounded-full bg-red-800 px-5 py-3 font-semibold text-white">{t.absagenKnopf}</button>
            </form>
          )}
        </section>
      </main>
    </>
  );
}
