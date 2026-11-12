import type { Database } from "@/lib/database.types";
import { teamLocale, type TeamSprache } from "@/lib/team-sprache";

type Enums = Database["public"]["Enums"];

/** Antwort der Datenbankfunktionen check_in_by_code / check_in_manual (siehe Migration, checkin_core). */
export type EinlassErgebnis = {
  result:
    | "checked_in" | "already_checked_in" | "invalid_code" | "not_found" | "not_registered" | "not_eligible"
    | "module_cancelled" | "module_not_available" | "ticket_not_required" | "outside_checkin_window"
    | "day_not_found" | "invalid_scan_time" | "consent_required" | "fehler"
    // nur im Offline-Modus (Browser, siehe offline-einlass.ts)
    | "offline_vorgemerkt" | "offline_bereits" | "offline_ohne_liste" | "offline_unbekannt"
    // nur beim Walk-in (create_walk_in)
    | "email_other_person" | "email_in_use" | "possible_duplicate";
  participant_id?: string;
  display_name?: string;
  affiliation_status?: Enums["affiliation_status"];
  module_title?: string;
  registration_status?: Enums["registration_status"];
  checked_in_at?: string;
  window_start?: string;
  window_end?: string;
};

/** expected: zugesagt (bzw. alle Bestätigten, wenn das Modul keine Rückmeldung nutzt) plus schon Eingecheckte; no_reply: ohne Rückmeldung, noch nicht da. */
export type Zaehler = { checked_in: number; expected: number; no_reply?: number; waitlist: number; excused: number };

export type EinlassAntwort = { ergebnis: EinlassErgebnis; zaehler: Zaehler | null };

export const zugehoerigkeit: Record<Enums["affiliation_status"], string> = {
  member: "Mitglied",
  academy_student: "Academy-Teilnehmer:in",
  guest: "Gast",
  alumni: "Alumni",
};

/** Zugehörigkeit in der Sprache des Team-Bereichs (Deutsch = zugehoerigkeit, das andere Seiten weiter direkt nutzen). */
export const zugehoerigkeitTexte: Record<TeamSprache, Record<Enums["affiliation_status"], string>> = {
  de: zugehoerigkeit,
  tr: { member: "Üye", academy_student: "Academy katılımcısı", guest: "Misafir", alumni: "Mezun" },
  fr: { member: "Membre", academy_student: "Participant·e Academy", guest: "Invité·e", alumni: "Alumni" },
};

export const anmeldestatus: Record<Enums["registration_status"], string> = {
  confirmed: "Angemeldet",
  pending: "Noch nicht freigeschaltet",
  waitlist: "Warteliste",
  cancelled: "Abgemeldet",
  excused: "Entschuldigt",
  rejected: "Abgelehnt",
};

/** Anmeldestatus in der Sprache des Team-Bereichs (Deutsch = anmeldestatus). */
export const anmeldestatusTexte: Record<TeamSprache, Record<Enums["registration_status"], string>> = {
  de: anmeldestatus,
  tr: {
    confirmed: "Kayıtlı", pending: "Henüz onaylanmadı", waitlist: "Bekleme listesi", cancelled: "Kayıt iptal", excused: "Mazeretli",
    rejected: "Reddedildi",
  },
  fr: {
    confirmed: "Inscrit·e", pending: "Pas encore validé·e", waitlist: "Liste d’attente", cancelled: "Désinscrit·e", excused: "Excusé·e",
    rejected: "Refusé·e",
  },
};

export function uhrzeit(iso: string, sekunden = true, sprache: TeamSprache = "de"): string {
  return new Intl.DateTimeFormat(teamLocale[sprache], {
    hour: "2-digit", minute: "2-digit", second: sekunden ? "2-digit" : undefined, timeZone: "Europe/Berlin",
  }).format(new Date(iso));
}

export type Ton = "gruen" | "gelb" | "rot";

/**
 * Texte der Ergebniskarte. Türkisch ohne Endung an der Uhrzeit („09:05'te“ hinge von der gesprochenen Zahl ab),
 * daher „saat …“ bzw. Doppelpunkt. Französisch: geschütztes Leerzeichen vor : ; ? ! und in « ».
 */
