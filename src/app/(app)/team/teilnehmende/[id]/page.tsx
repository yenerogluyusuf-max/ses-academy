import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Phone, QrCode, Send } from "lucide-react";
import { Hinweis as Meldung } from "@/components/team/Hinweis";
import { KontaktFormular, KontaktKnoepfe, KontaktVerlauf, NotizFormular, ZusageKnoepfe, kontaktHinweisTexte, kontaktHinweise, type Kontakt } from "@/components/team/Kontakt";
import { Rueckfrage } from "@/components/team/Rueckfrage";
import { TeamKopf } from "@/components/team/TeamKopf";
import { Rueckmeldung, laenderNamen } from "@/components/team/Ui";
import { MailHinweis } from "@/components/team/MailHinweis";
import { darf, getStaff, requireStaff, type Staff } from "@/lib/auth";
import { anwesenheitSetzen, beitragEntfernen, beitragHinzufuegen, personSpeichern, ticketSenden } from "@/lib/aktionen/teilnehmende";
import { auswerten, zusammenfassen } from "@/lib/bewertung";
import { istToken, kurzcodeAnzeige } from "@/lib/codes";
import { mailBereit } from "@/lib/mail";
import { createClient } from "@/lib/supabase/server";
import { teamLocale, type TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";
import { telLink } from "@/lib/telefon";
import { jetztMs } from "@/lib/zeit";

const de = {
  meta: "Teilnehmer:in | SES Academy",
  typen: { kommentar: "Kommentar", video: "Video", grafik: "Grafik", podcast: "Podcast", rede: "Rede", artikel: "Artikel" },
  status: {
    modulAbgesagt: "Modul abgesagt", entschuldigt: "Entschuldigt", storniert: "Storniert", warteliste: "Warteliste", nichtBestaetigt: "Nicht bestätigt",
    angemeldet: "Angemeldet", laeuft: "Läuft · noch nicht da", nichtGekommen: "Nicht gekommen",
    teilgenommen: (da: number, tage: number) => `Teilgenommen · ${da}/${tage} ${tage === 1 ? "Tag" : "Tage"}`,
  },
  /** Gesamturteil der Hausaufgaben-Bewertung (lib/bewertung liefert es deutsch) */
  urteile: {} as Record<string, string>,
  alleTeilnehmenden: "← Alle Teilnehmenden",
  weiblich: "weiblich",
  maennlich: "männlich",
  keineRegion: "Keine Region eingetragen",
  verantwortlich: "verantwortlich:",
  keineMail: "keine E-Mail-Adresse",
  aktiv: "Aktiv",
  ausgeschieden: "Ausgeschieden",
  imPortal: "Im Portal angemeldet",
  nieImPortal: "Noch nie im Portal",
  datenschutzFehlt: "Datenschutz-Einwilligung fehlt",
  kurzcode: (code: string) => `Kurzcode ${code}`,
  qrAnsehen: "QR-Code ansehen",
  qrMail: "QR-Code per Mail",
  anwesenheit: "Anwesenheit",
  vonTagen: (da: number, faellig: number) => `${da} von ${faellig}`,
  tagenDa: "Tagen da",
  keineTageVorbei: "noch keine Modultage vorbei",
  zuletztDa: "Zuletzt da",
  nochNie: "noch nie",
  /** Nach der Anzahl der Abgaben (Französisch mit Plural) */
  abgegeben: (() => "abgegeben") as (anzahl: number) => string,
  vonFuenf: "von 5",
  verpasst: (n: number) => `Zuletzt ${n} Modultage in Folge verpasst. Vielleicht kurz nachfragen?`,
  moduleUndAnwesenheit: "Module und Anwesenheit",
  zurAuswertung: "zur Auswertung",
  tagAntippen: "Einen Tag antippen, um die Anwesenheit nachzutragen oder zurückzunehmen. Jede Änderung wird protokolliert.",
  zusage: "Zusage:",
  eingecheckt: (methode: string) => `eingecheckt (${methode}), zum Zurücknehmen tippen`,
  nichtEingecheckt: "nicht eingecheckt, zum Nachtragen tippen",
  keinModul: "Für kein Modul angemeldet.",
  zimmer: "Zimmer",
  zimmerNr: (label: string) => `Zimmer ${label}`,
  mit: (namen: string) => `mit ${namen}`,
  allein: "allein",
  hausaufgabe: (n: number | undefined) => `Hausaufgabe ${n ?? ""}`,
  titelZusatz: (titel: string) => `: ${titel}`,
  video: (label: string) => `Video: ${label}`,
  punkte: (punkte: number) => `${punkte} / 45 Punkte`,
  nichtBewertet: "noch nicht bewertet",
  keineAbgabe: "Noch keine Abgabe erfasst.",
  beitraege: "Stimmen-Beiträge",
  link: "Link",
  aufWebsite: "auf der Website",
  entfernen: "Entfernen",
  jaEntfernen: "Ja, entfernen",
  beitragFrage: (titel: string) => `Beitrag „${titel}“ entfernen?`,
  keineBeitraege: "Noch keine Beiträge verknüpft.",
  beitragVerknuepfen: "+ Beitrag verknüpfen",
  art: "Art",
  linkPlatzhalter: "Link (Zeitung, YouTube …)",
  medium: "Medium, z. B. Perspektif",
  slug: "Slug auf der Website (optional)",
  verknuepfen: "Verknüpfen",
  stammdaten: "Stammdaten",
  vornamen: "Vorname(n)",
  bitteWaehlen: "bitte wählen",
  land: "Land",
  ausRegion: "aus Region übernehmen",
  geschlecht: "Geschlecht",
  keineAngabe: "keine Angabe",
  verantwortlichePerson: "Verantwortliche Person",
  keine: "keine",
  nimmtTeil: "Nimmt aktiv teil",
  anrufeUndNotizen: "Anrufe und Notizen",
  anrufEintragen: "Anruf eintragen",
  sorumlu: (name: string) => `Sorumlu ${name}`,
  ausgeschiedenKlein: "ausgeschieden",
  moduleUndZusagen: "Module und Zusagen",
  daTage: (d: number) => `da · ${d} ${d === 1 ? "Tag" : "Tage"}`,
  nichtGekommen: "nicht gekommen",
  warteliste: "Warteliste",
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    meta: "Katılımcı | SES Academy",
    typen: { kommentar: "Yorum", video: "Video", grafik: "Grafik", podcast: "Podcast", rede: "Konuşma", artikel: "Makale" },
    status: {
      modulAbgesagt: "Modül iptal edildi", entschuldigt: "Mazeretli", storniert: "Kayıt iptal", warteliste: "Bekleme listesi", nichtBestaetigt: "Onaylanmadı",
      angemeldet: "Kayıtlı", laeuft: "Devam ediyor · henüz gelmedi", nichtGekommen: "Gelmedi",
      teilgenommen: (da, tage) => `Katıldı · ${da}/${tage} gün`,
    },
    urteile: {
      "Sehr überzeugend": "Çok ikna edici", "Überzeugend": "İkna edici", "Solide": "Sağlam", "Ausbaufähig": "Geliştirilebilir",
      "Deutlicher Verbesserungsbedarf": "Belirgin gelişim ihtiyacı",
    },
    alleTeilnehmenden: "← Tüm katılımcılar",
    weiblich: "kadın",
    maennlich: "erkek",
    keineRegion: "Bölge girilmemiş",
    verantwortlich: "sorumlu:",
    keineMail: "e-posta adresi yok",
    aktiv: "Aktif",
    ausgeschieden: "Ayrıldı",
    imPortal: "Portala giriş yaptı",
    nieImPortal: "Portala hiç girmedi",
    datenschutzFehlt: "Veri koruma onayı eksik",
    kurzcode: (code) => `Kısa kod ${code}`,
    qrAnsehen: "QR kodu gör",
    qrMail: "QR kodu e-postayla gönder",
    anwesenheit: "Katılım",
    vonTagen: (da, faellig) => `${da}/${faellig}`,
    tagenDa: "gün geldi",
    keineTageVorbei: "henüz geçmiş modül günü yok",
    zuletztDa: "Son katılım",
    nochNie: "hiç gelmedi",
    abgegeben: () => "teslim edildi",
    vonFuenf: "/ 5",
    verpasst: (n) => `Son ${n} modül gününü üst üste kaçırdı. Kısaca arayıp sormak iyi olabilir.`,
    moduleUndAnwesenheit: "Modüller ve katılım",
    zurAuswertung: "değerlendirmeye git",
    tagAntippen: "Katılımı sonradan eklemek veya geri almak için bir güne dokun. Her değişiklik kayda geçer.",
    zusage: "Katılım cevabı:",
    eingecheckt: (methode) => `giriş yapıldı (${methode}), geri almak için dokun`,
    nichtEingecheckt: "giriş yapılmadı, eklemek için dokun",
    keinModul: "Hiçbir modüle kayıtlı değil.",
    zimmer: "Oda",
    zimmerNr: (label) => `Oda ${label}`,
    mit: (namen) => `${namen} ile`,
    allein: "tek başına",
    hausaufgabe: (n) => `Ödev ${n ?? ""}`,
    titelZusatz: (titel) => `: ${titel}`,
    video: (label) => `Video: ${label}`,
    punkte: (punkte) => `${punkte} / 45 puan`,
    nichtBewertet: "henüz değerlendirilmedi",
    keineAbgabe: "Henüz teslim kaydı yok.",
    beitraege: "Stimmen katkıları",
    link: "Bağlantı",
    aufWebsite: "web sitesinde",
    entfernen: "Kaldır",
    jaEntfernen: "Evet, kaldır",
    beitragFrage: (titel) => `“${titel}” katkısı kaldırılsın mı?`,
    keineBeitraege: "Henüz bağlı katkı yok.",
    beitragVerknuepfen: "+ Katkı bağla",
    art: "Tür",
    linkPlatzhalter: "Bağlantı (gazete, YouTube …)",
    medium: "Yayın organı, ör. Perspektif",
    slug: "Web sitesindeki slug (isteğe bağlı)",
    verknuepfen: "Bağla",
    stammdaten: "Temel bilgiler",
    vornamen: "Ad(lar)",
    bitteWaehlen: "lütfen seç",
    land: "Ülke",
    ausRegion: "bölgeden al",
    geschlecht: "Cinsiyet",
    keineAngabe: "belirtilmemiş",
    verantwortlichePerson: "Sorumlu",
    keine: "yok",
    nimmtTeil: "Aktif olarak katılıyor",
    anrufeUndNotizen: "Aramalar ve notlar",
    anrufEintragen: "Arama kaydet",
    sorumlu: (name) => `Sorumlu ${name}`,
    ausgeschiedenKlein: "ayrıldı",
    moduleUndZusagen: "Modüller ve katılım cevapları",
    daTage: (d) => `geldi · ${d} gün`,
    nichtGekommen: "gelmedi",
    warteliste: "Bekleme listesi",
  },
  fr: {
    meta: "Participant·e | SES Academy",
    typen: { kommentar: "Commentaire", video: "Vidéo", grafik: "Graphique", podcast: "Podcast", rede: "Discours", artikel: "Article" },
    status: {
      modulAbgesagt: "Module annulé", entschuldigt: "Excusé·e", storniert: "Désinscrit·e", warteliste: "Liste d’attente", nichtBestaetigt: "Non confirmé",
      angemeldet: "Inscrit·e", laeuft: "En cours · pas encore là", nichtGekommen: "Absent·e",
      teilgenommen: (da, tage) => `Présent·e · ${da}/${tage} jour${tage > 1 ? "s" : ""}`,
    },
    urteile: {
      "Sehr überzeugend": "Très convaincant", "Überzeugend": "Convaincant", "Solide": "Solide", "Ausbaufähig": "Perfectible",
      "Deutlicher Verbesserungsbedarf": "Nette marge de progression",
    },
    alleTeilnehmenden: "← Tous les participants",
    weiblich: "femme",
    maennlich: "homme",
    keineRegion: "Aucune région renseignée",
    verantwortlich: "Sorumlu :",
    keineMail: "pas d’adresse e-mail",
    aktiv: "Actif·ve",
    ausgeschieden: "A quitté le programme",
    imPortal: "Connecté·e au portail",
    nieImPortal: "Jamais connecté·e au portail",
    datenschutzFehlt: "Consentement RGPD manquant",
    kurzcode: (code) => `Code court ${code}`,
    qrAnsehen: "Voir le QR code",
    qrMail: "QR code par e-mail",
    anwesenheit: "Présence",
    vonTagen: (da, faellig) => `${da} sur ${faellig}`,
    tagenDa: "jours de présence",
    keineTageVorbei: "aucun jour de module passé pour l’instant",
    zuletztDa: "Dernière présence",
    nochNie: "jamais",
    abgegeben: (n) => (n > 1 ? "rendus" : "rendu"),
    vonFuenf: "sur 5",
    verpasst: (n) => `A manqué les ${n} derniers jours de module d’affilée. Peut-être prendre des nouvelles ?`,
    moduleUndAnwesenheit: "Modules et présence",
    zurAuswertung: "vers l’analyse",
    tagAntippen: "Touche un jour pour ajouter ou annuler une présence. Chaque modification est enregistrée.",
    zusage: "Réponse :",
    eingecheckt: (methode) => `présence enregistrée (${methode}), touche pour annuler`,
    nichtEingecheckt: "pas de présence enregistrée, touche pour l’ajouter",
    keinModul: "Inscrit·e à aucun module.",
    zimmer: "Chambre",
    zimmerNr: (label) => `Chambre ${label}`,
    mit: (namen) => `avec ${namen}`,
    allein: "seul·e",
    hausaufgabe: (n) => `Devoir ${n ?? ""}`,
    titelZusatz: (titel) => ` : ${titel}`,
    video: (label) => `Vidéo : ${label}`,
    punkte: (punkte) => `${punkte} / 45 points`,
    nichtBewertet: "pas encore évalué",
    keineAbgabe: "Aucun devoir rendu enregistré pour l’instant.",
    beitraege: "Contributions Stimmen",
    link: "Lien",
    aufWebsite: "sur le site",
    entfernen: "Retirer",
    jaEntfernen: "Oui, retirer",
    beitragFrage: (titel) => `Retirer la contribution « ${titel} » ?`,
    keineBeitraege: "Aucune contribution liée pour l’instant.",
    beitragVerknuepfen: "+ Lier une contribution",
    art: "Type",
    linkPlatzhalter: "Lien (journal, YouTube…)",
    medium: "Média, p. ex. Perspektif",
    slug: "Slug sur le site (facultatif)",
    verknuepfen: "Lier",
    stammdaten: "Données de base",
    vornamen: "Prénom(s)",
    bitteWaehlen: "à choisir",
    land: "Pays",
    ausRegion: "reprendre de la région",
    geschlecht: "Genre",
    keineAngabe: "non renseigné",
    verantwortlichePerson: "Sorumlu",
    keine: "aucun",
    nimmtTeil: "Participe activement",
    anrufeUndNotizen: "Appels et notes",
    anrufEintragen: "Noter un appel",
    sorumlu: (name) => `Sorumlu ${name}`,
    ausgeschiedenKlein: "a quitté le programme",
    moduleUndZusagen: "Modules et réponses",
    daTage: (d) => `présent·e · ${d} jour${d > 1 ? "s" : ""}`,
    nichtGekommen: "absent·e",
    warteliste: "Liste d’attente",
  },
};

