import Link from "next/link";
import type { VersandEintrag } from "@/lib/versandprotokoll";
import { teamLocale, type TeamSprache } from "@/lib/team-sprache";

const de = {
  titel: "Von der App verschickt",
  erklaerung: "Info-Mails, Tickets und andere Mails verschickt die App direkt. Eine Kopie liegt nicht im Postfach, deshalb steht hier das Protokoll.",
  suche: "Name oder Adresse",
  suchen: "Suchen",
  alle: "Alle zeigen",
  leer: "Keine verschickten Mails gefunden.",
  an: "An",
  art: "Mail",
  wann: "Wann",
  ergebnis: "Ergebnis",
  ok: "verschickt",
  fehler: "fehlgeschlagen",
  ansehen: "ansehen",
  ansehenTitel: "Vorschau dieser Info-Mail mit dem heutigen Stand",
  mitTicket: "mit Ticket",
  arten: {
    info: "Info-Mail", ticket: "Ticket", absage: "Absage des Moduls", abmeldung: "Abmeldebestätigung", application_received: "Bewerbung erhalten",
    feedback: "Feedback-Einladung", submission_received: "Abgabe erhalten", team_willkommen: "Teamkonto", zimmerliste: "Zimmerliste ans Hotel",
  } as Record<string, string>,
  mehr: (n: number) => `Gezeigt werden die neuesten ${n}.`,
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    titel: "Uygulamanın gönderdikleri",
    erklaerung: "Bilgilendirme e-postalarını, biletleri ve diğer e-postaları uygulama doğrudan gönderir. Posta kutusunda kopyası olmadığı için burada gönderim kaydı görünür.",
    suche: "Ad veya adres",
    suchen: "Ara",
    alle: "Tümünü göster",
    leer: "Gönderilmiş e-posta bulunamadı.",
    an: "Alıcı",
    art: "E-posta",
    wann: "Zaman",
    ergebnis: "Sonuç",
    ok: "gönderildi",
    fehler: "gönderilemedi",
    ansehen: "görüntüle",
    ansehenTitel: "Bu bilgi e-postasının bugünkü hâliyle önizlemesi",
    mitTicket: "biletle",
    arten: {
      info: "Bilgi e-postası", ticket: "Bilet", absage: "Modül iptali", abmeldung: "Kayıt iptali onayı", application_received: "Başvuru alındı",
      feedback: "Geri bildirim daveti", submission_received: "Ödev teslim alındı", team_willkommen: "Ekip hesabı", zimmerliste: "Otele oda listesi",
    },
    mehr: (n) => `En yeni ${n} kayıt gösteriliyor.`,
  },
  fr: {
    titel: "Envoyés par l’application",
    erklaerung: "L’application envoie directement les e-mails d’information, les billets et les autres e-mails. Aucune copie n’est rangée dans la boîte mail : voici donc le journal d’envoi.",
    suche: "Nom ou adresse",
    suchen: "Rechercher",
    alle: "Tout afficher",
    leer: "Aucun e-mail envoyé trouvé.",
    an: "À",
    art: "E-mail",
    wann: "Quand",
    ergebnis: "Résultat",
    ok: "envoyé",
    fehler: "échec",
    ansehen: "voir",
    ansehenTitel: "Aperçu de cet e-mail d’information avec les données actuelles",
    mitTicket: "avec billet",
    arten: {
      info: "E-mail d’information", ticket: "Billet", absage: "Annulation du module", abmeldung: "Confirmation de désinscription", application_received: "Candidature reçue",
      feedback: "Invitation à donner son avis", submission_received: "Devoir reçu", team_willkommen: "Compte d’équipe", zimmerliste: "Liste des chambres pour l’hôtel",
    },
    mehr: (n) => `Les ${n} plus récents sont affichés.`,
  },
};

/**
 * Protokoll der von der App verschickten Mails im Ordner „Gesendet“ des Postfachs. Info-Mails lassen sich über die
 * Vorschau im Modul ansehen (nur mit Recht „alles“, wie die Vorschau selbst).
 */
export function Versandprotokoll({ eintraege, sprache, suche, vorschau, grenze }: {
  eintraege: VersandEintrag[]; sprache: TeamSprache; suche: string; vorschau: boolean; grenze: number;
}) {
  const t = T[sprache];
  const zeit = new Intl.DateTimeFormat(teamLocale[sprache], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
  return (
    <section className="mt-6">
      <h2 className="font-display text-xl font-bold">{t.titel}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t.erklaerung}</p>
      <form method="get" className="mt-3 flex flex-wrap gap-2">
        <input type="hidden" name="ordner" value="gesendet" />
        <label htmlFor="suche" className="sr-only">{t.suche}</label>
        <input id="suche" name="suche" defaultValue={suche} placeholder={t.suche} className="feld max-w-xs" />
        <button type="submit" className="knopf-hell">{t.suchen}</button>
        {suche && <Link href="/team/postfach/?ordner=gesendet" className="self-center text-sm font-semibold text-ink-soft hover:text-ink">{t.alle}</Link>}
      </form>
      {eintraege.length === 0 ? (
        <p className="karte mt-4 text-ink-soft">{t.leer}</p>
      ) : (
        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-3xl bg-weiss ring-1 ring-ink/[0.06]">
          {eintraege.map((e) => (
            <li key={e.id} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 px-4 py-3 sm:px-5">
              <span className="truncate font-semibold">
                {e.name ?? e.an}
                {e.name && <span className="font-normal text-ink-soft"> · {e.an}</span>}
              </span>
              <span className="text-sm whitespace-nowrap text-ink-soft">{zeit.format(new Date(e.zeit))}</span>
              <span className="flex flex-wrap items-center gap-x-2 text-sm text-ink-soft">
                <span>{t.arten[e.art] ?? e.art}{e.mitTicket ? ` (${t.mitTicket})` : ""}{e.modulTitel ? ` · ${e.modulTitel}` : ""}</span>
                {vorschau && e.art === "info" && e.modulId && e.personId && (
                  <Link href={`/team/module/${e.modulId}/infomail/?person=${e.personId}`} title={t.ansehenTitel} className="font-semibold text-ink underline underline-offset-2">{t.ansehen}</Link>
                )}
              </span>
              <span className={`chip self-start justify-self-end ${e.status === "sent" ? "bg-gruen-hell" : "bg-rot-hell text-rot"}`} title={e.fehler ?? undefined}>
                {e.status === "sent" ? t.ok : t.fehler}
              </span>
              {e.status === "failed" && e.fehler && <span className="col-span-2 text-xs text-rot [overflow-wrap:anywhere]">{e.fehler}</span>}
            </li>
          ))}
        </ul>
      )}
      {eintraege.length >= grenze && <p className="mt-2 text-sm text-ink-soft">{t.mehr(grenze)}</p>}
    </section>
  );
}