const de = {
  eingecheckt: (zeit: string) => `Erfolgreich eingecheckt um ${zeit} Uhr`,
  bereitsEingecheckt: (zeit: string) => `Warnung: Bereits eingecheckt um ${zeit} Uhr`,
  bereitsEingechecktText: "Der Code ist gültig, die Person steht schon in der Liste.",
  nichtZugelassen: "Nicht zugelassen",
  nichtZugelassenText: "Diese Anmeldung berechtigt nicht zum Einlass. Bitte mit dem Orga-Team klären.",
  nichtAngemeldet: "Nicht für dieses Modul angemeldet",
  nichtAngemeldetText: "Der Code gehört zu einer Person, die für dieses Modul keine Anmeldung hat.",
  ungueltig: "Ungültiger Code",
  ungueltigText: "QR-Code oder Kurzcode konnte nicht gelesen werden.",
  unbekannt: "Code unbekannt",
  unbekanntText: "Zu diesem Code gibt es keine Person.",
  abgesagt: "Modul abgesagt",
  abgesagtText: "Für ein abgesagtes Modul ist kein Einlass möglich.",
  nichtVeroeffentlicht: "Modul nicht veröffentlicht",
  ohneTicket: "Für dieses Modul gibt es kein Ticket",
  ohneTicketText: "Bitte die Person in der Anwesenheitsliste abhaken.",
  ausserhalb: "Außerhalb des Einlasszeitraums",
  fensterVorbei: (bis: string) => `Der Einlass für diesen Tag ist vorbei (bis ${bis} Uhr).`,
  fensterAb: (ab: string) => `Einlass ist ab ${ab} Uhr möglich (4 Stunden vor Beginn bis 6 Stunden nach Ende).`,
  offlineVorgemerkt: (zeit: string) => `Offline vorgemerkt um ${zeit} Uhr`,
  offlineVorgemerktText: "Kein Internet: Der Check-in wird übertragen, sobald die Verbindung wieder steht.",
  offlineBereits: (zeit: string) => `Warnung: Bereits erfasst um ${zeit} Uhr`,
  offlineBereitsText: "Offline geprüft. Die Person ist schon eingecheckt oder vorgemerkt.",
  offlineUnbekannt: "Nicht in der Offline-Liste",
  offlineUnbekanntText: "Offline geprüft: Auf diesem Gerät stehen nur die Angemeldeten. Bitte mit dem Orga-Team klären oder später online erneut prüfen.",
  emailAndere: "Diese E-Mail gehört schon einer anderen Person",
  emailAndereText: "Nichts angelegt, niemand eingecheckt. Ist es dieselbe Person, bitte in der Liste abhaken; sonst die E-Mail prüfen oder leer lassen.",
  emailVergeben: "E-Mail schon vergeben",
  emailVergebenText: "Bitte ohne E-Mail anlegen oder das Orga-Team fragen. Es wurde nichts angelegt.",
  doppelt: "Diese Person ist schon angemeldet",
  doppeltText: "Nichts angelegt. Bitte in der Liste abhaken. Ist es wirklich jemand anderes mit gleichem Namen, „Trotzdem neu anlegen“ ankreuzen.",
  ohneListe: "Kein Internet und keine Offline-Liste",
  ohneListeText: "Die Einlassliste für diesen Tag wurde auf diesem Gerät noch nicht geladen. Bitte Internet herstellen.",
  einwilligung: "Einwilligung fehlt",
  einwilligungText: "Ohne Datenschutz-Einwilligung kann niemand erfasst werden.",
  nichtGespeichert: "Check-in nicht gespeichert",
  nichtGespeichertText: "Bitte erneut versuchen oder den Kurzcode eingeben.",
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    eingecheckt: (zeit) => `Giriş yapıldı, saat ${zeit}`,
    bereitsEingecheckt: (zeit) => `Uyarı: Giriş zaten yapılmış, saat ${zeit}`,
    bereitsEingechecktText: "Kod geçerli, kişi zaten listede.",
    nichtZugelassen: "Giriş izni yok",
    nichtZugelassenText: "Bu kayıt girişe izin vermiyor. Lütfen organizasyon ekibine danış.",
    nichtAngemeldet: "Bu modüle kayıtlı değil",
    nichtAngemeldetText: "Kod, bu modüle kaydı olmayan bir kişiye ait.",
    ungueltig: "Geçersiz kod",
    ungueltigText: "QR kod ya da kısa kod okunamadı.",
    unbekannt: "Bilinmeyen kod",
    unbekanntText: "Bu koda ait bir kişi yok.",
    abgesagt: "Modül iptal edildi",
    abgesagtText: "İptal edilen bir modüle giriş yapılamaz.",
    nichtVeroeffentlicht: "Modül yayında değil",
    ohneTicket: "Bu modül için bilet yok",
    ohneTicketText: "Lütfen kişiyi yoklama listesinde işaretle.",
    ausserhalb: "Giriş saatleri dışında",
    fensterVorbei: (bis) => `Bu gün için giriş sona erdi (bitiş: ${bis}).`,
    fensterAb: (ab) => `Giriş ${ab} itibarıyla mümkün (başlangıçtan 4 saat önceden bitişten 6 saat sonrasına kadar).`,
    offlineVorgemerkt: (zeit) => `Çevrimdışı sıraya alındı, saat ${zeit}`,
    offlineVorgemerktText: "İnternet yok: Bağlantı geri gelir gelmez giriş aktarılacak.",
    offlineBereits: (zeit) => `Uyarı: Zaten kaydedilmiş, saat ${zeit}`,
    offlineBereitsText: "Çevrimdışı kontrol edildi. Kişinin girişi zaten yapılmış ya da sıraya alınmış.",
    offlineUnbekannt: "Çevrimdışı listede yok",
    offlineUnbekanntText: "Çevrimdışı kontrol edildi: Bu cihazda yalnızca kayıtlı kişiler var. Lütfen organizasyon ekibine danış ya da internet gelince tekrar kontrol et.",
    emailAndere: "Bu e-posta başka bir kişiye ait",
    emailAndereText: "Kimse eklenmedi, kimsenin girişi yapılmadı. Aynı kişiyse lütfen listede işaretle; değilse e-postayı kontrol et ya da boş bırak.",
    emailVergeben: "E-posta zaten kullanılıyor",
    emailVergebenText: "Lütfen e-postasız ekle ya da organizasyon ekibine sor. Kimse eklenmedi.",
    doppelt: "Bu kişi zaten kayıtlı",
    doppeltText: "Kimse eklenmedi. Lütfen listede işaretle. Gerçekten aynı adı taşıyan başka biriyse “Yine de yeni kişi olarak ekle” kutusunu işaretle.",
    ohneListe: "İnternet yok, çevrimdışı liste de yok",
    ohneListeText: "Bu günün giriş listesi bu cihaza henüz yüklenmedi. Lütfen internete bağlan.",
    einwilligung: "Onay eksik",
    einwilligungText: "Veri koruma onayı olmadan kimse kaydedilemez.",
    nichtGespeichert: "Giriş kaydedilmedi",
    nichtGespeichertText: "Lütfen tekrar dene ya da kısa kodu gir.",
  },
  fr: {
    eingecheckt: (zeit) => `Entrée enregistrée à ${zeit}`,
    bereitsEingecheckt: (zeit) => `Attention : entrée déjà enregistrée à ${zeit}`,
    bereitsEingechecktText: "Le code est valide, la personne figure déjà sur la liste.",
    nichtZugelassen: "Non admis·e",
    nichtZugelassenText: "Cette inscription ne donne pas droit à l’entrée. Merci de voir avec l’équipe d’organisation.",
    nichtAngemeldet: "Pas inscrit·e à ce module",
    nichtAngemeldetText: "Ce code appartient à une personne qui n’est pas inscrite à ce module.",
    ungueltig: "Code non valide",
    ungueltigText: "Impossible de lire le QR code ou le code court.",
    unbekannt: "Code inconnu",
    unbekanntText: "Aucune personne ne correspond à ce code.",
    abgesagt: "Module annulé",
    abgesagtText: "Pas d’entrée possible pour un module annulé.",
    nichtVeroeffentlicht: "Module non publié",
    ohneTicket: "Pas de billet pour ce module",
    ohneTicketText: "Merci de cocher la personne dans la liste de présence.",
    ausserhalb: "En dehors des horaires d’accueil",
    fensterVorbei: (bis) => `L’accueil pour ce jour est terminé (jusqu’à ${bis}).`,
    fensterAb: (ab) => `Accueil possible à partir de ${ab} (de 4 heures avant le début à 6 heures après la fin).`,
    offlineVorgemerkt: (zeit) => `Noté hors ligne à ${zeit}`,
    offlineVorgemerktText: "Pas d’internet : l’entrée sera transmise dès que la connexion sera rétablie.",
    offlineBereits: (zeit) => `Attention : déjà noté·e à ${zeit}`,
    offlineBereitsText: "Vérifié hors ligne. La personne est déjà entrée ou en attente de transmission.",
    offlineUnbekannt: "Pas dans la liste hors ligne",
    offlineUnbekanntText: "Vérifié hors ligne : cet appareil ne contient que les personnes inscrites. Merci de voir avec l’équipe d’organisation ou de revérifier plus tard en ligne.",
    emailAndere: "Cet e-mail appartient déjà à une autre personne",
    emailAndereText: "Rien n’a été créé, personne n’est entré. Si c’est la même personne, coche-la dans la liste ; sinon, vérifie l’e-mail ou laisse le champ vide.",
    emailVergeben: "E-mail déjà utilisé",
    emailVergebenText: "Ajoute la personne sans e-mail ou demande à l’équipe d’organisation. Rien n’a été créé.",
    doppelt: "Cette personne est déjà inscrite",
    doppeltText: "Rien n’a été créé. Coche-la dans la liste. S’il s’agit vraiment d’une autre personne du même nom, coche « Créer quand même ».",
    ohneListe: "Ni internet ni liste hors ligne",
    ohneListeText: "La liste d’accueil de ce jour n’a pas encore été chargée sur cet appareil. Merci de rétablir la connexion internet.",
    einwilligung: "Consentement manquant",
    einwilligungText: "Sans consentement au traitement des données, personne ne peut être enregistré.",
    nichtGespeichert: "Entrée non enregistrée",
    nichtGespeichertText: "Réessaie ou saisis le code court.",
  },
};

