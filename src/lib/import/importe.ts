import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { kriterien, type KriteriumFeld } from "@/lib/bewertung";
import { texte } from "@/i18n";
import { anmeldestatus } from "@/lib/einlass";
import { modulplan } from "@/i18n/daten";
import { teamTexte, type TeamTexte } from "@/lib/team-texte";
import type { TeamSprache } from "@/lib/team-sprache";
import { excelDatum, klein, kopfzeile, leseTabelle, text, type Zeile } from "./excel";
import { faltName, finde, landAusText, regionName, type Person, type Treffer } from "./namen";

type Db = SupabaseClient<Database>;

export type ImportArt = "teilnehmerliste" | "hausaufgaben" | "bewertungsbogen" | "emails" | "zusagen";

export type Optionen = {
  anwenden: boolean;
  /** Ähnliche Namen (Tippfehler, nur Vorname, abgeschnitten) automatisch zuordnen. */
  vorschlaegeUebernehmen: boolean;
  /** Personen, die noch nicht im System sind, neu anlegen. */
  fehlendeAnlegen: boolean;
  /** Vorhandene E-Mail-Adressen durch die aus der Datei ersetzen. */
  ueberschreiben: boolean;
  hausaufgabeNr: number;
  /** Für Zusagen: zu welchem Modul die Antworten gehören. */
  modulId?: string;
  /** Sprache des Berichts (Sprache des Teamkontos), Standard Deutsch. */
  sprache?: TeamSprache;
};

export type Hinweis = { stufe: "ok" | "info" | "warnung"; text: string };
export type Bericht = { titel: string; zahlen: [string, number][]; hinweise: Hinweis[]; angewendet: boolean };

// ── Texte des Berichts je Sprache des Teamkontos ─────────────────────────────

/** Französische Anführungszeichen mit geschützten Leerzeichen */
const qFr = (x: string) => `«\u00a0${x}\u00a0»`;

const meldungenDe = {
  titel: { teilnehmerliste: "Teilnehmerliste", hausaufgaben: "Hausaufgabenliste", bewertungsbogen: "Bewertungsbogen Rhetorik", emails: "E-Mail-Adressen", zusagen: "Zusagen" } as Record<ImportArt, string>,
  // Zähler
  unklareNamen: "Unklare Namen", neueVerantwortliche: "Neue Verantwortliche", zeilenGelesen: "Zeilen gelesen", neueTeilnehmende: "Neue Teilnehmende",
  aktualisiert: "Bereits vorhanden, aktualisiert", anwesend: "Anwesend (Modul)", nichtDa: "Nicht da (Modul)", nichtGefunden: "Nicht gefunden",
  landErgaenzt: "Land/Region ergänzt", schonErfasst: (nr: number) => `Hausaufgabe ${nr}: schon erfasst`, abgegeben: (nr: number) => `Hausaufgabe ${nr}: abgegeben`,
  videosGelesen: "Videos gelesen", nichtZugeordnet: "Nicht zugeordnete Namen", mitBewertung: "Videos mit Bewertung", ohneBewertung: "Videos noch ohne Bewertung",
  gruppenvideos: "Gruppenvideos", abgabenNeu: "Abgaben neu", ungueltigeMail: "Ungültige E-Mail", konflikte: "Konflikte", schonEingetragen: "Schon eingetragen",
  abweichend: "Abweichend, nicht geändert", mailErsetzt: "E-Mail ersetzt", mailErgaenzt: "E-Mail ergänzt", antwortUnklar: "Antwort unklar",
  neueGaeste: "Neue Personen (als Gast)", neuAngemeldet: "Neu angemeldet", vomTeam: "Vom Team gesetzt, nicht geändert", zusagen: "Zusagen", absagen: "Absagen",
  telefonErgaenzt: "Telefon ergänzt",
  // Hinweise
  zeile: (nr: number) => `Zeile ${nr}`,
  video: (nr: number, bezeichnung: string) => `Video ${nr} („${bezeichnung}“)`,
  grund: (g: string) => g,
  zugeordnet: (kontext: string, name: string, person: string, grund: string) => `${kontext}: „${name}“ → „${person}“ zugeordnet (${grund}).`,
  vermutlich: (kontext: string, name: string, person: string, grund: string) => `${kontext}: „${name}“ ist vermutlich „${person}“ (${grund}) – zum Übernehmen „Ähnliche Namen zuordnen“ anhaken.`,
  mehrdeutig: (kontext: string, name: string, kandidaten: string) => `${kontext}: „${name}“ passt auf mehrere Personen (${kandidaten}) – bitte von Hand zuordnen.`,
  keinJahrgang: "Es gibt keinen aktuellen Jahrgang. Bitte zuerst in Supabase einen Jahrgang mit is_current = true anlegen.",
  hausaufgabeNeu: (nr: number) => `Hausaufgabe ${nr} wird neu angelegt.`,
  modulFehlt: (nr: number) => `Modul ${nr} steht nicht im Modulplan der Website (src/i18n/daten.ts).`,
  modulNeu: (nr: number, titel: string) => `Modul ${nr} („${titel}“) wird mit den Daten der Website angelegt.`,
  kopfListe: "Kopfzeile nicht gefunden – erwartet werden Spalten wie „İsim Soyisim“/„Name“ und „Bölge“/„Region“.",
  regionUnbekannt: (zeile: number, name: string, region: string) => `Zeile ${zeile} (${name}): Region „${region}“ unbekannt – bitte von Hand setzen.`,
  gtUnklar: (zeile: number, name: string, wert: string) => `Zeile ${zeile} (${name}): GT/KGT „${wert}“ nicht eindeutig – bitte von Hand setzen.`,
  doppelt: (zeile: number, name: string, erste: number) => `Zeile ${zeile}: „${name}“ steht doppelt in der Datei (auch Zeile ${erste}) – nur einmal angelegt. Sind es zwei Personen, bitte die zweite von Hand anlegen.`,
  modulWert: (zeile: number, name: string, nr: number, wert: string) => `Zeile ${zeile} (${name}): Modul ${nr} hat den Wert „${wert}“ statt +/– – übersprungen.`,
  kommendeModule: (n: number) => `Alle Personen der Liste sind für die ${n} kommenden Module des Jahrgangs angemeldet.`,
  kopfHausaufgaben: "Kopfzeile nicht gefunden – erwartet werden Spalten „Name“ und „Ödev 1“ …",
  nichtInListeAnlegen: (zeile: number, name: string) => `Zeile ${zeile}: „${name}“ ist nicht in der Teilnehmerliste – übersprungen (oder „Fehlende Personen anlegen“ anhaken).`,
  kopfBogen: "Blatt mit den Spalten „Name(n) / Video“ und „Inhalt“ nicht gefunden.",
  videoNichtGefunden: (kontext: string, name: string) => `${kontext}: „${name}“ nicht gefunden – unter Hausaufgaben von Hand zuordnen.`,
  abgeschnitten: (kontext: string) => `${kontext}: Name abgeschnitten – bitte prüfen, ob alle Personen zugeordnet sind.`,
  kopfMails: "Keine Spalte mit E-Mail-Adressen und Namen gefunden. Die Datei braucht eine Kopfzeile mit z. B. „Ad Soyad“ bzw. „Vorname“/„Nachname“ und eine Spalte mit E-Mails.",
  leer: "leer",
  keineMail: (zeile: number, name: string, mail: string) => `Zeile ${zeile} (${name}): „${mail}“ ist keine gültige E-Mail-Adresse.`,
  nichtInListeMail: (zeile: number, name: string, mail: string) => `Zeile ${zeile}: „${name}“ (${mail}) ist nicht in der Teilnehmerliste.`,
  mailVergeben: (zeile: number, mail: string, andere: string, person: string) => `Zeile ${zeile}: ${mail} gehört schon zu „${andere}“ – nicht für „${person}“ übernommen.`,
  mailAbweichend: (person: string, alt: string, neu: string) => `„${person}“ hat schon ${alt}; in der Datei steht ${neu} – zum Ersetzen „Vorhandene überschreiben“ anhaken.`,
  ohneMail: (n: number) => `${n} Personen haben danach noch keine E-Mail-Adresse.`,
  modulWaehlen: "Bitte das Modul wählen, zu dem die Zusagen gehören.",
  modulGibtsNicht: "Das gewählte Modul gibt es nicht.",
  kopfZusagen: "Keine Namensspalte gefunden. Die Datei braucht eine Kopfzeile mit z. B. „Adınız Soyadınız“ oder „Vorname“/„Nachname“.",
  keineAntwortSpalte: "Keine Spalte „Katılım sağlayacak mısınız?“ / „Teilnahme“ gefunden: jede Zeile zählt als Zusage.",
  antwortUnverstanden: (zeile: number, name: string, antwort: string) => `Zeile ${zeile} (${name}): Antwort „${antwort}“ nicht verstanden, übersprungen.`,
  nichtInListe: (zeile: number, name: string) => `Zeile ${zeile}: „${name}“ ist nicht in der Teilnehmerliste.`,
  mehrfach: (zeile: number, name: string, vorher: number) => `Zeile ${zeile}: „${name}“ steht mehrfach in der Datei (auch Zeile ${vorher}); die untere Antwort gilt.`,
  rsvp: (wert: string) => wert,
  vomTeamGesetzt: (name: string, portal: string, datei: string) => `„${name}“: im Portal vom Team auf „${portal}“ gesetzt, in der Datei „${datei}“ – nicht geändert, bitte bei der Person prüfen.`,
  status: (wert: string) => anmeldestatus[wert as keyof typeof anmeldestatus] ?? wert,
  zusageStatus: (name: string, status: string) => `„${name}“ sagt zu, steht aber auf „${status}“: Status bitte prüfen.`,
  ohneRueckmeldung: (modul: string, n: number) => `${modul}: ${n} Angemeldete haben danach noch keine Rückmeldung. Sie stehen unter Teilnehmende → „Noch keine Zusage“.`,
};
type Meldungen = typeof meldungenDe;

