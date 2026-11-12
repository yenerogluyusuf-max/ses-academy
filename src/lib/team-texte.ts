import type { TeamSprache } from "@/lib/team-sprache";

/**
 * Gemeinsame Begriffe des Team-Bereichs in Deutsch, Türkisch und Französisch (Wunsch 12.11.2026).
 * Seitentexte stehen als kleines Wörterbuch direkt in der jeweiligen Seite ({ de, tr, fr }); hier nur, was mehrere
 * Seiten brauchen, damit überall dieselben Wörter stehen. Ton wie bei den Teilnehmenden: du / sen / tu.
 * Französisch: geschütztes Leerzeichen ( ) vor : ; ? ! und in « … », Apostroph ’.
 */
const de = {
  team: "Team",
  teamBereich: "Team-Bereich",
  schnellzugriff: "Schnellzugriff",
  menue: "Menü",
  sprache: "Sprache",
  passwort: "Passwort",
  abmelden: "Abmelden",
  gruppen: { eventtag: "Eventtag", programm: "Programm", teilnehmende: "Teilnehmende", organisation: "Organisation" },
  bereiche: {
    start: "Übersicht", einlass: "Einlass", regieplan: "Regieplan", rollenplan: "Rollenplan", gruppen: "Gruppen", module: "Module",
    bewerbungen: "Bewerbungen", teilnehmende: "Teilnehmende", anrufe: "Anrufe", hausaufgaben: "Hausaufgaben", mitglieder: "Mitglieder",
    auswertung: "Auswertung", import: "Import", logistik: "Logistik", dokumente: "Dokumente", sitzungen: "Sitzungen", postfach: "Postfach",
    nachrichten: "Nachrichten", freigaben: "Freigaben", loeschantraege: "Löschanträge", team: "Team",
  },
  rollen: { admin: "Admin", vorstand: "Vorstand", orga_team: "Orga-Team", checkin_helper: "Einlass-Helfer:in" },
  anmeldung: { confirmed: "angemeldet", waitlist: "Warteliste", pending: "wird geprüft", excused: "entschuldigt", cancelled: "abgemeldet", rejected: "abgelehnt" },
  rsvp: { zugesagt: "zugesagt", abgesagt: "abgesagt", offen: "keine Rückmeldung" },
  wort: {
    speichern: "Speichern", abbrechen: "Abbrechen", loeschen: "Löschen", bearbeiten: "Bearbeiten", zurueck: "Zurück", hinzufuegen: "Hinzufügen",
    senden: "Senden", suchen: "Suchen", filtern: "Filtern", alle: "Alle", keine: "Keine", ja: "Ja", nein: "Nein", schliessen: "Schließen",
    oeffnen: "Öffnen", herunterladen: "Herunterladen", hochladen: "Hochladen", drucken: "Drucken", bestaetigen: "Bestätigen",
    modul: "Modul", module: "Module", teilnehmende: "Teilnehmende", person: "Person", personen: "Personen", datum: "Datum", uhrzeit: "Uhrzeit",
    ort: "Ort", name: "Name", vorname: "Vorname", nachname: "Nachname", email: "E-Mail", telefon: "Telefon", status: "Status", notiz: "Notiz",
    anzahl: "Anzahl", gesamt: "Gesamt", heute: "Heute", morgen: "Morgen", gestern: "Gestern", tag: "Tag", tage: "Tage", titel: "Titel",
    beschreibung: "Beschreibung", optional: "optional", hotel: "Hotel", zimmer: "Zimmer", region: "Region", generation: "Generation",
  },
  meldung: {
    gespeichert: "Gespeichert.", geloescht: "Gelöscht.", fehler: "Das hat nicht geklappt.", eingabe: "Bitte die Angaben prüfen.",
    rechte: "Dafür fehlen dir die Rechte.", nichtGefunden: "Nicht gefunden.",
  },
};

export type TeamTexte = typeof de;

