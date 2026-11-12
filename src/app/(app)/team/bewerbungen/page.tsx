import type { Metadata } from "next";
import Link from "next/link";
import { TeamKopf } from "@/components/team/TeamKopf";
import { MailHinweis } from "@/components/team/MailHinweis";
import { Rueckfrage } from "@/components/team/Rueckfrage";
import { annehmen, statusSetzen, ticketErneutSenden } from "@/lib/aktionen/bewerbungen";
import { requireStaff } from "@/lib/auth";
import { bewerbungStatusBetreff, mailBereit } from "@/lib/mail";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { teamLocale, type TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";

export const metadata: Metadata = { title: "Bewerbungen | SES Academy" };

type Status = Database["public"]["Enums"]["application_status"];

type Hinweise = Record<string, { text: string; gut: boolean }>;

const de = {
  statusName: {
    eingegangen: "Eingegangen",
    in_pruefung: "In Prüfung",
    angenommen: "Angenommen",
    warteliste: "Warteliste",
    abgelehnt: "Abgelehnt",
    zurueckgezogen: "Zurückgezogen",
  } as Record<Status, string>,
  hinweise: {
    angenommen: { text: "Angenommen. Die Person ist für alle kommenden Module angemeldet, das Ticket ist verschickt.", gut: true },
    "angenommen-ohne-mail": { text: "Angenommen, aber die Ticket-Mail konnte nicht gesendet werden. Bitte „Ticket erneut senden“ versuchen.", gut: false },
    "annahme-fehler": { text: "Die Annahme hat nicht geklappt. Bitte erneut versuchen.", gut: false },
    gespeichert: { text: "Status gespeichert.", gut: true },
    "abgelehnt-mail": { text: "Abgelehnt. Die Person hat eine Mail bekommen (in der Sprache ihrer Bewerbung).", gut: true },
    "warteliste-mail": { text: "Auf die Warteliste gesetzt. Die Person hat eine Mail bekommen (in der Sprache ihrer Bewerbung).", gut: true },
    "status-mail-aus": { text: "Status gespeichert. Es ist keine Mail rausgegangen: Der Mailversand ist noch nicht eingerichtet. Bitte die Person anders informieren.", gut: false },
    "status-mail-fehler": { text: "Status gespeichert, aber die Mail konnte nicht gesendet werden. Bitte die Person anders informieren.", gut: false },
    bestaetigen: { text: "Bitte die Rückfrage bestätigen. Es wurde nichts geändert.", gut: false },
    "ticket-gesendet": { text: "Ticket-Mail erneut gesendet.", gut: true },
    "mail-fehler": { text: "Die Mail konnte nicht gesendet werden. Stimmen die SMTP-Einstellungen?", gut: false },
    fehler: { text: "Das hat nicht geklappt.", gut: false },
  } as Hinweise,
  keinJahrgang: "Kein aktueller Jahrgang angelegt",
  filter: "Filter",
  offen: "Offen",
  alter: (n: number) => ` · ${n} Jahre`,
  geburtsjahr: (j: number) => ` · Jahrgang ${j}`,
  sprachen: "Sprachen:",
  keineAngabe: "keine Angabe",
  eingegangenAm: (d: string) => `eingegangen am ${d}`,
  ueber: (q: string) => ` · über ${q}`,
  motivation: "Motivation und weitere Angaben",
  annehmenKnopf: "Annehmen und Ticket senden",
  annehmenFrage: (name: string, email: string) => `${name} annehmen? Die Person wird für alle kommenden Module des Jahrgangs angemeldet und bekommt ihr Ticket an ${email}.`,
  annehmenJa: "Ja, annehmen",
  ticketGehtNicht: "Mailversand ist nicht eingerichtet: Das Ticket geht im Moment nicht raus.",
  ablehnen: "Ablehnen",
  warteliste: "Warteliste",
  ablehnenFrage: (name: string) => `Bewerbung von ${name} ablehnen?`,
  wartelisteFrage: (name: string) => `${name} auf die Warteliste setzen?`,
  ablehnenJa: "Ja, ablehnen",
  wartelisteJa: "Ja, auf die Warteliste",
  mailSenden: (email: string, tuerkisch: boolean, betreff: string) => `Mail an ${email} senden, auf ${tuerkisch ? "Türkisch" : "Deutsch"}: „${betreff}“`,
  keineMail: "Mailversand ist nicht eingerichtet: Die Person bekommt keine Mail. Bitte anders informieren.",
  ticketErneut: "Ticket erneut senden",
  leer: "Keine Bewerbungen in dieser Ansicht.",
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    statusName: {
      eingegangen: "Gelen",
      in_pruefung: "İnceleniyor",
      angenommen: "Kabul edildi",
      warteliste: "Bekleme listesi",
      abgelehnt: "Reddedildi",
      zurueckgezogen: "Geri çekildi",
    },
    hinweise: {
      angenommen: { text: "Kabul edildi. Kişi gelecek tüm modüllere kaydedildi, bilet gönderildi.", gut: true },
      "angenommen-ohne-mail": { text: "Kabul edildi, ama bilet e-postası gönderilemedi. Lütfen “Bileti tekrar gönder”i dene.", gut: false },
      "annahme-fehler": { text: "Kabul işlemi olmadı. Lütfen tekrar dene.", gut: false },
      gespeichert: { text: "Durum kaydedildi.", gut: true },
      "abgelehnt-mail": { text: "Reddedildi. Kişiye bir e-posta gitti (başvurusunun dilinde).", gut: true },
      "warteliste-mail": { text: "Bekleme listesine alındı. Kişiye bir e-posta gitti (başvurusunun dilinde).", gut: true },
      "status-mail-aus": { text: "Durum kaydedildi. E-posta gitmedi: E-posta gönderimi henüz kurulmadı. Lütfen kişiyi başka bir yolla bilgilendir.", gut: false },
      "status-mail-fehler": { text: "Durum kaydedildi, ama e-posta gönderilemedi. Lütfen kişiyi başka bir yolla bilgilendir.", gut: false },
      bestaetigen: { text: "Lütfen işlemi onayla. Hiçbir şey değiştirilmedi.", gut: false },
      "ticket-gesendet": { text: "Bilet e-postası tekrar gönderildi.", gut: true },
      "mail-fehler": { text: "E-posta gönderilemedi. SMTP ayarları doğru mu?", gut: false },
      fehler: { text: teamTexte.tr.meldung.fehler, gut: false },
    },
    keinJahrgang: "Güncel dönem oluşturulmamış",
    filter: "Filtre",
    offen: "Açık",
    alter: (n) => ` · ${n} yaşında`,
    geburtsjahr: (j) => ` · ${j} doğumlu`,
    sprachen: "Diller:",
    keineAngabe: "belirtilmemiş",
    eingegangenAm: (d) => `geliş tarihi ${d}`,
    ueber: (q) => ` · kaynak: ${q}`,
    motivation: "Motivasyon ve diğer bilgiler",
    annehmenKnopf: "Kabul et ve bileti gönder",
    annehmenFrage: (name, email) => `${name} kabul edilsin mi? Kişi dönemin gelecek tüm modüllerine kaydedilecek ve biletini ${email} adresine alacak.`,
    annehmenJa: "Evet, kabul et",
    ticketGehtNicht: "E-posta gönderimi kurulmadı: Bilet şu anda gönderilemiyor.",
    ablehnen: "Reddet",
    warteliste: "Bekleme listesi",
    ablehnenFrage: (name) => `${name} adlı kişinin başvurusu reddedilsin mi?`,
    wartelisteFrage: (name) => `${name} bekleme listesine alınsın mı?`,
    ablehnenJa: "Evet, reddet",
    wartelisteJa: "Evet, bekleme listesine al",
    mailSenden: (email, tuerkisch, betreff) => `${email} adresine ${tuerkisch ? "Türkçe" : "Almanca"} e-posta gönder: “${betreff}”`,
    keineMail: "E-posta gönderimi kurulmadı: Kişiye e-posta gitmeyecek. Lütfen başka bir yolla bilgilendir.",
    ticketErneut: "Bileti tekrar gönder",
    leer: "Bu görünümde başvuru yok.",
  },
  fr: {
    statusName: {
      eingegangen: "Reçue",
      in_pruefung: "En cours d’examen",
      angenommen: "Acceptée",
      warteliste: "Liste d’attente",
      abgelehnt: "Refusée",
      zurueckgezogen: "Retirée",
    },
    hinweise: {
      angenommen: { text: "Acceptée. La personne est inscrite à tous les prochains modules, le billet est envoyé.", gut: true },
      "angenommen-ohne-mail": { text: "Acceptée, mais l’e-mail avec le billet n’a pas pu être envoyé. Essaie «\u00a0Renvoyer le billet\u00a0».", gut: false },
      "annahme-fehler": { text: "L’acceptation n’a pas fonctionné. Merci de réessayer.", gut: false },
      gespeichert: { text: "Statut enregistré.", gut: true },
      "abgelehnt-mail": { text: "Refusée. La personne a reçu un e-mail (dans la langue de sa candidature).", gut: true },
      "warteliste-mail": { text: "Mise sur liste d’attente. La personne a reçu un e-mail (dans la langue de sa candidature).", gut: true },
      "status-mail-aus": { text: "Statut enregistré. Aucun e-mail n’est parti\u00a0: l’envoi d’e-mails n’est pas encore configuré. Merci d’informer la personne autrement.", gut: false },
      "status-mail-fehler": { text: "Statut enregistré, mais l’e-mail n’a pas pu être envoyé. Merci d’informer la personne autrement.", gut: false },
      bestaetigen: { text: "Merci de confirmer d’abord. Rien n’a été modifié.", gut: false },
      "ticket-gesendet": { text: "E-mail avec le billet renvoyé.", gut: true },
      "mail-fehler": { text: "L’e-mail n’a pas pu être envoyé. Les paramètres SMTP sont-ils corrects\u00a0?", gut: false },
      fehler: { text: teamTexte.fr.meldung.fehler, gut: false },
    },
    keinJahrgang: "Aucune promotion en cours n’a été créée",
    filter: "Filtre",
    offen: "À traiter",
    alter: (n) => ` · ${n}\u00a0ans`,
    geburtsjahr: (j) => ` · né·e en ${j}`,
    sprachen: "Langues\u00a0:",
    keineAngabe: "non renseigné",
    eingegangenAm: (d) => `reçue le ${d}`,
    ueber: (q) => ` · via ${q}`,
    motivation: "Motivation et autres informations",
    annehmenKnopf: "Accepter et envoyer le billet",
    annehmenFrage: (name, email) => `Accepter ${name}\u00a0? La personne sera inscrite à tous les prochains modules de la promotion et recevra son billet à ${email}.`,
    annehmenJa: "Oui, accepter",
    ticketGehtNicht: "L’envoi d’e-mails n’est pas configuré\u00a0: le billet ne part pas pour le moment.",
    ablehnen: "Refuser",
    warteliste: "Liste d’attente",
    ablehnenFrage: (name) => `Refuser la candidature de ${name}\u00a0?`,
    wartelisteFrage: (name) => `Mettre ${name} sur liste d’attente\u00a0?`,
    ablehnenJa: "Oui, refuser",
    wartelisteJa: "Oui, sur liste d’attente",
    mailSenden: (email, tuerkisch, betreff) => `Envoyer un e-mail à ${email}, en ${tuerkisch ? "turc" : "allemand"}\u00a0: «\u00a0${betreff}\u00a0»`,
    keineMail: "L’envoi d’e-mails n’est pas configuré\u00a0: la personne ne recevra pas d’e-mail. Merci de l’informer autrement.",
    ticketErneut: "Renvoyer le billet",
    leer: "Aucune candidature dans cette vue.",
  },
};

