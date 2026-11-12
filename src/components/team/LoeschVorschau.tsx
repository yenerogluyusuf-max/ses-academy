import type { TeamSprache } from "@/lib/team-sprache";

type Zahlen = Record<string, number | boolean>;

const de = {
  geloescht: [
    ["kontakte", "Anrufe und Kontakt-Notizen"], ["notizen", "Notizen des Teams"], ["uebernachtung", "Angaben zur Übernachtung (mit Hinweisen ans Team)"],
    ["zimmer", "Zimmer-Zuteilungen"], ["zimmerwuensche", "Zimmerwunsch-Zuordnungen"], ["beitraege", "verknüpfte Beiträge"],
    ["engagements", "Engagements"], ["bewerbungen", "Bewerbungen (mit Motivation)"], ["mails", "Mail-Protokoll: Adresse wird entfernt"],
  ] as [string, string][],
  anonymisiert: [
    ["anmeldungen", "Anmeldungen zu Modulen"], ["anwesenheiten", "Anwesenheiten (Check-ins)"], ["abgaben", "Hausaufgaben-Abgaben mit Bewertungen und Dateien"],
    ["entschuldigungen", "Entschuldigungen für Hausaufgaben"], ["feedback", "Feedback-Antworten"], ["gruppen", "Gruppen-Zuordnungen"], ["mitgliedschaften", "Mitgliedschaften (Generation)"],
  ] as [string, string][],
  wirdGeloescht: "Wird gelöscht",
  stammdaten: (foto: boolean) => `Name, E-Mail, Telefon, Geschlecht, Foto${foto ? " (vorhanden)" : ""}; Ticket und Links werden ungültig`,
  teamKonto: "Login-Konto: bleibt, weil es zugleich ein Team-Konto ist (unter „Team“ entfernen)",
  konto: "Login-Konto für „Mein Bereich“",
  keinKonto: "kein Login-Konto vorhanden",
  bleibt: "Bleibt ohne Namen („Gelöschte Person“) für die Auswertung",
  statistik: "Region, Generation, GT/KGT und Sorumlu bleiben für die Statistik.",
  zeile: (name: string, zahl: string) => `${name}: ${zahl}`,
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    geloescht: [
      ["kontakte", "Aramalar ve iletişim notları"], ["notizen", "Ekibin notları"], ["uebernachtung", "Konaklama bilgileri (ekibe notlarla birlikte)"],
      ["zimmer", "Oda atamaları"], ["zimmerwuensche", "Oda isteği eşleştirmeleri"], ["beitraege", "Bağlı katkılar"],
      ["engagements", "Faaliyetler"], ["bewerbungen", "Başvurular (motivasyon yazısıyla)"], ["mails", "E-posta kaydı: adres kaldırılır"],
    ],
    anonymisiert: [
      ["anmeldungen", "Modül kayıtları"], ["anwesenheiten", "Katılımlar (girişler)"], ["abgaben", "Değerlendirmeleri ve dosyalarıyla ödev teslimleri"],
      ["entschuldigungen", "Ödev mazeretleri"], ["feedback", "Geri bildirim cevapları"], ["gruppen", "Grup atamaları"], ["mitgliedschaften", "Üyelikler (dönem)"],
    ],
    wirdGeloescht: "Silinecek",
    stammdaten: (foto) => `Ad, e-posta, telefon, cinsiyet, fotoğraf${foto ? " (var)" : ""}; bilet ve bağlantılar geçersiz olur`,
    teamKonto: "Giriş hesabı: aynı zamanda ekip hesabı olduğu için kalır (“Ekip” bölümünden kaldır)",
    konto: "“Mein Bereich” için giriş hesabı",
    keinKonto: "giriş hesabı yok",
    bleibt: "Değerlendirme için adsız olarak (“Silinmiş kişi”) kalır",
    statistik: "Bölge, dönem, GT/KGT ve sorumlu istatistik için kalır.",
    zeile: (name, zahl) => `${name}: ${zahl}`,
  },
  fr: {
    geloescht: [
      ["kontakte", "Appels et notes de contact"], ["notizen", "Notes de l’équipe"], ["uebernachtung", "Informations d’hébergement (avec les remarques pour l’équipe)"],
      ["zimmer", "Attributions de chambre"], ["zimmerwuensche", "Souhaits de chambre associés"], ["beitraege", "Contributions liées"],
      ["engagements", "Engagements"], ["bewerbungen", "Candidatures (avec motivation)"], ["mails", "Journal des e-mails : l’adresse est supprimée"],
    ],
    anonymisiert: [
      ["anmeldungen", "Inscriptions aux modules"], ["anwesenheiten", "Présences (enregistrements à l’accueil)"], ["abgaben", "Devoirs rendus, avec évaluations et fichiers"],
      ["entschuldigungen", "Excuses pour les devoirs"], ["feedback", "Réponses aux retours"], ["gruppen", "Attributions de groupe"], ["mitgliedschaften", "Adhésions (promotion)"],
    ],
    wirdGeloescht: "Sera supprimé",
    stammdaten: (foto) => `Nom, e-mail, téléphone, genre, photo${foto ? " (présente)" : ""} ; le billet et les liens deviennent invalides`,
    teamKonto: "Compte de connexion : conservé, car c’est aussi un compte d’équipe (à supprimer sous « Équipe »)",
    konto: "Compte de connexion pour « Mein Bereich »",
    keinKonto: "aucun compte de connexion",
    bleibt: "Conservé sans nom (« Personne supprimée ») pour l’analyse",
    statistik: "Région, promotion, GT/KGT et Sorumlu restent pour les statistiques.",
    zeile: (name, zahl) => `${name} : ${zahl}`,
  },
};

/** Was eine Löschung bewirkt (aus deletion_counts): unter Löschanträge und in der Freigabe für die zweite Person. */
export function LoeschVorschau({ zahlen: z, sprache = "de" }: { zahlen: Zahlen; sprache?: TeamSprache }) {
  const t = T[sprache];
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <div>
        <p className="font-semibold text-rot">{t.wirdGeloescht}</p>
        <ul className="mt-1 space-y-0.5 text-sm">
          <li>{t.stammdaten(Boolean(z.foto))}</li>
          <li>{z.team_konto ? t.teamKonto : z.konto ? t.konto : t.keinKonto}</li>
          {t.geloescht.filter(([k]) => Number(z[k] ?? 0) > 0).map(([k, n]) => <li key={k}>{t.zeile(n, String(z[k]))}</li>)}
        </ul>
      </div>
      <div>
        <p className="font-semibold">{t.bleibt}</p>
        <ul className="mt-1 space-y-0.5 text-sm">
          {t.anonymisiert.filter(([k]) => Number(z[k] ?? 0) > 0).map(([k, n]) => <li key={k}>{t.zeile(n, String(z[k]))}</li>)}
          <li className="text-ink-soft">{t.statistik}</li>
        </ul>
      </div>
    </div>
  );
}