const tr: TeamTexte = {
  team: "Ekip",
  teamBereich: "Ekip alanı",
  schnellzugriff: "Hızlı erişim",
  menue: "Menü",
  sprache: "Dil",
  passwort: "Şifre",
  abmelden: "Çıkış yap",
  gruppen: { eventtag: "Program günü", programm: "Program", teilnehmende: "Katılımcılar", organisation: "Organizasyon" },
  bereiche: {
    start: "Genel bakış", einlass: "Giriş", regieplan: "Akış planı", rollenplan: "Görev planı", gruppen: "Gruplar", module: "Modüller",
    bewerbungen: "Başvurular", teilnehmende: "Katılımcılar", anrufe: "Aramalar", hausaufgaben: "Ödevler", mitglieder: "Üyeler",
    auswertung: "Değerlendirme", import: "İçe aktarma", logistik: "Lojistik", dokumente: "Belgeler", sitzungen: "Toplantılar", postfach: "Posta kutusu",
    nachrichten: "Mesajlar", freigaben: "Onaylar", loeschantraege: "Silme talepleri", team: "Ekip",
  },
  rollen: { admin: "Yönetici", vorstand: "Yönetim kurulu", orga_team: "Organizasyon ekibi", checkin_helper: "Giriş görevlisi" },
  anmeldung: { confirmed: "kayıtlı", waitlist: "bekleme listesi", pending: "inceleniyor", excused: "mazeretli", cancelled: "kayıt iptal", rejected: "reddedildi" },
  rsvp: { zugesagt: "katılacak", abgesagt: "katılmayacak", offen: "cevap yok" },
  wort: {
    speichern: "Kaydet", abbrechen: "Vazgeç", loeschen: "Sil", bearbeiten: "Düzenle", zurueck: "Geri", hinzufuegen: "Ekle",
    senden: "Gönder", suchen: "Ara", filtern: "Filtrele", alle: "Tümü", keine: "Hiçbiri", ja: "Evet", nein: "Hayır", schliessen: "Kapat",
    oeffnen: "Aç", herunterladen: "İndir", hochladen: "Yükle", drucken: "Yazdır", bestaetigen: "Onayla",
    modul: "Modül", module: "Modüller", teilnehmende: "Katılımcılar", person: "Kişi", personen: "Kişi", datum: "Tarih", uhrzeit: "Saat",
    ort: "Yer", name: "Ad", vorname: "Ad", nachname: "Soyad", email: "E-posta", telefon: "Telefon", status: "Durum", notiz: "Not",
    anzahl: "Sayı", gesamt: "Toplam", heute: "Bugün", morgen: "Yarın", gestern: "Dün", tag: "Gün", tage: "Gün", titel: "Başlık",
    beschreibung: "Açıklama", optional: "isteğe bağlı", hotel: "Otel", zimmer: "Oda", region: "Bölge", generation: "Dönem",
  },
  meldung: {
    gespeichert: "Kaydedildi.", geloescht: "Silindi.", fehler: "Bu işlem olmadı.", eingabe: "Lütfen bilgileri kontrol et.",
    rechte: "Bunun için yetkin yok.", nichtGefunden: "Bulunamadı.",
  },
};

const fr: TeamTexte = {
  team: "Équipe",
  teamBereich: "Espace équipe",
  schnellzugriff: "Accès rapide",
  menue: "Menu",
  sprache: "Langue",
  passwort: "Mot de passe",
  abmelden: "Se déconnecter",
  gruppen: { eventtag: "Jour J", programm: "Programme", teilnehmende: "Participants", organisation: "Organisation" },
  bereiche: {
    start: "Aperçu", einlass: "Accueil", regieplan: "Déroulé", rollenplan: "Répartition des rôles", gruppen: "Groupes", module: "Modules",
    bewerbungen: "Candidatures", teilnehmende: "Participants", anrufe: "Appels", hausaufgaben: "Devoirs", mitglieder: "Membres",
    auswertung: "Analyse", import: "Importer", logistik: "Logistique", dokumente: "Documents", sitzungen: "Réunions", postfach: "Boîte mail",
    nachrichten: "Messages", freigaben: "Validations", loeschantraege: "Demandes de suppression", team: "Équipe",
  },
  rollen: { admin: "Admin", vorstand: "Bureau", orga_team: "Équipe d’organisation", checkin_helper: "Bénévole d’accueil" },
  anmeldung: { confirmed: "inscrit·e", waitlist: "liste d’attente", pending: "en cours d’examen", excused: "excusé·e", cancelled: "désinscrit·e", rejected: "refusé·e" },
  rsvp: { zugesagt: "vient", abgesagt: "ne vient pas", offen: "pas de réponse" },
  wort: {
    speichern: "Enregistrer", abbrechen: "Annuler", loeschen: "Supprimer", bearbeiten: "Modifier", zurueck: "Retour", hinzufuegen: "Ajouter",
    senden: "Envoyer", suchen: "Rechercher", filtern: "Filtrer", alle: "Tous", keine: "Aucun", ja: "Oui", nein: "Non", schliessen: "Fermer",
    oeffnen: "Ouvrir", herunterladen: "Télécharger", hochladen: "Importer", drucken: "Imprimer", bestaetigen: "Confirmer",
    modul: "Module", module: "Modules", teilnehmende: "Participants", person: "Personne", personen: "Personnes", datum: "Date", uhrzeit: "Heure",
    ort: "Lieu", name: "Nom", vorname: "Prénom", nachname: "Nom", email: "E-mail", telefon: "Téléphone", status: "Statut", notiz: "Note",
    anzahl: "Nombre", gesamt: "Total", heute: "Aujourd’hui", morgen: "Demain", gestern: "Hier", tag: "Jour", tage: "Jours", titel: "Titre",
    beschreibung: "Description", optional: "facultatif", hotel: "Hôtel", zimmer: "Chambre", region: "Région", generation: "Promotion",
  },
  meldung: {
    gespeichert: "Enregistré.", geloescht: "Supprimé.", fehler: "Cela n’a pas fonctionné.", eingabe: "Merci de vérifier les informations.",
    rechte: "Tu n’as pas les droits pour cela.", nichtGefunden: "Introuvable.",
  },
};

export const teamTexte: Record<TeamSprache, TeamTexte> = { de, tr, fr };