/** Gründe aus lib/import/namen.ts (dort deutsch) */
const grundUebersetzt = (g: string, ahnlich: (n: number) => string, teil: string, abgeschnitten: string) => {
  const n = g.match(/^ähnlich geschrieben \((\d+) Zeichen anders\)$/)?.[1];
  return n ? ahnlich(Number(n)) : g === "nur Teil des Namens angegeben" ? teil : g === "Name abgeschnitten" ? abgeschnitten : g;
};

const meldungen: Record<TeamSprache, Meldungen> = {
  de: meldungenDe,
  tr: {
    titel: { teilnehmerliste: "Katılımcı listesi", hausaufgaben: "Ödev listesi", bewertungsbogen: "Hitabet değerlendirme formu", emails: "E-posta adresleri", zusagen: "Katılım cevapları" },
    unklareNamen: "Belirsiz isimler", neueVerantwortliche: "Yeni sorumlular", zeilenGelesen: "Okunan satırlar", neueTeilnehmende: "Yeni katılımcılar",
    aktualisiert: "Zaten vardı, güncellendi", anwesend: "Geldi (modül)", nichtDa: "Gelmedi (modül)", nichtGefunden: "Bulunamadı",
    landErgaenzt: "Ülke/bölge tamamlandı", schonErfasst: (nr) => `Ödev ${nr}: zaten kayıtlı`, abgegeben: (nr) => `Ödev ${nr}: teslim edildi`,
    videosGelesen: "Okunan videolar", nichtZugeordnet: "Atanmamış isimler", mitBewertung: "Değerlendirilmiş videolar", ohneBewertung: "Henüz değerlendirilmemiş videolar",
    gruppenvideos: "Grup videoları", abgabenNeu: "Yeni teslimler", ungueltigeMail: "Geçersiz e-posta", konflikte: "Çakışmalar", schonEingetragen: "Zaten kayıtlı",
    abweichend: "Farklı, değiştirilmedi", mailErsetzt: "E-posta değiştirildi", mailErgaenzt: "E-posta eklendi", antwortUnklar: "Belirsiz cevap",
    neueGaeste: "Yeni kişiler (misafir olarak)", neuAngemeldet: "Yeni kayıt", vomTeam: "Ekip belirlemiş, değiştirilmedi", zusagen: "Katılacaklar", absagen: "Katılmayacaklar",
    telefonErgaenzt: "Telefon eklendi",
    zeile: (nr) => `Satır ${nr}`,
    video: (nr, bezeichnung) => `Video ${nr} (“${bezeichnung}”)`,
    grund: (g) => grundUebersetzt(g, (n) => `benzer yazılmış (${n} karakter farklı)`, "ismin yalnızca bir kısmı yazılmış", "isim kesik"),
    zugeordnet: (kontext, name, person, grund) => `${kontext}: “${name}” → “${person}” ile eşleştirildi (${grund}).`,
    vermutlich: (kontext, name, person, grund) => `${kontext}: “${name}” büyük ihtimalle “${person}” (${grund}) – aktarmak için “Benzer isimleri otomatik eşleştir”i işaretle.`,
    mehrdeutig: (kontext, name, kandidaten) => `${kontext}: “${name}” birden fazla kişiye uyuyor (${kandidaten}) – lütfen elle eşleştir.`,
    keinJahrgang: "Güncel dönem yok. Lütfen önce Supabase’te is_current = true olan bir dönem oluştur.",
    hausaufgabeNeu: (nr) => `Ödev ${nr} yeni oluşturulacak.`,
    modulFehlt: (nr) => `Modül ${nr} web sitesinin modül planında yok (src/i18n/daten.ts).`,
    modulNeu: (nr, titel) => `Modül ${nr} (“${titel}”) web sitesindeki bilgilerle oluşturulacak.`,
    kopfListe: "Başlık satırı bulunamadı – “İsim Soyisim”/“Name” ve “Bölge”/“Region” gibi sütunlar bekleniyor.",
    regionUnbekannt: (zeile, name, region) => `Satır ${zeile} (${name}): “${region}” bölgesi bilinmiyor – lütfen elle gir.`,
    gtUnklar: (zeile, name, wert) => `Satır ${zeile} (${name}): GT/KGT “${wert}” belirsiz – lütfen elle gir.`,
    doppelt: (zeile, name, erste) => `Satır ${zeile}: “${name}” dosyada iki kez geçiyor (ayrıca satır ${erste}) – yalnızca bir kez oluşturuldu. İki ayrı kişiyse lütfen ikincisini elle oluştur.`,
    modulWert: (zeile, name, nr, wert) => `Satır ${zeile} (${name}): Modül ${nr} için +/– yerine “${wert}” yazılmış – atlandı.`,
    kommendeModule: (n) => `Listedeki herkes dönemin gelecek ${n} modülüne kaydedildi.`,
    kopfHausaufgaben: "Başlık satırı bulunamadı – “Name” ve “Ödev 1” … sütunları bekleniyor.",
    nichtInListeAnlegen: (zeile, name) => `Satır ${zeile}: “${name}” katılımcı listesinde yok – atlandı (ya da “Portalda henüz olmayan kişileri yeni oluştur”u işaretle).`,
    kopfBogen: "“Name(n) / Video” ve “Inhalt” sütunlarını içeren sayfa bulunamadı.",
    videoNichtGefunden: (kontext, name) => `${kontext}: “${name}” bulunamadı – Ödevler bölümünde elle eşleştir.`,
    abgeschnitten: (kontext) => `${kontext}: isim kesik – lütfen herkesin eşleştirildiğini kontrol et.`,
    kopfMails: "E-posta adresleri ve isimleri içeren bir sütun bulunamadı. Dosyada örn. “Ad Soyad” ya da “Vorname”/“Nachname” gibi bir başlık satırı ve e-postaların olduğu bir sütun olmalı.",
    leer: "boş",
    keineMail: (zeile, name, mail) => `Satır ${zeile} (${name}): “${mail}” geçerli bir e-posta adresi değil.`,
    nichtInListeMail: (zeile, name, mail) => `Satır ${zeile}: “${name}” (${mail}) katılımcı listesinde yok.`,
    mailVergeben: (zeile, mail, andere, person) => `Satır ${zeile}: ${mail} zaten “${andere}” adlı kişiye ait – “${person}” için aktarılmadı.`,
    mailAbweichend: (person, alt, neu) => `“${person}” için zaten ${alt} kayıtlı; dosyada ${neu} yazıyor – değiştirmek için “Mevcut e-posta adreslerinin üzerine yaz”ı işaretle.`,
    ohneMail: (n) => `Bundan sonra da ${n} kişinin e-posta adresi yok.`,
    modulWaehlen: "Lütfen katılım cevaplarının ait olduğu modülü seç.",
    modulGibtsNicht: "Seçilen modül yok.",
    kopfZusagen: "İsim sütunu bulunamadı. Dosyada örn. “Adınız Soyadınız” ya da “Vorname”/“Nachname” gibi bir başlık satırı olmalı.",
    keineAntwortSpalte: "“Katılım sağlayacak mısınız?” / “Teilnahme” sütunu bulunamadı: her satır katılım cevabı (evet) sayılıyor.",
    antwortUnverstanden: (zeile, name, antwort) => `Satır ${zeile} (${name}): “${antwort}” cevabı anlaşılamadı, atlandı.`,
    nichtInListe: (zeile, name) => `Satır ${zeile}: “${name}” katılımcı listesinde yok.`,
    mehrfach: (zeile, name, vorher) => `Satır ${zeile}: “${name}” dosyada birden fazla geçiyor (ayrıca satır ${vorher}); alttaki cevap geçerli.`,
    rsvp: (wert) => teamTexte.tr.rsvp[wert as keyof TeamTexte["rsvp"]] ?? wert,
    vomTeamGesetzt: (name, portal, datei) => `“${name}”: portalda ekip tarafından “${portal}” olarak girilmiş, dosyada “${datei}” – değiştirilmedi, lütfen kişiyle kontrol et.`,
    status: (wert) => teamTexte.tr.anmeldung[wert as keyof TeamTexte["anmeldung"]] ?? wert,
    zusageStatus: (name, status) => `“${name}” katılacağını söylüyor ama durumu “${status}”: lütfen durumu kontrol et.`,
    ohneRueckmeldung: (modul, n) => `${modul}: kayıtlı ${n} kişiden hâlâ cevap yok. Onları Katılımcılar sayfasında bulabilirsin.`,
  },
  fr: {
    titel: { teilnehmerliste: "Liste des participants", hausaufgaben: "Liste des devoirs", bewertungsbogen: "Grille d’évaluation rhétorique", emails: "Adresses e-mail", zusagen: "Confirmations" },
    unklareNamen: "Noms incertains", neueVerantwortliche: "Nouveaux référents", zeilenGelesen: "Lignes lues", neueTeilnehmende: "Nouveaux participants",
    aktualisiert: "Déjà présents, mis à jour", anwesend: "Présents (module)", nichtDa: "Absents (module)", nichtGefunden: "Introuvables",
    landErgaenzt: "Pays/région complétés", schonErfasst: (nr) => `Devoir ${nr}\u00a0: déjà saisi`, abgegeben: (nr) => `Devoir ${nr}\u00a0: rendu`,
    videosGelesen: "Vidéos lues", nichtZugeordnet: "Noms non associés", mitBewertung: "Vidéos évaluées", ohneBewertung: "Vidéos pas encore évaluées",
    gruppenvideos: "Vidéos de groupe", abgabenNeu: "Nouveaux rendus", ungueltigeMail: "E-mail invalide", konflikte: "Conflits", schonEingetragen: "Déjà saisis",
    abweichend: "Différents, non modifiés", mailErsetzt: "E-mail remplacé", mailErgaenzt: "E-mail ajouté", antwortUnklar: "Réponse incertaine",
    neueGaeste: "Nouvelles personnes (comme invités)", neuAngemeldet: "Nouvelles inscriptions", vomTeam: "Définis par l’équipe, non modifiés", zusagen: "Viennent", absagen: "Ne viennent pas",
    telefonErgaenzt: "Téléphone ajouté",
    zeile: (nr) => `Ligne ${nr}`,
    video: (nr, bezeichnung) => `Vidéo ${nr} (${qFr(bezeichnung)})`,
    grund: (g) => grundUebersetzt(g, (n) => `orthographe proche (${n}\u00a0caractère${n > 1 ? "s" : ""} de différence)`, "seule une partie du nom est indiquée", "nom tronqué"),
    zugeordnet: (kontext, name, person, grund) => `${kontext}\u00a0: ${qFr(name)} → ${qFr(person)} associé (${grund}).`,
    vermutlich: (kontext, name, person, grund) => `${kontext}\u00a0: ${qFr(name)} est probablement ${qFr(person)} (${grund}) – pour l’appliquer, coche ${qFr("Associer automatiquement les noms similaires")}.`,
    mehrdeutig: (kontext, name, kandidaten) => `${kontext}\u00a0: ${qFr(name)} correspond à plusieurs personnes (${kandidaten}) – merci d’associer à la main.`,
    keinJahrgang: "Il n’y a pas de promotion en cours. Crée d’abord dans Supabase une promotion avec is_current = true.",
    hausaufgabeNeu: (nr) => `Le devoir ${nr} va être créé.`,
    modulFehlt: (nr) => `Le module ${nr} ne figure pas dans le plan des modules du site (src/i18n/daten.ts).`,
    modulNeu: (nr, titel) => `Le module ${nr} (${qFr(titel)}) va être créé avec les données du site.`,
    kopfListe: `Ligne d’en-tête introuvable – colonnes attendues comme ${qFr("İsim Soyisim")}/${qFr("Name")} et ${qFr("Bölge")}/${qFr("Region")}.`,
    regionUnbekannt: (zeile, name, region) => `Ligne ${zeile} (${name})\u00a0: région ${qFr(region)} inconnue – merci de la saisir à la main.`,
    gtUnklar: (zeile, name, wert) => `Ligne ${zeile} (${name})\u00a0: GT/KGT ${qFr(wert)} ambigu – merci de le saisir à la main.`,
    doppelt: (zeile, name, erste) => `Ligne ${zeile}\u00a0: ${qFr(name)} apparaît deux fois dans le fichier (aussi ligne ${erste}) – créé une seule fois. S’il s’agit de deux personnes, crée la deuxième à la main.`,
    modulWert: (zeile, name, nr, wert) => `Ligne ${zeile} (${name})\u00a0: le module ${nr} a la valeur ${qFr(wert)} au lieu de +/– – ignoré.`,
    kommendeModule: (n) => `Toutes les personnes de la liste sont inscrites aux ${n}\u00a0prochains modules de la promotion.`,
    kopfHausaufgaben: `Ligne d’en-tête introuvable – colonnes attendues ${qFr("Name")} et ${qFr("Ödev 1")}…`,
    nichtInListeAnlegen: (zeile, name) => `Ligne ${zeile}\u00a0: ${qFr(name)} n’est pas dans la liste des participants – ignoré (ou coche ${qFr("Créer les personnes qui ne sont pas encore dans le portail")}).`,
    kopfBogen: `Feuille avec les colonnes ${qFr("Name(n) / Video")} et ${qFr("Inhalt")} introuvable.`,
    videoNichtGefunden: (kontext, name) => `${kontext}\u00a0: ${qFr(name)} introuvable – à associer à la main sous Devoirs.`,
    abgeschnitten: (kontext) => `${kontext}\u00a0: nom tronqué – vérifie que toutes les personnes sont associées.`,
    kopfMails: `Aucune colonne avec des adresses e-mail et des noms trouvée. Le fichier doit avoir une ligne d’en-tête avec p.\u00a0ex. ${qFr("Ad Soyad")} ou ${qFr("Vorname")}/${qFr("Nachname")} et une colonne d’e-mails.`,
    leer: "vide",
    keineMail: (zeile, name, mail) => `Ligne ${zeile} (${name})\u00a0: ${qFr(mail)} n’est pas une adresse e-mail valide.`,
    nichtInListeMail: (zeile, name, mail) => `Ligne ${zeile}\u00a0: ${qFr(name)} (${mail}) n’est pas dans la liste des participants.`,
    mailVergeben: (zeile, mail, andere, person) => `Ligne ${zeile}\u00a0: ${mail} appartient déjà à ${qFr(andere)} – non repris pour ${qFr(person)}.`,
    mailAbweichend: (person, alt, neu) => `${qFr(person)} a déjà ${alt}\u00a0; le fichier indique ${neu} – pour remplacer, coche ${qFr("Remplacer les adresses e-mail existantes")}.`,
    ohneMail: (n) => `${n}\u00a0personnes n’ont toujours pas d’adresse e-mail.`,
    modulWaehlen: "Merci de choisir le module auquel les confirmations se rapportent.",
    modulGibtsNicht: "Le module choisi n’existe pas.",
    kopfZusagen: `Aucune colonne de noms trouvée. Le fichier doit avoir une ligne d’en-tête avec p.\u00a0ex. ${qFr("Adınız Soyadınız")} ou ${qFr("Vorname")}/${qFr("Nachname")}.`,
    keineAntwortSpalte: `Pas de colonne ${qFr("Katılım sağlayacak mısınız?")} / ${qFr("Teilnahme")} trouvée\u00a0: chaque ligne compte comme une confirmation.`,
    antwortUnverstanden: (zeile, name, antwort) => `Ligne ${zeile} (${name})\u00a0: réponse ${qFr(antwort)} non comprise, ignorée.`,
    nichtInListe: (zeile, name) => `Ligne ${zeile}\u00a0: ${qFr(name)} n’est pas dans la liste des participants.`,
    mehrfach: (zeile, name, vorher) => `Ligne ${zeile}\u00a0: ${qFr(name)} apparaît plusieurs fois dans le fichier (aussi ligne ${vorher})\u00a0; la réponse la plus bas compte.`,
    rsvp: (wert) => teamTexte.fr.rsvp[wert as keyof TeamTexte["rsvp"]] ?? wert,
    vomTeamGesetzt: (name, portal, datei) => `${qFr(name)}\u00a0: mis sur ${qFr(portal)} par l’équipe dans le portail, ${qFr(datei)} dans le fichier – non modifié, merci de vérifier avec la personne.`,
    status: (wert) => teamTexte.fr.anmeldung[wert as keyof TeamTexte["anmeldung"]] ?? wert,
    zusageStatus: (name, status) => `${qFr(name)} confirme sa venue mais a le statut ${qFr(status)}\u00a0: merci de vérifier le statut.`,
    ohneRueckmeldung: (modul, n) => `${modul}\u00a0: ${n}\u00a0inscrits n’ont toujours pas répondu. Tu les trouves sous Participants.`,
  },
};