/** Was die Ergebniskarte zeigt: Farbe, Überschrift, Erklärung (in der Sprache des Team-Bereichs). */
export function deute(e: EinlassErgebnis, sprache: TeamSprache = "de"): { ton: Ton; titel: string; text?: string } {
  const t = T[sprache];
  const um = (iso: string) => uhrzeit(iso, true, sprache);
  switch (e.result) {
    case "checked_in":
      return { ton: "gruen", titel: t.eingecheckt(um(e.checked_in_at!)) };
    case "already_checked_in":
      return { ton: "gelb", titel: t.bereitsEingecheckt(um(e.checked_in_at!)), text: t.bereitsEingechecktText };
    case "not_eligible":
      return { ton: "rot", titel: e.registration_status ? anmeldestatusTexte[sprache][e.registration_status] : t.nichtZugelassen, text: t.nichtZugelassenText };
    case "not_registered":
      return { ton: "rot", titel: t.nichtAngemeldet, text: t.nichtAngemeldetText };
    case "invalid_code":
      return { ton: "rot", titel: t.ungueltig, text: t.ungueltigText };
    case "not_found":
      return { ton: "rot", titel: t.unbekannt, text: t.unbekanntText };
    case "module_cancelled":
      return { ton: "rot", titel: t.abgesagt, text: t.abgesagtText };
    case "module_not_available":
      return { ton: "rot", titel: t.nichtVeroeffentlicht };
    case "ticket_not_required":
      return { ton: "gelb", titel: t.ohneTicket, text: t.ohneTicketText };
    case "outside_checkin_window":
      return { ton: "rot", titel: t.ausserhalb, text: einlassFenster(e, sprache) };
    case "offline_vorgemerkt":
      return { ton: "gruen", titel: t.offlineVorgemerkt(um(e.checked_in_at!)), text: t.offlineVorgemerktText };
    case "offline_bereits":
      return { ton: "gelb", titel: t.offlineBereits(um(e.checked_in_at!)), text: t.offlineBereitsText };
    case "offline_unbekannt":
      return { ton: "rot", titel: t.offlineUnbekannt, text: t.offlineUnbekanntText };
    case "email_other_person":
      return { ton: "gelb", titel: t.emailAndere, text: t.emailAndereText };
    case "email_in_use":
      return { ton: "gelb", titel: t.emailVergeben, text: t.emailVergebenText };
    case "possible_duplicate":
      return { ton: "gelb", titel: t.doppelt, text: t.doppeltText };
    case "offline_ohne_liste":
      return { ton: "rot", titel: t.ohneListe, text: t.ohneListeText };
    case "consent_required":
      return { ton: "rot", titel: t.einwilligung, text: t.einwilligungText };
    default:
      return { ton: "rot", titel: t.nichtGespeichert, text: t.nichtGespeichertText };
  }
}

