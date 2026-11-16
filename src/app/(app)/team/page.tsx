import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarClock, Megaphone, ScanLine, ShieldCheck } from "lucide-react";
import { MailHinweis } from "@/components/team/MailHinweis";
import { TeamKopf } from "@/components/team/TeamKopf";
import { darf, getStaff, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { teamLocale, type TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";
import { jetztMs } from "@/lib/zeit";

const de = {
  seitentitel: "Team | SES Academy",
  tagLabel: (n: number) => (n === 0 ? "heute" : n === 1 ? "morgen" : `in ${n} Tagen`),
  gruss: (vorname: string) => `Salam, ${vorname}`,
  keineRechte: "Für diesen Bereich fehlt deiner Rolle die Berechtigung.",
  zugangVor: "Dein Zugang gilt nur für ",
  einModul: "ein Modul",
  zugangNach: "",
  zugangBis: (datum: string) => ` bis ${datum}`,
  zugangEnde: ": Einlass und Regieplan dieses Moduls.",
  einlassOeffnen: "Einlass öffnen",
  einlassText: "QR-Codes scannen oder Kurzcode eingeben",
  regieplanText: "Was läuft gerade, was kommt als Nächstes",
  freigaben: (n: number) => `${n} ${n === 1 ? "Antrag wartet" : "Anträge warten"} auf deine Freigabe`,
  loeschungen: (n: number) => `${n} ${n === 1 ? "Löschantrag wartet" : "Löschanträge warten"} auf Bearbeitung`,
  stimmen: (n: number) => `${n} ${n === 1 ? "eingereichter Beitrag wartet" : "eingereichte Beiträge warten"} auf Prüfung (Stimmen)`,
  naechstesModul: "Nächstes Modul",
  modulOeffnen: "Modul öffnen",
  zimmerplan: "Zimmerplan",
  angemeldet: "angemeldet",
  infoMails: "Info-Mails verschickt",
  aufgabenErledigt: "Aufgaben erledigt",
  checklisteAnlegen: "Checkliste anlegen",
  programmpunkte: "Programmpunkte",
  keinModul: "Noch kein Modul geplant",
  modulAnlegen: "Modul anlegen",
  meineAufgaben: "Meine Aufgaben",
  nichtsOffen: "Nichts offen. Aufgaben weist man in der Checkliste eines Moduls oder in einer Sitzung zu.",
  erledigt: (titel: string) => `„${titel}“ erledigt`,
  fristenBis: (datum: string) => `Fristen bis ${datum}`,
  ueberfaellig: (n: number) => `${n} überfällig`,
  stornofrist: (hotel: string, modul: string | undefined) => `Stornofrist ${hotel} (${modul})`,
  hausaufgabe: (nummer: number, titel: string) => `Hausaufgabe ${nummer}: ${titel}`,
  keineFristen: "Keine Fristen in den nächsten zwei Wochen.",
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    seitentitel: "Ekip | SES Academy",
    tagLabel: (n) => (n === 0 ? "bugün" : n === 1 ? "yarın" : `${n} gün sonra`),
    gruss: (vorname) => `Selam, ${vorname}`,
    keineRechte: "Rolünün bu alan için yetkisi yok.",
    zugangVor: "Erişimin yalnızca ",
    einModul: "bir modül",
    zugangNach: " için geçerli",
    zugangBis: (datum) => ` (${datum} tarihine kadar)`,
    zugangEnde: ": bu modülün girişi ve akış planı.",
    einlassOeffnen: "Girişi aç",
    einlassText: "QR kodları tara ya da kısa kodu gir",
    regieplanText: "Şu an ne var, sırada ne var",
    freigaben: (n) => `Onayını bekleyen ${n} talep var`,
    loeschungen: (n) => `İşlem bekleyen ${n} silme talebi var`,
    stimmen: (n) => `İnceleme bekleyen ${n} katkı var (Sesler)`,
    naechstesModul: "Sıradaki modül",
    modulOeffnen: "Modülü aç",
    zimmerplan: "Oda planı",
    angemeldet: "kayıtlı",
    infoMails: "bilgi e-postası gönderildi",
    aufgabenErledigt: "görev tamamlandı",
    checklisteAnlegen: "Kontrol listesi oluştur",
    programmpunkte: "program maddesi",
    keinModul: "Henüz planlanmış modül yok",
    modulAnlegen: "Modül oluştur",
    meineAufgaben: "Görevlerim",
    nichtsOffen: "Açık görev yok. Görevler bir modülün kontrol listesinde ya da bir toplantıda atanır.",
    erledigt: (titel) => `“${titel}” tamamlandı olarak işaretle`,
    fristenBis: (datum) => `${datum} tarihine kadarki son tarihler`,
    ueberfaellig: (n) => `${n} gecikmiş`,
    stornofrist: (hotel, modul) => `İptal son tarihi: ${hotel} (${modul})`,
    hausaufgabe: (nummer, titel) => `Ödev ${nummer}: ${titel}`,
    keineFristen: "Önümüzdeki iki hafta içinde son tarih yok.",
  },
  fr: {
    seitentitel: "Équipe | SES Academy",
    tagLabel: (n) => (n === 0 ? "aujourd’hui" : n === 1 ? "demain" : `dans ${n} jours`),
    gruss: (vorname) => `Salam, ${vorname}`,
    keineRechte: "Ton rôle ne donne pas accès à cet espace.",
    zugangVor: "Ton accès ne vaut que pour ",
    einModul: "un module",
    zugangNach: "",
    zugangBis: (datum) => ` jusqu’au ${datum}`,
    zugangEnde: " : accueil et déroulé de ce module.",
    einlassOeffnen: "Ouvrir l’accueil",
    einlassText: "Scanner les QR codes ou saisir le code court",
    regieplanText: "Ce qui se passe maintenant, ce qui vient ensuite",
    freigaben: (n) => (n === 1 ? "1 demande attend ta validation" : `${n} demandes attendent ta validation`),
    loeschungen: (n) => (n === 1 ? "1 demande de suppression attend d’être traitée" : `${n} demandes de suppression attendent d’être traitées`),
    stimmen: (n) => (n === 1 ? "1 contribution proposée attend d’être examinée (Voix)" : `${n} contributions proposées attendent d’être examinées (Voix)`),
    naechstesModul: "Prochain module",
    modulOeffnen: "Ouvrir le module",
    zimmerplan: "Plan des chambres",
    angemeldet: "inscrits",
    infoMails: "e-mails d’info envoyés",
    aufgabenErledigt: "tâches terminées",
    checklisteAnlegen: "Créer la liste de contrôle",
    programmpunkte: "points du programme",
    keinModul: "Aucun module prévu pour l’instant",
    modulAnlegen: "Créer un module",
    meineAufgaben: "Mes tâches",
    nichtsOffen: "Rien en attente. Les tâches s’attribuent dans la liste de contrôle d’un module ou lors d’une réunion.",
    erledigt: (titel) => `Marquer la tâche « ${titel} » comme terminée`,
    fristenBis: (datum) => `Échéances jusqu’au ${datum}`,
    ueberfaellig: (n) => `${n} en retard`,
    stornofrist: (hotel, modul) => `Date limite d’annulation : ${hotel} (${modul})`,
    hausaufgabe: (nummer, titel) => `Devoir ${nummer} : ${titel}`,
    keineFristen: "Aucune échéance dans les deux prochaines semaines.",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const l = (await getStaff())?.sprache ?? "de";
  return { title: T[l].seitentitel };
}

/** Texte der Übersicht nach dem Umbau 16.11.2026 (Zweck: was steht an, was ist zu tun, wie lief es zuletzt). */
const S = {
  de: {
    ortFolgt: "Ort folgt", zugesagt: "zugesagt", ohneAntwort: "ohne Rückmeldung", programm: "Programm", ganzesProgramm: "Ganzes Programm",
    keinProgramm: "Noch kein Programm eingetragen.", weitere: (n: number) => `+ ${n} weitere Punkte`,
    zuTun: "Zu erledigen", nichtsZuTun: "Gerade nichts Dringendes.",
    zusagenFehlen: (n: number, modul: string) => `${n} Rückmeldungen für ${modul} fehlen noch`,
    infoMailFehlt: (n: number) => `Info-Mail an ${n} Personen noch nicht verschickt`,
    bewerbungen: (n: number) => `${n} Bewerbungen warten auf Entscheidung`,
    unstimmig: (n: number) => `${n} offene Bewerbungen gehören zu Teilnehmenden (abgleichen)`,
    ohneMail: (n: number) => `${n} Teilnehmende ohne E-Mail-Adresse`,
    letztesModul: "Zuletzt", anwesenheit: (da: number, alle: number) => `Anwesenheit (${da} von ${alle})`,
    feedback: (n: number) => `Feedback Programm (${n} Antworten)`, keinFeedback: "noch kein Feedback", zurAuswertung: "Zur Auswertung des Moduls",
  },
  tr: {
    ortFolgt: "yer bildirilecek", zugesagt: "katılacak", ohneAntwort: "cevap yok", programm: "Program", ganzesProgramm: "Tüm program",
    keinProgramm: "Henüz program girilmedi.", weitere: (n: number) => `+ ${n} madde daha`,
    zuTun: "Yapılacaklar", nichtsZuTun: "Şu an acil bir şey yok.",
    zusagenFehlen: (n: number, modul: string) => `${modul} için ${n} cevap eksik`,
    infoMailFehlt: (n: number) => `Bilgi e-postası ${n} kişiye henüz gönderilmedi`,
    bewerbungen: (n: number) => `${n} başvuru karar bekliyor`,
    unstimmig: (n: number) => `${n} açık başvuru katılımcılara ait (eşleştir)`,
    ohneMail: (n: number) => `${n} katılımcının e-posta adresi yok`,
    letztesModul: "En son", anwesenheit: (da: number, alle: number) => `Katılım (${alle} kişiden ${da})`,
    feedback: (n: number) => `Program geri bildirimi (${n} cevap)`, keinFeedback: "henüz geri bildirim yok", zurAuswertung: "Modül değerlendirmesine git",
  },
  fr: {
    ortFolgt: "lieu à venir", zugesagt: "confirment", ohneAntwort: "sans réponse", programm: "Programme", ganzesProgramm: "Programme complet",
    keinProgramm: "Pas encore de programme.", weitere: (n: number) => `+ ${n} autres points`,
    zuTun: "À faire", nichtsZuTun: "Rien d’urgent pour l’instant.",
    zusagenFehlen: (n: number, modul: string) => `${n} réponses manquent pour ${modul}`,
    infoMailFehlt: (n: number) => `E-mail d’information pas encore envoyé à ${n} personnes`,
    bewerbungen: (n: number) => `${n} candidatures attendent une décision`,
    unstimmig: (n: number) => `${n} candidatures ouvertes concernent des participants (rapprocher)`,
    ohneMail: (n: number) => `${n} participants sans adresse e-mail`,
    letztesModul: "Dernier module", anwesenheit: (da: number, alle: number) => `Présence (${da} sur ${alle})`,
    feedback: (n: number) => `Retours sur le programme (${n} réponses)`, keinFeedback: "pas encore de retours", zurAuswertung: "Voir l’analyse du module",
  },
} satisfies Record<TeamSprache, unknown>;

const tageBis = (tag: string, heute: string) => Math.round((Date.parse(`${tag}T12:00:00Z`) - Date.parse(`${heute}T12:00:00Z`)) / 86_400_000);


/** Übersicht: nächstes Modul mit Stand der Vorbereitung, meine Aufgaben, Fristen, offene Freigaben. */
export default async function TeamStart({ searchParams }: PageProps<"/team">) {
  const staff = await requireStaff();
  const l = staff.sprache;
  const t = T[l];
  const b = teamTexte[l].bereiche;
  const datumLang = new Intl.DateTimeFormat(teamLocale[l], { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Berlin" });
  const datum = new Intl.DateTimeFormat(teamLocale[l], { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const { fehler } = await searchParams;
  const jetzt = jetztMs();
  const heute = new Date(jetzt).toISOString().slice(0, 10);
  const inZweiWochen = new Date(jetzt + 14 * 86_400_000).toISOString().slice(0, 10);
  const supabase = await createClient();
  const vorname = staff.name.split(" ")[0];

  // Einlass-Helfer und auf ein Modul begrenzte Zugänge: nur die Eventtag-Werkzeuge
  if (!darf.orga(staff.role) || staff.modulId) {
    const { data: modul } = staff.modulId ? await supabase.from("modules").select("title").eq("id", staff.modulId).maybeSingle() : { data: null };
    return (
      <>
        <TeamKopf staff={staff} />
        <main lang={l} className="mx-auto max-w-3xl px-4 py-8 lg:py-12">
          <p className="text-sm text-ink-soft">{datumLang.format(new Date(jetzt))}</p>
          <h1 className="font-display mt-1 text-3xl font-bold lg:text-4xl">{t.gruss(vorname)}</h1>
          {fehler === "rechte" && <p role="alert" className="mt-4 rounded-2xl bg-amber-100 p-4 text-amber-900">{t.keineRechte}</p>}
          {staff.modulId && (
            <p className="mt-4 rounded-2xl bg-gelb-hell p-4 text-sm">
              {t.zugangVor}<strong>{modul?.title ?? t.einModul}</strong>{t.zugangNach}{staff.gueltigBis ? t.zugangBis(datumLang.format(new Date(staff.gueltigBis))) : ""}{t.zugangEnde}
            </p>
          )}
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Link href="/team/einlass/" className="rounded-3xl bg-forest p-6 text-paper">
              <ScanLine aria-hidden className="h-7 w-7 text-signal" />
              <p className="font-display mt-6 text-2xl font-bold">{t.einlassOeffnen}</p>
              <p className="mt-1 text-paper/70">{t.einlassText}</p>
            </Link>
            <Link href="/team/regieplan/" className="karte">
              <CalendarClock aria-hidden className="h-7 w-7 text-sage" />
              <p className="font-display mt-6 text-2xl font-bold">{b.regieplan}</p>
              <p className="mt-1 text-ink-soft">{t.regieplanText}</p>
            </Link>
          </div>
        </main>
      </>
    );
  }

  const alles = darf.alles(staff.role);
  const s = S[l];
  const zeit = new Intl.DateTimeFormat(teamLocale[l], { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
  const tagKurz = new Intl.DateTimeFormat(teamLocale[l], { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Berlin" });
  const [{ data: naechste }, { data: hotels }, { data: hausaufgaben }, { count: offeneFreigaben }, { count: offeneLoeschungen }, { data: module }, { count: offeneStimmen }] = await Promise.all([
    supabase.from("module_days").select("id, day, module:modules!inner(id, title, location, status, cancelled_at, slug)").gte("day", heute).eq("module.status", "published").is("module.cancelled_at", null).not("module.slug", "like", "probe-%").order("day").limit(1),
    supabase.from("hotels").select("name, cancellation_deadline, module:modules(id, title)").gte("cancellation_deadline", heute).lte("cancellation_deadline", inZweiWochen),
    supabase.from("assignments").select("number, title, due_date").gte("due_date", heute).lte("due_date", inZweiWochen),
    alles ? supabase.from("approvals").select("id", { count: "exact", head: true }).eq("status", "offen").neq("requested_by", staff.userId) : Promise.resolve({ count: 0 }),
    darf.admin(staff.role) ? supabase.from("deletion_requests").select("id", { count: "exact", head: true }).eq("status", "offen") : Promise.resolve({ count: 0 }),
    supabase.from("modules").select("id, title, slug, cancelled_at, module_days(starts_at, ends_at)").eq("status", "published").is("cancelled_at", null).not("slug", "like", "probe-%"),
    alles ? supabase.from("contributions").select("id", { count: "exact", head: true }).eq("status", "eingereicht") : Promise.resolve({ count: 0 }),
  ]);
  const naechstes = naechste?.[0];

  // Nächstes Modul: Termine mit Programm, Anmeldungen, Zusagen, Info-Mail
  const [{ data: modulTage }, { data: regs }, { data: info }] = naechstes ? await Promise.all([
    supabase.from("module_days").select("id, starts_at, ends_at, label, program_items(id, starts_at, ends_at, title, status)").eq("module_id", naechstes.module.id).order("starts_at"),
    alles ? supabase.from("registrations").select("status, rsvp").eq("module_id", naechstes.module.id) : Promise.resolve({ data: [] as { status: string; rsvp: string | null }[] }),
    alles ? supabase.rpc("get_info_status", { p_module_id: naechstes.module.id }) : Promise.resolve({ data: [] as { info_status: string }[] }),
  ]) : [{ data: [] }, { data: [] }, { data: [] }];
  const bestaetigt = (regs ?? []).filter((r) => r.status === "confirmed");
  const zugesagt = bestaetigt.filter((r) => r.rsvp === "zugesagt").length;
  const ohneAntwort = bestaetigt.filter((r) => !r.rsvp).length;
  const infoGesendet = (info ?? []).filter((x) => x.info_status === "gesendet").length;
  const vorschauTage = (modulTage ?? []).slice(0, 3).map((d) => ({ ...d, punkte: d.program_items.filter((p) => p.status !== "entfaellt").sort((a, b) => a.starts_at.localeCompare(b.starts_at)) }));
  const ersterTag = modulTage?.[0]?.starts_at, letzterTag = modulTage?.at(-1)?.ends_at;

  // Letztes Modul: Anwesenheit und Feedback
  const vorbei = (module ?? []).map((m) => ({ ...m, ende: m.module_days.map((d) => d.ends_at).sort().at(-1) ?? "" }))
    .filter((m) => m.ende && Date.parse(m.ende) < jetzt).sort((a, b) => b.ende.localeCompare(a.ende));
  const letztes = vorbei[0];
  let letzteZahlen: { quote: number | null; da: number; angemeldet: number; feedback: { wert: number; max: number; antworten: number } | null } | null = null;
  if (letztes && alles) {
    const [{ data: stats }, { data: umfrage }] = await Promise.all([
      supabase.rpc("get_module_stats"),
      supabase.from("feedback_surveys").select("id").eq("module_id", letztes.id).maybeSingle(),
    ]);
    const st = (stats ?? []).find((x) => x.module_id === letztes.id);
    const { data: fb } = umfrage ? await supabase.rpc("get_feedback_results", { p_survey_id: umfrage.id }) : { data: null };
    const erste = (fb ?? []).find((x) => x.kind === "skala" && x.average !== null);
    letzteZahlen = { quote: st?.attendance_rate ?? null, da: st?.attended_people ?? 0, angemeldet: st?.registered ?? 0, feedback: erste ? { wert: erste.average, max: erste.scale_max ?? 5, antworten: erste.answers } : null };
  }

  // Was zu tun ist (nur Admin/Vorstand sieht Bewerbungen und E-Mail-Adressen)
  const [{ data: bewerbungen }, { data: personen }] = alles ? await Promise.all([
    supabase.from("applications").select("status, participant_id"),
    supabase.from("participants").select("id, active, email, affiliation_status"),
  ]) : [{ data: [] }, { data: [] }];
  const aktiv = new Set((personen ?? []).filter((p) => p.active).map((p) => p.id));
  const offeneBewerbungen = (bewerbungen ?? []).filter((b) => (b.status === "eingegangen" || b.status === "in_pruefung") && !(b.participant_id && aktiv.has(b.participant_id))).length;
  const unstimmig = (bewerbungen ?? []).filter((b) => (b.status === "eingegangen" || b.status === "in_pruefung") && b.participant_id && aktiv.has(b.participant_id)).length;
  const ohneMail = (personen ?? []).filter((p) => p.active && p.affiliation_status === "academy_student" && !p.email).length;
  const aufgaben: { text: string; href: string; ton: "warnung" | "neutral" }[] = [
    ...(naechstes && alles && ohneAntwort > 0 ? [{ text: s.zusagenFehlen(ohneAntwort, naechstes.module.title), href: `/team/module/${naechstes.module.id}/teilnehmende/?filter=offen`, ton: "neutral" as const }] : []),
    ...(naechstes && alles && bestaetigt.length > 0 && infoGesendet < bestaetigt.length && tageBis(naechstes.day, heute) <= 14 ? [{ text: s.infoMailFehlt(bestaetigt.length - infoGesendet), href: `/team/module/${naechstes.module.id}/infomail/`, ton: "warnung" as const }] : []),
    ...(offeneBewerbungen > 0 ? [{ text: s.bewerbungen(offeneBewerbungen), href: "/team/bewerbungen/", ton: "neutral" as const }] : []),
    ...(unstimmig > 0 ? [{ text: s.unstimmig(unstimmig), href: "/team/bewerbungen/", ton: "warnung" as const }] : []),
    ...(ohneMail > 0 ? [{ text: s.ohneMail(ohneMail), href: "/team/teilnehmende/?filter=ohne-mail", ton: "neutral" as const }] : []),
    ...(hotels ?? []).map((h) => ({ text: `${datum.format(new Date(`${h.cancellation_deadline}T12:00:00Z`))}: ${t.stornofrist(h.name, h.module?.title)}`, href: h.module ? `/team/module/${h.module.id}/hotel/` : "/team/module/", ton: "warnung" as const })),
    ...(hausaufgaben ?? []).map((h) => ({ text: `${datum.format(new Date(`${h.due_date}T12:00:00Z`))}: ${t.hausaufgabe(h.number, h.title)}`, href: "/team/hausaufgaben/", ton: "neutral" as const })),
  ];

  return (
    <>
      <TeamKopf staff={staff} />
      <main lang={l} className="mx-auto max-w-6xl px-4 py-8 lg:px-8 lg:py-10">
        <p className="text-sm text-ink-soft">{datumLang.format(new Date(jetzt))}</p>
        <h1 className="font-display mt-1 text-3xl font-bold lg:text-4xl">{t.gruss(vorname)}</h1>
        {fehler === "rechte" && <p role="alert" className="mt-4 rounded-2xl bg-gelb-hell p-4">{t.keineRechte}</p>}
        <MailHinweis className="mt-6" sprache={l} />

        {(offeneFreigaben ?? 0) > 0 && (
          <Link href="/team/freigaben/" className="mt-6 flex items-center gap-3 rounded-2xl bg-signal px-5 py-3.5 font-semibold text-ink transition hover:brightness-95">
            <ShieldCheck aria-hidden className="h-5 w-5" /><span className="mr-auto">{t.freigaben(offeneFreigaben ?? 0)}</span><ArrowRight aria-hidden className="h-5 w-5" />
          </Link>
        )}
        {(offeneLoeschungen ?? 0) > 0 && (
          <Link href="/team/loeschantraege/" className="mt-3 flex items-center gap-3 rounded-2xl bg-gelb-hell px-5 py-3.5 font-semibold text-ink ring-1 ring-line transition hover:brightness-95">
            <ShieldCheck aria-hidden className="h-5 w-5" /><span className="mr-auto">{t.loeschungen(offeneLoeschungen ?? 0)}</span><ArrowRight aria-hidden className="h-5 w-5" />
          </Link>
        )}
        {(offeneStimmen ?? 0) > 0 && (
          <Link href="/team/stimmen/" className="mt-3 flex items-center gap-3 rounded-2xl bg-gruen-hell px-5 py-3.5 font-semibold text-ink ring-1 ring-line transition hover:brightness-95">
            <Megaphone aria-hidden className="h-5 w-5" /><span className="mr-auto">{t.stimmen(offeneStimmen ?? 0)}</span><ArrowRight aria-hidden className="h-5 w-5" />
          </Link>
        )}

        {/* Nächstes Modul mit Programm */}
        <section className="mt-6 overflow-hidden rounded-[2rem] bg-forest p-6 text-paper lg:p-8">
          {naechstes ? (
            <>
              <div className="flex flex-wrap items-start gap-4">
                <div className="mr-auto">
                  <p className="text-xs font-semibold tracking-[0.14em] text-signal uppercase">{t.naechstesModul} · {t.tagLabel(tageBis(naechstes.day, heute))}</p>
                  <h2 className="font-display mt-2 text-3xl font-bold lg:text-4xl">{naechstes.module.title}</h2>
                  <p className="mt-1 text-paper/70">
                    {ersterTag && letzterTag ? `${datum.format(new Date(ersterTag))}${modulTage!.length > 1 ? ` – ${datum.format(new Date(letzterTag))}` : ""}` : datum.format(new Date(`${naechstes.day}T12:00:00Z`))}
                    {naechstes.module.location ? ` · ${naechstes.module.location}` : ` · ${s.ortFolgt}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/team/module/${naechstes.module.id}/${alles ? "" : "teilnehmende/"}`} className="inline-flex items-center gap-2 rounded-full bg-signal px-5 py-2.5 text-sm font-semibold text-ink">{t.modulOeffnen} <ArrowRight aria-hidden className="h-4 w-4" /></Link>
                  <Link href="/team/einlass/" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold hover:bg-white/16"><ScanLine aria-hidden className="h-4 w-4" /> {b.einlass}</Link>
                </div>
              </div>
              {alles && (
                <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {([[bestaetigt.length, t.angemeldet, `/team/module/${naechstes.module.id}/teilnehmende/`], [zugesagt, s.zugesagt, `/team/module/${naechstes.module.id}/teilnehmende/?filter=zugesagt`], [ohneAntwort, s.ohneAntwort, `/team/module/${naechstes.module.id}/teilnehmende/?filter=offen`], [`${infoGesendet}/${bestaetigt.length}`, t.infoMails, `/team/module/${naechstes.module.id}/infomail/`]] as const).map(([wert, text, href]) => (
                    <Link key={text} href={href} className="rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10 transition hover:bg-white/[0.12]">
                      <dd className="font-display text-3xl leading-none font-bold">{wert}</dd>
                      <dt className="mt-1 text-sm text-paper/70">{text}</dt>
                    </Link>
                  ))}
                </dl>
              )}
              <div className="mt-6 rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold tracking-wide text-paper/80 uppercase">{s.programm}</h3>
                  <Link href={`/team/module/${naechstes.module.id}/programm/`} className="text-sm font-semibold text-signal hover:underline">{s.ganzesProgramm}</Link>
                </div>
                {vorschauTage.every((d) => d.punkte.length === 0) ? <p className="mt-2 text-sm text-paper/70">{s.keinProgramm}</p> : (
                  <div className={`mt-3 grid gap-5 ${vorschauTage.length > 1 ? "md:grid-cols-2" : ""} ${vorschauTage.length > 2 ? "lg:grid-cols-3" : ""}`}>
                    {vorschauTage.map((d) => (
                      <div key={d.id}>
                        <p className="font-semibold">{tagKurz.format(new Date(d.starts_at))}</p>
                        <ul className="mt-1.5 space-y-1 text-sm">
                          {d.punkte.slice(0, 8).map((p) => <li key={p.id} className="flex gap-3"><span className="w-12 shrink-0 tabular-nums text-paper/60">{zeit.format(new Date(p.starts_at))}</span><span>{p.title}</span></li>)}
                          {d.punkte.length > 8 && <li className="text-paper/60">{s.weitere(d.punkte.length - 8)}</li>}
                          {d.punkte.length === 0 && <li className="text-paper/60">{s.keinProgramm}</li>}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-signal uppercase">{t.naechstesModul}</p>
              <p className="font-display mt-2 text-2xl font-bold">{t.keinModul}</p>
              {alles && <Link href="/team/module/" className="mt-4 inline-flex items-center gap-2 rounded-full bg-signal px-5 py-2.5 text-sm font-semibold text-ink">{t.modulAnlegen} <ArrowRight aria-hidden className="h-4 w-4" /></Link>}
            </div>
          )}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="karte">
            <h2 className="font-display text-lg font-bold">{s.zuTun}</h2>
            {aufgaben.length === 0 ? <p className="mt-2 text-ink-soft">{s.nichtsZuTun}</p> : (
              <ul className="mt-3 divide-y divide-line">
                {aufgaben.map((a) => (
                  <li key={a.text}>
                    <Link href={a.href} className="flex items-center gap-3 py-2.5 hover:underline">
                      <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${a.ton === "warnung" ? "bg-signal ring-2 ring-forest/30" : "bg-line"}`} />
                      <span className="mr-auto">{a.text}</span>
                      <ArrowRight aria-hidden className="h-4 w-4 text-ink-soft" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {letztes && (
            <section className="karte">
              <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{s.letztesModul}</p>
              <h2 className="font-display mt-1 text-lg font-bold">{letztes.title}</h2>
              {letzteZahlen ? (
                <dl className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-paper p-4">
                    <dd className="font-display text-3xl font-extrabold">{letzteZahlen.quote === null ? "–" : `${Math.round(letzteZahlen.quote)} %`}</dd>
                    <dt className="text-sm text-ink-soft">{s.anwesenheit(letzteZahlen.da, letzteZahlen.angemeldet)}</dt>
                  </div>
                  <div className="rounded-2xl bg-paper p-4">
                    <dd className="font-display text-3xl font-extrabold">{letzteZahlen.feedback ? `${letzteZahlen.feedback.wert.toLocaleString(teamLocale[l], { maximumFractionDigits: 1 })}` : "–"}{letzteZahlen.feedback && <span className="text-base text-ink-soft"> / {letzteZahlen.feedback.max}</span>}</dd>
                    <dt className="text-sm text-ink-soft">{letzteZahlen.feedback ? s.feedback(letzteZahlen.feedback.antworten) : s.keinFeedback}</dt>
                  </div>
                </dl>
              ) : null}
              <Link href={`/team/module/${letztes.id}/${alles ? "auswertung/" : "teilnehmende/"}`} className="link mt-4 inline-block text-sm">{s.zurAuswertung}</Link>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