class Protokoll {
  constructor(readonly m: Meldungen) {}
  zahlen = new Map<string, number>();
  hinweise: Hinweis[] = [];
  zaehle(k: string, n = 1) { this.zahlen.set(k, (this.zahlen.get(k) ?? 0) + n); }
  info(t: string) { this.hinweise.push({ stufe: "info", text: t }); }
  warn(t: string) { this.hinweise.push({ stufe: "warnung", text: t }); }
}

function pruefe<T>(res: { error: { message: string } | null; data?: unknown }, was: string): T {
  if (res.error) throw new Error(`${was}: ${res.error.message}`);
  return res.data as T;
}

/** „Ahmet İlhan Kaplan“ → Vorname „Ahmet İlhan“, Nachname „Kaplan“ */
function teileName(name: string) {
  const t = name.trim().split(/\s+/);
  return t.length > 1 ? { first_name: t.slice(0, -1).join(" "), last_name: t[t.length - 1] } : { first_name: t[0] ?? name, last_name: "" };
}

/** Ordnet einen Namen zu und protokolliert Unklarheiten. Gibt die Person oder null zurück. */
function zuordnen(name: string, personen: Person[], o: Optionen, p: Protokoll, kontext: string): Person | null {
  const t: Treffer = finde(name, personen);
  if (t.art === "sicher") return t.person;
  if (t.art === "vorschlag") {
    if (o.vorschlaegeUebernehmen) {
      p.info(p.m.zugeordnet(kontext, name, t.person.name, p.m.grund(t.grund)));
      return t.person;
    }
    p.warn(p.m.vermutlich(kontext, name, t.person.name, p.m.grund(t.grund)));
    p.zaehle(p.m.unklareNamen);
    return null;
  }
  if (t.art === "mehrdeutig") {
    p.warn(p.m.mehrdeutig(kontext, name, t.kandidaten.map((k) => k.name).join(", ")));
    p.zaehle(p.m.unklareNamen);
    return null;
  }
  return null;
}