/** Datumsformate je Sprache des Team-Bereichs. */
const formate = Object.fromEntries((Object.keys(teamLocale) as TeamSprache[]).map((l) => {
  const lang = new Intl.DateTimeFormat(teamLocale[l], { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" });
  const kurz = new Intl.DateTimeFormat(teamLocale[l], { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Berlin" });
  return [l, {
    tag: new Intl.DateTimeFormat(teamLocale[l], { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Berlin" }),
    datum: (d: string) => lang.format(new Date(d)),
    kurzDatum: (d: string) => kurz.format(new Date(d)),
  }];
})) as Record<TeamSprache, { tag: Intl.DateTimeFormat; datum: (d: string) => string; kurzDatum: (d: string) => string }>;

export async function generateMetadata(): Promise<Metadata> {
  return { title: T[(await getStaff())?.sprache ?? "de"].meta };
}

type Reg = {
  id: string; status: string; rsvp: string | null;
  modules: { id: string; title: string; cancelled_at: string | null; module_days: { id: string; starts_at: string; ends_at: string }[] };
  attendances: { id: string; module_day_id: string; method: string }[];
};
type Abg = { submissions: { id: string; label: string; assignments: { number: number; title: string } | null; reviews: Record<string, number | null>[] } | null };

/** Status eines Moduls aus Sicht der Person. */
function status(r: Reg, tage: Reg["modules"]["module_days"], jetzt: number, t: (typeof de)["status"]) {
  const vorbei = tage.filter((x) => Date.parse(x.ends_at) < jetzt).length;
  const da = r.attendances.length;
  if (r.modules.cancelled_at) return { text: t.modulAbgesagt, klasse: "bg-paper-deep" };
  if (r.status === "excused") return { text: t.entschuldigt, klasse: "bg-paper-deep" };
  if (r.status === "cancelled") return { text: t.storniert, klasse: "bg-paper-deep" };
  if (r.status === "waitlist") return { text: t.warteliste, klasse: "bg-gelb-hell" };
  if (r.status !== "confirmed") return { text: t.nichtBestaetigt, klasse: "bg-gelb-hell" };
  if (vorbei === 0) return { text: t.angemeldet, klasse: "bg-weiss ring-1 ring-line" };
  if (da === 0) return { text: vorbei < tage.length ? t.laeuft : t.nichtGekommen, klasse: "bg-rot-hell text-rot" };
  return { text: t.teilgenommen(da, tage.length), klasse: "bg-gruen-hell" };
}

function Hinweis({ ton, children }: { ton: "gut" | "warnung" | "neutral"; children: React.ReactNode }) {
  const farbe = ton === "gut" ? "bg-gruen-hell" : ton === "warnung" ? "bg-gelb-hell" : "bg-paper-deep";
  return <span className={`chip ${farbe} py-1`}>{children}</span>;
}

export default async function Person({ params, searchParams }: PageProps<"/team/teilnehmende/[id]">) {
  const staff = await requireStaff("orga");
  const l = staff.sprache;
  const t = T[l];
  const w = teamTexte[l].wort;
  const { tag: tagFormat, datum, kurzDatum } = formate[l];
  const laender = laenderNamen[l];
  const { id } = await params;
  const sp = await searchParams;
  if (!istToken(id)) notFound();
  const modulAusLink = typeof sp.modul === "string" && istToken(sp.modul) ? sp.modul : null;
  if (!darf.alles(staff.role)) return <OrgaKarte staff={staff} id={id} modulId={modulAusLink} hinweis={sp.hinweis} />;
  const supabase = await createClient();
  const [{ data: p }, { data: regionen }, { data: mentoren }, { data: regs }, { data: abg }, { data: beitraege }, { data: kennzahlen }, { data: kontakte }, { data: zimmer }] = await Promise.all([
    supabase.from("participants").select("*").eq("id", id).maybeSingle(),
    supabase.from("regions").select("id,name").order("name"),
    supabase.from("mentors").select("id,name").order("name"),
    supabase.from("registrations").select("id,status,rsvp,modules(id,title,cancelled_at,module_days(id,starts_at,ends_at)),attendances(id,module_day_id,method)").eq("participant_id", id),
    supabase.from("submission_participants").select("submissions(id,label,assignments(number,title),reviews(*))").eq("participant_id", id),
    supabase.from("contributions").select("*").eq("participant_id", id).order("published_on", { ascending: false }),
    supabase.rpc("get_participant_analytics"),
    supabase.rpc("get_contacts", { p_participant_id: id }),
    supabase.rpc("get_person_rooms", { p_participant_id: id }),
  ]);
  if (!p) notFound();
  const jetzt = jetztMs();
  const k = (kennzahlen ?? []).find((a) => a.participant_id === id);
  const anmeldungen = ((regs ?? []) as unknown as Reg[])
    .map((r) => ({ ...r, tage: [...r.modules.module_days].sort((a, b) => a.starts_at.localeCompare(b.starts_at)) }))
    .sort((a, b) => (a.tage[0]?.starts_at ?? "9").localeCompare(b.tage[0]?.starts_at ?? "9"));
  const abgaben = ((abg ?? []) as unknown as Abg[]).map((a) => a.submissions!).filter(Boolean)
    .sort((a, b) => (a.assignments?.number ?? 0) - (b.assignments?.number ?? 0));
  const name = `${p.first_name} ${p.last_name}`.trim();
  const region = regionen?.find((r) => r.id === p.region_id)?.name;
  const mentor = mentoren?.find((m) => m.id === p.mentor_id)?.name;
  const mailAn = mailBereit();
  const besucht = k?.total_attended ?? 0;
  const faellig = besucht + (k?.total_no_shows ?? 0);
  const noten = abgaben.map((a) => zusammenfassen(a.reviews).durchschnitt).filter((d): d is number => d != null);
  const notenSchnitt = noten.length ? Math.round((noten.reduce((x, y) => x + y, 0) / noten.length) * 10) / 10 : null;
  const code = typeof sp.hinweis === "string" ? sp.hinweis : undefined;

  return (
    <>
      <TeamKopf staff={staff} aktiv="teilnehmende" breit />
      <main lang={l} className="mx-auto max-w-7xl px-4 py-8">
        <Link href={`/team/teilnehmende/${modulAusLink ? `?modul=${modulAusLink}` : ""}`} className="text-sm font-semibold text-ink-soft hover:text-ink">{t.alleTeilnehmenden}</Link>

        {/* Kopf: wer ist das, wie erreiche ich die Person, was ist offen */}
        <header className="karte mt-3 mb-6">
          <div className="flex flex-wrap items-start gap-5">
            {p.photo_path
              ? <img src={`/portal/foto/${p.id}/`} alt="" className="h-20 w-20 shrink-0 rounded-full object-cover ring-1 ring-line" />
              : <span aria-hidden className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-forest font-display text-2xl font-bold text-paper">
                  {(p.first_name[0] ?? "") + (p.last_name[0] ?? "")}
                </span>}
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-3xl leading-tight font-extrabold sm:text-4xl">{name}</h1>
              <p className="mt-1 text-ink-soft">
                {[region, p.country && p.country !== "other" ? laender[p.country] : null, p.branch, p.gender === "w" ? t.weiblich : p.gender === "m" ? t.maennlich : null].filter(Boolean).join(" · ") || t.keineRegion}
                {mentor && <> · {t.verantwortlich} <span className="font-semibold text-ink">{mentor}</span></>}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
                {p.email
                  ? <a href={`mailto:${p.email}`} className="inline-flex items-center gap-1.5 font-semibold hover:underline"><Mail aria-hidden className="h-4 w-4 text-ink-soft" />{p.email}</a>
                  : <span className="inline-flex items-center gap-1.5 text-rot"><Mail aria-hidden className="h-4 w-4" />{t.keineMail}</span>}
                {p.phone && <a href={telLink(p.phone)} className="inline-flex items-center gap-1.5 font-semibold hover:underline"><Phone aria-hidden className="h-4 w-4 text-ink-soft" />{p.phone}</a>}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.active ? <Hinweis ton="gut">{t.aktiv}</Hinweis> : <Hinweis ton="neutral">{t.ausgeschieden}</Hinweis>}
                {p.user_id ? <Hinweis ton="gut">{t.imPortal}</Hinweis> : <Hinweis ton="neutral">{t.nieImPortal}</Hinweis>}
                {!p.privacy_consent_at && <Hinweis ton="warnung">{t.datenschutzFehlt}</Hinweis>}
                {p.short_code && <Hinweis ton="neutral">{t.kurzcode(kurzcodeAnzeige(p.short_code))}</Hinweis>}
              </div>
            </div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-col">
              <a href={`/ticket/${p.link_token}/`} target="_blank" rel="noopener noreferrer" className="knopf-hell"><QrCode aria-hidden className="h-4 w-4" />{t.qrAnsehen}</a>
              <form action={ticketSenden}>
                <input type="hidden" name="id" value={p.id} />
                <button className="knopf w-full" disabled={!p.email || !mailAn}><Send aria-hidden className="h-4 w-4" />{t.qrMail}</button>
              </form>
              <MailHinweis knapp className="max-w-56" sprache={l} />
            </div>
          </div>

          {/* Kurzbilanz statt vieler Kästen */}
          <dl className="mt-6 grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{t.anwesenheit}</dt>
              <dd className="mt-1">
                <span className="font-display text-2xl font-extrabold">{faellig ? t.vonTagen(besucht, faellig) : "–"}</span>
                <span className="text-sm text-ink-soft"> {faellig ? t.tagenDa : t.keineTageVorbei}</span>
                {faellig > 0 && (
                  <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-paper-deep">
                    <span className={`block h-full rounded-full ${besucht / faellig >= 0.75 ? "bg-forest" : "bg-signal"}`} style={{ width: `${Math.round((besucht / faellig) * 100)}%` }} />
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{t.zuletztDa}</dt>
              <dd className="mt-1">
                {k?.last_attended_at
                  ? <><span className="font-display text-2xl font-extrabold">{kurzDatum(k.last_attended_at)}</span><span className="block text-sm text-ink-soft">{k.last_attended_title}</span></>
                  : <span className="text-ink-soft">{t.nochNie}</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{teamTexte[l].bereiche.hausaufgaben}</dt>
              <dd className="mt-1">
                <span className="font-display text-2xl font-extrabold">{abgaben.length}</span>
                <span className="text-sm text-ink-soft"> {t.abgegeben(abgaben.length)}{notenSchnitt != null && <> · Ø <span className="font-semibold text-ink">{notenSchnitt.toLocaleString(teamLocale[l])}</span> {t.vonFuenf}</>}</span>
              </dd>
            </div>
          </dl>
          {k && k.trailing_misses >= 2 && (
            <p className="mt-4 rounded-2xl bg-gelb-hell p-3 text-sm font-semibold">{t.verpasst(k.trailing_misses)}</p>
          )}
        </header>

        {code && code in kontaktHinweise
          ? <Meldung code={code} texte={kontaktHinweisTexte[l]} />
          : <Rueckmeldung hinweis={sp.hinweis} fehler={sp.fehler} sprache={l} />}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <section className="karte">
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-2xl font-bold">{t.moduleUndAnwesenheit}</h2>
                <Link href="/team/auswertung/" className="link text-sm">{t.zurAuswertung}</Link>
              </div>
              <p className="mb-3 text-sm text-ink-soft">{t.tagAntippen}</p>
              <ul className="divide-y divide-line">
                {anmeldungen.map((r) => {
                  const s = status(r, r.tage, jetzt, t.status);
                  return (
                    <li key={r.id} className="py-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p><span className="font-semibold">{r.modules.title}</span>{r.tage[0] && <span className="text-sm text-ink-soft"> · {datum(r.tage[0].starts_at)}</span>}</p>
                        <span className={`chip ${s.klasse}`}>{s.text}</span>
                      </div>
                      {r.status === "confirmed" && !r.modules.cancelled_at && r.tage.some((x) => Date.parse(x.ends_at) > jetzt) && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                          <span className="text-ink-soft">{t.zusage}</span>
                          <ZusageKnoepfe participantId={p.id} moduleId={r.modules.id} rsvp={r.rsvp} zurueck={`/team/teilnehmende/${p.id}/`} sprache={l} />
                        </div>
                      )}
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {r.tage.map((x) => {
                          const a = r.attendances.find((y) => y.module_day_id === x.id);
                          const kommt = Date.parse(x.starts_at) > jetzt;
                          return (
                            <form key={x.id} action={anwesenheitSetzen}>
                              <input type="hidden" name="participant_id" value={p.id} />
                              <input type="hidden" name="module_day_id" value={x.id} />
                              {a && <input type="hidden" name="attendance_id" value={a.id} />}
                              <button
                                className={`rounded-full px-3 py-1 text-sm font-semibold transition ${a ? "bg-forest text-paper hover:bg-ink" : kommt ? "text-ink-soft ring-1 ring-line ring-inset hover:ring-ink/30" : "bg-paper text-ink-soft ring-1 ring-line ring-inset hover:ring-ink/30"}`}
                                title={a ? t.eingecheckt(a.method) : t.nichtEingecheckt}>
                                {a ? "✓ " : ""}{tagFormat.format(new Date(x.starts_at))}
                              </button>
                            </form>
                          );
                        })}
                      </div>
                    </li>
                  );
                })}
                {!anmeldungen.length && <li className="py-3 text-ink-soft">{t.keinModul}</li>}
              </ul>
            </section>

            <Verlauf id={p.id} name={name} phone={p.phone} sprache={l} modulId={modulAusLink ?? anmeldungen.find((r) => !r.modules.cancelled_at && r.tage.some((x) => Date.parse(x.ends_at) > jetzt))?.modules.id ?? null} kontakte={(kontakte ?? []) as Kontakt[]} />

            {(zimmer ?? []).length > 0 && (
              <section className="karte">
                <h2 className="font-display mb-3 text-2xl font-bold">{t.zimmer}</h2>
                <ul className="divide-y divide-line text-sm">
                  {(zimmer ?? []).map((z) => (
                    <li key={z.module_id} className="py-2">
                      <span className="font-semibold">{z.module_title}</span>{z.module_start && <span className="text-ink-soft"> · {kurzDatum(z.module_start)}</span>} · {t.zimmerNr(z.room_label)}
                      <span className="block text-ink-soft">{z.mates.length ? t.mit(z.mates.join(", ")) : t.allein}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="karte">
              <h2 className="font-display mb-3 text-2xl font-bold">{teamTexte[l].bereiche.hausaufgaben}</h2>
              {abgaben.length ? (
                <ul className="divide-y divide-line">
                  {abgaben.map((a) => {
                    const e = zusammenfassen(a.reviews);
                    const punkte = a.reviews.map(auswerten).find((x) => x.durchschnitt != null);
                    return (
                      <li key={a.id} className="py-3">
                        <Link href={`/team/abgaben/${a.id}/`} className="group flex flex-wrap items-center justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block font-semibold group-hover:underline">{t.hausaufgabe(a.assignments?.number)}{a.assignments?.title && !/^hausaufgabe \d+$/i.test(a.assignments.title) ? t.titelZusatz(a.assignments.title) : ""}</span>
                            {a.label.trim() !== name && <span className="block text-sm text-ink-soft">{t.video(a.label)}</span>}
                          </span>
                          {e.durchschnitt != null
                            ? <span className="flex items-center gap-2">
                                {punkte?.anzahl === 9 && <span className="text-sm text-ink-soft">{t.punkte(punkte.punkte)}</span>}
                                <span className="chip bg-gruen-hell py-1">{e.durchschnitt.toLocaleString(teamLocale[l])} · {(e.urteil && t.urteile[e.urteil]) ?? e.urteil}</span>
                              </span>
                            : <span className="chip bg-paper-deep py-1">{t.nichtBewertet}</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="text-ink-soft">{t.keineAbgabe}</p>}
            </section>

            <section className="karte">
              <h2 className="font-display mb-3 text-2xl font-bold">{t.beitraege}</h2>
              {beitraege?.length ? (
                <ul className="mb-4 divide-y divide-line">
                  {beitraege.map((b) => (
                    <li key={b.id} className="flex items-start justify-between gap-3 py-3">
                      <div>
                        <p className="font-semibold">{b.title}</p>
                        <p className="text-xs text-ink-soft">
                          {t.typen[b.kind as keyof typeof de.typen]}{b.outlet ? ` · ${b.outlet}` : ""}{b.published_on ? ` · ${datum(b.published_on)}` : ""}
                          {b.url && <> · <a href={b.url} target="_blank" rel="noopener noreferrer" className="link">{t.link}</a></>}
                          {b.website_slug && <> · <a href={`/stimmen/${b.website_slug}/`} className="link">{t.aufWebsite}</a></>}
                        </p>
                      </div>
                      <form action={beitragEntfernen} className="max-w-56">
                        <input type="hidden" name="id" value={b.id} /><input type="hidden" name="participant_id" value={p.id} />
                        <Rueckfrage knopf={t.entfernen} knopfKlasse="text-xs text-rot hover:underline" gefahr ja={t.jaEntfernen} frage={t.beitragFrage(b.title)} sprache={l} />
                      </form>
                    </li>
                  ))}
                </ul>
              ) : <p className="mb-4 text-ink-soft">{t.keineBeitraege}</p>}
              <details>
                <summary className="cursor-pointer text-sm font-semibold">{t.beitragVerknuepfen}</summary>
                <form action={beitragHinzufuegen} className="mt-4 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="participant_id" value={p.id} />
                  <select name="kind" className="feld" defaultValue="artikel" aria-label={t.art}>{Object.entries(t.typen).map(([wert, text]) => <option key={wert} value={wert}>{text}</option>)}</select>
                  <input name="published_on" type="date" className="feld" aria-label={w.datum} />
                  <input name="title" required placeholder={w.titel} className="feld sm:col-span-2" />
                  <input name="url" type="url" placeholder={t.linkPlatzhalter} className="feld sm:col-span-2" />
                  <input name="outlet" placeholder={t.medium} className="feld" />
                  <input name="website_slug" placeholder={t.slug} className="feld" />
                  <button className="knopf sm:col-span-2 sm:justify-self-start">{t.verknuepfen}</button>
                </form>
              </details>
            </section>
          </div>

          <section className="karte lg:sticky lg:top-6">
            <h2 className="font-display mb-4 text-2xl font-bold">{t.stammdaten}</h2>
            <form action={personSpeichern} className="grid gap-x-3 gap-y-4 sm:grid-cols-2">
              <input type="hidden" name="id" value={p.id} />
              <div><label className="etikett" htmlFor="first_name">{t.vornamen}</label><input id="first_name" name="first_name" required defaultValue={p.first_name} className="feld" /></div>
              <div><label className="etikett" htmlFor="last_name">{w.nachname}</label><input id="last_name" name="last_name" defaultValue={p.last_name} className="feld" /></div>
              <div className="sm:col-span-2"><label className="etikett" htmlFor="email">{w.email}</label><input id="email" name="email" type="email" defaultValue={p.email ?? ""} className="feld" /></div>
              <div className="sm:col-span-2"><label className="etikett" htmlFor="phone">{w.telefon}</label><input id="phone" name="phone" defaultValue={p.phone ?? ""} className="feld" /></div>
              <div>
                <label className="etikett" htmlFor="region_id">{w.region}</label>
                <select id="region_id" name="region_id" defaultValue={p.region_id ?? ""} className="feld">
                  <option value="">{t.bitteWaehlen}</option>
                  {regionen?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="etikett" htmlFor="country">{t.land}</label>
                <select id="country" name="country" defaultValue={p.country ?? ""} className="feld">
                  <option value="">{t.ausRegion}</option>
                  {Object.entries(laender).map(([kuerzel, v]) => <option key={kuerzel} value={kuerzel}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="etikett" htmlFor="branch">GT / KGT</label>
                <select id="branch" name="branch" defaultValue={p.branch ?? ""} className="feld">
                  <option value="">{t.bitteWaehlen}</option><option>GT</option><option>KGT</option>
                </select>
              </div>
              <div>
                <label className="etikett" htmlFor="gender">{t.geschlecht}</label>
                <select id="gender" name="gender" defaultValue={p.gender ?? ""} className="feld">
                  <option value="">{t.keineAngabe}</option><option value="w">{t.weiblich}</option><option value="m">{t.maennlich}</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="etikett" htmlFor="mentor_id">{t.verantwortlichePerson}</label>
                <select id="mentor_id" name="mentor_id" defaultValue={p.mentor_id ?? ""} className="feld">
                  <option value="">{t.keine}</option>
                  {mentoren?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
                <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="active" defaultChecked={p.active} className="h-4 w-4 accent-ink" /> {t.nimmtTeil}</label>
                <button className="knopf">{w.speichern}</button>
              </div>
            </form>
          </section>
        </div>
      </main>
    </>
  );
}

/** Anrufe und Notizen zur Person, neueste zuerst; darüber Notiz schreiben und Anruf eintragen. */
function Verlauf({ id, name, phone, modulId, kontakte, sprache }: { id: string; name: string; phone: string | null; modulId: string | null; kontakte: Kontakt[]; sprache: TeamSprache }) {
  const t = T[sprache];
  const zurueck = `/team/teilnehmende/${id}/${modulId ? `?modul=${modulId}` : ""}`;
  return (
    <section className="karte scroll-mt-4" id={`p-${id}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-2xl font-bold">{t.anrufeUndNotizen}</h2>
        <KontaktKnoepfe name={name} phone={phone} sprache={sprache} />
      </div>
      <NotizFormular participantId={id} moduleId={modulId} zurueck={zurueck} sprache={sprache} />
      <div className="mt-3 rounded-2xl bg-paper p-3">
        <p className="mb-2 text-xs font-semibold tracking-wide text-ink-soft uppercase">{t.anrufEintragen}</p>
        <KontaktFormular participantId={id} moduleId={modulId} zurueck={zurueck} sprache={sprache} />
      </div>
      <div className="mt-4"><KontaktVerlauf eintraege={kontakte} zurueck={zurueck} mitModul sprache={sprache} /></div>
    </section>
  );
}

type OrgaPerson = { name: string; phone: string | null; region: string | null; mentor_name: string | null; branch: string | null; active: boolean; modules: { m: string; s: string; r: string | null; d: number }[] };

/**
 * Ansicht für das Orga-Team: Telefon, Sorumlu, Zusagen je Modul, Anrufe und Notizen. Ohne E-Mail, Stammdaten,
 * Hausaufgaben und Beiträge (die sieht nur Admin/Vorstand).
 */
async function OrgaKarte({ staff, id, modulId, hinweis }: { staff: Staff; id: string; modulId: string | null; hinweis?: string | string[] }) {
  const l = staff.sprache;
  const t = T[l];
  const { datum } = formate[l];
  const supabase = await createClient();
  const [{ data: zeilen }, { data: kontakte }, { data: module }] = await Promise.all([
    supabase.rpc("get_people", { p_participant_id: id }),
    supabase.rpc("get_contacts", { p_participant_id: id }),
    supabase.from("modules").select("id, title, cancelled_at, module_days(starts_at, ends_at)").neq("status", "draft"),
  ]);
  const p = (zeilen ?? [])[0] as unknown as OrgaPerson | undefined;
  if (!p) notFound();
  const jetzt = jetztMs();
  const kommend = (module ?? [])
    .map((m) => ({ ...m, beginn: m.module_days.map((x) => x.starts_at).sort()[0] ?? "", ende: m.module_days.map((x) => x.ends_at).sort().at(-1) ?? "", reg: p.modules.find((r) => r.m === m.id) }))
    .filter((m) => m.reg && m.beginn && !m.cancelled_at)
    .sort((a, b) => a.beginn.localeCompare(b.beginn));
  return (
    <>
      <TeamKopf staff={staff} aktiv="teilnehmende" breit />
      <main lang={l} className="mx-auto max-w-4xl px-4 py-8">
        <Link href={`/team/teilnehmende/${modulId ? `?modul=${modulId}` : ""}`} className="text-sm font-semibold text-ink-soft hover:text-ink">{t.alleTeilnehmenden}</Link>
        <header className="karte mt-3 mb-6">
          <h1 className="font-display text-3xl font-extrabold">{p.name}</h1>
          <p className="mt-1 text-ink-soft">
            {[p.region, p.branch, p.mentor_name && t.sorumlu(p.mentor_name), !p.active && t.ausgeschiedenKlein].filter(Boolean).join(" · ") || t.keineRegion}
          </p>
          {p.phone && <p className="mt-2 inline-flex items-center gap-1.5 font-semibold"><Phone aria-hidden className="h-4 w-4 text-ink-soft" />{p.phone}</p>}
        </header>
        <Meldung code={hinweis} texte={kontaktHinweisTexte[l]} />
        <section className="karte mb-6">
          <h2 className="font-display mb-3 text-2xl font-bold">{t.moduleUndZusagen}</h2>
          <ul className="divide-y divide-line">
            {kommend.map((m) => {
              const vorbei = Date.parse(m.ende) < jetzt;
              return (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <p><span className="font-semibold">{m.title}</span><span className="text-sm text-ink-soft"> · {datum(m.beginn)}</span></p>
                  {vorbei
                    ? <span className="chip bg-paper-deep">{m.reg!.d > 0 ? t.daTage(m.reg!.d) : m.reg!.s === "confirmed" ? t.nichtGekommen : teamTexte[l].anmeldung.excused}</span>
                    : m.reg!.s === "confirmed"
                      ? <ZusageKnoepfe participantId={id} moduleId={m.id} rsvp={m.reg!.r} zurueck={`/team/teilnehmende/${id}/${modulId ? `?modul=${modulId}` : ""}`} sprache={l} />
                      : <span className="chip bg-paper-deep">{m.reg!.s === "waitlist" ? t.warteliste : teamTexte[l].anmeldung.cancelled}</span>}
                </li>
              );
            })}
            {kommend.length === 0 && <li className="py-3 text-ink-soft">{t.keinModul}</li>}
          </ul>
        </section>
        <Verlauf id={id} name={p.name} phone={p.phone} sprache={l} modulId={modulId ?? kommend.find((m) => Date.parse(m.ende) > jetzt)?.id ?? null} kontakte={(kontakte ?? []) as Kontakt[]} />
      </main>
    </>
  );
}
