import type { Metadata } from "next";
import Link from "next/link";
import { Phone } from "lucide-react";
import { Hinweis } from "@/components/team/Hinweis";
import { Ergebnis, kontaktHinweisTexte, kontaktHinweise, notizZitat, wann } from "@/components/team/Kontakt";
import { Rueckfrage } from "@/components/team/Rueckfrage";
import { TeamKopf } from "@/components/team/TeamKopf";
import { Leer, Rueckmeldung, Titel } from "@/components/team/Ui";
import { MailHinweis } from "@/components/team/MailHinweis";
import { AuswahlKnoepfe } from "@/components/team/AuswahlKnoepfe";
import { RundmailFormular } from "@/components/team/RundmailFormular";
import { darf, getStaff, requireStaff } from "@/lib/auth";
import { mentorSpeichern, willkommenAnAlle } from "@/lib/aktionen/teilnehmende";
import { createClient } from "@/lib/supabase/server";
import { mailBereit } from "@/lib/mail";
import { filterBeschreibung, herkunft, kontakte, ladeListe, leseFilter, punkt, punktTexte, termine, uebernachtungen, zusagen } from "@/lib/teilnehmende-liste";
import type { TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";
import { telLink } from "@/lib/telefon";
import { nachtName } from "@/lib/uebernachtung";

const de = {
  meta: "Teilnehmende | SES Academy",
  keinJahrgang: "Kein aktueller Jahrgang",
  vonGesamt: (a: number, b: number) => `${a} von ${b}`,
  ausgeblendet: (n: number) => `${n} Gäste und Walk-ins sind ausgeblendet.`,
  anzeigen: "Anzeigen",
  willkommenText: (n: number) => `${n} Teilnehmende mit E-Mail haben sich noch nie angemeldet und noch keine Willkommensmail bekommen. Sie enthält Ticket und Anleitung zum Login.`,
  willkommenKnopf: "Willkommensmail senden",
  willkommenJa: (n: number) => `Ja, an ${n} senden`,
  willkommenFrage: (n: number) => `Willkommensmail jetzt an ${n} Teilnehmende senden? Jede Person bekommt sie nur einmal.`,
  liste: "Liste",
  verantwortliche: (n: number) => `Verantwortliche (${n})`,
  verantwortlicheText: "Verantwortliche (Sorumlu) betreuen eine Gruppe. Mit eingetragener E-Mail können sie sich später anmelden. Wer im Team-Bereich mitarbeiten soll, braucht zusätzlich eine Team-Rolle (Admin legt sie unter „Team“ an).",
  anzahlTeilnehmende: (n: number) => `${n} Teilnehmende`,
  hatSichAngemeldet: " · hat sich angemeldet",
  neuePerson: "Neue verantwortliche Person",
  emailOptional: "E-Mail (optional)",
  suche: (alles: boolean): string => (alles ? "Name, E-Mail oder Telefon" : "Name oder Telefon"),
  modulAbgesagt: " (abgesagt)",
  alleRegionen: "Alle Regionen",
  ohneRegion: "ohne Region",
  alleSorumlu: "Alle Sorumlu",
  ohneSorumlu: "ohne Sorumlu",
  uebernachtung: "Übernachtung",
  kontakt: "Kontakt",
  gtUndKgt: "GT und KGT",
  alleAktiven: "Alle Aktiven",
  ohneMail: "Ohne E-Mail",
  ohneTelefon: "Ohne Telefon",
  ausgeschieden: "Ausgeschieden",
  wer: "Wer",
  nurJahrgang: "Nur Jahrgang",
  mitGaesten: "Mit Gästen und Walk-ins",
  nurGaeste: (n: number) => `Nur Gäste und Walk-ins (${n})`,
  zuruecksetzen: "Zurücksetzen",
  zusage: "Zusage",
  doppelpunkt: (s: string) => `${s}:`,
  auswahl: (n: number, alles: boolean) => `${n} ${n === 1 ? "Person" : "Personen"} in dieser Auswahl${alles ? "" : " (ohne E-Mail-Adressen)"}`,
  excel: "Als Excel herunterladen",
  rundmail: "Rundmail an diese Auswahl",
  rundmailText: (n: number) => `Geht an alle angehakten Personen der Liste unten (anfangs alle ${n}). Einzelne lassen sich in der ersten Spalte abwählen. Wie jede Nachricht an viele gibt sie eine zweite Person unter „Freigaben“ frei.`,
  niemand: "Niemand in dieser Auswahl.",
  fuerRundmail: "Für die Rundmail ausgewählt",
  ha: (n: number) => `HA${n}`,
  /** Ausgeschriebene Hausaufgabe als Tooltip, wo das Kürzel nicht selbsterklärend ist */
  haTitel: null as ((n: number) => string) | null,
  letzterKontakt: "Letzter Kontakt / Notiz",
  auswaehlen: (name: string) => `${name} für die Rundmail auswählen`,
  anrufen: (name: string) => `${name} anrufen`,
  fehltRegion: "fehlt",
  fehltMail: "fehlt",
  keineAngabe: "keine Angabe",
  nein: "nein",
  punktTitel: (modul: string, text: string) => `${modul}: ${text}`,
  nochNichts: "noch nichts",
  legende: { da: "da (Einlass)", teilweise: "teilweise da", keineZusage: "noch keine Zusage / nicht gekommen", abgesagt: "abgesagt / entschuldigt" },
  nameAnklicken: "Name anklicken: Anrufe, Notizen und Zusagen der Person",
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    meta: "Katılımcılar | SES Academy",
    keinJahrgang: "Güncel dönem yok",
    vonGesamt: (a, b) => `${a} / ${b}`,
    ausgeblendet: (n) => `${n} misafir ve kayıtsız gelen gizlendi.`,
    anzeigen: "Göster",
    willkommenText: (n) => `E-posta adresi olan ${n} katılımcı henüz hiç giriş yapmadı ve hoş geldin e-postası almadı. Bu e-postada bilet ve giriş talimatı var.`,
    willkommenKnopf: "Hoş geldin e-postası gönder",
    willkommenJa: (n) => `Evet, ${n} kişiye gönder`,
    willkommenFrage: (n) => `Hoş geldin e-postası şimdi ${n} katılımcıya gönderilsin mi? Her kişi bunu yalnızca bir kez alır.`,
    liste: "Liste",
    verantwortliche: (n) => `Sorumlular (${n})`,
    verantwortlicheText: "Sorumlular bir grubu takip eder. E-posta adresi girilmişse daha sonra giriş yapabilirler. Ekip alanında çalışacak kişinin ayrıca bir ekip rolüne ihtiyacı var (yönetici bunu “Ekip” bölümünde oluşturur).",
    anzahlTeilnehmende: (n) => `${n} katılımcı`,
    hatSichAngemeldet: " · giriş yaptı",
    neuePerson: "Yeni sorumlu",
    emailOptional: "E-posta (isteğe bağlı)",
    suche: (alles) => (alles ? "Ad, e-posta veya telefon" : "Ad veya telefon"),
    modulAbgesagt: " (iptal edildi)",
    alleRegionen: "Tüm bölgeler",
    ohneRegion: "bölgesiz",
    alleSorumlu: "Tüm sorumlular",
    ohneSorumlu: "sorumlusu yok",
    uebernachtung: "Konaklama",
    kontakt: "İletişim",
    gtUndKgt: "GT ve KGT",
    alleAktiven: "Tüm aktifler",
    ohneMail: "E-postası olmayanlar",
    ohneTelefon: "Telefonu olmayanlar",
    ausgeschieden: "Ayrılanlar",
    wer: "Kim",
    nurJahrgang: "Sadece dönem",
    mitGaesten: "Misafirler ve kayıtsız gelenler dahil",
    nurGaeste: (n) => `Sadece misafirler ve kayıtsız gelenler (${n})`,
    zuruecksetzen: "Sıfırla",
    zusage: "Katılım cevabı",
    doppelpunkt: (s) => `${s}:`,
    auswahl: (n, alles) => `Bu seçimde ${n} kişi${alles ? "" : " (e-posta adresleri olmadan)"}`,
    excel: "Excel olarak indir",
    rundmail: "Bu seçime toplu e-posta",
    rundmailText: (n) => `Aşağıdaki listede işaretli herkese gider (başta ${n} kişinin hepsi). İlk sütunda tek tek kişilerin işaretini kaldırabilirsin. Çok kişiye giden her mesaj gibi bunu da ikinci bir kişi “Onaylar” bölümünde onaylar.`,
    niemand: "Bu seçimde kimse yok.",
    fuerRundmail: "Toplu e-posta için seçildi",
    ha: (n) => `Ö${n}`,
    haTitel: (n) => `Ödev ${n}`,
    letzterKontakt: "Son iletişim / not",
    auswaehlen: (name) => `Toplu e-posta için seç: ${name}`,
    anrufen: (name) => `Ara: ${name}`,
    fehltRegion: "eksik",
    fehltMail: "eksik",
    keineAngabe: "bilgi yok",
    nein: "hayır",
    punktTitel: (modul, text) => `${modul}: ${text}`,
    nochNichts: "henüz yok",
    legende: { da: "geldi (giriş kaydı)", teilweise: "kısmen geldi", keineZusage: "henüz cevap yok / gelmedi", abgesagt: "katılmayacak / mazeretli" },
    nameAnklicken: "Ada tıkla: kişinin aramaları, notları ve katılım cevapları",
  },
  fr: {
    meta: "Participants | SES Academy",
    keinJahrgang: "Aucune promotion en cours",
    vonGesamt: (a, b) => `${a} sur ${b}`,
    ausgeblendet: (n) => `Invités et personnes sans inscription masqués : ${n}.`,
    anzeigen: "Afficher",
    willkommenText: (n) => `Participants avec adresse e-mail qui ne se sont jamais connectés et n’ont pas encore reçu l’e-mail de bienvenue : ${n}. Il contient le billet et les instructions de connexion.`,
    willkommenKnopf: "Envoyer l’e-mail de bienvenue",
    willkommenJa: (n) => `Oui, envoyer à ${n}`,
    willkommenFrage: (n) => `Envoyer maintenant l’e-mail de bienvenue à ${n} participant${n > 1 ? "s" : ""} ? Chaque personne ne le reçoit qu’une fois.`,
    liste: "Liste",
    verantwortliche: (n) => `Sorumlu (${n})`,
    verantwortlicheText: "Les Sorumlu s’occupent d’un groupe. Avec une adresse e-mail enregistrée, ils pourront se connecter plus tard. Pour travailler dans l’espace équipe, il faut en plus un rôle d’équipe (l’admin le crée sous « Équipe »).",
    anzahlTeilnehmende: (n) => `${n} participant${n > 1 ? "s" : ""}`,
    hatSichAngemeldet: " · s’est connecté·e",
    neuePerson: "Nouveau Sorumlu",
    emailOptional: "E-mail (facultatif)",
    suche: (alles) => (alles ? "Nom, e-mail ou téléphone" : "Nom ou téléphone"),
    modulAbgesagt: " (annulé)",
    alleRegionen: "Toutes les régions",
    ohneRegion: "sans région",
    alleSorumlu: "Tous les Sorumlu",
    ohneSorumlu: "sans Sorumlu",
    uebernachtung: "Hébergement",
    kontakt: "Contact",
    gtUndKgt: "GT et KGT",
    alleAktiven: "Tous les actifs",
    ohneMail: "Sans e-mail",
    ohneTelefon: "Sans téléphone",
    ausgeschieden: "Ont quitté le programme",
    wer: "Qui",
    nurJahrgang: "Promotion uniquement",
    mitGaesten: "Avec invités et personnes sans inscription",
    nurGaeste: (n) => `Invités et personnes sans inscription uniquement (${n})`,
    zuruecksetzen: "Réinitialiser",
    zusage: "Réponse",
    doppelpunkt: (s) => `${s} :`,
    auswahl: (n, alles) => `${n} personne${n > 1 ? "s" : ""} dans cette sélection${alles ? "" : " (sans adresses e-mail)"}`,
    excel: "Télécharger en Excel",
    rundmail: "E-mail groupé à cette sélection",
    rundmailText: (n) => `Part à toutes les personnes cochées dans la liste ci-dessous (au départ, les ${n}). Tu peux en décocher dans la première colonne. Comme tout message envoyé à beaucoup de monde, une deuxième personne doit le valider sous « Validations ».`,
    niemand: "Personne dans cette sélection.",
    fuerRundmail: "Sélectionné·e pour l’e-mail groupé",
    ha: (n) => `D${n}`,
    haTitel: (n) => `Devoir ${n}`,
    letzterKontakt: "Dernier contact / note",
    auswaehlen: (name) => `Sélectionner ${name} pour l’e-mail groupé`,
    anrufen: (name) => `Appeler ${name}`,
    fehltRegion: "manquante",
    fehltMail: "manquant",
    keineAngabe: "non renseigné",
    nein: "non",
    punktTitel: (modul, text) => `${modul} : ${text}`,
    nochNichts: "rien pour l’instant",
    legende: { da: "présent·e (accueil)", teilweise: "présent·e en partie", keineZusage: "pas encore de réponse / absent·e", abgesagt: "ne vient pas / excusé·e" },
    nameAnklicken: "Clique sur un nom pour voir les appels, notes et réponses de la personne",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  return { title: T[(await getStaff())?.sprache ?? "de"].meta };
}

/**
 * Teilnehmende und Anrufliste in einem (ab Orga-Team): alle Filter, je Person Zusage und Anwesenheit pro Modul,
 * Telefon und der letzte Anruf bzw. die letzte Notiz. Ein Klick auf den Namen öffnet Verlauf, Notizen und Zusagen.
 * E-Mail-Adressen, Hausaufgaben und die Verantwortlichen-Pflege nur für Admin/Vorstand.
 */
export default async function Teilnehmende({ searchParams }: PageProps<"/team/teilnehmende">) {
  const staff = await requireStaff("orga");
  const l = staff.sprache;
  const t = T[l];
  const w = teamTexte[l].wort;
  const pt = punktTexte[l];
  const alles = darf.alles(staff.role);
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const supabase = await createClient();
  const filter = leseFilter(sp);
  const { jahrgang, modulListe, modul, jetzt, alle, grundmenge, liste, zusage, kontakt, ueb, gruppe } = await ladeListe(filter, alles);
  const [{ data: aufgaben }, { data: abgaben }, { data: mentoren }, { data: vorlagen }] = await Promise.all([
    alles ? supabase.from("assignments").select("id,number").eq("cohort_id", jahrgang?.id ?? "").order("number") : Promise.resolve({ data: [] }),
    alles ? supabase.from("submission_participants").select("participant_id, submissions(assignment_id)") : Promise.resolve({ data: [] }),
    alles ? supabase.from("mentors").select("id,name,email,user_id").order("name") : Promise.resolve({ data: [] }),
    alles ? supabase.from("message_templates").select("id, name, subject_de, body_de, subject_tr, body_tr").order("name") : Promise.resolve({ data: [] }),
  ]);
  const haVon = new Map<string, Set<string>>();
  for (const a of (abgaben ?? []) as { participant_id: string; submissions: { assignment_id: string } | null }[]) {
    if (a.submissions) haVon.set(a.participant_id, (haVon.get(a.participant_id) ?? new Set()).add(a.submissions.assignment_id));
  }

  let ohneLogin = 0;
  if (alles) {
    const [{ data: ohneKonto }, { data: begruesst }] = await Promise.all([
      supabase.from("participants").select("id").eq("affiliation_status", "academy_student").eq("active", true).not("email", "is", null).is("user_id", null),
      supabase.from("email_log").select("participant_id").eq("kind", "willkommen").eq("status", "sent"),
    ]);
    const schon = new Set((begruesst ?? []).map((z) => z.participant_id));
    ohneLogin = (ohneKonto ?? []).filter((p) => !schon.has(p.id)).length;
  }

  const mitZusagen = new Set(alle.flatMap((p) => p.modules.filter((r) => r.r).map((r) => r.m)));
  const auswahl = (werte: (string | null)[]) => {
    const z = new Map<string, number>();
    for (const wert of werte) z.set(wert ?? "-", (z.get(wert ?? "-") ?? 0) + 1);
    return [...z.entries()].sort((a, b) => (a[0] === "-" ? 1 : b[0] === "-" ? -1 : a[0].localeCompare(b[0], "de")));
  };
  const regionen = auswahl(alle.map((p) => p.region));
  const sorumlus = auswahl(alle.map((p) => p.mentor_name));

  const adresse = (aenderung: Record<string, string>, pfad = "/team/teilnehmende/") => {
    const q = new URLSearchParams();
    for (const k of ["modul", "q", "region", "verantwortlich", "gt", "filter", "gruppe", "zusage", "kontakt", "uebernachtung"]) if (s(k)) q.set(k, s(k));
    if (modul && !q.has("modul")) q.set("modul", modul.id);
    for (const [k, v] of Object.entries(aenderung)) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    return `${pfad}?${q}`;
  };
  const personLink = (id: string) => `/team/teilnehmende/${id}/${modul ? `?modul=${modul.id}` : ""}`;
  const code = typeof sp.hinweis === "string" ? sp.hinweis : undefined;

  return (
    <>
      <TeamKopf staff={staff} aktiv="teilnehmende" breit />
      <main lang={l} className="mx-auto max-w-[96rem] px-4 py-10">
        {/* Über den Reiter „Teilnehmende“ eines Moduls gekommen: zurück ins Modul (Orga-Team ohne Modulübersicht: Programm) */}
        {modul && s("modul") && (
          <Link href={`/team/module/${modul.id}/${alles ? "" : "programm/"}`} className="mb-2 inline-block text-sm font-semibold text-ink-soft hover:text-ink">← {modul.title}</Link>
        )}
        <Titel kicker={`${jahrgang?.name ?? t.keinJahrgang} · ${t.vonGesamt(liste.length, alle.length)}`}>{teamTexte[l].bereiche.teilnehmende}</Titel>
        {gruppe === "jahrgang" && alle.some((p) => herkunft(p) && p.affiliation_status !== "academy_student") && (
          <p className="-mt-5 mb-6 text-sm text-ink-soft">
            {t.ausgeblendet(alle.filter((p) => herkunft(p) && p.affiliation_status !== "academy_student").length)}{" "}
            <Link href={adresse({ gruppe: "gaeste" })} className="link">{t.anzeigen}</Link>
          </p>
        )}
        {code && code in kontaktHinweise ? <Hinweis code={code} texte={kontaktHinweisTexte[l]} /> : <Rueckmeldung hinweis={sp.hinweis} fehler={sp.fehler} sprache={l} />}
        {alles && ohneLogin > 0 && (
          <form action={willkommenAnAlle} className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl bg-white/70 p-4 ring-1 ring-line">
            <p className="mr-auto text-sm">{t.willkommenText(ohneLogin)}</p>
            <Rueckfrage knopf={t.willkommenKnopf} knopfKlasse="knopf" ja={t.willkommenJa(ohneLogin)} frage={t.willkommenFrage(ohneLogin)} sprache={l} />
            <MailHinweis knapp className="w-full" sprache={l} />
          </form>
        )}
        {alles && (
          <div className="mb-6 flex gap-2">
            <Link href="?" className={`rounded-full px-4 py-1.5 text-sm font-semibold ${s("ansicht") !== "verantwortliche" ? "bg-ink text-paper" : "bg-weiss ring-1 ring-line"}`}>{t.liste}</Link>
            <Link href="?ansicht=verantwortliche" className={`rounded-full px-4 py-1.5 text-sm font-semibold ${s("ansicht") === "verantwortliche" ? "bg-ink text-paper" : "bg-weiss ring-1 ring-line"}`}>{t.verantwortliche(mentoren?.length ?? 0)}</Link>
          </div>
        )}

        {alles && s("ansicht") === "verantwortliche" ? (
          <section className="karte">
            <p className="mb-4 max-w-3xl text-sm text-ink-soft">{t.verantwortlicheText}</p>
            {mentoren?.map((m) => (
              <form key={m.id} action={mentorSpeichern} className="grid items-center gap-2 border-b border-line py-3 sm:grid-cols-[1.2fr_1.5fr_auto]">
                <input type="hidden" name="id" value={m.id} />
                <div>
                  <input name="name" defaultValue={m.name} required className="feld" aria-label={w.name} />
                  <p className="mt-1 text-xs text-ink-soft">
                    <Link href={`?verantwortlich=${encodeURIComponent(m.name)}`} className="underline">{t.anzahlTeilnehmende(alle.filter((p) => p.mentor_name === m.name).length)}</Link>
                    {m.user_id ? t.hatSichAngemeldet : ""}
                  </p>
                </div>
                <input name="email" type="email" defaultValue={m.email ?? ""} placeholder={w.email} className="feld" aria-label={w.email} />
                <button className="knopf-hell">{w.speichern}</button>
              </form>
            ))}
            <form action={mentorSpeichern} className="mt-4 grid items-center gap-2 sm:grid-cols-[1.2fr_1.5fr_auto]">
              <input name="name" required placeholder={t.neuePerson} className="feld" />
              <input name="email" type="email" placeholder={t.emailOptional} className="feld" />
              <button className="knopf">{w.hinzufuegen}</button>
            </form>
          </section>
        ) : (
          <>
            <form key={JSON.stringify(sp)} className="mb-4 grid gap-3 rounded-3xl bg-weiss p-4 ring-1 ring-line sm:grid-cols-2 lg:grid-cols-5" action="/team/teilnehmende/">
              <select name="modul" defaultValue={modul?.id} className="feld lg:col-span-2" aria-label={w.modul}>
                {modulListe.map((m) => <option key={m.id} value={m.id}>{m.title} · {termine(m.tage, l)}{m.cancelled_at ? t.modulAbgesagt : ""}</option>)}
              </select>
              <input name="q" defaultValue={s("q")} placeholder={t.suche(alles)} className="feld lg:col-span-3" />
              <select name="region" defaultValue={s("region")} className="feld" aria-label={w.region}>
                <option value="">{t.alleRegionen}</option>
                {regionen.map(([wert, n]) => <option key={wert} value={wert}>{wert === "-" ? t.ohneRegion : wert} ({n})</option>)}
              </select>
              <select name="verantwortlich" defaultValue={s("verantwortlich")} className="feld" aria-label="Sorumlu">
                <option value="">{t.alleSorumlu}</option>
                {sorumlus.map(([wert, n]) => <option key={wert} value={wert}>{wert === "-" ? t.ohneSorumlu : wert} ({n})</option>)}
              </select>
              <select name="uebernachtung" defaultValue={ueb} className="feld" aria-label={t.uebernachtung}>
                {(Object.keys(uebernachtungen) as (keyof typeof uebernachtungen)[]).map((u) => <option key={u} value={u}>{uebernachtungen[u].name[l]}</option>)}
              </select>
              <select name="kontakt" defaultValue={kontakt} className="feld" aria-label={t.kontakt}>
                {(Object.keys(kontakte) as (keyof typeof kontakte)[]).map((k) => <option key={k} value={k}>{kontakte[k].name[l]}</option>)}
              </select>
              <select name="gt" defaultValue={s("gt")} className="feld" aria-label="GT/KGT">
                <option value="">{t.gtUndKgt}</option>
                <option>GT</option>
                <option>KGT</option>
              </select>
              <select name="filter" defaultValue={s("filter")} className="feld" aria-label={w.status}>
                <option value="">{t.alleAktiven}</option>
                {alles && <option value="ohne-mail">{t.ohneMail}</option>}
                <option value="ohne-telefon">{t.ohneTelefon}</option>
                <option value="inaktiv">{t.ausgeschieden}</option>
              </select>
              <select name="gruppe" defaultValue={gruppe} className="feld" aria-label={t.wer}>
                <option value="jahrgang">{t.nurJahrgang}</option>
                <option value="alle">{t.mitGaesten}</option>
                <option value="gaeste">{t.nurGaeste(alle.filter((p) => herkunft(p)).length)}</option>
              </select>
              {zusage && <input type="hidden" name="zusage" value={zusage} />}
              <div className="flex gap-2 lg:col-span-2">
                <button className="knopf">{w.filtern}</button>
                <Link href="/team/teilnehmende/" className="knopf-hell">{t.zuruecksetzen}</Link>
              </div>
            </form>

            {modul && (
              <nav aria-label={t.zusage} className="mb-6 flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{t.doppelpunkt(modul.title)}</span>
                {(Object.keys(zusagen) as (keyof typeof zusagen)[]).map((z) => (
                  <Link key={z} href={adresse({ zusage: z })} aria-current={z === zusage ? "page" : undefined}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ring-1 transition ${z === zusage ? "bg-ink text-paper ring-ink" : "bg-weiss ring-line hover:ring-ink"}`}>
                    {zusagen[z].name[l]} <span className="opacity-70">{grundmenge.filter(zusagen[z].passt).length}</span>
                  </Link>
                ))}
              </nav>
            )}

            <div className="mb-3 flex flex-wrap items-center gap-2">
              <p className="mr-auto text-sm text-ink-soft">{t.auswahl(liste.length, alles)}</p>
              {liste.length > 0 && <a href={adresse({}, "/team/teilnehmende/export/")} className="knopf-hell" download>{t.excel}</a>}
            </div>
            {alles && liste.length > 0 && (
              <details id="rundmail" className="karte mb-4">
                <summary className="cursor-pointer font-display text-lg font-bold">{t.rundmail}</summary>
                <p className="mt-2 max-w-3xl text-sm text-ink-soft">{t.rundmailText(liste.length)}</p>
                <div className="mt-4">
                  {/* Filterbeschreibung bleibt deutsch: Sie geht in die Freigabe-Beschreibung, die die Datenbank auf Deutsch baut */}
                  <RundmailFormular vorlagen={vorlagen ?? []} mailBereit={mailBereit()} email={staff.email} sprache={l}
                    auswahl={{ beschreibung: filterBeschreibung(filter, modul?.title ?? null) || (gruppe === "jahrgang" ? "ganzer Jahrgang" : "") }} />
                </div>
              </details>
            )}

            {liste.length === 0 ? (
              <Leer>{t.niemand}</Leer>
            ) : (
              <div className="overflow-x-auto rounded-3xl bg-weiss ring-1 ring-line">
                <table className="tabelle">
                  <thead>
                    <tr>
                      {alles && <th className="whitespace-nowrap"><span className="sr-only">{t.fuerRundmail}</span><AuswahlKnoepfe sprache={l} /></th>}
                      <th>{w.name}</th><th>{w.telefon}</th><th>{w.region}</th><th>Sorumlu</th>
                      {modul && <th>{t.uebernachtung}</th>}
                      {modulListe.map((m) => (
                        <th key={m.id} title={m.title} className={`text-center whitespace-nowrap ${m.id === modul?.id ? "bg-gelb-hell/60" : m.tage[m.tage.length - 1].ends_at < jetzt ? "opacity-60" : ""}`}>{termine(m.tage, l)}</th>
                      ))}
                      {alles && <th>{w.email}</th>}
                      {alles && aufgaben?.map((a) => <th key={a.id} title={t.haTitel?.(a.number)} className="text-center">{t.ha(a.number)}</th>)}
                      <th>{t.letzterKontakt}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liste.map((p) => (
                      <tr key={p.participant_id}>
                        {alles && (
                          <td>
                            <input type="checkbox" data-rundmail value={p.participant_id} defaultChecked aria-label={t.auswaehlen(p.name)} className="h-4 w-4 accent-ink" />
                          </td>
                        )}
                        <td className="whitespace-nowrap">
                          <Link href={personLink(p.participant_id)} className="font-semibold hover:underline">{p.name}</Link>
                          {herkunft(p) && <span className="chip ml-1.5 bg-paper-deep align-middle">{herkunft(p, l)}</span>}
                        </td>
                        <td className="whitespace-nowrap">
                          {p.phone ? <a href={telLink(p.phone)} className="inline-flex items-center gap-1 text-sm hover:underline" aria-label={t.anrufen(p.name)}><Phone aria-hidden className="h-3.5 w-3.5" />{p.phone}</a> : <span className="text-sm text-ink-soft">–</span>}
                        </td>
                        <td className="whitespace-nowrap">{p.region ?? <span className="text-rot">{t.fehltRegion}</span>}</td>
                        <td className="whitespace-nowrap">{p.mentor_name ?? "–"}</td>
                        {modul && <td className="text-sm whitespace-nowrap">{!p.registration_status ? "–" : !p.stay_answered ? <span className="text-ink-soft">{t.keineAngabe}</span> : p.nights?.length ? p.nights.map(nachtName).join(", ") : t.nein}</td>}
                        {modulListe.map((m) => {
                          const pk = punkt(p.modules.find((r) => r.m === m.id), m.tage.length, m.tage[m.tage.length - 1].ends_at < jetzt, mitZusagen.has(m.id), l);
                          return (
                            <td key={m.id} className={`text-center ${m.id === modul?.id ? "bg-gelb-hell/30" : ""}`}>
                              {pk ? <span title={t.punktTitel(m.title, pk.text)} className={`inline-block h-3 w-3 rounded-full ${pk.farbe}`} /> : <span className="text-ink-soft/40">·</span>}
                            </td>
                          );
                        })}
                        {alles && <td>{p.email ? <span title={p.email}>✓</span> : <span className="chip bg-gelb-hell">{t.fehltMail}</span>}</td>}
                        {alles && aufgaben?.map((a) => <td key={a.id} className="text-center">{haVon.get(p.participant_id)?.has(a.id) ? "✓" : <span className="text-ink-soft/40">–</span>}</td>)}
                        <td className="min-w-64 text-sm">
                          {p.last_at && p.last_channel ? (
                            <Link href={`${personLink(p.participant_id)}#p-${p.participant_id}`} className="flex flex-wrap items-center gap-1.5 hover:underline">
                              <Ergebnis outcome={p.last_outcome} sprache={l} />
                              <span className="text-ink-soft">{wann(p.last_at, l)}{p.last_by ? ` · ${p.last_by}` : ""}</span>
                              {p.last_note && <span className="line-clamp-1 max-w-80 text-ink">{notizZitat(p.last_note, l)}</span>}
                            </Link>
                          ) : <span className="text-ink-soft">{t.nochNichts}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-4 flex flex-wrap gap-4 text-xs text-ink-soft">
              <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-mint" />{t.legende.da}</span>
              <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-orange-400" />{t.legende.teilweise}</span>
              <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-yellow-300" />{pt.zugesagt}</span>
              <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-rot" />{t.legende.keineZusage}</span>
              <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-zinc-300" />{t.legende.abgesagt}</span>
              <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-paper-deep ring-1 ring-line" />{pt.angemeldet}</span>
              <span>{t.nameAnklicken}</span>
            </p>
          </>
        )}
      </main>
    </>
  );
}