type P = { id: string; name: string; email: string | null; region_id: number | null; country: string | null; branch: string | null; mentor_id: string | null };

async function lade(sb: Db, m: Meldungen) {
  const [personen, regionen, mentoren, jahrgang] = await Promise.all([
    sb.from("participants").select("id,first_name,last_name,email,region_id,country,branch,mentor_id").in("affiliation_status", ["academy_student", "alumni", "guest", "member"]),
    sb.from("regions").select("id,name,country"),
    sb.from("mentors").select("id,name"),
    sb.from("cohorts").select("id,name").eq("is_current", true).maybeSingle(),
  ]);
  if (!jahrgang.data) throw new Error(m.keinJahrgang);
  return {
    personen: pruefe<{ id: string; first_name: string; last_name: string; email: string | null; region_id: number | null; country: string | null; branch: string | null; mentor_id: string | null }[]>(personen, "Teilnehmende laden").map(
      (x): P => ({ id: x.id, name: `${x.first_name} ${x.last_name}`.trim(), email: x.email, region_id: x.region_id, country: x.country, branch: x.branch, mentor_id: x.mentor_id }),
    ),
    regionen: pruefe<{ id: number; name: string; country: string }[]>(regionen, "Regionen laden"),
    mentoren: pruefe<{ id: string; name: string }[]>(mentoren, "Verantwortliche laden"),
    jahrgang: jahrgang.data,
  };
}
type Daten = Awaited<ReturnType<typeof lade>>;

async function personAnlegen(sb: Db, d: Daten, name: string, werte: Partial<Database["public"]["Tables"]["participants"]["Insert"]>, o: Optionen): Promise<P> {
  if (!o.anwenden) {
    const tmp: P = { id: `neu-${d.personen.length}`, name, email: null, region_id: null, country: null, branch: null, mentor_id: null };
    d.personen.push(tmp);
    return tmp;
  }
  const neu = pruefe<{ id: string }>(
    await sb.from("participants").insert({ ...teileName(name), affiliation_status: "academy_student", cohort_id: d.jahrgang.id, ...werte }).select("id").single(),
    `„${name}“ anlegen`,
  );
  const p: P = { id: neu.id, name, email: null, region_id: werte.region_id ?? null, country: werte.country ?? null, branch: werte.branch ?? null, mentor_id: werte.mentor_id ?? null };
  d.personen.push(p);
  return p;
}

async function hausaufgabeId(sb: Db, d: Daten, nr: number, o: Optionen, p: Protokoll, cache: Map<number, string>) {
  if (cache.has(nr)) return cache.get(nr)!;
  const { data } = await sb.from("assignments").select("id").eq("cohort_id", d.jahrgang.id).eq("number", nr).maybeSingle();
  let id = data?.id;
  if (!id) {
    p.info(p.m.hausaufgabeNeu(nr));
    id = o.anwenden
      ? pruefe<{ id: string }>(await sb.from("assignments").insert({ cohort_id: d.jahrgang.id, number: nr, title: `Hausaufgabe ${nr}` }).select("id").single(), "Hausaufgabe anlegen").id
      : `neu-${nr}`;
  }
  cache.set(nr, id);
  return id;
}

