import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Hinweis } from "@/components/team/Hinweis";
import { ModulReiter } from "@/components/team/ModulReiter";
import { TeamKopf } from "@/components/team/TeamKopf";
import { Rueckfrage } from "@/components/team/Rueckfrage";
import { zimmerlisteSenden } from "@/lib/aktionen/logistik";
import { mailBereit } from "@/lib/mail";
import { abfrageUmschalten, hotelEntfernen, hotelSpeichern, zimmerAnlegen, zimmerEntfernen, zimmerSichtbarUmschalten, zimmerZuteilen } from "@/lib/aktionen/hotel";
import { darf, requireStaff } from "@/lib/auth";
import { istToken } from "@/lib/codes";
import { naechte, nachtName } from "@/lib/uebernachtung";
import { createClient } from "@/lib/supabase/server";
import { teamLocale, type TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";

export const metadata: Metadata = { title: "Hotel und Zimmer | SES Academy" };

type Meldung = { text: string; gut: boolean };

const de = {
  hinweise: {
    abfrage: { text: "Gespeichert.", gut: true },
    hotel: { text: "Hotel gespeichert.", gut: true },
    zimmer: { text: "Zimmer angelegt.", gut: true },
    "zimmer-entfernt": { text: "Zimmer entfernt.", gut: true },
    zugeteilt: { text: "Zuteilung gespeichert.", gut: true },
    "zimmer-voll": { text: "Das Zimmer ist schon voll. Die bisherige Zuteilung bleibt.", gut: false },
    "hotel-entfernt": { text: "Hotel entfernt.", gut: true },
    "liste-gesendet": { text: "Zimmerliste ans Hotel verschickt (Excel-Datei im Anhang).", gut: true },
    "liste-adresse": { text: "Bitte eine gültige E-Mail-Adresse des Hotels angeben.", gut: false },
    "liste-mail-aus": { text: "Mailversand ist nicht eingerichtet: Die Zimmerliste wurde nicht verschickt. Bitte herunterladen und selbst schicken.", gut: false },
    "liste-leer": { text: "In diesem Hotel ist noch niemand eingeteilt. Es wurde nichts verschickt.", gut: false },
    "liste-fehler": { text: "Die Mail konnte nicht verschickt werden: Der Mailserver hat sie abgelehnt oder war nicht erreichbar.", gut: false },
    "hotel-belegt": { text: "In diesem Hotel sind noch Personen eingeteilt. Bitte erst umsetzen, dann entfernen.", gut: false },
    "zimmer-sichtbar": { text: "Die Zimmer stehen jetzt bei den Teilnehmenden in „Mein Bereich“.", gut: true },
    "zimmer-verborgen": { text: "Die Zimmer sind in „Mein Bereich“ verborgen.", gut: true },
    eingabe: { text: "Bitte die Angaben prüfen: Name, Preis als Zahl (z. B. 89,50), Kontingent als Zahl, Stornofrist als Datum.", gut: false },
    fehler: { text: "Das hat nicht geklappt.", gut: false },
  } as Record<string, Meldung>,
  anreise: { bahn: "Bahn", auto: "Auto", flug: "Flug", bus: "Bus", andere: "anders" } as Record<string, string>,
  /** Beschriftung „Frauen“/„Männer“ aus der automatischen Einteilung (in der Datenbank deutsch) */
  bereiche: {} as Record<string, string>,
  g: { w: "w", m: "m" } as Record<string, string>,
  gName: { w: "weiblich", m: "männlich" } as Record<string, string>,
  hotels: "Hotels",
  hotelsDoppelpunkt: (n: number): string => (n > 1 ? "Hotels:" : "Hotel:"),
  weiteresHotel: "+ Weiteres Hotel",
  kostenuebersicht: "Kostenübersicht",
  abfrage: "Abfrage in „Mein Bereich“:",
  offen: "offen",
  geschlossen: "geschlossen",
  geantwortet: (n: number, von: number) => `${n} von ${von} haben geantwortet`,
  abfrageSchliessen: "Abfrage schließen",
  abfrageOeffnen: "Abfrage öffnen",
  zimmerSichtbar: (hotel: string | null) => `Zimmer in „Mein Bereich“${hotel ? ` (${hotel})` : ""}:`,
  sichtbar: "sichtbar, alle Zugeteilten sehen ihr Zimmer",
  verborgen: "verborgen, erst nach Prüfung des Zimmerplans freigeben",
  nameFolgt: "Vor dem Freigeben bitte oben den Hotelnamen und die Adresse eintragen.",
  zimmerVerbergen: "Zimmer verbergen",
  zimmerFreigeben: "Zimmer freigeben",
  jeNacht: "Übernachtungen je Nacht",
  nacht: (nacht: string, anzahl: number, w: number, m: number) => `${nacht}: ${anzahl}${anzahl ? ` (${w} w · ${m} m)` : ""}`,
  weiteresAnlegen: "Weiteres Hotel anlegen",
  hotel: "Hotel",
  name: "Name",
  adresse: "Adresse",
  ansprechperson: "Ansprechperson im Hotel",
  ansprechpersonBeispiel: "Name, Telefon, Mail",
  kontingent: "Kontingent (Zimmer)",
  preis: "Preis je Zimmer und Nacht (€)",
  storno: "Kostenlos stornierbar bis",
  notizen: "Notizen",
  hotelAnlegen: "Hotel anlegen",
  hotelEntfernen: "Dieses Hotel entfernen",
  hotelEntfernenJa: "Ja, Hotel entfernen",
  hotelEntfernenFrage: (name: string, n: number) => `„${name}“ mit ${n} Zimmern entfernen? Eingeteilt ist dort niemand.`,
  stornofrist: (datum: string) => `Stornofrist: ${datum}. Bis dahin die Zimmerliste mit dem Hotel abgleichen.`,
  zimmer: "Zimmer",
  zimmerStand: (zimmer: number, belegt: number, betten: number, kontingent: number | null) =>
    `${zimmer} Zimmer · ${belegt} von ${betten} Betten belegt${kontingent ? ` · Kontingent ${kontingent}` : ""}`,
  listePdf: "Zimmerliste als PDF",
  alsExcel: "als Excel",
  zuerstHotelNeu: "Zuerst das Hotel anlegen, dann seine Zimmer.",
  zuerstHotel: "Zuerst das Hotel anlegen.",
  zimmerEntfernen: (label: string) => `Zimmer ${label} entfernen`,
  entfernen: "entfernen",
  listeMail: "Zimmerliste per Mail ans Hotel",
  senden: "Senden",
  sendenJa: "Ja, jetzt senden",
  sendenFrage: (hotel: string, n: number) => `Zimmerliste von „${hotel}“ (${n} Gäste) jetzt an die eingetragene Adresse schicken? Sie enthält nur Namen und Zimmer, keine Kontaktdaten.`,
  mailAus: "Mailversand ist nicht eingerichtet: Es geht keine Mail raus. Bitte die Liste herunterladen und selbst schicken.",
  zuletzt: (wann: string, an: string) => `Zuletzt verschickt am ${wann} Uhr an ${an}.`,
  nochNicht: "Noch nicht per Mail verschickt.",
  zimmerBeispiel: "101-110 oder 101, 102, 205",
  betten: "Betten",
  bereich: "Bereich",
  bereichBeispiel: "z. B. 1. Stock",
  anlegen: "Anlegen",
  angemeldete: "Angemeldete",
  anreiseSpalte: "Anreise",
  abreise: "Abreise",
  wunsch: "Zimmerwunsch / Hinweis",
  keineAngaben: "noch keine Angaben",
  zimmerFuer: (name: string) => `Zimmer für ${name}`,
  ok: "OK",
  keineAnmeldungen: "Noch keine Anmeldungen.",
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    hinweise: {
      abfrage: { text: "Kaydedildi.", gut: true },
      hotel: { text: "Otel kaydedildi.", gut: true },
      zimmer: { text: "Odalar eklendi.", gut: true },
      "zimmer-entfernt": { text: "Oda kaldırıldı.", gut: true },
      zugeteilt: { text: "Oda yerleştirmesi kaydedildi.", gut: true },
      "zimmer-voll": { text: "Oda zaten dolu. Önceki yerleştirme geçerli kalıyor.", gut: false },
      "hotel-entfernt": { text: "Otel kaldırıldı.", gut: true },
      "liste-gesendet": { text: "Oda listesi otele gönderildi (Excel dosyası ekte).", gut: true },
      "liste-adresse": { text: "Lütfen otelin geçerli bir e-posta adresini gir.", gut: false },
      "liste-mail-aus": { text: "E-posta gönderimi kurulu değil: Oda listesi gönderilmedi. Lütfen listeyi indirip kendin gönder.", gut: false },
      "liste-leer": { text: "Bu otelde henüz kimse yerleştirilmedi. Hiçbir şey gönderilmedi.", gut: false },
      "liste-fehler": { text: "E-posta gönderilemedi: Posta sunucusu e-postayı reddetti ya da sunucuya ulaşılamadı.", gut: false },
      "hotel-belegt": { text: "Bu otelde hâlâ yerleştirilmiş kişiler var. Lütfen önce onları başka odaya al, sonra oteli kaldır.", gut: false },
      "zimmer-sichtbar": { text: "Odalar artık katılımcıların „Mein Bereich“ sayfasında görünüyor.", gut: true },
      "zimmer-verborgen": { text: "Odalar „Mein Bereich“ sayfasında gizlendi.", gut: true },
      eingabe: { text: "Lütfen bilgileri kontrol et: ad, fiyat sayı olarak (ör. 89,50), kontenjan sayı olarak, iptal son tarihi tarih olarak.", gut: false },
      fehler: { text: teamTexte.tr.meldung.fehler, gut: false },
    },
    anreise: { bahn: "Tren", auto: "Araba", flug: "Uçak", bus: "Otobüs", andere: "başka" },
    bereiche: { Frauen: "Kadınlar", Männer: "Erkekler", "ohne Angabe": "belirtilmemiş" },
    g: { w: "K", m: "E" },
    gName: { w: "kadın", m: "erkek" },
    hotels: "Oteller",
    hotelsDoppelpunkt: (n) => (n > 1 ? "Oteller:" : "Otel:"),
    weiteresHotel: "+ Başka otel",
    kostenuebersicht: "Masraf özeti",
    abfrage: "„Mein Bereich“ konaklama anketi:",
    offen: "açık",
    geschlossen: "kapalı",
    geantwortet: (n, von) => `${von} kişiden ${n} kişi cevap verdi`,
    abfrageSchliessen: "Anketi kapat",
    abfrageOeffnen: "Anketi aç",
    zimmerSichtbar: (hotel) => `„Mein Bereich“ içindeki odalar${hotel ? ` (${hotel})` : ""}:`,
    sichtbar: "görünür, yerleştirilen herkes odasını görüyor",
    verborgen: "gizli, oda planını kontrol ettikten sonra yayınla",
    nameFolgt: "Yayınlamadan önce lütfen yukarıya otelin adını ve adresini gir.",
    zimmerVerbergen: "Odaları gizle",
    zimmerFreigeben: "Odaları yayınla",
    jeNacht: "Gecelere göre konaklama",
    nacht: (nacht, anzahl, w, m) => `${nacht}: ${anzahl}${anzahl ? ` (${w} K · ${m} E)` : ""}`,
    weiteresAnlegen: "Başka otel ekle",
    hotel: "Otel",
    name: "Otel adı",
    adresse: "Adres",
    ansprechperson: "Oteldeki irtibat kişisi",
    ansprechpersonBeispiel: "Ad, telefon, e-posta",
    kontingent: "Kontenjan (oda)",
    preis: "Oda başına gecelik fiyat (€)",
    storno: "Ücretsiz iptal son tarihi",
    notizen: "Notlar",
    hotelAnlegen: "Oteli ekle",
    hotelEntfernen: "Bu oteli kaldır",
    hotelEntfernenJa: "Evet, oteli kaldır",
    hotelEntfernenFrage: (name, n) => `„${name}“ ve ${n} odası kaldırılsın mı? Orada kimse yerleştirilmemiş.`,
    stornofrist: (datum) => `Ücretsiz iptal son tarihi: ${datum}. O zamana kadar oda listesini otelle karşılaştır.`,
    zimmer: "Odalar",
    zimmerStand: (zimmer, belegt, betten, kontingent) => `${zimmer} oda · ${betten} yataktan ${belegt} dolu${kontingent ? ` · Kontenjan ${kontingent}` : ""}`,
    listePdf: "Oda listesi PDF",
    alsExcel: "Excel olarak",
    zuerstHotelNeu: "Önce oteli ekle, sonra odalarını.",
    zuerstHotel: "Önce oteli ekle.",
    zimmerEntfernen: (label) => `${label} odasını kaldır`,
    entfernen: "kaldır",
    listeMail: "Oda listesini otele e-postayla gönder",
    senden: "Gönder",
    sendenJa: "Evet, şimdi gönder",
    sendenFrage: (hotel, n) => `„${hotel}“ oda listesi (${n} misafir) şimdi girilen adrese gönderilsin mi? Listede sadece adlar ve odalar var, iletişim bilgisi yok.`,
    mailAus: "E-posta gönderimi kurulu değil: Hiçbir e-posta gitmez. Lütfen listeyi indirip kendin gönder.",
    zuletzt: (wann, an) => `En son ${wann} tarihinde ${an} adresine gönderildi.`,
    nochNicht: "Henüz e-postayla gönderilmedi.",
    zimmerBeispiel: "101-110 veya 101, 102, 205",
    betten: "Yatak",
    bereich: "Bölüm",
    bereichBeispiel: "ör. 1. kat",
    anlegen: "Ekle",
    angemeldete: "Kayıtlılar",
    anreiseSpalte: "Varış",
    abreise: "Ayrılış",
    wunsch: "Oda isteği / not",
    keineAngaben: "henüz bilgi yok",
    zimmerFuer: (name) => `${name} için oda`,
    ok: "Tamam",
    keineAnmeldungen: "Henüz kayıt yok.",
  },
  fr: {
    hinweise: {
      abfrage: { text: "Enregistré.", gut: true },
      hotel: { text: "Hôtel enregistré.", gut: true },
      zimmer: { text: "Chambres ajoutées.", gut: true },
      "zimmer-entfernt": { text: "Chambre supprimée.", gut: true },
      zugeteilt: { text: "Attribution enregistrée.", gut: true },
      "zimmer-voll": { text: "La chambre est déjà pleine. L’attribution précédente est conservée.", gut: false },
      "hotel-entfernt": { text: "Hôtel supprimé.", gut: true },
      "liste-gesendet": { text: "Liste des chambres envoyée à l’hôtel (fichier Excel en pièce jointe).", gut: true },
      "liste-adresse": { text: "Merci d’indiquer une adresse e-mail valide de l’hôtel.", gut: false },
      "liste-mail-aus": { text: "L’envoi d’e-mails n’est pas configuré : la liste des chambres n’a pas été envoyée. Télécharge-la et envoie-la toi-même.", gut: false },
      "liste-leer": { text: "Personne n’est encore réparti dans cet hôtel. Rien n’a été envoyé.", gut: false },
      "liste-fehler": { text: "L’e-mail n’a pas pu être envoyé : le serveur de messagerie l’a refusé ou était injoignable.", gut: false },
      "hotel-belegt": { text: "Des personnes sont encore réparties dans cet hôtel. Déplace-les d’abord, puis supprime l’hôtel.", gut: false },
      "zimmer-sichtbar": { text: "Les chambres sont maintenant visibles pour les participants dans « Mein Bereich ».", gut: true },
      "zimmer-verborgen": { text: "Les chambres sont masquées dans « Mein Bereich ».", gut: true },
      eingabe: { text: "Merci de vérifier les informations : nom, prix en chiffres (p. ex. 89,50), contingent en chiffres, date limite d’annulation sous forme de date.", gut: false },
      fehler: { text: teamTexte.fr.meldung.fehler, gut: false },
    },
    anreise: { bahn: "Train", auto: "Voiture", flug: "Avion", bus: "Autocar", andere: "autre" },
    bereiche: { Frauen: "Femmes", Männer: "Hommes", "ohne Angabe": "non renseigné" },
    g: { w: "F", m: "H" },
    gName: { w: "femme", m: "homme" },
    hotels: "Hôtels",
    hotelsDoppelpunkt: (n) => (n > 1 ? "Hôtels :" : "Hôtel :"),
    weiteresHotel: "+ Autre hôtel",
    kostenuebersicht: "Aperçu des coûts",
    abfrage: "Formulaire dans « Mein Bereich » :",
    offen: "ouvert",
    geschlossen: "fermé",
    geantwortet: (n, von) => `${n} sur ${von} ont répondu`,
    abfrageSchliessen: "Fermer le formulaire",
    abfrageOeffnen: "Ouvrir le formulaire",
    zimmerSichtbar: (hotel) => `Chambres dans « Mein Bereich »${hotel ? ` (${hotel})` : ""} :`,
    sichtbar: "visibles, chaque personne répartie voit sa chambre",
    verborgen: "masquées, à publier seulement après vérification du plan des chambres",
    nameFolgt: "Avant de publier, indique en haut le nom et l’adresse de l’hôtel.",
    zimmerVerbergen: "Masquer les chambres",
    zimmerFreigeben: "Publier les chambres",
    jeNacht: "Nuitées par nuit",
    nacht: (nacht, anzahl, w, m) => `${nacht} : ${anzahl}${anzahl ? ` (${w} F · ${m} H)` : ""}`,
    weiteresAnlegen: "Ajouter un autre hôtel",
    hotel: "Hôtel",
    name: "Nom",
    adresse: "Adresse",
    ansprechperson: "Contact à l’hôtel",
    ansprechpersonBeispiel: "Nom, téléphone, e-mail",
    kontingent: "Contingent (chambres)",
    preis: "Prix par chambre et par nuit (€)",
    storno: "Annulation gratuite jusqu’au",
    notizen: "Notes",
    hotelAnlegen: "Ajouter l’hôtel",
    hotelEntfernen: "Supprimer cet hôtel",
    hotelEntfernenJa: "Oui, supprimer l’hôtel",
    hotelEntfernenFrage: (name, n) => `Supprimer « ${name} » et ses ${n} chambres ? Personne n’y est réparti.`,
    stornofrist: (datum) => `Date limite d’annulation : ${datum}. D’ici là, comparer la liste des chambres avec l’hôtel.`,
    zimmer: "Chambres",
    zimmerStand: (zimmer, belegt, betten, kontingent) => `${zimmer} chambres · ${belegt} lits occupés sur ${betten}${kontingent ? ` · contingent ${kontingent}` : ""}`,
    listePdf: "Liste des chambres en PDF",
    alsExcel: "en Excel",
    zuerstHotelNeu: "Ajoute d’abord l’hôtel, puis ses chambres.",
    zuerstHotel: "Ajoute d’abord l’hôtel.",
    zimmerEntfernen: (label) => `Supprimer la chambre ${label}`,
    entfernen: "supprimer",
    listeMail: "Envoyer la liste des chambres à l’hôtel par e-mail",
    senden: "Envoyer",
    sendenJa: "Oui, envoyer maintenant",
    sendenFrage: (hotel, n) => `Envoyer maintenant la liste des chambres de « ${hotel} » (${n} personnes) à l’adresse indiquée ? Elle contient seulement les noms et les chambres, aucune coordonnée.`,
    mailAus: "L’envoi d’e-mails n’est pas configuré : aucun e-mail ne partira. Télécharge la liste et envoie-la toi-même.",
    zuletzt: (wann, an) => `Dernier envoi le ${wann} à ${an}.`,
    nochNicht: "Pas encore envoyée par e-mail.",
    zimmerBeispiel: "101-110 ou 101, 102, 205",
    betten: "Lits",
    bereich: "Secteur",
    bereichBeispiel: "p. ex. 1er étage",
    anlegen: "Ajouter",
    angemeldete: "Inscrits",
    anreiseSpalte: "Arrivée",
    abreise: "Départ",
    wunsch: "Souhait de chambre / remarque",
    keineAngaben: "pas encore de réponse",
    zimmerFuer: (name) => `Chambre pour ${name}`,
    ok: "OK",
    keineAnmeldungen: "Pas encore d’inscriptions.",
  },
};