const tagKurz: Record<TeamSprache, Intl.DateTimeFormat> = {
  de: new Intl.DateTimeFormat(teamLocale.de, { weekday: "short", day: "numeric", month: "numeric", timeZone: "Europe/Berlin" }),
  tr: new Intl.DateTimeFormat(teamLocale.tr, { weekday: "short", day: "numeric", month: "numeric", timeZone: "Europe/Berlin" }),
  fr: new Intl.DateTimeFormat(teamLocale.fr, { weekday: "short", day: "numeric", month: "numeric", timeZone: "Europe/Berlin" }),
};
const tagIso = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" });

/** „ab 06:00 Uhr“ allein ist missverständlich: anderer Tag mit Datum, schon vorbei als „war bis …“. */
function einlassFenster(e: EinlassErgebnis, sprache: TeamSprache): string | undefined {
  if (!e.window_start) return undefined;
  const jetzt = Date.now();
  const mitTag = (iso: string) => (tagIso.format(new Date(iso)) === tagIso.format(jetzt) ? "" : `${tagKurz[sprache].format(new Date(iso))} `);
  if (e.window_end && Date.parse(e.window_end) < jetzt) return T[sprache].fensterVorbei(`${mitTag(e.window_end)}${uhrzeit(e.window_end, false, sprache)}`);
  return T[sprache].fensterAb(`${mitTag(e.window_start)}${uhrzeit(e.window_start, false, sprache)}`);
}