// ── Module der Website (Modul 1 = Auftakt, 2 = Verfassungen, …) ───────────────

const berlin = (datum: string, uhr: string) => {
  const probe = new Date(`${datum}T${uhr}:00Z`);
  const versatz = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Berlin", timeZoneName: "longOffset" }).formatToParts(probe).find((t) => t.type === "timeZoneName")?.value.replace("GMT", "") || "+00:00";
  return new Date(`${datum}T${uhr}:00${versatz}`).toISOString();
};

/** Holt das Modul Nr. n des Jahrgangs samt Tagen; legt es bei Bedarf nach dem Modulplan der Website an. */
async function modul(sb: Db, d: Daten, nr: number, o: Optionen, p: Protokoll) {
  const plan = modulplan[nr - 1];
  if (!plan) throw new Error(p.m.modulFehlt(nr));
  const { data } = await sb.from("modules").select("id,title,module_days(id,starts_at)").eq("slug", plan.slug).maybeSingle();
  if (data) return { id: data.id, titel: data.title, tage: data.module_days.map((t) => ({ id: t.id, beginn: t.starts_at })) };

  const titel = texte.de.seminare[plan.slug].titel;
  p.info(p.m.modulNeu(nr, titel));
  if (!o.anwenden) return { id: `neu-${nr}`, titel, tage: [] };
  const m = pruefe<{ id: string }>(
    await sb.from("modules").insert({ slug: plan.slug, title: titel, kind: plan.art, location: plan.ort, status: "published", cohort_id: d.jahrgang.id }).select("id").single(),
    "Modul anlegen",
  );
  const tage: { module_id: string; day: string; starts_at: string; ends_at: string }[] = [];
  for (let t = new Date(`${plan.von}T12:00:00Z`); t <= new Date(`${plan.bis}T12:00:00Z`); t.setUTCDate(t.getUTCDate() + 1)) {
    const tag = t.toISOString().slice(0, 10);
    tage.push({ module_id: m.id, day: tag, starts_at: berlin(tag, "10:00"), ends_at: berlin(tag, "18:00") });
  }
  const neu = pruefe<{ id: string; starts_at: string }[]>(await sb.from("module_days").insert(tage).select("id,starts_at"), "Modultage anlegen");
  return { id: m.id, titel, tage: neu.map((x) => ({ id: x.id, beginn: x.starts_at })) };
}

// ── 1. Teilnehmerliste (Bölge, İsim Soyisim, KGT/GT, Modul 1…n, Sorumlu Kişi) ──

async function teilnehmerliste(sb: Db, zeilen: Zeile[], o: Optionen, p: Protokoll) {
  const istName = (z: string) => z.includes("isim") || z === "name" || z.includes("vor- und nachname") || z === "vollständiger name";
  const istRegion = (z: string) => z.includes("bölge") || z === "region";
  const kopf = kopfzeile(zeilen, [istName, istRegion]);
  if (!kopf) throw new Error(p.m.kopfListe);
  const k = kopf.zellen;
  const col = {
    name: k.findIndex(istName),
    region: k.findIndex(istRegion),
    org: k.findIndex((z) => z.includes("kgt") || z === "gt"),
    sorumlu: k.findIndex((z) => z.includes("sorumlu") || z.includes("verantwort")),
  };
  const modulSpalten = k.map((z, i) => ({ i, nr: Number(z.match(/modul\s*(\d+)/)?.[1]) })).filter((m) => m.nr > 0);

  const d = await lade(sb, p.m);
  const bestand: Person[] = [...d.personen];
  const regionNamen = d.regionen.map((r) => r.name);

  const mentorId = new Map(d.mentoren.map((t) => [faltName(t.name), t.id]));
  for (const z of zeilen.slice(kopf.index + 1)) {
    const s = col.sorumlu >= 0 ? text(z[col.sorumlu]) : "";
    if (s && !mentorId.has(faltName(s))) {
      p.zaehle(p.m.neueVerantwortliche);
      mentorId.set(faltName(s), o.anwenden ? pruefe<{ id: string }>(await sb.from("mentors").insert({ name: s }).select("id").single(), "Verantwortliche anlegen").id : `neu-${s}`);
    }
  }
  const moduleNachNr = new Map<number, Awaited<ReturnType<typeof modul>>>();
  for (const m of modulSpalten) moduleNachNr.set(m.nr, await modul(sb, d, m.nr, o, p));

  const anmeldungen: { personId: string; modulNr: number; da: boolean }[] = [];
  const ausDatei = new Map<string, { person: Person; zeile: number }>();
  for (const [zi, z] of zeilen.slice(kopf.index + 1).entries()) {
    const name = text(z[col.name]);
    if (!name) continue;
    const zeilenNr = kopf.index + 2 + zi;
    p.zaehle(p.m.zeilenGelesen);

    const region = col.region >= 0 ? regionName(z[col.region], regionNamen) : null;
    if (col.region >= 0 && text(z[col.region]) && !region) p.warn(p.m.regionUnbekannt(zeilenNr, name, text(z[col.region])));
    const r = d.regionen.find((x) => x.name === region);
    const orgRoh = col.org >= 0 ? text(z[col.org]).toUpperCase() : "";
    const branch = orgRoh === "GT" || orgRoh === "KGT" ? orgRoh : null;
    if (orgRoh && !branch) p.warn(p.m.gtUnklar(zeilenNr, name, orgRoh));
    const s = col.sorumlu >= 0 ? text(z[col.sorumlu]) : "";
    const werte = {
      ...(r ? { region_id: r.id, country: r.country } : {}),
      ...(branch ? { branch } : {}),
      ...(s ? { mentor_id: mentorId.get(faltName(s)) } : {}),
    };

    // Mit dem Bestand vor dem Import abgleichen; derselbe Name zweimal in der Datei wird nur einmal angelegt
    const schonInDatei = ausDatei.get(faltName(name));
    if (schonInDatei) p.warn(p.m.doppelt(zeilenNr, name, schonInDatei.zeile));
    let person = schonInDatei?.person ?? zuordnen(name, bestand, o, p, p.m.zeile(zeilenNr));
    if (!person) {
      if (finde(name, bestand).art !== "keiner") continue;
      person = await personAnlegen(sb, d, name, werte, o);
      p.zaehle(p.m.neueTeilnehmende);
    } else if (schonInDatei) {
      // zweite Zeile derselben Person: nur die Module übernehmen
    } else {
      p.zaehle(p.m.aktualisiert);
      if (o.anwenden) pruefe(await sb.from("participants").update({ ...werte, affiliation_status: "academy_student", cohort_id: d.jahrgang.id }).eq("id", person.id), `„${name}“ aktualisieren`);
    }

    if (!schonInDatei) ausDatei.set(faltName(name), { person, zeile: zeilenNr });
    for (const m of modulSpalten) {
      const w = text(z[m.i]);
      const da = w === "+" ? true : w === "-" || w === "–" ? false : null;
      if (da === null) {
        if (w) p.warn(p.m.modulWert(zeilenNr, name, m.nr, w));
        continue;
      }
      anmeldungen.push({ personId: person.id, modulNr: m.nr, da });
      p.zaehle(da ? p.m.anwesend : p.m.nichtDa);
    }
  }

  if (!o.anwenden) return;
  // Anmeldungen für die importierten Module, Anwesenheit für alle Tage eines besuchten Moduls
  const regs = anmeldungen.map((a) => ({ module_id: moduleNachNr.get(a.modulNr)!.id, participant_id: a.personId, status: "confirmed" as const, source: "staff" as const }));
  const gespeichert: { id: string; module_id: string; participant_id: string }[] = [];
  for (let i = 0; i < regs.length; i += 500)
    gespeichert.push(...pruefe<typeof gespeichert>(await sb.from("registrations").upsert(regs.slice(i, i + 500), { onConflict: "module_id,participant_id" }).select("id,module_id,participant_id"), "Anmeldungen speichern"));
  const regId = new Map(gespeichert.map((g) => [`${g.module_id}|${g.participant_id}`, g.id]));
  const anwesenheit = anmeldungen
    .filter((a) => a.da)
    .flatMap((a) => {
      const m = moduleNachNr.get(a.modulNr)!;
      return m.tage.map((t) => ({ registration_id: regId.get(`${m.id}|${a.personId}`)!, module_day_id: t.id, checked_in_at: t.beginn, method: "manual" as const }));
    });
  for (let i = 0; i < anwesenheit.length; i += 500)
    pruefe(await sb.from("attendances").upsert(anwesenheit.slice(i, i + 500), { onConflict: "registration_id,module_day_id", ignoreDuplicates: true }), "Anwesenheit speichern");

  // Für kommende Module des Jahrgangs anmelden, damit der QR-Code am Einlass gilt
  const { data: kommende } = await sb.from("modules").select("id, module_days!inner(ends_at)").eq("cohort_id", d.jahrgang.id).eq("status", "published").is("cancelled_at", null).gt("module_days.ends_at", new Date().toISOString());
  const personen = [...new Set(anmeldungen.map((a) => a.personId))];
  const zukunft = [...new Set((kommende ?? []).map((m) => m.id))].flatMap((mid) => personen.map((pid) => ({ module_id: mid, participant_id: pid, status: "confirmed" as const, source: "cohort" as const })));
  for (let i = 0; i < zukunft.length; i += 500)
    pruefe(await sb.from("registrations").upsert(zukunft.slice(i, i + 500), { onConflict: "module_id,participant_id", ignoreDuplicates: true }), "Anmeldung kommende Module");
  if (zukunft.length) p.info(p.m.kommendeModule(new Set(zukunft.map((z) => z.module_id)).size));
}

