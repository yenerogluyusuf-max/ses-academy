import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TagesordnungKnoepfe } from "@/components/team/Dokumente";
import { Hinweis } from "@/components/team/Hinweis";
import { ModulFormular } from "@/components/team/ModulFormular";
import { ModulReiter } from "@/components/team/ModulReiter";
import { TeamKopf } from "@/components/team/TeamKopf";
import { MailHinweis } from "@/components/team/MailHinweis";
import { jetztMs } from "@/lib/zeit";
import { absageZuruecknehmen, modulAbsagen, modulSpeichern, tagEntfernen, tagHinzufuegen } from "@/lib/aktionen/module";
import { requireStaff } from "@/lib/auth";
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


/** Neue Texte des Überblicks (Umbau 16.11.2026). */
const U = {
  de: {
    stattgefunden: "Stattgefunden", laeuft: "Läuft gerade", inTagen: (n: number) => (n <= 0 ? "heute" : n === 1 ? "morgen" : `in ${n} Tagen`),
    ortFolgt: "Ort folgt", angemeldet: "angemeldet", zugesagt: "zugesagt", abgesagt: "abgesagt", offen: "ohne Rückmeldung",
    da: (tag: string) => `da am ${tag}`, feedback: "Feedback (Programm insgesamt)", antworten: (n: number) => `${n} Antworten`,
    zurAuswertung: "Zur Auswertung", zurListe: "Zur Liste",
    termine: "Termine", eingecheckt: (n: number) => `${n} eingecheckt`, einlass: "Einlass", ablauf: "Ablauf am Tag", terminNeu: "Termin hinzufügen",
    versand: "Versand und Druck", infoMail: "Info-Mail", infoStand: (a: number, b: number) => `${a} von ${b} verschickt`,
    tagesordnung: "Tagesordnung", namensschilder: "Namensschilder", notfall: "Notfall-Liste",
    workshop: "Workshop-Gruppen", workshopText: (g: number, r: number, k: number) => `${g} Gruppen in ${r} Räumen zu ${k} Themen`,
    gruppen: (n: number) => `${n} ${n === 1 ? "Gruppe" : "Gruppen"}`, personen: (n: number) => `${n} Personen`, zuDenGruppen: "Alle Gruppen ansehen",
    bearbeiten: "Moduldaten bearbeiten", bearbeitenText: "Titel, Ort, Untertitel, Plätze und Sichtbarkeit auf der Website.",
  },
  tr: {
    stattgefunden: "Gerçekleşti", laeuft: "Şu an devam ediyor", inTagen: (n: number) => (n <= 0 ? "bugün" : n === 1 ? "yarın" : `${n} gün sonra`),
    ortFolgt: "yer bildirilecek", angemeldet: "kayıtlı", zugesagt: "katılacak", abgesagt: "katılmayacak", offen: "cevap yok",
    da: (tag: string) => `${tag} katılan`, feedback: "Geri bildirim (programın geneli)", antworten: (n: number) => `${n} cevap`,
    zurAuswertung: "Değerlendirmeye git", zurListe: "Listeye git",
    termine: "Tarihler", eingecheckt: (n: number) => `${n} giriş`, einlass: "Giriş", ablauf: "Günün akışı", terminNeu: "Tarih ekle",
    versand: "Gönderim ve baskı", infoMail: "Bilgi e-postası", infoStand: (a: number, b: number) => `${b} kişiden ${a} kişiye gönderildi`,
    tagesordnung: "Gündem", namensschilder: "Yaka kartları", notfall: "Acil durum listesi",
    workshop: "Atölye grupları", workshopText: (g: number, r: number, k: number) => `${r} salonda ${k} konuda ${g} grup`,
    gruppen: (n: number) => `${n} grup`, personen: (n: number) => `${n} kişi`, zuDenGruppen: "Tüm grupları gör",
    bearbeiten: "Modül bilgilerini düzenle", bearbeitenText: "Başlık, yer, alt başlık, kontenjan ve web sitesindeki görünürlük.",
  },
  fr: {
    stattgefunden: "Passé", laeuft: "En cours", inTagen: (n: number) => (n <= 0 ? "aujourd’hui" : n === 1 ? "demain" : `dans ${n} jours`),
    ortFolgt: "lieu à venir", angemeldet: "inscrits", zugesagt: "confirment", abgesagt: "se désistent", offen: "sans réponse",
    da: (tag: string) => `présents ${tag}`, feedback: "Retours (programme global)", antworten: (n: number) => `${n} réponses`,
    zurAuswertung: "Voir l’analyse", zurListe: "Voir la liste",
    termine: "Dates", eingecheckt: (n: number) => `${n} enregistrés`, einlass: "Accueil", ablauf: "Déroulé du jour", terminNeu: "Ajouter une date",
    versand: "Envois et impressions", infoMail: "E-mail d’information", infoStand: (a: number, b: number) => `${a} sur ${b} envoyés`,
    tagesordnung: "Ordre du jour", namensschilder: "Badges", notfall: "Liste d’urgence",
    workshop: "Groupes d’atelier", workshopText: (g: number, r: number, k: number) => `${g} groupes dans ${r} salles sur ${k} thèmes`,
    gruppen: (n: number) => `${n} ${n === 1 ? "groupe" : "groupes"}`, personen: (n: number) => `${n} personnes`, zuDenGruppen: "Voir tous les groupes",
    bearbeiten: "Modifier les données du module", bearbeitenText: "Titre, lieu, sous-titre, places et visibilité sur le site.",
  },
} satisfies Record<TeamSprache, Record<string, unknown>>;

