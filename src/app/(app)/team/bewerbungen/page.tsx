import type { Metadata } from "next";
import Link from "next/link";
import { TeamKopf } from "@/components/team/TeamKopf";
import { MailHinweis } from "@/components/team/MailHinweis";
import { Rueckfrage } from "@/components/team/Rueckfrage";
import { annehmen, mitTeilnehmendenAbgleichen, statusSetzen, ticketErneutSenden } from "@/lib/aktionen/bewerbungen";
import { bewerbungsAngaben } from "@/lib/bewerbung-felder";
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

const filterListe: (Status | "offen")[] = ["offen", "angenommen", "warteliste", "abgelehnt", "zurueckgezogen"];

/** Texte nach dem Umbau 16.11.2026. */
const U = {
  de: {
    gesamt: (n: number) => `${n} Bewerbungen`,
    unstimmig: (offen: number, abgelehnt: number) => `${offen ? `${offen} offene` : ""}${offen && abgelehnt ? " und " : ""}${abgelehnt ? `${abgelehnt} abgelehnte` : ""} Bewerbungen gehören zu Personen, die bereits teilnehmen.`,
    unstimmigText: "Der Abgleich setzt bei diesen Personen die neueste Bewerbung auf „angenommen“ und verknüpft Bewerbungen mit gleicher E-Mail-Adresse. Es gehen keine Mails raus.",
    abgleichen: "Mit Teilnehmendenliste abgleichen", abgleichFrage: "Bewerbungen jetzt mit der Teilnehmendenliste abgleichen?", abgleichJa: "Ja, abgleichen",
    abgleichFertig: (a: number, v: number) => `Abgleich fertig: ${a} Bewerbungen auf „angenommen“ gesetzt, ${v} mit einer Person verknüpft.`,
    nimmtTeil: "nimmt bereits teil", tage: (da: number, alle: number) => `${da}/${alle} Tage da`, nieDa: "noch nie da", nichtInListe: "nicht in der Teilnehmendenliste",
    ausgeschieden: "ausgeschieden", profil: "Profil", angaben: "Alle Angaben", motivation: "Motivation", sprachen: "Sprachen",
    angenommenText: "Hier steht, ob angenommene Personen auch wirklich kommen.",
  },
  tr: {
    gesamt: (n: number) => `${n} başvuru`,
    unstimmig: (offen: number, abgelehnt: number) => `${offen ? `${offen} açık` : ""}${offen && abgelehnt ? " ve " : ""}${abgelehnt ? `${abgelehnt} reddedilmiş` : ""} başvuru, zaten katılan kişilere ait.`,
    unstimmigText: "Eşleştirme bu kişilerin en yeni başvurusunu „kabul edildi“ yapar ve aynı e-posta adresli başvuruları kişiye bağlar. E-posta gönderilmez.",
    abgleichen: "Katılımcı listesiyle eşleştir", abgleichFrage: "Başvurular şimdi katılımcı listesiyle eşleştirilsin mi?", abgleichJa: "Evet, eşleştir",
    abgleichFertig: (a: number, v: number) => `Eşleştirme tamam: ${a} başvuru „kabul edildi“ yapıldı, ${v} başvuru bir kişiye bağlandı.`,
    nimmtTeil: "zaten katılıyor", tage: (da: number, alle: number) => `${alle} günden ${da} gün katıldı`, nieDa: "hiç gelmedi", nichtInListe: "katılımcı listesinde yok",
    ausgeschieden: "ayrıldı", profil: "Profil", angaben: "Tüm bilgiler", motivation: "Motivasyon", sprachen: "Diller",
    angenommenText: "Kabul edilenlerin gerçekten gelip gelmediği burada görünür.",
  },
  fr: {
    gesamt: (n: number) => `${n} candidatures`,
    unstimmig: (offen: number, abgelehnt: number) => `${offen ? `${offen} candidatures ouvertes` : ""}${offen && abgelehnt ? " et " : ""}${abgelehnt ? `${abgelehnt} refusées` : ""} concernent des personnes qui participent déjà.`,
    unstimmigText: "Le rapprochement passe la candidature la plus récente de ces personnes à « acceptée » et relie les candidatures ayant la même adresse e-mail. Aucun e-mail n’est envoyé.",
    abgleichen: "Rapprocher avec la liste des participants", abgleichFrage: "Rapprocher maintenant les candidatures avec la liste des participants ?", abgleichJa: "Oui, rapprocher",
    abgleichFertig: (a: number, v: number) => `Rapprochement terminé : ${a} candidatures passées à « acceptée », ${v} reliées à une personne.`,
    nimmtTeil: "participe déjà", tage: (da: number, alle: number) => `${da}/${alle} jours présents`, nieDa: "jamais venu·e", nichtInListe: "absent·e de la liste des participants",
    ausgeschieden: "a quitté", profil: "Profil", angaben: "Toutes les informations", motivation: "Motivation", sprachen: "Langues",
    angenommenText: "Ici on voit si les personnes acceptées viennent vraiment.",
  },
} satisfies Record<TeamSprache, unknown>;