// ── 2. Hausaufgabenliste (Name, Bölge, Ülke, Ödev 1…n mit ✓) ─────────────────

async function hausaufgaben(sb: Db, zeilen: Zeile[], o: Optionen, p: Protokoll) {
  const kopf = kopfzeile(zeilen, [(z) => z === "name" || z.includes("isim"), (z) => z.includes("ödev") || z.includes("hausaufgabe")]);
  if (!kopf) throw new Error(p.m.kopfHausaufgaben);
  const k = kopf.zellen;
  const col = { name: k.findIndex((z) => z === "name" || z.includes("isim")), region: k.findIndex((z) => z.includes("bölge")), land: k.findIndex((z) => z.includes("ülke") || z.includes("land")) };
  const aufgaben = k.map((z, i) => ({ i, nr: Number(z.match(/(?:ödev|hausaufgabe)\s*(\d+)/)?.[1]) })).filter((a) => a.nr > 0);

  const d = await lade(sb, p.m);
  const regionNamen = d.regionen.map((r) => r.name);
  const cache = new Map<number, string>();
  const { data: vorhanden } = await sb.from("submission_participants").select("participant_id, submissions(assignment_id)");
  const hatAbgabe = new Set((vorhanden ?? []).map((a) => `${(a.submissions as { assignment_id: string } | null)?.assignment_id}|${a.participant_id}`));

  for (const [zi, z] of zeilen.slice(kopf.index + 1).entries()) {
    const name = text(z[col.name]);
    if (!name) continue;
    const zeilenNr = kopf.index + 2 + zi;
    p.zaehle(p.m.zeilenGelesen);
    let person = zuordnen(name, d.personen, o, p, p.m.zeile(zeilenNr));
    const region = col.region >= 0 ? d.regionen.find((r) => r.name === regionName(z[col.region], regionNamen)) : undefined;
    const land = col.land >= 0 ? landAusText[faltName(text(z[col.land]))] : undefined;
    if (!person) {
      if (finde(name, d.personen).art !== "keiner") continue;
      if (!o.fehlendeAnlegen) {
        p.warn(p.m.nichtInListeAnlegen(zeilenNr, name));
        p.zaehle(p.m.nichtGefunden);
        continue;
      }
      person = await personAnlegen(sb, d, name, { ...(region ? { region_id: region.id } : {}), ...(land || region ? { country: land ?? region!.country } : {}) }, o);
      p.zaehle(p.m.neueTeilnehmende);
    } else {
      const full = d.personen.find((x) => x.id === person!.id)!;
      const update: { country?: string; region_id?: number } = {};
      if (!full.country && (land || region)) update.country = land ?? region!.country;
      if (!full.region_id && region) update.region_id = region.id;
      if (Object.keys(update).length) {
        p.zaehle(p.m.landErgaenzt);
        if (o.anwenden) pruefe(await sb.from("participants").update(update).eq("id", person.id), `„${name}“ ergänzen`);
      }
    }

    for (const a of aufgaben) {
      if (!text(z[a.i])) continue;
      const hid = await hausaufgabeId(sb, d, a.nr, o, p, cache);
      if (hatAbgabe.has(`${hid}|${person.id}`)) { p.zaehle(p.m.schonErfasst(a.nr)); continue; }
      hatAbgabe.add(`${hid}|${person.id}`);
      p.zaehle(p.m.abgegeben(a.nr));
      if (o.anwenden) {
        const ab = pruefe<{ id: string }>(await sb.from("submissions").insert({ assignment_id: hid, label: person.name, source: "list", note: "Aus Hausaufgabenliste übernommen" }).select("id").single(), "Abgabe anlegen");
        pruefe(await sb.from("submission_participants").insert({ submission_id: ab.id, participant_id: person.id }), "Abgabe zuordnen");
      }
    }
  }
}

// ── 3. Bewertungsbogen Rhetorik-Videos (Blatt „Alle Videos“) ─────────────────

const kriteriumSpalte: Record<KriteriumFeld, (z: string) => boolean> = {
  content: (z) => z === "inhalt",
  structure: (z) => z.startsWith("aufbau"),
  body_language: (z) => z.startsWith("körpersprache"),
  facial_expression: (z) => z.startsWith("mimik"),
  voice: (z) => z.startsWith("stimme"),
  language: (z) => z.startsWith("ausdruck"),
  presence: (z) => z.startsWith("auftreten"),
  impact: (z) => z.startsWith("publikumswirkung"),
  overall: (z) => z === "gesamteindruck",
};

type Abgabe = { id: string; file_name: string | null; source: string; submission_participants: { participant_id: string }[] };