/** Thema aus dem Gruppennamen „Ekip 3 · Konu 2: Thema“ (sonst der ganze Name). */
function thema(name: string) {
  const treffer = name.match(/·\s*(.+)$/);
  return (treffer ? treffer[1] : name).trim();
}

/**
 * Überblick eines Moduls (Umbau 16.11.2026, Wunsch: übersichtlich, ohne Technikbegriffe):
 * oben die Zahlen, die zählen (angemeldet, Zusagen, Anwesenheit je Tag, Feedback), dann Termine, Versand und Druck,
 * die Workshop-Gruppen und ganz unten eingeklappt „Moduldaten bearbeiten“ mit der Absage. Das Feedback im Detail steht
 * jetzt im Reiter „Auswertung“.
 */
export default async function ModulDetail({ params, searchParams }: PageProps<"/team/module/[id]">) {
  const staff = await requireStaff("alles");
  const l = staff.sprache;
  const t = T[l];
  const u = U[l];
  const w = teamTexte[l];
  const tagFormat = new Intl.DateTimeFormat(teamLocale[l], { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Berlin" });
  const kurzTag = new Intl.DateTimeFormat(teamLocale[l], { weekday: "short", day: "numeric", month: "numeric", timeZone: "Europe/Berlin" });
  const tagMonat = new Intl.DateTimeFormat(teamLocale[l], { day: "numeric", month: "long", timeZone: "Europe/Berlin" });
  const jahrFormat = new Intl.DateTimeFormat(teamLocale[l], { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" });
  const zeitFormat = new Intl.DateTimeFormat(teamLocale[l], { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
  const { id } = await params;
  const { hinweis } = await searchParams;
  if (!istToken(id)) notFound();
  const supabase = await createClient();
  const { data: m } = await supabase
    .from("modules")
    .select("*, module_days(id, day, starts_at, ends_at, label, attendances(count)), registrations(status, rsvp)")
    .eq("id", id)
    .maybeSingle();
  if (!m) notFound();

  const [{ data: infoRoh }, { data: tagesordnungen }, { data: umfrage }, { data: gruppen }] = await Promise.all([
    supabase.rpc("get_info_status", { p_module_id: m.id }),
    // Fertige Tagesordnungen (PDF) aus „Material“ mit dem Schlagwort „Tagesordnung“, zum direkten Herunterladen
    supabase.from("documents").select("id, title").eq("module_id", m.id).contains("tags", ["Tagesordnung"]).gt("current_version", 0).neq("status", "archiv"),
    supabase.from("feedback_surveys").select("id").eq("module_id", m.id).maybeSingle(),
    supabase.from("module_groups").select("id, name, room, group_members(count)").eq("module_id", m.id).order("position"),
  ]);
  const info = infoRoh ?? [];
  const { data: ergebnisse } = umfrage ? await supabase.rpc("get_feedback_results", { p_survey_id: umfrage.id }) : { data: null };
  const gesamtFrage = (ergebnisse ?? []).find((e) => e.kind === "skala");

  const code = typeof hinweis === "string" && hinweis.startsWith("gespeichert-") ? "gespeichert" : typeof hinweis === "string" && hinweis.startsWith("abgesagt-") ? "abgesagt" : hinweis;
  const absageInformiert = typeof hinweis === "string" && hinweis.startsWith("abgesagt-") ? Number(hinweis.split("-")[1]) : null;
  const neuAngemeldet = typeof hinweis === "string" && hinweis.startsWith("gespeichert-") ? Number(hinweis.split("-")[1]) : 0;
  const tage = [...m.module_days].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const jetzt = jetztMs();
  const beginn = tage[0] ? Date.parse(tage[0].starts_at) : null;
  const ende = tage.at(-1) ? Date.parse(tage.at(-1)!.ends_at) : null;
  const bestaetigt = m.registrations.filter((r) => r.status === "confirmed");
  const zusagen = { ja: bestaetigt.filter((r) => r.rsvp === "zugesagt").length, nein: bestaetigt.filter((r) => r.rsvp === "abgesagt").length };
  const ohneAntwort = bestaetigt.length - zusagen.ja - zusagen.nein;

  const zeitraum = !beginn || !ende ? t.keineTermine
    : tagMonat.format(beginn) === tagMonat.format(ende) ? jahrFormat.format(beginn) : `${tagMonat.format(beginn)} – ${jahrFormat.format(ende)}`;
  const zustand = m.cancelled_at ? { text: t.abgesagt, klasse: "bg-rot-hell text-rot" }
    : ende && ende < jetzt ? { text: u.stattgefunden, klasse: "bg-paper-deep" }
    : beginn && beginn <= jetzt ? { text: u.laeuft, klasse: "bg-signal" }
    : beginn ? { text: u.inTagen(Math.floor((beginn - jetzt) / 86_400_000)), klasse: "bg-gruen-hell" } : null;

  // Workshop-Gruppen: Räume und Themen aus den Gruppennamen
  const gruppenListe = (gruppen ?? []).map((g) => ({ ...g, anzahl: (g.group_members as unknown as { count: number }[])[0]?.count ?? 0 }));
  const themen = [...gruppenListe.reduce((karte, g) => {
    const k = thema(g.name);
    const x = karte.get(k) ?? { gruppen: 0, personen: 0 };
    karte.set(k, { gruppen: x.gruppen + 1, personen: x.personen + g.anzahl });
    return karte;
  }, new Map<string, { gruppen: number; personen: number }>())];
  const raeume = new Set(gruppenListe.map((g) => g.room).filter(Boolean)).size;

  const kachel = "rounded-2xl bg-weiss p-4 ring-1 ring-line";
  const knopfKlein = "rounded-full bg-weiss px-3.5 py-1.5 text-sm font-semibold ring-1 ring-line hover:ring-ink";

  return (
    <>
      <TeamKopf staff={staff} aktiv="module" />
      <main lang={l} className="mx-auto max-w-5xl px-4 py-8">
        <ModulReiter id={m.id} titel={m.title} aktiv="" untertitel={
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{zeitraum}</span><span aria-hidden>·</span><span>{m.location || u.ortFolgt}</span>
            {zustand && <span className={`chip py-0.5 ${zustand.klasse}`}>{zustand.text}</span>}
          </p>
        } />
        {m.cancelled_at && m.cancellation_reason && <p className="mb-4 font-semibold text-rot">{t.abgesagtGrund(m.cancellation_reason)}</p>}
        <Hinweis code={code} texte={t.hinweise} />
        {absageInformiert !== null && absageInformiert > 0 && <p role="status" className="mt-2 rounded-2xl bg-gruen-hell p-4">{t.informiert(absageInformiert)}</p>}
        {neuAngemeldet > 0 && <p role="status" className="mt-2 rounded-2xl bg-gruen-hell p-4">{t.neuAngemeldet(neuAngemeldet)}</p>}

        {/* Zahlen auf einen Blick, jede Kachel führt zur passenden Liste */}
        <section aria-label={u.angemeldet} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link href={`/team/module/${m.id}/teilnehmende/`} className={`${kachel} hover:ring-ink`}>
            <span className="font-display block text-3xl font-extrabold tabular-nums">{bestaetigt.length}</span>
            <span className="text-sm text-ink-soft">{u.angemeldet}</span>
            <span className="mt-2 block text-xs text-ink-soft">{zusagen.ja} {u.zugesagt} · {zusagen.nein} {u.abgesagt} · {ohneAntwort} {u.offen}</span>
          </Link>
          {tage.slice(0, 2).map((tag) => (
            <Link key={tag.id} href={`/team/module/${m.id}/teilnehmende/?tag=${tag.id}`} className={`${kachel} hover:ring-ink`}>
              <span className="font-display block text-3xl font-extrabold tabular-nums">{tag.attendances[0]?.count ?? 0}</span>
              <span className="text-sm text-ink-soft">{u.da(kurzTag.format(new Date(tag.starts_at)))}</span>
              {bestaetigt.length > 0 && Date.parse(tag.starts_at) < jetzt && (
                <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-paper-deep">
                  <span className="block h-full rounded-full bg-forest" style={{ width: `${Math.min(100, Math.round(((tag.attendances[0]?.count ?? 0) / bestaetigt.length) * 100))}%` }} />
                </span>
              )}
            </Link>
          ))}
          {gesamtFrage && gesamtFrage.average !== null ? (
            <Link href={`/team/module/${m.id}/auswertung/`} className={`${kachel} hover:ring-ink`}>
              <span className="font-display block text-3xl font-extrabold tabular-nums">{String(gesamtFrage.average).replace(".", l === "de" || l === "fr" ? "," : ",")}<span className="text-base text-ink-soft"> / {gesamtFrage.scale_max ?? 5}</span></span>
              <span className="text-sm text-ink-soft">{u.feedback}</span>
              <span className="mt-2 block text-xs text-ink-soft">{u.antworten(gesamtFrage.answers)}</span>
            </Link>
          ) : null}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Termine */}
          <section className="karte">
            <h2 className="font-display text-xl font-bold">{u.termine}</h2>
            <ul className="mt-3 divide-y divide-line">
              {tage.map((tag) => {
                const checkins = tag.attendances[0]?.count ?? 0;
                return (
                  <li key={tag.id} className="py-3">
                    <p className="font-semibold">{tagFormat.format(new Date(tag.starts_at))}{tag.label ? ` · ${tag.label}` : ""}</p>
                    <p className="text-sm text-ink-soft">{zeitFormat.format(new Date(tag.starts_at))}–{zeitFormat.format(new Date(tag.ends_at))} · {u.eingecheckt(checkins)}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Link href={`/team/einlass/?tag=${tag.id}`} className={knopfKlein}>{u.einlass}</Link>
                      <Link href={`/team/regieplan/?tag=${tag.id}`} className={knopfKlein}>{u.ablauf}</Link>
                      {checkins === 0 && (
                        <form action={tagEntfernen}>
                          <input type="hidden" name="module_id" value={m.id} /><input type="hidden" name="day_id" value={tag.id} />
                          <button type="submit" className="text-sm text-ink-soft underline">{t.entfernen}</button>
                        </form>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {tage.length === 0 && <p className="mt-3 text-ink-soft">{t.keineTermine}</p>}
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold">+ {u.terminNeu}</summary>
              <form action={tagHinzufuegen} className="mt-3 grid gap-2 sm:grid-cols-2">
                <input type="hidden" name="module_id" value={m.id} />
                <div className="sm:col-span-2"><label htmlFor="day" className="etikett">{w.wort.datum}</label><input id="day" name="day" type="date" required className="feld" /></div>
                <div><label htmlFor="von" className="etikett">{t.beginn}</label><input id="von" name="von" type="time" required defaultValue="10:00" className="feld" /></div>
                <div><label htmlFor="bis" className="etikett">{t.ende}</label><input id="bis" name="bis" type="time" required defaultValue="18:00" className="feld" /></div>
                <div className="sm:col-span-2"><label htmlFor="label" className="etikett">{t.bezeichnung}</label><input id="label" name="label" placeholder={t.bezeichnungBeispiel} className="feld" /></div>
                <button type="submit" className="knopf sm:col-span-2 sm:justify-self-start">{t.terminEintragen}</button>
              </form>
              <p className="mt-2 text-xs text-ink-soft">{t.termineText}</p>
            </details>
          </section>

          {/* Versand und Druck */}
          <section id="tickets" className="karte">
            <h2 className="font-display text-xl font-bold">{u.versand}</h2>
            <ul className="mt-3 divide-y divide-line">
              <li className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span>
                  <span className="block font-semibold">{u.infoMail}</span>
                  <span className="text-sm text-ink-soft">
                    {u.infoStand(info.filter((x) => x.info_status === "gesendet").length, info.length)}
                    {info.some((x) => x.info_status === "fehlgeschlagen") && t.fehlgeschlagen(info.filter((x) => x.info_status === "fehlgeschlagen").length)}
                    {info.some((x) => x.info_status === "keine_mail") && t.ohneMail(info.filter((x) => x.info_status === "keine_mail").length)}
                  </span>
                </span>
                {m.cancelled_at
                  ? <span className="text-sm text-ink-soft">{t.infoAbgesagt}</span>
                  : <Link href={`/team/module/${m.id}/infomail/`} className={knopfKlein}>{w.wort.oeffnen}</Link>}
              </li>
              <li className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="font-semibold">{u.tagesordnung}</span>
                <Link href={`/team/module/${m.id}/tagesordnung/`} target="_blank" className={knopfKlein}>{w.wort.drucken}</Link>
              </li>
              <li className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="font-semibold">{u.namensschilder}</span>
                <Link href={`/team/module/${m.id}/namensschilder/`} className={knopfKlein}>{w.wort.drucken}</Link>
              </li>
              <li className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="font-semibold">{u.notfall}</span>
                <Link href={`/team/module/${m.id}/notfall/`} className={knopfKlein}>{w.wort.drucken}</Link>
              </li>
            </ul>
            <MailHinweis knapp className="mt-2" sprache={l} />
            <TagesordnungKnoepfe dokumente={tagesordnungen ?? []} sprache={l} />
          </section>
        </div>

        {/* Workshop-Gruppen */}
        {gruppenListe.length > 0 && (
          <section className="karte mt-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-xl font-bold">{u.workshop}</h2>
              <Link href={`/team/module/${m.id}/gruppen/`} className="link text-sm">{u.zuDenGruppen}</Link>
            </div>
            <p className="mt-1 text-sm text-ink-soft">{u.workshopText(gruppenListe.length, raeume, themen.length)}</p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {themen.map(([name, x]) => (
                <li key={name} className="flex items-baseline justify-between gap-3 rounded-2xl bg-paper px-4 py-3">
                  <span className="font-semibold">{name}</span>
                  <span className="shrink-0 text-sm text-ink-soft">{u.gruppen(x.gruppen)} · {u.personen(x.personen)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Selten gebraucht: eingeklappt ganz unten */}
        <details className="mt-10 rounded-3xl bg-white/60 ring-1 ring-line">
          <summary className="cursor-pointer px-6 py-4 font-semibold">{u.bearbeiten}</summary>
          <div className="px-6 pb-6">
            <p className="mb-4 text-sm text-ink-soft">{u.bearbeitenText}</p>
            <ModulFormular modul={m} aktion={modulSpeichern} knopf={w.wort.speichern} sprache={l} />

            <div className="mt-8 border-t border-line pt-6">
              <h3 className="font-semibold">{m.cancelled_at ? t.absage : t.absagen}</h3>
              {m.cancelled_at ? (
                <form action={absageZuruecknehmen} className="mt-3">
                  <input type="hidden" name="id" value={m.id} />
                  <button type="submit" className="knopf-hell">{t.zuruecknehmen}</button>
                </form>
              ) : (
                <form action={modulAbsagen} className="mt-3 grid gap-2">
                  <input type="hidden" name="id" value={m.id} />
                  <div><label htmlFor="grund" className="etikett">{t.grund}</label><input id="grund" name="grund" className="feld" /></div>
                  <label className="flex gap-2 text-sm"><input type="checkbox" name="benachrichtigen" value="ja" defaultChecked className="mt-0.5" /> {t.benachrichtigen}</label>
                  <label className="flex gap-2 rounded-2xl bg-rot-hell p-3 text-sm text-rot"><input type="checkbox" name="bestaetigt" value="ja" required className="mt-0.5" /> {t.bestaetigen}</label>
                  <button type="submit" className="justify-self-start rounded-full bg-rot px-5 py-2.5 text-sm font-semibold text-white">{t.absagenKnopf}</button>
                </form>
              )}
            </div>
          </div>
        </details>
      </main>
    </>
  );
}
