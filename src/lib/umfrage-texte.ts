import type { BereichSprache } from "@/lib/bereich-texte";

/**
 * Texte für die Feedback-Umfrage im Stil des Google-Formulars (15.11.2026): Pflichtfragen, Skalen 1–10, Auswahl mit
 * „Sonstiges“ und der allgemeine Link /umfrage/ für die WhatsApp-Gruppe (Person per E-Mail erkannt).
 */
const de = {
  pflichtHinweis: "Fragen mit * sind Pflicht.",
  skalaEnden: (max: number) => `1 = sehr schlecht, ${max} = sehr gut`,
  sonstiges: "Sonstiges",
  sonstigesFeld: "Bitte kurz beschreiben",
  fehlt: "Bitte beantworte alle Pflichtfragen (mit *).",
  schonBeantwortet: "Du hast schon teilgenommen, danke! Die Umfrage ist anonym, deshalb lässt sich eine abgeschickte Antwort nicht mehr ansehen oder ändern.",
  hallo: (name: string) => `Hallo ${name}, danke, dass du dabei warst.`,
  anonym: "Die Umfrage ist anonym: Wir speichern nur, dass du teilgenommen hast, nicht welche Antworten von dir sind. Nach dem Absenden kannst du sie deshalb nicht mehr ändern.",
  danke: "Danke! Deine Antwort ist anonym gespeichert.",
  zurueck: "Zurück zu meinem Konto",
  eintrittTitel: "Feedback",
  eintrittText: "Gib die E-Mail-Adresse ein, mit der du angemeldet bist. Danach siehst du die Umfrage.",
  eintrittFeld: "E-Mail-Adresse",
  eintrittWeiter: "Weiter",
  eintrittUnbekannt: "Diese E-Mail-Adresse kennen wir nicht. Nimm bitte die Adresse, an die deine Einladung und dein Ticket gingen.",
  eintrittKeineUmfrage: "Gerade ist keine Umfrage offen.",
  eintrittBald: (uhr: string) => `Die Umfrage öffnet um ${uhr} Uhr. Du kannst die E-Mail-Adresse aber schon eingeben.`,
};

const tr: typeof de = {
  pflichtHinweis: "* işaretli sorular zorunludur.",
  skalaEnden: (max: number) => `1 = çok kötü, ${max} = çok iyi`,
  sonstiges: "Diğer",
  sonstigesFeld: "Kısaca yaz",
  fehlt: "Lütfen tüm zorunlu soruları (* işaretli) cevapla.",
  schonBeantwortet: "Ankete zaten katıldın, teşekkürler! Anket anonim olduğu için gönderilen cevaplar sonradan görüntülenemez veya değiştirilemez.",
  hallo: (name: string) => `Merhaba ${name}, katıldığın için teşekkürler.`,
  anonym: "Anket anonimdir: Sadece katıldığını kaydediyoruz, hangi cevapların sana ait olduğunu değil. Bu yüzden gönderdikten sonra cevaplarını değiştiremezsin.",
  danke: "Teşekkürler! Cevabın anonim olarak kaydedildi.",
  zurueck: "Hesabıma dön",
  eintrittTitel: "Değerlendirme",
  eintrittText: "Kayıt olduğun e-posta adresini gir. Ardından anketi göreceksin.",
  eintrittFeld: "E-posta adresi",
  eintrittWeiter: "Devam",
  eintrittUnbekannt: "Bu e-posta adresini tanımıyoruz. Lütfen davetiyenin ve biletinin gönderildiği adresi kullan.",
  eintrittKeineUmfrage: "Şu anda açık bir anket yok.",
  eintrittBald: (uhr: string) => `Anket saat ${uhr}’da açılıyor. E-posta adresini şimdiden girebilirsin.`,
};

const fr: typeof de = {
  pflichtHinweis: "Les questions marquées d’un * sont obligatoires.",
  skalaEnden: (max: number) => `1 = très mauvais, ${max} = très bien`,
  sonstiges: "Autre",
  sonstigesFeld: "Précise brièvement",
  fehlt: "Merci de répondre à toutes les questions obligatoires (*).",
  schonBeantwortet: "Tu as déjà participé, merci ! Le questionnaire est anonyme : une réponse envoyée ne peut plus être consultée ni modifiée.",
  hallo: (name: string) => `Bonjour ${name}, merci d’avoir participé.`,
  anonym: "Le questionnaire est anonyme : nous enregistrons seulement que tu as participé, pas quelles réponses sont les tiennes. Tu ne pourras donc plus les modifier après l’envoi.",
  danke: "Merci ! Ta réponse a été enregistrée de façon anonyme.",
  zurueck: "Retour à mon compte",
  eintrittTitel: "Retours",
  eintrittText: "Saisis l’adresse e-mail que tu as utilisée pour l’inscription. Ensuite, tu verras le questionnaire.",
  eintrittFeld: "Adresse e-mail",
  eintrittWeiter: "Continuer",
  eintrittUnbekannt: "Nous ne connaissons pas cette adresse e-mail. Utilise l’adresse à laquelle tu as reçu ton invitation et ton billet.",
  eintrittKeineUmfrage: "Aucun questionnaire n’est ouvert pour le moment.",
  eintrittBald: (uhr: string) => `Le questionnaire ouvre à ${uhr}. Tu peux déjà saisir ton adresse e-mail.`,
};

export const umfrageTexte: Record<BereichSprache, typeof de> = { de, tr, fr };