const filterListe: (Status | "offen")[] = ["offen", "angenommen", "warteliste", "abgelehnt"];

export default async function BewerbungenSeite({ searchParams }: PageProps<"/team/bewerbungen">) {
  const staff = await requireStaff("alles");
  const l = staff.sprache;
  const t = T[l];
  const { status: filterRoh, hinweis } = await searchParams;
  const filter = (filterListe as string[]).includes(String(filterRoh)) ? (filterRoh as Status | "offen") : "offen";
  const supabase = await createClient();

  const { data: jahrgang } = await supabase.from("cohorts").select("id, name").eq("is_current", true).maybeSingle();
  let query = supabase.from("applications").select("*").order("created_at", { ascending: true });
  if (jahrgang) query = query.eq("cohort_id", jahrgang.id);
  query = filter === "offen" ? query.in("status", ["eingegangen", "in_pruefung"]) : query.eq("status", filter);
  // Zähler an den Reitern (nur Status, keine Inhalte)
  let zaehlAbfrage = supabase.from("applications").select("status");
  if (jahrgang) zaehlAbfrage = zaehlAbfrage.eq("cohort_id", jahrgang.id);
  const [{ data: bewerbungen }, { data: alleStatus }] = await Promise.all([query, zaehlAbfrage]);
  const anzahl = (f: Status | "offen") => (alleStatus ?? []).filter((b) => (f === "offen" ? b.status === "eingegangen" || b.status === "in_pruefung" : b.status === f)).length;
  const h = hinweis ? t.hinweise[String(hinweis)] : null;

  const bereit = mailBereit();
  const knopf = "rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-line bg-white hover:bg-paper-deep";

  return (
    <>
      <TeamKopf staff={staff} aktiv="bewerbungen" />
      <main lang={l} className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="font-display text-3xl font-bold">{teamTexte[l].bereiche.bewerbungen}</h1>
        <p className="mt-1 text-ink-soft">{jahrgang?.name ?? t.keinJahrgang}</p>

        {h && <p role="status" className={`mt-4 rounded-2xl p-4 ${h.gut ? "bg-emerald-100 text-emerald-950" : "bg-amber-100 text-amber-950"}`}>{h.text}</p>}

        <MailHinweis className="mt-4" sprache={l} />

        <nav className="mt-6 flex flex-wrap gap-2" aria-label={t.filter}>
          {filterListe.map((f) => (
            <Link key={f} href={`/team/bewerbungen/?status=${f}`}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${f === filter ? "bg-ink text-paper" : "bg-white ring-1 ring-line"}`}>
              {f === "offen" ? t.offen : t.statusName[f]} <span className={f === filter ? "opacity-75" : "text-ink-soft"}>{anzahl(f)}</span>
            </Link>
          ))}
        </nav>

        <ul className="mt-6 grid gap-4">
          {(bewerbungen ?? []).map((b) => (
            <li key={b.id} className="rounded-3xl bg-white/80 p-5 ring-1 ring-line">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-xl font-bold">{b.first_name} {b.last_name}</p>
                  <p className="text-sm text-ink-soft">
                    {b.email}{b.phone ? ` · ${b.phone}` : ""}{[b.city, b.country].filter(Boolean).length ? ` · ${[b.city, b.country].filter(Boolean).join(", ")}` : ""}{b.age ? t.alter(b.age) : b.birth_year ? t.geburtsjahr(b.birth_year) : ""}
                  </p>
                  <p className="text-sm text-ink-soft">
                    {t.sprachen} {b.languages.join(", ") || t.keineAngabe} · {t.eingegangenAm(new Date(b.created_at).toLocaleDateString(teamLocale[l], { timeZone: "Europe/Berlin" }))}
                    {b.source ? t.ueber(b.source) : ""}
                  </p>
                </div>
                <span className="rounded-full bg-paper-deep px-3 py-1 text-sm font-semibold">{t.statusName[b.status]}</span>
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold">{t.motivation}</summary>
                <p className="mt-2 whitespace-pre-line">{b.motivation}</p>
                {Object.keys(b.details ?? {}).length > 0 && (
                  <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[minmax(0,14rem)_1fr]">
                    {Object.entries(b.details as Record<string, string>).filter(([, v]) => v).map(([k, v]) => (
                      <div key={k} className="contents"><dt className="text-ink-soft">{k}</dt><dd className="whitespace-pre-line">{v}</dd></div>
                    ))}
                  </dl>
                )}
              </details>
              <div className="mt-4 flex flex-wrap gap-2">
                {b.status !== "angenommen" ? (
                  <>
                    <form action={annehmen} className="contents">
                      <input type="hidden" name="id" value={b.id} /><input type="hidden" name="filter" value={filter} />
                      <Rueckfrage knopf={t.annehmenKnopf} knopfKlasse="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper hover:bg-forest"
                        frage={t.annehmenFrage(`${b.first_name} ${b.last_name}`, b.email)}
                        ja={t.annehmenJa} sprache={l}>
                        {!bereit && <p className="font-semibold text-rot">{t.ticketGehtNicht}</p>}
                      </Rueckfrage>
                    </form>
                    {b.status !== "in_pruefung" && (
                      <form action={statusSetzen}>
                        <input type="hidden" name="id" value={b.id} /><input type="hidden" name="status" value="in_pruefung" /><input type="hidden" name="filter" value={filter} />
                        <button type="submit" className={knopf}>{t.statusName.in_pruefung}</button>
                      </form>
                    )}
                    {(["warteliste", "abgelehnt"] as const).filter((s) => s !== b.status).map((s) => (
                      <form key={s} action={statusSetzen} className="contents">
                        <input type="hidden" name="id" value={b.id} /><input type="hidden" name="status" value={s} /><input type="hidden" name="filter" value={filter} />
                        <Rueckfrage knopf={s === "abgelehnt" ? t.ablehnen : t.warteliste} knopfKlasse={knopf} gefahr={s === "abgelehnt"} sprache={l}
                          frage={s === "abgelehnt" ? t.ablehnenFrage(`${b.first_name} ${b.last_name}`) : t.wartelisteFrage(`${b.first_name} ${b.last_name}`)}
                          ja={s === "abgelehnt" ? t.ablehnenJa : t.wartelisteJa}>
                          {bereit ? (
                            <label className="flex gap-2">
                              <input type="checkbox" name="mail" value="ja" defaultChecked className="mt-0.5" />
                              <span>{t.mailSenden(b.email, b.language === "tr", bewerbungStatusBetreff(s, b.language))}</span>
                            </label>
                          ) : (
                            <p className="font-semibold text-rot">{t.keineMail}</p>
                          )}
                        </Rueckfrage>
                      </form>
                    ))}
                  </>
                ) : b.participant_id ? (
                  <form action={ticketErneutSenden}>
                    <input type="hidden" name="participant_id" value={b.participant_id} /><input type="hidden" name="filter" value={filter} />
                    <button type="submit" className={knopf}>{t.ticketErneut}</button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        {(bewerbungen ?? []).length === 0 && <p className="mt-6 text-ink-soft">{t.leer}</p>}
      </main>
    </>
  );
}