async function bewertungsbogen(sb: Db, blaetter: { name: string; zeilen: Zeile[] }[], o: Optionen, p: Protokoll) {
  let zeilen: Zeile[] = [];
  let kopf: ReturnType<typeof kopfzeile> = null;
  for (const b of blaetter) {
    kopf = kopfzeile(b.zeilen, [(z) => z.includes("name"), (z) => z === "inhalt"]);
    if (kopf) { zeilen = b.zeilen; break; }
  }
  if (!kopf) throw new Error(p.m.kopfBogen);
  const k = kopf.zellen;
  const idx = (f: (z: string) => boolean) => k.findIndex(f);
  const col = {
    name: idx((z) => z.includes("name")),
    gut: idx((z) => z.startsWith("besonders gut")),
    besser: idx((z) => z.startsWith("verbesserung")),
    tipp: idx((z) => z.startsWith("tipp")),
    datum: idx((z) => z === "datum"),
    von: idx((z) => z.startsWith("bewertet von")),
    datei: idx((z) => z.startsWith("dateiname")),
    hinweis: idx((z) => z.startsWith("hinweis")),
  };
  const kCol = Object.fromEntries(kriterien.map((kr) => [kr.feld, idx(kriteriumSpalte[kr.feld])])) as Record<KriteriumFeld, number>;

  const d = await lade(sb, p.m);
  const hid = await hausaufgabeId(sb, d, o.hausaufgabeNr, o, p, new Map());
  const { data: alt } = await sb.from("submissions").select("id,file_name,source,submission_participants(participant_id)").eq("assignment_id", hid);
  const abgaben = (alt ?? []) as Abgabe[];

  for (const [zi, z] of zeilen.slice(kopf.index + 1).entries()) {
    const bezeichnung = text(z[col.name]);
    if (!bezeichnung) continue;
    p.zaehle(p.m.videosGelesen);
    const datei = (col.datei >= 0 && text(z[col.datei])) || bezeichnung;
    const kontext = p.m.video(zi + 1, bezeichnung);

    const namen = bezeichnung.split(/;|\s-\s|,|\s&\s/).map((n) => n.replace(/…|\.\.\./g, "").trim()).filter(Boolean);
    const ids: string[] = [];
    for (const n of namen) {
      const person = zuordnen(n, d.personen, o, p, kontext);
      if (person) ids.push(person.id);
      else if (finde(n, d.personen).art === "keiner") { p.warn(p.m.videoNichtGefunden(kontext, n)); p.zaehle(p.m.nichtZugeordnet); }
    }
    if (bezeichnung.includes("…")) p.info(p.m.abgeschnitten(kontext));

    const punkte = Object.fromEntries(
      kriterien.map((kr) => {
        const v = kCol[kr.feld] >= 0 ? Number(z[kCol[kr.feld]]) : NaN;
        return [kr.feld, Number.isInteger(v) && v >= 1 && v <= 5 ? v : null];
      }),
    ) as Record<KriteriumFeld, number | null>;
    const bewertet = Object.values(punkte).some((v) => v != null);
    const feedback = { strengths: text(z[col.gut]) || null, improvements: text(z[col.besser]) || null, tip: text(z[col.tipp]) || null };
    const bewerter = col.von >= 0 ? text(z[col.von]) || null : null;
    p.zaehle(bewertet ? p.m.mitBewertung : p.m.ohneBewertung);
    if (ids.length > 1) p.zaehle(p.m.gruppenvideos);

    if (!o.anwenden) continue;
    let ab = abgaben.find((a) => a.file_name === datei);
    if (!ab) {
      const neu = pruefe<{ id: string }>(
        await sb.from("submissions").insert({ assignment_id: hid, label: bezeichnung, file_name: datei, source: "review_sheet", note: col.hinweis >= 0 ? text(z[col.hinweis]) || null : null }).select("id").single(),
        "Abgabe anlegen",
      );
      ab = { id: neu.id, file_name: datei, source: "review_sheet", submission_participants: [] };
      abgaben.push(ab);
      p.zaehle(p.m.abgabenNeu);
    }
    const fehlend = ids.filter((id) => !ab!.submission_participants.some((x) => x.participant_id === id));
    if (fehlend.length) {
      pruefe(await sb.from("submission_participants").insert(fehlend.map((participant_id) => ({ submission_id: ab!.id, participant_id }))), "Personen zuordnen");
      ab.submission_participants.push(...fehlend.map((participant_id) => ({ participant_id })));
      // „Abgegeben“-Markierung aus der Hausaufgabenliste durch das echte Video ersetzen
      const platzhalter = abgaben.filter((a) => a.source === "list" && a.submission_participants.length === 1 && fehlend.includes(a.submission_participants[0].participant_id));
      if (platzhalter.length) pruefe(await sb.from("submissions").delete().in("id", platzhalter.map((x) => x.id)), "Platzhalter entfernen");
      platzhalter.forEach((x) => abgaben.splice(abgaben.indexOf(x), 1));
    }
    if (bewertet || feedback.strengths || feedback.improvements || feedback.tip) {
      const q = sb.from("reviews").select("id").eq("submission_id", ab.id).is("reviewer_id", null);
      const { data: vorh } = await (bewerter ? q.eq("reviewer_name", bewerter) : q.is("reviewer_name", null)).maybeSingle();
      const werte = { submission_id: ab.id, reviewer_name: bewerter, reviewed_on: col.datum >= 0 ? excelDatum(z[col.datum]) : null, ...punkte, ...feedback };
      if (vorh) pruefe(await sb.from("reviews").update(werte).eq("id", vorh.id), "Bewertung aktualisieren");
      else pruefe(await sb.from("reviews").insert(werte), "Bewertung speichern");
    }
  }
}

// ── 4. E-Mail-Adressen (z. B. Export der Google-Formular-Antworten) ──────────

const MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function emails(sb: Db, blaetter: { name: string; zeilen: Zeile[] }[], o: Optionen, p: Protokoll) {
  let gefunden: { zeilen: Zeile[]; kopf: number; mail: number; namen: number[]; tel: number } | null = null;
  for (const b of blaetter) {
    for (let i = 0; i < Math.min(15, b.zeilen.length) && !gefunden; i++) {
      const k = b.zeilen[i].map(klein);
      const rest = b.zeilen.slice(i + 1, i + 40);
      const mail = k.findIndex((_, c) => rest.filter((r) => MAIL.test(text(r[c]))).length >= Math.max(1, rest.filter((r) => text(r[c])).length * 0.6));
      if (mail < 0) continue;
      const voll = k.findIndex((z) => /ad[ıi]? ?soyad|isim soyisim|isim|vollständiger name|name, vorname|^name$|ad soyad/.test(z));
      const vor = k.findIndex((z) => /^(ad[ıi]?|vorname|first name|prénom)$/.test(z));
      const nach = k.findIndex((z) => /^(soyad[ıi]?|nachname|last name|nom)$/.test(z));
      const namen = voll >= 0 ? [voll] : vor >= 0 && nach >= 0 ? [vor, nach] : [];
      if (!namen.length) continue;
      gefunden = { zeilen: b.zeilen, kopf: i, mail, namen, tel: k.findIndex((z) => /telefon|tel\.?$|handy|phone|gsm|cep/.test(z)) };
    }
    if (gefunden) break;
  }
  if (!gefunden) throw new Error(p.m.kopfMails);

  const d = await lade(sb, p.m);
  const { data: alle } = await sb.from("participants").select("id,first_name,last_name,email").not("email", "is", null);
  const vergeben = new Map((alle ?? []).map((x) => [x.email!, { id: x.id, name: `${x.first_name} ${x.last_name}`.trim() }]));
  for (const [zi, z] of gefunden.zeilen.slice(gefunden.kopf + 1).entries()) {
    const name = gefunden.namen.map((c) => text(z[c])).join(" ").trim();
    const mail = text(z[gefunden.mail]).toLowerCase();
    if (!name && !mail) continue;
    const zeilenNr = gefunden.kopf + 2 + zi;
    p.zaehle(p.m.zeilenGelesen);
    if (!MAIL.test(mail)) { p.warn(p.m.keineMail(zeilenNr, name, mail || p.m.leer)); p.zaehle(p.m.ungueltigeMail); continue; }
    let person = zuordnen(name, d.personen, o, p, p.m.zeile(zeilenNr));
    if (!person) {
      if (finde(name, d.personen).art !== "keiner") continue;
      if (!o.fehlendeAnlegen) { p.warn(p.m.nichtInListeMail(zeilenNr, name, mail)); p.zaehle(p.m.nichtGefunden); continue; }
      person = await personAnlegen(sb, d, name, {}, o);
      p.zaehle(p.m.neueTeilnehmende);
    }
    const full = d.personen.find((x) => x.id === person!.id)!;
    const andere = vergeben.get(mail);
    if (andere && andere.id !== full.id) { p.warn(p.m.mailVergeben(zeilenNr, mail, andere.name, full.name)); p.zaehle(p.m.konflikte); continue; }
    if (full.email === mail) { p.zaehle(p.m.schonEingetragen); continue; }
    if (full.email && !o.ueberschreiben) { p.warn(p.m.mailAbweichend(full.name, full.email, mail)); p.zaehle(p.m.abweichend); continue; }
    p.zaehle(full.email ? p.m.mailErsetzt : p.m.mailErgaenzt);
    const tel = gefunden.tel >= 0 ? text(z[gefunden.tel]) || undefined : undefined;
    if (o.anwenden) pruefe(await sb.from("participants").update({ email: mail, ...(tel ? { phone: tel } : {}) }).eq("id", full.id), `E-Mail für „${full.name}“`);
    if (full.email) vergeben.delete(full.email);
    full.email = mail;
    vergeben.set(mail, { id: full.id, name: full.name });
  }
  const ohne = d.personen.filter((x) => !x.email).length;
  if (ohne) p.info(p.m.ohneMail(ohne));
}

