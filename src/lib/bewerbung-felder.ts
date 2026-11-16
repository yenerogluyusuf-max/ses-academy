import type { TeamSprache } from "@/lib/team-sprache";

/**
 * Angaben aus dem Bewerbungsformular (Google-Formular, Fragen auf Türkisch) in lesbarer Reihenfolge und mit
 * Überschriften in der Sprache des Team-Bereichs. Die Antworten selbst bleiben, wie sie geschrieben wurden.
 * Schlüssel = Frage im Formular (applications.details).
 */
export const bewerbungsFelder: { frage: string; gruppe: "bildung" | "beruf" | "engagement" | "sonst"; name: Record<TeamSprache, string> }[] = [
  { frage: "En yüksek elde edilen eğitim durumu", gruppe: "bildung", name: { de: "Höchster Abschluss", tr: "En yüksek eğitim durumu", fr: "Diplôme le plus élevé" } },
  { frage: "Hangi alanda eğitim aldınız?", gruppe: "bildung", name: { de: "Fachrichtung", tr: "Eğitim alanı", fr: "Domaine d’études" } },
  { frage: "Mevcut eğitim durumunuz nedir?", gruppe: "bildung", name: { de: "Derzeit", tr: "Mevcut durum", fr: "Situation actuelle" } },
  { frage: "Şu anda hangi alanda eğitim alıyorsunuz?", gruppe: "bildung", name: { de: "Studiert / lernt gerade", tr: "Şu anki eğitim alanı", fr: "Études en cours" } },
  { frage: "Üniversite / Bölüm", gruppe: "bildung", name: { de: "Hochschule / Fach", tr: "Üniversite / bölüm", fr: "Université / filière" } },
  { frage: "Meslek / Pozisyon", gruppe: "beruf", name: { de: "Beruf / Position", tr: "Meslek / pozisyon", fr: "Profession / poste" } },
  { frage: "Çalıştığınız kurum / alan", gruppe: "beruf", name: { de: "Arbeitgeber / Bereich", tr: "Çalıştığı kurum / alan", fr: "Employeur / domaine" } },
  { frage: "Herhangi bir gönüllü veya toplumsal katkı faaliyetinde bulundunuz mu?", gruppe: "engagement", name: { de: "Ehrenamtlich aktiv", tr: "Gönüllü faaliyet", fr: "Engagement bénévole" } },
  { frage: "Hangi kurum veya alanlarda gönüllü çalışmalarınız var?", gruppe: "engagement", name: { de: "Ehrenamt in", tr: "Gönüllü olduğu alanlar", fr: "Bénévolat dans" } },
  { frage: "Yer aldığınız kurumların/cemiyetlerin adlarını yazınız:", gruppe: "engagement", name: { de: "Vereine / Organisationen", tr: "Kurum / cemiyetler", fr: "Associations / organisations" } },
  { frage: "Gönüllü olarak üstlendiğiniz görev(ler)i belirtiniz:", gruppe: "engagement", name: { de: "Aufgaben im Ehrenamt", tr: "Üstlendiği görevler", fr: "Missions bénévoles" } },
  { frage: "Eğer IGMG’de göreviniz olduysa lütfen bölgenizi belirtin:", gruppe: "engagement", name: { de: "IGMG-Region", tr: "IGMG bölgesi", fr: "Région IGMG" } },
  { frage: "Özel becerileriniz var mı?", gruppe: "sonst", name: { de: "Besondere Fähigkeiten (eigene Angabe)", tr: "Özel beceriler (kendi beyanı)", fr: "Compétences particulières (déclarées)" } },
  { frage: "Program organizasyon ekibine katılıp görev üstlenmek ister misiniz?", gruppe: "sonst", name: { de: "Mitarbeit im Orga-Team", tr: "Organizasyon ekibinde görev", fr: "Participation à l’équipe d’organisation" } },
  { frage: "Eklemek istediğiniz başka bir yorum veya bilgi varsa buraya yazabilirsiniz:", gruppe: "sonst", name: { de: "Weitere Anmerkungen", tr: "Ek notlar", fr: "Autres remarques" } },
];

export const bewerbungsGruppen: Record<TeamSprache, Record<(typeof bewerbungsFelder)[number]["gruppe"], string>> = {
  de: { bildung: "Ausbildung", beruf: "Beruf", engagement: "Engagement", sonst: "Sonstiges" },
  tr: { bildung: "Eğitim", beruf: "Meslek", engagement: "Gönüllülük", sonst: "Diğer" },
  fr: { bildung: "Formation", beruf: "Profession", engagement: "Engagement", sonst: "Autres" },
};

/** Leere bzw. nichtssagende Antworten („-“, „/“, „Yok“ …) ausblenden. */
export function aussagekraeftig(wert: unknown): wert is string {
  if (typeof wert !== "string") return false;
  const w = wert.trim();
  return w.length > 1 && !/^(yok|hayır|hayir|nein|keine?|no|none|-+|\/+|\.+)$/i.test(w);
}

/** Angaben einer Bewerbung als geordnete Liste [Überschrift, Antwort]. */
export function bewerbungsAngaben(details: unknown, sprache: TeamSprache) {
  const d = (details && typeof details === "object" ? details : {}) as Record<string, unknown>;
  return bewerbungsFelder
    .filter((f) => aussagekraeftig(d[f.frage]))
    .map((f) => ({ gruppe: f.gruppe, name: f.name[sprache], wert: (d[f.frage] as string).trim() }));
}

/** Alter heute aus der Altersangabe der Bewerbung (bzw. dem Geburtsjahr), auf ganze Jahre. */
export function alterHeute(b: { age: number | null; birth_year: number | null; created_at: string } | null | undefined, jetzt: number): number | null {
  if (!b) return null;
  const jahr = new Date(jetzt).getFullYear();
  if (b.birth_year) return jahr - b.birth_year;
  if (b.age) return b.age + (jahr - new Date(b.created_at).getFullYear());
  return null;
}