/** Texte der zusammengeführten Seite „Unterkunft“ (Umbau 16.11.2026). */
const U: Record<TeamSprache, {
  belegung: string; planen: string; planenText: string; uebernachtende: (n: number) => string; ohneAngaben: (n: number) => string;
  hoteldaten: string; frei: (n: number) => string; ohneZimmer: (n: number) => string; zimmerPersonen: (z: number, p: number, b: number) => string;
  status: string; leer: string;
}> = {
  de: {
    belegung: "Belegung", planen: "Zimmer planen", planenText: "Vorschlag berechnen, Zimmerwünsche prüfen",
    uebernachtende: (n) => `Übernachtende und Zuteilung (${n})`, ohneAngaben: (n) => `${n} Angemeldete ohne Angaben zur Übernachtung`,
    hoteldaten: "Hoteldaten, Zimmer anlegen, Liste ans Hotel", frei: (n) => `${n} frei`,
    ohneZimmer: (n) => `${n} übernachten noch ohne Zimmer`, zimmerPersonen: (z, p, b) => `${z} Zimmer · ${p} von ${b} Betten belegt`,
    status: "Stand", leer: "frei",
  },
  tr: {
    belegung: "Doluluk", planen: "Oda planla", planenText: "Öneri hesapla, oda isteklerini kontrol et",
    uebernachtende: (n) => `Konaklayanlar ve oda dağılımı (${n})`, ohneAngaben: (n) => `Konaklama bilgisi vermeyen ${n} kayıtlı`,
    hoteldaten: "Otel bilgileri, oda ekleme, otele liste", frei: (n) => `${n} boş`,
    ohneZimmer: (n) => `${n} kişi konaklıyor ama henüz odası yok`, zimmerPersonen: (z, p, b) => `${z} oda · ${b} yataktan ${p} dolu`,
    status: "Durum", leer: "boş",
  },
  fr: {
    belegung: "Occupation", planen: "Planifier les chambres", planenText: "Calculer une proposition, vérifier les souhaits",
    uebernachtende: (n) => `Personnes hébergées et attribution (${n})`, ohneAngaben: (n) => `${n} inscrits sans indication d’hébergement`,
    hoteldaten: "Données de l’hôtel, créer des chambres, liste à l’hôtel", frei: (n) => `${n} libres`,
    ohneZimmer: (n) => `${n} hébergés encore sans chambre`, zimmerPersonen: (z, p, b) => `${z} chambres · ${p} lits occupés sur ${b}`,
    status: "État", leer: "libre",
  },
};