/**
 * Bewerbungen (Umbau 16.11.2026): kompakte Zeilen statt großer Karten, alle Angaben eingeklappt und lesbar beschriftet.
 * Abgleich mit der Teilnehmendenliste, wenn offene oder abgelehnte Bewerbungen zu Personen gehören, die schon teilnehmen.
 * Bei „Angenommen“ steht, ob die Person tatsächlich kommt.
 */
export default async function BewerbungenSeite({ searchParams }: PageProps<"/team/bewerbungen">) {
  const staff = await requireStaff("alles");
  const l = staff.sprache;
  const t = T[l];
  const u = U[l];
  const { status: filterRoh, hinweis } = await searchParams;
  const filter = (filterListe as string[]).includes(String(filterRoh)) ? (filterRoh as Status | "offen") : "offen";
  const supabase = await createClient();

  const { data: jahrgang } = await supabase.from("cohorts").select("id, name").eq("is_current", true).maybeSingle();
  let query = supabase.from("applications").select("*").order("created_at", { ascending: filter === "offen" });
  if (jahrgang) query = query.eq("cohort_id", jahrgang.id);
  query = filter === "offen" ? query.in("status", ["eingegangen", "in_pruefung"]) : query.eq("status", filter);
  let zaehlAbfrage = supabase.from("applications").select("status, participant_id");
  if (jahrgang) zaehlAbfrage = zaehlAbfrage.eq("cohort_id", jahrgang.id);
  const [{ data: bewerbungen }, { data: alleStatus }, { data: personen }, { data: kennzahlen }] = await Promise.all([
    query, zaehlAbfrage,
    supabase.from("participants").select("id, active"),
    supabase.rpc("get_participant_analytics"),
  ]);
  const aktiv = new Set((personen ?? []).filter((p) => p.active).map((p) => p.id));
  const bekannt = new Set((personen ?? []).map((p) => p.id));
  const kennzahl = new Map((kennzahlen ?? []).map((k) => [k.participant_id, k]));
  const anzahl = (f: Status | "offen") => (alleStatus ?? []).filter((b) => (f === "offen" ? b.status === "eingegangen" || b.status === "in_pruefung" : b.status === f)).length;
  const angenommenePersonen = new Set((alleStatus ?? []).filter((b) => b.status === "angenommen" && b.participant_id).map((b) => b.participant_id));
  const unstimmigOffen = (alleStatus ?? []).filter((b) => (b.status === "eingegangen" || b.status === "in_pruefung") && b.participant_id && aktiv.has(b.participant_id)).length;
  const unstimmigAbgelehnt = new Set((alleStatus ?? []).filter((b) => b.status === "abgelehnt" && b.participant_id && aktiv.has(b.participant_id) && !angenommenePersonen.has(b.participant_id)).map((b) => b.participant_id)).size;
  const abgleich = typeof hinweis === "string" && /^abgleich-\d+-\d+$/.test(hinweis) ? hinweis.split("-").slice(1).map(Number) : null;
  const h = hinweis && !abgleich ? t.hinweise[String(hinweis)] : null;
  const bereit = mailBereit();
  const knopf = "rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-line bg-white hover:bg-paper-deep";
  const datum = (iso: string) => new Date(iso).toLocaleDateString(teamLocale[l], { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "2-digit" });

  /** Stand der Person zur Bewerbung: nimmt teil (mit Tagen), nie da, nicht in der Liste. */
  const teilnahme = (b: { participant_id: string | null; status: Status }) => {
    if (!b.participant_id || !bekannt.has(b.participant_id)) return b.status === "angenommen" ? <span className="chip bg-gelb-hell">{u.nichtInListe}</span> : null;
    const k = kennzahl.get(b.participant_id);
    const faellig = (k?.total_attended ?? 0) + (k?.total_no_shows ?? 0);
    if (!aktiv.has(b.participant_id)) return <span className="chip bg-paper-deep">{u.ausgeschieden}</span>;
    if (b.status !== "angenommen") return <span className="chip bg-signal">{u.nimmtTeil}</span>;
    if (!faellig) return null;
    return k!.total_attended ? <span className={`chip ${k!.total_attended / faellig >= 0.75 ? "bg-gruen-hell" : "bg-gelb-hell"}`}>{u.tage(k!.total_attended, faellig)}</span> : <span className="chip bg-rot-hell text-rot">{u.nieDa}</span>;
  };

  return (
    <>
      <TeamKopf staff={staff} aktiv="bewerbungen" />
      <main lang={l} className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-sm font-semibold tracking-wide text-sage uppercase">{jahrgang?.name ?? t.keinJahrgang} · {u.gesamt((alleStatus ?? []).length)}</p>
        <h1 className="font-display mt-1 text-4xl font-extrabold">{teamTexte[l].bereiche.bewerbungen}</h1>

        {abgleich && <p role="status" className="mt-4 rounded-2xl bg-gruen-hell p-4 text-sm font-semibold">{u.abgleichFertig(abgleich[0], abgleich[1])}</p>}
        {h && <p role="status" className={`mt-4 rounded-2xl p-4 text-sm font-semibold ${h.gut ? "bg-gruen-hell" : "bg-gelb-hell"}`}>{h.text}</p>}

        {(unstimmigOffen > 0 || unstimmigAbgelehnt > 0) && (
          <form action={mitTeilnehmendenAbgleichen} className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-gelb-hell p-4">
            <input type="hidden" name="filter" value={filter} />
            <div className="mr-auto max-w-2xl">
              <p className="font-semibold">{u.unstimmig(unstimmigOffen, unstimmigAbgelehnt)}</p>
              <p className="text-sm">{u.unstimmigText}</p>
            </div>
            <Rueckfrage knopf={u.abgleichen} knopfKlasse="knopf" frage={u.abgleichFrage} ja={u.abgleichJa} sprache={l} />
          </form>
        )}

        <nav className="mt-6 flex flex-wrap gap-2" aria-label={t.filter}>
          {filterListe.map((f) => (
            <Link key={f} href={`/team/bewerbungen/?status=${f}`} aria-current={f === filter ? "page" : undefined}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${f === filter ? "bg-ink text-paper" : "bg-weiss ring-1 ring-line hover:ring-ink"}`}>
              {f === "offen" ? t.offen : t.statusName[f]} <span className="tabular-nums opacity-70">{anzahl(f)}</span>
            </Link>
          ))}
        </nav>
        {filter === "angenommen" && <p className="mt-3 text-sm text-ink-soft">{u.angenommenText}</p>}
        {filter === "offen" && <MailHinweis knapp className="mt-3" sprache={l} />}

        {(bewerbungen ?? []).length === 0 ? <p className="mt-6 text-ink-soft">{t.leer}</p> : (
          <ul className="karte mt-4 divide-y divide-line p-0">
            {(bewerbungen ?? []).map((b) => {
              const name = `${b.first_name} ${b.last_name}`.trim();
              const angaben = bewerbungsAngaben(b.details, l);
              const alter = b.age ?? (b.birth_year ? new Date(b.created_at).getFullYear() - b.birth_year : null);
              return (
                <li key={b.id}>
                  <details className="group">
                    <summary className="grid cursor-pointer list-none items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-paper/60 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
                      <span className="min-w-0">
                        <span className="font-semibold">{name}</span>
                        <span className="block truncate text-xs text-ink-soft">{[alter ? `${alter} J.` : null, [b.city, b.country].filter(Boolean).join(", ") || null, datum(b.created_at)].filter(Boolean).join(" · ")}</span>
                      </span>
                      <span className="truncate text-xs text-ink-soft">{b.languages.join(" · ")}</span>
                      <span className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                        {teilnahme(b)}
                        {b.status === "in_pruefung" && <span className="chip bg-paper-deep">{t.statusName.in_pruefung}</span>}
                      </span>
                    </summary>
                    <div className="grid gap-5 border-t border-line bg-paper/40 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                      <div className="text-sm">
                        <p className="text-ink-soft">{b.email}{b.phone ? ` · ${b.phone}` : ""}{b.source ? t.ueber(b.source) : ""}</p>
                        {b.participant_id && bekannt.has(b.participant_id) && <Link href={`/team/teilnehmende/${b.participant_id}/`} className="link mt-1 inline-block">{u.profil} →</Link>}
                        {b.motivation.trim() && (<><p className="mt-3 text-xs font-semibold tracking-wide text-ink-soft uppercase">{u.motivation}</p><p className="mt-1 whitespace-pre-line">{b.motivation}</p></>)}
                        {b.review_note && <p className="mt-3 rounded-xl bg-weiss px-3 py-2 text-xs text-ink-soft whitespace-pre-line">{b.review_note}</p>}
                      </div>
                      <dl className="grid content-start gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[minmax(0,11rem)_1fr]">
                        {angaben.map((a) => <div key={a.name} className="contents"><dt className="text-ink-soft">{a.name}</dt><dd className="whitespace-pre-line">{a.wert}</dd></div>)}
                      </dl>
                      <div className="flex flex-wrap gap-2 lg:col-span-2">
                        {b.status !== "angenommen" ? (
                          <>
                            <form action={annehmen} className="contents">
                              <input type="hidden" name="id" value={b.id} /><input type="hidden" name="filter" value={filter} />
                              <Rueckfrage knopf={t.annehmenKnopf} knopfKlasse="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-paper hover:bg-forest"
                                frage={t.annehmenFrage(name, b.email)} ja={t.annehmenJa} sprache={l}>
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
                                  frage={s === "abgelehnt" ? t.ablehnenFrage(name) : t.wartelisteFrage(name)}
                                  ja={s === "abgelehnt" ? t.ablehnenJa : t.wartelisteJa}>
                                  {bereit ? (
                                    <label className="flex gap-2">
                                      <input type="checkbox" name="mail" value="ja" defaultChecked className="mt-0.5" />
                                      <span>{t.mailSenden(b.email, b.language === "tr", bewerbungStatusBetreff(s, b.language))}</span>
                                    </label>
                                  ) : <p className="font-semibold text-rot">{t.keineMail}</p>}
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
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