// ── 5. Zusagen (Antworten auf „Kommst du?“, z. B. Google-Formular „Katılım ve Konaklama“) ──────

const JA = /^(evet|ja|yes|oui|komme|katılacağım|katilacagim)\b/i;
const NEIN = /^(hayır|hayir|nein|no|non|komme nicht|katılamayacağım|katilamayacagim)\b/i;

async function zusagen(sb: Db, blaetter: { name: string; zeilen: Zeile[] }[], o: Optionen, p: Protokoll) {
  if (!o.modulId) throw new Error(p.m.modulWaehlen);
  const { data: modul } = await sb.from("modules").select("id, title").eq("id", o.modulId).maybeSingle();
  if (!modul) throw new Error(p.m.modulGibtsNicht);
  let gefunden: { zeilen: Zeile[]; kopf: number; namen: number[]; antwort: number; tel: number } | null = null;
  for (const b of blaetter) {
    for (let i = 0; i < Math.min(15, b.zeilen.length) && !gefunden; i++) {
      const k = b.zeilen[i].map(klein);
      const voll = k.findIndex((z) => /ad[ıi]n?[ıi]?z? ?soyad|isim soyisim|vollständiger name|name, vorname|^name$|ad soyad|^isim$/.test(z));
      const vor = k.findIndex((z) => /^(ad[ıi]?|vorname|first name|prénom)$/.test(z));
      const nach = k.findIndex((z) => /^(soyad[ıi]?|nachname|last name|nom)$/.test(z));
      const namen = voll >= 0 ? [voll] : vor >= 0 && nach >= 0 ? [vor, nach] : [];
      if (!namen.length) continue;
      gefunden = {
        zeilen: b.zeilen, kopf: i, namen,
        antwort: k.findIndex((z) => /katıl|katil|teilnahme|teilnehmen|kommst du|kommen sie|participat|attend/.test(z)),
        tel: k.findIndex((z) => /telefon|tel\.?$|handy|phone|gsm|cep/.test(z)),
      };
    }
    if (gefunden) break;
  }
  if (!gefunden) throw new Error(p.m.kopfZusagen);
  if (gefunden.antwort < 0) p.info(p.m.keineAntwortSpalte);

  const d = await lade(sb, p.m);
  const [{ data: anmeldungen }, { data: telefone }] = await Promise.all([
    sb.from("registrations").select("id, participant_id, status, rsvp, rsvp_source").eq("module_id", modul.id),
    sb.from("participants").select("id, phone"),
  ]);
  const anmeldung = new Map((anmeldungen ?? []).map((r) => [r.participant_id, r]));
  const telefon = new Map((telefone ?? []).map((t) => [t.id, t.phone]));

  // 1. Durchgang: Namen zuordnen; steht jemand mehrfach in der Datei, gilt die letzte Antwort (Formulare hängen neue
  //    Antworten unten an). So kippt ein erneuter Import derselben Datei nichts hin und her.
  const antworten = new Map<string, { person: P | Person; rsvp: "zugesagt" | "abgesagt"; tel: string; zeilenNr: number }>();
  for (const [zi, z] of gefunden.zeilen.slice(gefunden.kopf + 1).entries()) {
    const name = gefunden.namen.map((c) => text(z[c])).join(" ").trim();
    if (!name) continue;
    const zeilenNr = gefunden.kopf + 2 + zi;
    p.zaehle(p.m.zeilenGelesen);
    const roh = gefunden.antwort >= 0 ? text(z[gefunden.antwort]).trim() : "Evet";
    const rsvp = JA.test(roh) ? "zugesagt" : NEIN.test(roh) ? "abgesagt" : null;
    if (!rsvp) { p.warn(p.m.antwortUnverstanden(zeilenNr, name, roh || p.m.leer)); p.zaehle(p.m.antwortUnklar); continue; }
    let person: P | Person | null = zuordnen(name, d.personen, o, p, p.m.zeile(zeilenNr));
    if (!person) {
      if (finde(name, d.personen).art !== "keiner") continue;
      if (!o.fehlendeAnlegen) { p.warn(p.m.nichtInListe(zeilenNr, name)); p.zaehle(p.m.nichtGefunden); continue; }
      person = await personAnlegen(sb, d, name, { affiliation_status: "guest" }, o);
      p.zaehle(p.m.neueGaeste);
    }
    const vorher = antworten.get(person.id);
    if (vorher) p.info(p.m.mehrfach(zeilenNr, person.name, vorher.zeilenNr));
    antworten.set(person.id, { person, rsvp, tel: gefunden.tel >= 0 ? text(z[gefunden.tel]).trim() : "", zeilenNr });
  }

  // 2. Durchgang: je Person genau einmal schreiben
  for (const { person, rsvp, tel } of antworten.values()) {
    const reg = anmeldung.get(person.id);
    if (!reg) {
      p.zaehle(p.m.neuAngemeldet);
      if (o.anwenden && !person.id.startsWith("neu-")) {
        pruefe(await sb.from("registrations").insert({ module_id: modul.id, participant_id: person.id, status: "confirmed", source: "staff", rsvp, rsvp_at: new Date().toISOString(), rsvp_source: "import" }), `Anmeldung für „${person.name}“`);
      }
    } else if (reg.rsvp === rsvp) {
      p.zaehle(p.m.schonEingetragen);
    } else if (reg.rsvp && reg.rsvp_source === "team") {
      // Nach einem Anruf vom Team gesetzt: nicht still mit der Formular-Antwort überschreiben
      p.warn(p.m.vomTeamGesetzt(person.name, p.m.rsvp(reg.rsvp), p.m.rsvp(rsvp)));
      p.zaehle(p.m.vomTeam);
      continue;
    } else {
      if (reg.status !== "confirmed" && rsvp === "zugesagt") p.info(p.m.zusageStatus(person.name, p.m.status(reg.status)));
      if (o.anwenden) pruefe(await sb.from("registrations").update({ rsvp, rsvp_at: new Date().toISOString(), rsvp_source: "import" }).eq("id", reg.id), `Zusage für „${person.name}“`);
    }
    p.zaehle(rsvp === "zugesagt" ? p.m.zusagen : p.m.absagen);
    if (tel && !telefon.get(person.id) && !person.id.startsWith("neu-")) {
      p.zaehle(p.m.telefonErgaenzt);
      if (o.anwenden) pruefe(await sb.from("participants").update({ phone: tel }).eq("id", person.id), `Telefon für „${person.name}“`);
      telefon.set(person.id, tel);
    }
  }
  const ohne = (anmeldungen ?? []).filter((r) => r.status === "confirmed" && !r.rsvp && !antworten.has(r.participant_id)).length;
  p.info(p.m.ohneRueckmeldung(modul.title, ohne));
}

// ── Einstieg ──────────────────────────────────────────────────────────────────

/** Liest die Datei und gleicht sie ab. Nur mit `anwenden` wird geschrieben. Aufrufer prüft vorher die Rolle. */
export async function importiere(sb: Db, art: ImportArt, datei: File, o: Optionen): Promise<Bericht> {
  const blaetter = await leseTabelle(datei);
  const p = new Protokoll(meldungen[o.sprache ?? "de"]);
  const erstes = blaetter.find((b) => b.zeilen.length > 1)?.zeilen ?? [];
  if (art === "teilnehmerliste") await teilnehmerliste(sb, erstes, o, p);
  else if (art === "hausaufgaben") await hausaufgaben(sb, erstes, o, p);
  else if (art === "bewertungsbogen") await bewertungsbogen(sb, blaetter, o, p);
  else if (art === "zusagen") await zusagen(sb, blaetter, o, p);
  else await emails(sb, blaetter, o, p);
  return { titel: p.m.titel[art], zahlen: [...p.zahlen.entries()], hinweise: p.hinweise, angewendet: o.anwenden };
}