export default async function HotelSeite({ params, searchParams }: PageProps<"/team/module/[id]/hotel">) {
  const staff = await requireStaff("orga");
  const l = staff.sprache;
  const t = T[l];
  const w = teamTexte[l].wort;
  const zeit = new Intl.DateTimeFormat(teamLocale[l], { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
  const bereichName = (b: string) => t.bereiche[b] ?? b;
  const { id } = await params;
  const { hinweis, hotel: hotelWahl } = await searchParams;
  if (!istToken(id)) notFound();
  const supabase = await createClient();
  const [{ data: modul }, { data: hotels }, { data: personen }] = await Promise.all([
    supabase.from("modules").select("id, title, stay_form_open, module_days(day)").eq("id", id).maybeSingle(),
    supabase.from("hotels").select("*, rooms(id, label, capacity, section, room_assignments(participant_id))").eq("module_id", id).order("created_at"),
    supabase.rpc("get_stay_overview", { p_module_id: id }),
  ]);
  if (!modul) notFound();
  const alleNaechte = naechte(modul.module_days.map((d) => d.day));
  const liste = personen ?? [];
  const geantwortet = liste.filter((p) => p.answered);
  const proNacht = alleNaechte.map((n) => ({ nacht: n, anzahl: geantwortet.filter((p) => p.nights.includes(n)).length,
    w: geantwortet.filter((p) => p.nights.includes(n) && p.gender === "w").length, m: geantwortet.filter((p) => p.nights.includes(n) && p.gender === "m").length }));
  // Mehrere Hotels je Modul: eines ist gewählt (?hotel=), „neu“ zeigt ein leeres Formular für ein weiteres
  const alleHotels = hotels ?? [];
  const neu = hotelWahl === "neu";
  const hotel = neu ? undefined : alleHotels.find((h) => h.id === hotelWahl) ?? alleHotels[0];
  const sortiert = <T extends { label: string }>(z: T[]) => [...z].sort((a, b) => a.label.localeCompare(b.label, "de", { numeric: true }));
  const zimmer = sortiert(hotel?.rooms ?? []);
  const hotelName = new Map(alleHotels.map((h) => [h.id, h.name]));
  const alleZimmer = alleHotels.flatMap((h) => sortiert(h.rooms).map((z) => ({ ...z, hotel: h.name })));
  const belegt = zimmer.reduce((s, z) => s + z.room_assignments.length, 0);
  const betten = zimmer.reduce((s, z) => s + z.capacity, 0);
  const u = U[l];
  const nameVon = new Map(liste.map((p) => [p.participant_id, p.name]));
  const uebernachtende = liste.filter((p) => p.answered && (p.nights.length > 0 || p.room_id));
  const ohneAngaben = liste.length - liste.filter((p) => p.answered).length;
  const ohneZimmer = liste.filter((p) => p.nights.length > 0 && !p.room_id).length;

  return (
    <>
      <TeamKopf staff={staff} aktiv="module" breit />
      <main lang={l} className="mx-auto max-w-7xl px-4 py-8">
        <ModulReiter id={id} titel={modul.title} aktiv="hotel/" />
        <Hinweis code={hinweis} texte={t.hinweise} />

        {/* Hotels als Umschalter */}
        <nav aria-label={t.hotels} className="flex flex-wrap items-center gap-2">
          {alleHotels.map((h) => {
            const belegt = h.rooms.reduce((n, z) => n + z.room_assignments.length, 0);
            return (
              <Link key={h.id} href={`/team/module/${id}/hotel/?hotel=${h.id}`} aria-current={h.id === hotel?.id ? "page" : undefined}
                className={`rounded-full px-4 py-2 text-sm font-semibold ring-1 ${h.id === hotel?.id ? "bg-ink text-paper ring-ink" : "bg-weiss ring-line hover:ring-ink"}`}>
                {h.name} <span className="opacity-70">{belegt}/{h.rooms.reduce((n, z) => n + z.capacity, 0)}</span>
              </Link>
            );
          })}
          <Link href={`/team/module/${id}/hotel/?hotel=neu`} aria-current={neu ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-sm font-semibold ring-1 ${neu ? "bg-ink text-paper ring-ink" : "bg-weiss ring-line hover:ring-ink"}`}>{alleHotels.length ? t.weiteresHotel : `+ ${t.hotel}`}</Link>
          <Link href={`/team/module/${id}/zimmerplan/${hotel ? `?hotel=${hotel.id}` : ""}`} className="knopf-hell ml-auto" title={u.planenText}>{u.planen}</Link>
        </nav>

        {/* Stand in einer Zeile: Nächte, Abfrage, Sichtbarkeit */}
        <section className="mt-4 space-y-3 rounded-3xl bg-white/60 p-4 ring-1 ring-line">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {proNacht.map((n) => <span key={n.nacht} className="chip bg-paper-deep px-3 py-1 text-sm whitespace-nowrap">{t.nacht(nachtName(n.nacht), n.anzahl, n.w, n.m)}</span>)}
            {ohneZimmer > 0 && <span className="chip bg-gelb-hell px-3 py-1 text-sm">{u.ohneZimmer(ohneZimmer)}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-3 text-sm">
            {darf.alles(staff.role) && (
              <form action={abfrageUmschalten} className="flex items-center gap-2">
                <input type="hidden" name="module_id" value={id} /><input type="hidden" name="offen" value={modul.stay_form_open ? "0" : "1"} />
                <span className="text-ink-soft">{t.abfrage} {modul.stay_form_open ? t.offen : t.geschlossen} · {t.geantwortet(geantwortet.length, liste.length)}</span>
                <button type="submit" className="rounded-full bg-weiss px-3 py-1 text-xs font-semibold ring-1 ring-line hover:ring-ink">{modul.stay_form_open ? t.abfrageSchliessen : t.abfrageOeffnen}</button>
              </form>
            )}
            {hotel && (
              <form action={zimmerSichtbarUmschalten} className="flex items-center gap-2">
                <input type="hidden" name="module_id" value={id} /><input type="hidden" name="hotel_id" value={hotel.id} />
                <input type="hidden" name="sichtbar" value={hotel.rooms_visible ? "0" : "1"} />
                <span className={hotel.rooms_visible ? "text-ink-soft" : "font-semibold"}>{t.zimmerSichtbar(alleHotels.length > 1 ? hotel.name : null)} {hotel.rooms_visible ? t.sichtbar : t.verborgen}</span>
                <button type="submit" className="rounded-full bg-weiss px-3 py-1 text-xs font-semibold ring-1 ring-line hover:ring-ink">{hotel.rooms_visible ? t.zimmerVerbergen : t.zimmerFreigeben}</button>
              </form>
            )}
          </div>
        </section>

        {/* Belegung: Zimmer mit Namen */}
        {hotel && (
          <section className="karte mt-6">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display mr-auto text-xl font-bold">{u.belegung} · {hotel.name}</h2>
              <span className="text-sm text-ink-soft">{u.zimmerPersonen(zimmer.length, belegt, betten)}</span>
              <a href={`/team/module/${id}/zimmerliste/pdf/?hotel=${hotel.id}`} className="rounded-full bg-weiss px-3 py-1.5 text-sm font-semibold ring-1 ring-line hover:ring-ink">{t.listePdf}</a>
              <a href={`/team/module/${id}/zimmerplan/liste/?hotel=${hotel.id}`} className="rounded-full bg-weiss px-3 py-1.5 text-sm font-semibold ring-1 ring-line hover:ring-ink">{t.alsExcel}</a>
            </div>
            {hotel.address && <p className="mt-1 text-sm text-ink-soft">{hotel.address}</p>}
            {zimmer.length === 0 ? <p className="mt-4 text-ink-soft">{t.zuerstHotel}</p> : (
              <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {zimmer.map((z) => {
                  const frei = z.capacity - z.room_assignments.length;
                  return (
                    <li key={z.id} className={`rounded-2xl px-3.5 py-3 ring-1 ${frei > 0 ? "bg-weiss ring-line" : "bg-paper ring-transparent"}`}>
                      <p className="flex items-baseline justify-between gap-2">
                        <span className="font-display text-lg font-bold">{z.label}{z.section && <span className="ml-1.5 text-xs font-normal text-ink-soft">{bereichName(z.section)}</span>}</span>
                        <span className={`text-xs font-semibold ${frei > 0 ? "text-ink-soft" : "text-forest"}`}>{z.room_assignments.length}/{z.capacity}</span>
                      </p>
                      <ul className="mt-1 text-sm">
                        {z.room_assignments.map((a) => (
                          <li key={a.participant_id}><Link href={`/team/teilnehmende/${a.participant_id}/?modul=${id}`} className="hover:underline">{nameVon.get(a.participant_id) ?? "?"}</Link></li>
                        ))}
                        {frei > 0 && <li className="text-ink-soft">{u.frei(frei)}</li>}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
        {neu && <p className="mt-6 text-ink-soft">{t.zuerstHotelNeu}</p>}

        {/* Übernachtende mit Zuteilung, eingeklappt */}
        <details className="karte mt-6 overflow-x-auto" open={!hotel}>
          <summary className="cursor-pointer font-display text-xl font-bold">{u.uebernachtende(uebernachtende.length)}</summary>
          {ohneAngaben > 0 && <p className="mt-2 text-sm text-ink-soft">{u.ohneAngaben(ohneAngaben)}</p>}
          <table className="tabelle mt-4">
            <thead><tr><th>{l === "tr" ? "Ad Soyad" : w.name}</th>{alleNaechte.map((n) => <th key={n}>{nachtName(n)}</th>)}<th>{t.anreiseSpalte}</th><th>{t.wunsch}</th>{alleZimmer.length > 0 && <th>{w.zimmer}</th>}</tr></thead>
            <tbody>
              {uebernachtende.map((p) => (
                <tr key={p.participant_id}>
                  <td className="font-semibold"><Link href={`/team/teilnehmende/${p.participant_id}/?modul=${id}`} className="hover:underline">{p.name}</Link>{p.gender && <span className="ml-1 text-xs font-normal text-ink-soft" title={t.gName[p.gender] ?? p.gender}>{t.g[p.gender] ?? p.gender}</span>}{p.registration_status === "waitlist" && <span className="chip ml-1 bg-gelb-hell">{teamTexte[l].anmeldung.waitlist}</span>}</td>
                  {alleNaechte.map((n) => <td key={n} className="text-center">{p.nights.includes(n) ? "●" : ""}</td>)}
                  <td className="whitespace-nowrap">{p.arrival_at ? zeit.format(new Date(p.arrival_at)) : ""}{p.arrival_by ? ` · ${t.anreise[p.arrival_by]}` : ""}</td>
                  <td className="max-w-64">{[p.room_wish, p.notes].filter(Boolean).join(" · ")}</td>
                  {alleZimmer.length > 0 && (
                    <td>
                      <form action={zimmerZuteilen} className="flex gap-1">
                        <input type="hidden" name="module_id" value={id} />{hotel && <input type="hidden" name="hotel_id" value={hotel.id} />}<input type="hidden" name="participant_id" value={p.participant_id} />
                        <label className="sr-only" htmlFor={`z-${p.participant_id}`}>{t.zimmerFuer(p.name)}</label>
                        <select id={`z-${p.participant_id}`} name="room_id" defaultValue={p.room_id ?? ""} className={`feld !py-1.5 ${alleHotels.length > 1 ? "!w-44" : "!w-28"}`}>
                          <option value="">–</option>
                          {alleHotels.map((h) => {
                            const optionen = sortiert(h.rooms).map((z) => <option key={z.id} value={z.id} disabled={z.room_assignments.length >= z.capacity && z.id !== p.room_id}>{z.label} ({z.room_assignments.length}/{z.capacity})</option>);
                            return alleHotels.length > 1 ? <optgroup key={h.id} label={h.name}>{optionen}</optgroup> : optionen;
                          })}
                        </select>
                        <button type="submit" className="knopf-hell !px-3 !py-1.5">{t.ok}</button>
                      </form>
                      {alleHotels.length > 1 && p.hotel_id && <span className="mt-0.5 block text-xs text-ink-soft">{hotelName.get(p.hotel_id)}</span>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {liste.length === 0 && <p className="mt-3 text-ink-soft">{t.keineAnmeldungen}</p>}
        </details>

        {/* Selten gebraucht: Hoteldaten, Zimmer anlegen, Liste ans Hotel */}
        <details className="mt-6 rounded-3xl bg-white/60 ring-1 ring-line" open={neu || alleHotels.length === 0}>
          <summary className="cursor-pointer px-6 py-4 font-semibold">{neu ? t.weiteresAnlegen : u.hoteldaten}</summary>
          <div className="grid gap-6 px-6 pb-6 lg:grid-cols-2">
            <div>
              <form action={hotelSpeichern} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="module_id" value={id} />
                {hotel && <input type="hidden" name="id" value={hotel.id} />}
                <div className="sm:col-span-2"><label className="etikett" htmlFor="name">{t.name}</label><input id="name" name="name" required defaultValue={hotel?.name} className="feld" /></div>
                <div className="sm:col-span-2"><label className="etikett" htmlFor="address">{t.adresse}</label><input id="address" name="address" defaultValue={hotel?.address ?? ""} className="feld" /></div>
                <div className="sm:col-span-2"><label className="etikett" htmlFor="contact">{t.ansprechperson}</label><input id="contact" name="contact" defaultValue={hotel?.contact ?? ""} className="feld" placeholder={t.ansprechpersonBeispiel} /></div>
                <div><label className="etikett" htmlFor="quota_rooms">{t.kontingent}</label><input id="quota_rooms" name="quota_rooms" inputMode="numeric" defaultValue={hotel?.quota_rooms ?? ""} className="feld" /></div>
                <div><label className="etikett" htmlFor="price_per_night">{t.preis}</label><input id="price_per_night" name="price_per_night" inputMode="decimal" defaultValue={hotel?.price_per_night ?? ""} className="feld" /></div>
                <div><label className="etikett" htmlFor="cancellation_deadline">{t.storno}</label><input id="cancellation_deadline" name="cancellation_deadline" type="date" defaultValue={hotel?.cancellation_deadline ?? ""} className="feld" /></div>
                <div className="sm:col-span-2"><label className="etikett" htmlFor="notes">{t.notizen}</label><textarea id="notes" name="notes" rows={2} defaultValue={hotel?.notes ?? ""} className="feld" /></div>
                <div className="sm:col-span-2"><button type="submit" className="knopf">{hotel ? w.speichern : t.hotelAnlegen}</button></div>
              </form>
              {hotel && alleHotels.length > 1 && hotel.rooms.every((z) => z.room_assignments.length === 0) && (
                <form action={hotelEntfernen} className="mt-3 flex flex-wrap">
                  <input type="hidden" name="module_id" value={id} /><input type="hidden" name="hotel_id" value={hotel.id} />
                  <Rueckfrage sprache={l} knopf={t.hotelEntfernen} knopfKlasse="text-sm font-semibold text-ink-soft underline" gefahr ja={t.hotelEntfernenJa}
                    frage={t.hotelEntfernenFrage(hotel.name, hotel.rooms.length)} />
                </form>
              )}
              {hotel?.cancellation_deadline && <p className="mt-3 rounded-2xl bg-gelb-hell p-3 text-sm">{t.stornofrist(new Intl.DateTimeFormat(teamLocale[l], { dateStyle: "long" }).format(new Date(hotel.cancellation_deadline)))}</p>}
            </div>
            {hotel && (
              <div className="space-y-5">
                <form action={zimmerAnlegen} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="module_id" value={id} /><input type="hidden" name="hotel_id" value={hotel.id} />
                  <div className="min-w-40 flex-1"><label className="etikett" htmlFor="labels">{w.zimmer}</label><input id="labels" name="labels" required className="feld" placeholder={t.zimmerBeispiel} /></div>
                  <div><label className="etikett" htmlFor="capacity">{t.betten}</label><input id="capacity" name="capacity" type="number" min={1} max={12} defaultValue={2} className="feld !w-24" /></div>
                  <div><label className="etikett" htmlFor="section">{t.bereich}</label><input id="section" name="section" className="feld !w-40" placeholder={t.bereichBeispiel} /></div>
                  <button type="submit" className="knopf-hell">{t.anlegen}</button>
                </form>
                {zimmer.some((z) => z.room_assignments.length === 0) && (
                  <p className="flex flex-wrap gap-1.5 text-sm">
                    {zimmer.filter((z) => z.room_assignments.length === 0).map((z) => (
                      <form key={z.id} action={zimmerEntfernen} className="inline">
                        <input type="hidden" name="module_id" value={id} /><input type="hidden" name="id" value={z.id} /><input type="hidden" name="hotel_id" value={hotel.id} />
                        <button type="submit" className="chip bg-paper-deep hover:bg-rot-hell" aria-label={t.zimmerEntfernen(z.label)}>{z.label} ✕</button>
                      </form>
                    ))}
                  </p>
                )}
                {belegt > 0 && (
                  <form id="zimmerliste" action={zimmerlisteSenden} className="flex scroll-mt-4 flex-wrap items-end gap-2 rounded-2xl bg-paper p-3">
                    <input type="hidden" name="module_id" value={id} /><input type="hidden" name="hotel_id" value={hotel.id} />
                    <div className="min-w-52 flex-1">
                      <label className="etikett" htmlFor="an">{t.listeMail}</label>
                      <input id="an" name="an" type="email" required defaultValue={hotel.contact?.match(/[^\s<>(),;]+@[^\s<>(),;]+\.[a-z]{2,}/i)?.[0] ?? ""} placeholder="reservierung@hotel.de" className="feld" />
                    </div>
                    <Rueckfrage sprache={l} knopf={t.senden} ja={t.sendenJa} frage={t.sendenFrage(hotel.name, belegt)}>
                      {!mailBereit() && <p className="font-semibold text-rot">{t.mailAus}</p>}
                    </Rueckfrage>
                    <p className="basis-full text-xs text-ink-soft">
                      {hotel.room_list_sent_at
                        ? t.zuletzt(new Intl.DateTimeFormat(teamLocale[l], { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(hotel.room_list_sent_at)), hotel.room_list_sent_to ?? "")
                        : t.nochNicht}
                    </p>
                  </form>
                )}
              </div>
            )}
          </div>
        </details>
      </main>
    </>
  );
}
