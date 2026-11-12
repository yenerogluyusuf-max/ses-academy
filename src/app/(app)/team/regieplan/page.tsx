import type { Metadata } from "next";
import Link from "next/link";
import { Ellipsis, Phone, Printer } from "lucide-react";
import { AutoAktualisieren } from "@/components/team/AutoAktualisieren";
import { Hinweis } from "@/components/team/Hinweis";
import { TagWahl } from "@/components/team/TagWahl";
import { Rueckfrage } from "@/components/team/Rueckfrage";
import { TeamKopf } from "@/components/team/TeamKopf";
import { punktEnde, punktZustand, telLink, zustaendigWaehrend } from "@/lib/ablauf";
import {
  einsaetzeUebernehmen, einsatzAnlegen, einsatzBearbeiten, einsatzEntfernen, programmpunktAnlegen, programmpunktBearbeiten, programmpunktEntfernen, programmpunktStatus,
  programmVerschieben, regieplanPdfSetzen,
} from "@/lib/aktionen/eventtag";
import { darf, getStaff, requireStaff } from "@/lib/auth";
import { uhrzeit } from "@/lib/einlass";
import { ladeModultage } from "@/lib/eventtag";
import { createClient } from "@/lib/supabase/server";
import { teamLocale, type TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";
import { jetztMs } from "@/lib/zeit";

const de = {
  seitentitel: "Regieplan | SES Academy",
  hinweise: {
    "punkt-angelegt": { text: "Programmpunkt eingetragen.", gut: true },
    "punkt-entfernt": { text: "Programmpunkt entfernt.", gut: true },
    "punkt-geaendert": { text: "Programmpunkt geändert.", gut: true },
    "einsatz-geaendert": { text: "Einsatz geändert.", gut: true },
    status: { text: "Geändert.", gut: true },
    verschoben: { text: "Verschoben. Alle sehen die neuen Zeiten.", gut: true },
    "einsatz-angelegt": { text: "Einsatz eingetragen.", gut: true },
    "einsatz-entfernt": { text: "Einsatz entfernt.", gut: true },
    nichts: { text: "Am gewählten Tag gibt es keine Einsätze zum Übernehmen.", gut: false },
    "schon-uebernommen": { text: "Diese Einsätze stehen schon an diesem Tag. Nichts doppelt angelegt.", gut: true },
    pdf: { text: "PDF als Regieplan für diesen Tag festgelegt.", gut: true },
    "pdf-entfernt": { text: "PDF entfernt. Der Regieplan zeigt wieder die Programmliste.", gut: true },
    eingabe: { text: "Bitte die Angaben prüfen (Ende nach Beginn).", gut: false },
    fehler: { text: "Das hat nicht geklappt.", gut: false },
  } as Record<string, { text: string; gut: boolean }>,
  uebernommen: (n: number) => `${n} Einsätze übernommen.`,
  ganztaegig: "ganztägig",
  titel: "Regieplan",
  druckTeam: "Regieplan fürs Team drucken",
  tagesordnung: "Tagesordnung für Teilnehmende",
  namensschilder: "Namensschilder",
  notfall: "Notfall-Liste",
  keineTage: "Es gibt noch keine veröffentlichten Modultage.",
  alsPdf: "Regieplan als PDF",
  stand: (datum: string, version: number) => `Stand ${datum} · Version ${version}`,
  neuerTab: "In neuem Tab öffnen",
  neueFassung: "Neue Fassung hochladen",
  pdfAndere: "Andere PDF wählen oder entfernen",
  pdfFestlegen: "PDF als Regieplan für diesen Tag festlegen",
  keinePdfVor: "Noch keine PDF in der Ablage. Unter ",
  keinePdfNach: " hochladen, dann hier auswählen.",
  keinePdfOption: "keine PDF, wieder die Programmliste zeigen",
  diesesModul: " (dieses Modul)",
  pdfUebernehmen: "Übernehmen",
  jetztUndNaechstes: "Jetzt und als Nächstes",
  laeuftGerade: "Läuft gerade",
  bis: (zeit: string) => `bis ${zeit} Uhr`,
  alsNaechstes: "Als Nächstes",
  um: (zeit: string) => `${zeit} Uhr`,
  verspaetung: "Verspätung",
  zeitplanVerschieben: "Zeitplan verschieben",
  abPunkt: (titel: string) => ` ab „${titel}“`,
  verschiebenLabel: (min: number) => `${Math.abs(min)} Minuten ${min > 0 ? "später" : "früher"}: diesen und alle folgenden Punkte verschieben`,
  min: "Min.",
  punktBearbeiten: "Programmpunkt bearbeiten",
  beginn: "Beginn",
  ende: "Ende",
  raum: "Raum",
  verantwortlich: "Verantwortlich",
  untertitel: "Untertitel",
  chipJetzt: "jetzt",
  chipEntfaellt: "entfällt",
  chipVerschoben: "verschoben",
  optionenPunkt: (titel: string) => `Optionen für „${titel}“`,
  findetStatt: "Findet doch statt",
  entfaellt: "Entfällt",
  abHier: (min: number) => `Ab hier +${min} Min.`,
  entfernen: "Entfernen",
  jaEntfernen: "Ja, entfernen",
  punktEntfernenFrage: (titel: string) => `„${titel}“ aus dem Programm entfernen? Die Eingeteilten zu diesem Punkt bleiben im Rollenplan.`,
  keinProgramm: "Für diesen Tag ist noch kein Programm eingetragen.",
  punktEintragen: "+ Programmpunkt eintragen",
  titelBeispiel: "z. B. Vortrag Ruprecht Polenz",
  untertitelHilfe: "(steht in der Tagesordnung; interne Zeilen mit „intern:“ beginnen)",
  untertitelBeispiel: "z. B. Referent · Funktion; intern: Mikro 2",
  eintragen: "Eintragen",
  teamDesTages: "Team des Tages",
  entscheidet: "Entscheidet bei Problemen",
  anrufen: (name: string) => `${name} anrufen`,
  teamHeute: "Team heute",
  einsatzBearbeiten: "Einsatz bearbeiten",
  aufgabe: "Aufgabe",
  von: "von",
  bisFeld: "bis",
  entscheidetVorOrt: "Entscheidet bei Problemen vor Ort",
  leitung: "Leitung",
  optionenPerson: (name: string) => `Optionen für ${name}`,
  einsatzEntfernenFrage: (name: string) => `Einsatz von ${name} entfernen?`,
  niemand: "Noch niemand eingeteilt.",
  einsatzEintragen: "+ Einsatz eintragen",
  aufgabeBeispiel: "z. B. Einlass, Technik, Gäste",
  ohneUhrzeit: "Ohne Uhrzeit gilt der Einsatz für den ganzen Tag.",
  kopierenVon: "oder alle Einsätze kopieren von",
  einsaetzeUebernehmen: "Übernehmen",
  programmliste: (anzahl: number) => `Programmliste und Zeitplan (${anzahl} Punkte)`,
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    seitentitel: "Akış planı | SES Academy",
    hinweise: {
      "punkt-angelegt": { text: "Program maddesi eklendi.", gut: true },
      "punkt-entfernt": { text: "Program maddesi kaldırıldı.", gut: true },
      "punkt-geaendert": { text: "Program maddesi değiştirildi.", gut: true },
      "einsatz-geaendert": { text: "Görev değiştirildi.", gut: true },
      status: { text: "Değiştirildi.", gut: true },
      verschoben: { text: "Kaydırıldı. Herkes yeni saatleri görüyor.", gut: true },
      "einsatz-angelegt": { text: "Görev eklendi.", gut: true },
      "einsatz-entfernt": { text: "Görev kaldırıldı.", gut: true },
      nichts: { text: "Seçilen günde aktarılacak görev yok.", gut: false },
      "schon-uebernommen": { text: "Bu görevler bu günde zaten var. Hiçbir şey iki kez eklenmedi.", gut: true },
      pdf: { text: "PDF, bu günün akış planı olarak belirlendi.", gut: true },
      "pdf-entfernt": { text: "PDF kaldırıldı. Akış planı yeniden program listesini gösteriyor.", gut: true },
      eingabe: { text: "Lütfen bilgileri kontrol et (bitiş, başlangıçtan sonra olmalı).", gut: false },
      fehler: { text: teamTexte.tr.meldung.fehler, gut: false },
    },
    uebernommen: (n) => `${n} görev aktarıldı.`,
    ganztaegig: "tüm gün",
    titel: teamTexte.tr.bereiche.regieplan,
    druckTeam: "Ekip için akış planını yazdır",
    tagesordnung: "Katılımcılar için gündem",
    namensschilder: "Yaka kartları",
    notfall: "Acil durum listesi",
    keineTage: "Henüz yayımlanmış modül günü yok.",
    alsPdf: "PDF olarak akış planı",
    stand: (datum, version) => `${datum} itibarıyla · Sürüm ${version}`,
    neuerTab: "Yeni sekmede aç",
    neueFassung: "Yeni sürüm yükle",
    pdfAndere: "Başka bir PDF seç ya da kaldır",
    pdfFestlegen: "Bu gün için bir PDF’i akış planı olarak belirle",
    keinePdfVor: "Arşivde henüz PDF yok. ",
    keinePdfNach: " bölümünden yükle, sonra burada seç.",
    keinePdfOption: "PDF yok, yeniden program listesini göster",
    diesesModul: " (bu modül)",
    pdfUebernehmen: "Uygula",
    jetztUndNaechstes: "Şimdi ve sırada",
    laeuftGerade: "Şu an sürüyor",
    bis: (zeit) => `Bitiş ${zeit}`,
    alsNaechstes: "Sırada",
    um: (zeit) => `Saat ${zeit}`,
    verspaetung: "Gecikme",
    zeitplanVerschieben: "Zaman planını kaydır",
    abPunkt: (titel) => ` “${titel}” maddesinden itibaren`,
    verschiebenLabel: (min) => `Bu ve sonraki tüm maddeleri ${Math.abs(min)} dakika ${min > 0 ? "ertele" : "öne çek"}`,
    min: "dk.",
    punktBearbeiten: "Program maddesini düzenle",
    beginn: "Başlangıç",
    ende: "Bitiş",
    raum: "Salon",
    verantwortlich: "Sorumlu",
    untertitel: "Alt başlık",
    chipJetzt: "şimdi",
    chipEntfaellt: "yapılmayacak",
    chipVerschoben: "kaydırıldı",
    optionenPunkt: (titel) => `“${titel}” için seçenekler`,
    findetStatt: "Yine de yapılacak",
    entfaellt: "Yapılmayacak",
    abHier: (min) => `Buradan itibaren +${min} dk.`,
    entfernen: "Kaldır",
    jaEntfernen: "Evet, kaldır",
    punktEntfernenFrage: (titel) => `“${titel}” programdan kaldırılsın mı? Bu maddeye atanan kişiler görev planında kalır.`,
    keinProgramm: "Bu gün için henüz program girilmedi.",
    punktEintragen: "+ Program maddesi ekle",
    titelBeispiel: "ör. Ruprecht Polenz konuşması",
    untertitelHilfe: "(gündemde görünür; dahili satırlar “intern:” ile başlar)",
    untertitelBeispiel: "ör. Konuşmacı · Görevi; intern: Mikrofon 2",
    eintragen: teamTexte.tr.wort.hinzufuegen,
    teamDesTages: "Günün ekibi",
    entscheidet: "Sorun olursa karar verir",
    anrufen: (name) => `Ara: ${name}`,
    teamHeute: "Bugünkü ekip",
    einsatzBearbeiten: "Görevi düzenle",
    aufgabe: "Görev",
    von: "başlangıç",
    bisFeld: "bitiş",
    entscheidetVorOrt: "Sorun olursa yerinde karar verir",
    leitung: "Lider",
    optionenPerson: (name) => `${name} için seçenekler`,
    einsatzEntfernenFrage: (name) => `${name} için girilen görev kaldırılsın mı?`,
    niemand: "Henüz kimse atanmadı.",
    einsatzEintragen: "+ Görev ekle",
    aufgabeBeispiel: "ör. giriş, teknik, misafirler",
    ohneUhrzeit: "Saat girilmezse görev tüm gün için geçerlidir.",
    kopierenVon: "ya da tüm görevleri şu günden kopyala",
    einsaetzeUebernehmen: "Aktar",
    programmliste: (anzahl) => `Program listesi ve zaman planı (${anzahl} madde)`,
  },
  fr: {
    seitentitel: "Déroulé | SES Academy",
    hinweise: {
      "punkt-angelegt": { text: "Point du programme ajouté.", gut: true },
      "punkt-entfernt": { text: "Point du programme retiré.", gut: true },
      "punkt-geaendert": { text: "Point du programme modifié.", gut: true },
      "einsatz-geaendert": { text: "Affectation modifiée.", gut: true },
      status: { text: "Modifié.", gut: true },
      verschoben: { text: "Décalé. Tout le monde voit les nouveaux horaires.", gut: true },
      "einsatz-angelegt": { text: "Affectation ajoutée.", gut: true },
      "einsatz-entfernt": { text: "Affectation retirée.", gut: true },
      nichts: { text: "Il n’y a aucune affectation à reprendre le jour choisi.", gut: false },
      "schon-uebernommen": { text: "Ces affectations figurent déjà ce jour-là. Rien n’a été ajouté en double.", gut: true },
      pdf: { text: "PDF défini comme déroulé de ce jour.", gut: true },
      "pdf-entfernt": { text: "PDF retiré. Le déroulé affiche de nouveau la liste du programme.", gut: true },
      eingabe: { text: "Merci de vérifier les informations (la fin doit être après le début).", gut: false },
      fehler: { text: teamTexte.fr.meldung.fehler, gut: false },
    },
    uebernommen: (n) => (n === 1 ? "1 affectation reprise." : `${n} affectations reprises.`),
    ganztaegig: "toute la journée",
    titel: teamTexte.fr.bereiche.regieplan,
    druckTeam: "Imprimer le déroulé pour l’équipe",
    tagesordnung: "Ordre du jour pour les participants",
    namensschilder: "Badges",
    notfall: "Liste d’urgence",
    keineTage: "Il n’y a pas encore de journée de module publiée.",
    alsPdf: "Déroulé en PDF",
    stand: (datum, version) => `Mis à jour le ${datum} · version ${version}`,
    neuerTab: "Ouvrir dans un nouvel onglet",
    neueFassung: "Importer une nouvelle version",
    pdfAndere: "Choisir un autre PDF ou le retirer",
    pdfFestlegen: "Définir un PDF comme déroulé de ce jour",
    keinePdfVor: "Pas encore de PDF dans les documents. Importe-le dans ",
    keinePdfNach: ", puis sélectionne-le ici.",
    keinePdfOption: "aucun PDF, réafficher la liste du programme",
    diesesModul: " (ce module)",
    pdfUebernehmen: "Appliquer",
    jetztUndNaechstes: "Maintenant et à suivre",
    laeuftGerade: "En cours",
    bis: (zeit) => `jusqu’à ${zeit}`,
    alsNaechstes: "À suivre",
    um: (zeit) => `à ${zeit}`,
    verspaetung: "Retard",
    zeitplanVerschieben: "Décaler le programme",
    abPunkt: (titel) => ` à partir de « ${titel} »`,
    verschiebenLabel: (min) => `Décaler ce point et tous les suivants de ${Math.abs(min)} minutes ${min > 0 ? "plus tard" : "plus tôt"}`,
    min: "min",
    punktBearbeiten: "Modifier le point du programme",
    beginn: "Début",
    ende: "Fin",
    raum: "Salle",
    verantwortlich: "Responsable",
    untertitel: "Sous-titre",
    chipJetzt: "en cours",
    chipEntfaellt: "annulé",
    chipVerschoben: "décalé",
    optionenPunkt: (titel) => `Options pour « ${titel} »`,
    findetStatt: "A finalement lieu",
    entfaellt: "N’a pas lieu",
    abHier: (min) => `À partir d’ici +${min} min`,
    entfernen: "Retirer",
    jaEntfernen: "Oui, retirer",
    punktEntfernenFrage: (titel) => `Retirer « ${titel} » du programme ? Les personnes affectées à ce point restent dans la répartition des rôles.`,
    keinProgramm: "Aucun programme n’est encore saisi pour ce jour.",
    punktEintragen: "+ Ajouter un point au programme",
    titelBeispiel: "p. ex. conférence de Ruprecht Polenz",
    untertitelHilfe: "(figure dans l’ordre du jour ; les lignes internes commencent par « intern: »)",
    untertitelBeispiel: "p. ex. Intervenant · Fonction ; intern: micro 2",
    eintragen: teamTexte.fr.wort.hinzufuegen,
    teamDesTages: "Équipe du jour",
    entscheidet: "Décide en cas de problème",
    anrufen: (name) => `Appeler ${name}`,
    teamHeute: "L’équipe aujourd’hui",
    einsatzBearbeiten: "Modifier l’affectation",
    aufgabe: "Tâche",
    von: "de",
    bisFeld: "à",
    entscheidetVorOrt: "Décide sur place en cas de problème",
    leitung: "Coordination",
    optionenPerson: (name) => `Options pour ${name}`,
    einsatzEntfernenFrage: (name) => `Retirer l’affectation de ${name} ?`,
    niemand: "Personne n’est encore affecté.",
    einsatzEintragen: "+ Ajouter une affectation",
    aufgabeBeispiel: "p. ex. accueil, technique, invités",
    ohneUhrzeit: "Sans horaire, l’affectation vaut pour toute la journée.",
    kopierenVon: "ou copier toutes les affectations depuis",
    einsaetzeUebernehmen: "Reprendre",
    programmliste: (anzahl) => `Liste du programme et horaires (${anzahl} points)`,
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const l = (await getStaff())?.sprache ?? "de";
  return { title: T[l].seitentitel };
}

/** Tag zur Auswahl „von welchem Tag übernehmen“ (wie tagBezeichnung, aber in der Sprache des Teammitglieds). */
const tagBezeichnungIn = (l: TeamSprache, tag: { starts_at: string; label?: string | null }, modul: string) =>
  `${modul} · ${new Intl.DateTimeFormat(teamLocale[l], { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Berlin" }).format(new Date(tag.starts_at))}${tag.label ? ` · ${tag.label}` : ""}`;

/**
 * Regieplan und Rollenplan eines Modultags auf einer Seite: links das Programm (Stand nach der Uhr, mit den
 * Eingeteilten je Punkt), rechts das Team des Tages mit Leitung und Telefon. Druckansicht unter ./druck/.
 */
export default async function Regieplan({ searchParams }: PageProps<"/team/regieplan">) {
  const staff = await requireStaff("einlass");
  const l = staff.sprache;
  const t = T[l];
  const w = teamTexte[l].wort;
  const zeitspanne = (von: string | null, bis: string | null) => (von ? `${uhrzeit(von, false)}${bis ? `–${uhrzeit(bis, false)}` : ""}` : t.ganztaegig);
  const { tag: gewaehlt, hinweis, bearbeiten, einsatz: einsatzBearbeitet } = await searchParams;
  const { tage, vorschlag } = await ladeModultage(staff.modulId);
  const tag = tage.find((x) => x.id === gewaehlt) ?? vorschlag;
  const darfPflegen = darf.orga(staff.role);
  // Auf ein Modul begrenzte Zugänge: Programm und Team pflegen ja, Dokumentenablage, Druck-Listen und PDF nein
  const unbegrenzt = !staff.modulId;

  const supabase = await createClient();
  const [{ data: punkte }, { data: einsaetzeRoh }, { data: dokumente }] = tag
    ? await Promise.all([
        supabase.from("program_items").select("*").eq("module_day_id", tag.id).order("starts_at"),
        darfPflegen
          ? supabase.from("duty_assignments").select("*").eq("module_day_id", tag.id).order("is_lead", { ascending: false }).order("starts_at", { nullsFirst: true }).order("person_name")
          : Promise.resolve({ data: [] }),
        // PDFs aus der Ablage zur Auswahl (nur Orga-Team sieht die Ablage); das Modul des Tages zuerst
        darfPflegen && unbegrenzt
          ? supabase.from("documents").select("id, title, status, module_id, document_versions(version, mime_type, uploaded_at)").order("updated_at", { ascending: false })
          : Promise.resolve({ data: [] }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const pdfs = (dokumente ?? [])
    .map((d) => ({ ...d, aktuell: [...d.document_versions].sort((a, b) => b.version - a.version)[0] }))
    .filter((d) => d.aktuell?.mime_type === "application/pdf" && (d.status !== "archiv" || d.id === tag?.regieplan_document_id))
    .sort((a, b) => Number(b.module_id === tag?.module_id) - Number(a.module_id === tag?.module_id));
  const pdf = darfPflegen && tag?.regieplan_document_id ? pdfs.find((d) => d.id === tag.regieplan_document_id) ?? null : null;
  const liste = punkte ?? [];
  const einsaetze = einsaetzeRoh ?? [];
  const leitung = einsaetze.filter((e) => e.is_lead);
  const jetzt = jetztMs();
  const zustand = (i: number) => punktZustand(liste, i, jetzt);
  const laufendIdx = liste.findIndex((_, i) => zustand(i) === "jetzt");
  const naechsterIdx = liste.findIndex((_, i) => zustand(i) === "kommt");
  const laufend = laufendIdx >= 0 ? liste[laufendIdx] : null;
  const naechster = naechsterIdx >= 0 ? liste[naechsterIdx] : null;
  const anker = laufend ?? naechster;
  const andereTage = tag ? tage.filter((x) => x.module_id === tag.module_id && x.id !== tag.id) : [];
  const code = typeof hinweis === "string" && hinweis.startsWith("uebernommen-") ? undefined : hinweis;
  const uebernommen = typeof hinweis === "string" && hinweis.startsWith("uebernommen-") ? Number(hinweis.split("-")[1]) : 0;

  return (
    <>
      <TeamKopf staff={staff} aktiv="regieplan" />
      {/* Beim Bearbeiten nicht alle 30 Sekunden neu laden */}
      {!bearbeiten && !einsatzBearbeitet && <AutoAktualisieren />}
      <main lang={l} className={`mx-auto px-4 py-6 ${darfPflegen ? "max-w-6xl" : "max-w-3xl"}`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-3xl font-bold">{t.titel}</h1>
          {tag && (
            <div className="flex flex-wrap gap-2">
              <Link href={`/team/regieplan/druck/?tag=${tag.id}`} target="_blank" className="knopf-hell"><Printer aria-hidden className="h-4 w-4" />{t.druckTeam}</Link>
              {darfPflegen && unbegrenzt && <Link href={`/team/module/${tag.module_id}/tagesordnung/`} target="_blank" className="knopf"><Printer aria-hidden className="h-4 w-4" />{t.tagesordnung}</Link>}
              {darfPflegen && unbegrenzt && <Link href={`/team/module/${tag.module_id}/namensschilder/`} target="_blank" className="knopf-hell">{t.namensschilder}</Link>}
              {darfPflegen && unbegrenzt && <Link href={`/team/module/${tag.module_id}/notfall/`} target="_blank" className="knopf-hell">{t.notfall}</Link>}
            </div>
          )}
        </div>
        <Hinweis code={code} texte={t.hinweise} />
        {uebernommen > 0 && <p role="status" className="mt-4 rounded-2xl bg-gruen-hell p-4 text-sm font-semibold">{t.uebernommen(uebernommen)}</p>}
        {!tag ? (
          <p className="karte mt-6">{t.keineTage}</p>
        ) : (
          <>
            <TagWahl tage={tage} aktiv={tag.id} pfad="/team/regieplan/" jetzt={jetzt} sprache={l} />

            <div className={`mt-4 grid items-start gap-6 ${darfPflegen ? "lg:grid-cols-[minmax(0,1fr)_22rem]" : ""}`}>
              {/* Programm: als PDF, wenn für den Tag festgelegt; die Liste ist dann aufklappbar */}
              <div className="min-w-0">
                {pdf && (
                  <section aria-label={t.alsPdf} className="karte overflow-hidden !p-0">
                    <div className="flex flex-wrap items-center gap-2 px-5 py-4">
                      <div className="mr-auto min-w-0">
                        <p className="font-display truncate text-xl font-bold">{pdf.title}</p>
                        <p className="text-sm text-ink-soft">{t.stand(new Intl.DateTimeFormat(teamLocale[l], { dateStyle: "medium", timeZone: "Europe/Berlin" }).format(new Date(pdf.aktuell.uploaded_at)), pdf.aktuell.version)}</p>
                      </div>
                      <a href={`/team/regieplan/pdf/${tag.id}/`} target="_blank" rel="noopener" className="knopf-hell">{t.neuerTab}</a>
                      <Link href={`/team/dokumente/${pdf.id}/`} className="knopf-hell">{t.neueFassung}</Link>
                    </div>
                    <iframe src={`/team/regieplan/pdf/${tag.id}/`} title={pdf.title} className="block h-[80vh] w-full border-t border-line bg-paper-deep" />
                  </section>
                )}
                {darfPflegen && unbegrenzt && (
                  <details className={`rounded-3xl bg-paper-deep/60 px-4 py-3 text-sm ${pdf ? "mt-3" : "mb-4"}`}>
                    <summary className="cursor-pointer font-semibold">{pdf ? t.pdfAndere : t.pdfFestlegen}</summary>
                    {pdfs.length === 0 ? (
                      <p className="mt-2 text-ink-soft">{t.keinePdfVor}<Link href="/team/dokumente/" className="link">{teamTexte[l].bereiche.dokumente}</Link>{t.keinePdfNach}</p>
                    ) : (
                      <form action={regieplanPdfSetzen} className="mt-3 flex flex-wrap items-center gap-2">
                        <input type="hidden" name="tag" value={tag.id} />
                        <label className="sr-only" htmlFor="document_id">PDF</label>
                        <select id="document_id" name="document_id" defaultValue={pdf?.id ?? pdfs[0].id} className="feld !w-auto min-w-64 flex-1">
                          {pdf && <option value="">{t.keinePdfOption}</option>}
                          {pdfs.map((d) => <option key={d.id} value={d.id}>{d.title}{d.module_id === tag.module_id ? t.diesesModul : ""}</option>)}
                        </select>
                        <button className="knopf">{t.pdfUebernehmen}</button>
                      </form>
                    )}
                  </details>
                )}
                <ProgrammHuelle eingeklappt={Boolean(pdf)} zusammenfassung={t.programmliste(liste.length)}>
                {(laufend || naechster) && (
                  <section aria-label={t.jetztUndNaechstes} className="grid gap-3 sm:grid-cols-2">
                    {laufend && (
                      <div className="rounded-3xl bg-forest p-5 text-paper">
                        <p className="text-xs font-semibold tracking-wide text-signal uppercase">{t.laeuftGerade}</p>
                        <p className="font-display mt-1 text-xl font-bold">{laufend.title}</p>
                        <p className="text-sm text-paper/70">{t.bis(uhrzeit(new Date(punktEnde(liste, laufendIdx)).toISOString(), false))}{laufend.room ? ` · ${laufend.room}` : ""}</p>
                      </div>
                    )}
                    {naechster && (
                      <div className="rounded-3xl bg-weiss p-5 ring-1 ring-line">
                        <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{t.alsNaechstes}</p>
                        <p className="font-display mt-1 text-xl font-bold">{naechster.title}</p>
                        <p className="text-sm text-ink-soft">{t.um(uhrzeit(naechster.starts_at, false))}{naechster.room ? ` · ${naechster.room}` : ""}{naechster.responsible ? ` · ${naechster.responsible}` : ""}</p>
                      </div>
                    )}
                  </section>
                )}

                {darfPflegen && anker && (
                  <section aria-label={t.verspaetung} className="mt-3 flex flex-wrap items-center gap-2 rounded-3xl bg-paper-deep/60 px-4 py-3">
                    <p className="mr-auto text-sm"><span className="font-semibold">{t.zeitplanVerschieben}</span><span className="text-ink-soft">{t.abPunkt(anker.title)}</span></p>
                    {[-5, 5, 10, 15, 30].map((min) => (
                      <form key={min} action={programmVerschieben}>
                        <input type="hidden" name="tag" value={tag.id} /><input type="hidden" name="id" value={anker.id} />
                        <input type="hidden" name="minuten" value={min} />
                        <button type="submit" className="rounded-full bg-weiss px-3 py-1.5 text-sm font-semibold ring-1 ring-line hover:ring-ink/30"
                          aria-label={t.verschiebenLabel(min)}>
                          {min > 0 ? `+${min}` : `−${-min}`} {t.min}
                        </button>
                      </form>
                    ))}
                  </section>
                )}

                <ol className="mt-4 rounded-3xl bg-weiss ring-1 ring-line">
                  {liste.map((p, i) => {
                    const z = zustand(i);
                    const wer = darfPflegen ? zustaendigWaehrend(liste, i, einsaetze) : [];
                    if (darfPflegen && bearbeiten === p.id)
                      return (
                        <li key={p.id} id={`punkt-${p.id}`} className="border-b border-line bg-gelb-hell/40 px-4 py-4 first:rounded-t-3xl last:rounded-b-3xl last:border-b-0">
                          <form action={programmpunktBearbeiten} className="grid gap-3 sm:grid-cols-4">
                            <input type="hidden" name="tag" value={tag.id} /><input type="hidden" name="id" value={p.id} />
                            <p className="font-semibold sm:col-span-4">{t.punktBearbeiten}</p>
                            <div><label htmlFor="b-von" className="etikett">{t.beginn}</label><input id="b-von" name="von" type="time" required defaultValue={uhrzeit(p.starts_at, false)} className="feld" /></div>
                            <div><label htmlFor="b-bis" className="etikett">{t.ende}</label><input id="b-bis" name="bis" type="time" defaultValue={p.ends_at ? uhrzeit(p.ends_at, false) : ""} className="feld" /></div>
                            <div className="sm:col-span-2"><label htmlFor="b-title" className="etikett">{w.titel}</label><input id="b-title" name="title" required maxLength={200} defaultValue={p.title} className="feld" /></div>
                            <div><label htmlFor="b-room" className="etikett">{t.raum}</label><input id="b-room" name="room" maxLength={100} defaultValue={p.room ?? ""} className="feld" /></div>
                            <div><label htmlFor="b-responsible" className="etikett">{t.verantwortlich}</label><input id="b-responsible" name="responsible" maxLength={200} defaultValue={p.responsible ?? ""} className="feld" /></div>
                            <div className="sm:col-span-2"><label htmlFor="b-note" className="etikett">{t.untertitel}</label><input id="b-note" name="note" maxLength={1000} defaultValue={p.note ?? ""} className="feld" /></div>
                            <div className="flex flex-wrap gap-2 sm:col-span-4">
                              <button type="submit" className="knopf">{w.speichern}</button>
                              <Link href={`/team/regieplan/?tag=${tag.id}`} className="knopf-hell">{w.abbrechen}</Link>
                            </div>
                          </form>
                        </li>
                      );
                    return (
                      <li key={p.id} className={`relative flex gap-4 border-b border-line px-4 py-3.5 first:rounded-t-3xl last:rounded-b-3xl last:border-b-0 has-[details[open]]:z-30 ${z === "jetzt" ? "bg-gruen-hell" : ""} ${z === "vorbei" ? "opacity-50" : ""}`}>
                        {z === "jetzt" && <span aria-hidden className="absolute inset-y-0 left-0 w-1 rounded-l-3xl bg-forest" />}
                        <span className={`w-24 shrink-0 font-mono text-sm leading-6 font-semibold tabular-nums ${z === "entfaellt" ? "text-ink-soft line-through" : ""}`}>
                          {uhrzeit(p.starts_at, false)}{p.ends_at ? `–${uhrzeit(p.ends_at, false)}` : ""}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`leading-6 font-semibold ${z === "entfaellt" ? "text-ink-soft line-through" : ""}`}>
                            {p.title}
                            {z === "jetzt" && <span className="chip ml-2 bg-forest align-middle text-paper">{t.chipJetzt}</span>}
                            {z === "entfaellt" && <span className="chip ml-2 bg-rot-hell align-middle text-rot">{t.chipEntfaellt}</span>}
                            {p.status === "verschoben" && z !== "vorbei" && z !== "entfaellt" && <span className="chip ml-2 bg-gelb-hell align-middle">{t.chipVerschoben}</span>}
                          </p>
                          {(p.room || p.responsible || p.note) && (
                            <p className="text-sm text-ink-soft">{[p.room, p.responsible, p.note].filter(Boolean).join(" · ")}</p>
                          )}
                          {wer.length > 0 && (
                            <ul className="mt-1.5 flex flex-wrap gap-1">
                              {wer.map((e) => <li key={e.id} className="chip bg-paper py-1 ring-1 ring-line"><span className="font-semibold">{e.person_name}</span><span className="ml-1 font-normal text-ink-soft">{e.task}</span></li>)}
                            </ul>
                          )}
                        </div>
                        {darfPflegen && (
                          <details className="relative shrink-0 self-start">
                            <summary aria-label={t.optionenPunkt(p.title)} className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-full text-ink-soft hover:bg-paper hover:text-ink [&::-webkit-details-marker]:hidden">
                              <Ellipsis aria-hidden className="h-5 w-5" />
                            </summary>
                            <div className="absolute right-0 z-20 mt-1 w-56 rounded-2xl bg-weiss p-1.5 shadow-xl ring-1 ring-ink/10">
                              <form action={programmpunktStatus}>
                                <input type="hidden" name="tag" value={tag.id} /><input type="hidden" name="id" value={p.id} />
                                <input type="hidden" name="status" value={p.status === "entfaellt" ? "geplant" : "entfaellt"} />
                                <button type="submit" className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-paper">{p.status === "entfaellt" ? t.findetStatt : t.entfaellt}</button>
                              </form>
                              <Link href={`/team/regieplan/?tag=${tag.id}&bearbeiten=${p.id}#punkt-${p.id}`} className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-paper">{w.bearbeiten}</Link>
                              {z !== "vorbei" && z !== "entfaellt" && [10, 15].map((min) => (
                                <form key={min} action={programmVerschieben}>
                                  <input type="hidden" name="tag" value={tag.id} /><input type="hidden" name="id" value={p.id} />
                                  <input type="hidden" name="minuten" value={min} />
                                  <button type="submit" className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-paper">{t.abHier(min)}</button>
                                </form>
                              ))}
                              <form action={programmpunktEntfernen}>
                                <input type="hidden" name="tag" value={tag.id} /><input type="hidden" name="id" value={p.id} />
                                <Rueckfrage sprache={l} knopf={t.entfernen} knopfKlasse="w-full rounded-xl px-3 py-2 text-left text-sm text-rot hover:bg-rot-hell" gefahr ja={t.jaEntfernen}
                                  frage={t.punktEntfernenFrage(p.title)} />
                              </form>
                            </div>
                          </details>
                        )}
                      </li>
                    );
                  })}
                </ol>
                {liste.length === 0 && <p className="mt-4 rounded-3xl border-2 border-dashed border-line p-8 text-center text-ink-soft">{t.keinProgramm}</p>}

                {darfPflegen && (
                  <details className="karte mt-4">
                    <summary className="cursor-pointer list-none font-semibold [&::-webkit-details-marker]:hidden">{t.punktEintragen}</summary>
                    <form action={programmpunktAnlegen} className="mt-4 grid gap-3 sm:grid-cols-4">
                      <input type="hidden" name="tag" value={tag.id} />
                      <div><label htmlFor="von" className="etikett">{t.beginn}</label><input id="von" name="von" type="time" required className="feld" /></div>
                      <div><label htmlFor="bis" className="etikett">{t.ende}</label><input id="bis" name="bis" type="time" className="feld" /></div>
                      <div className="sm:col-span-2"><label htmlFor="title" className="etikett">{w.titel}</label><input id="title" name="title" required maxLength={200} className="feld" placeholder={t.titelBeispiel} /></div>
                      <div><label htmlFor="room" className="etikett">{t.raum}</label><input id="room" name="room" maxLength={100} className="feld" /></div>
                      <div><label htmlFor="responsible" className="etikett">{t.verantwortlich}</label><input id="responsible" name="responsible" maxLength={200} className="feld" /></div>
                      <div className="sm:col-span-2"><label htmlFor="note" className="etikett">{t.untertitel} <span className="font-normal text-ink-soft">{t.untertitelHilfe}</span></label><input id="note" name="note" maxLength={1000} className="feld" placeholder={t.untertitelBeispiel} /></div>
                      <div className="sm:col-span-4"><button type="submit" className="knopf">{t.eintragen}</button></div>
                    </form>
                  </details>
                )}
                </ProgrammHuelle>
              </div>

              {/* Team des Tages (früher Rollenplan) */}
              {darfPflegen && (
                <aside aria-label={t.teamDesTages} className="space-y-4 lg:sticky lg:top-6">
                  {leitung.length > 0 && (
                    <section className="rounded-3xl bg-gelb-hell p-5 ring-1 ring-line">
                      <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{t.entscheidet}</p>
                      {leitung.map((e) => (
                        <p key={e.id} className="mt-1 flex items-center justify-between gap-2">
                          <span className="text-lg font-semibold">{e.person_name}</span>
                          {e.phone && <a href={telLink(e.phone)} className="knopf !px-3 !py-1.5" aria-label={t.anrufen(e.person_name)}><Phone aria-hidden className="h-4 w-4" /></a>}
                        </p>
                      ))}
                    </section>
                  )}
                  <section className="karte !p-0">
                    <h2 className="font-display px-5 pt-5 text-xl font-bold">{t.teamHeute}</h2>
                    {einsaetze.length ? (
                      <ul className="mt-2 divide-y divide-line">
                        {einsaetze.map((e) => einsatzBearbeitet === e.id ? (
                          <li key={e.id} id={`einsatz-${e.id}`} className="bg-gelb-hell/40 px-5 py-4">
                            <form action={einsatzBearbeiten} className="grid grid-cols-2 gap-3">
                              <input type="hidden" name="tag" value={tag.id} /><input type="hidden" name="id" value={e.id} />
                              <p className="col-span-2 font-semibold">{t.einsatzBearbeiten}</p>
                              <div className="col-span-2"><label htmlFor="eb-name" className="etikett">{w.name}</label><input id="eb-name" name="person_name" required maxLength={200} defaultValue={e.person_name} className="feld" /></div>
                              <div className="col-span-2"><label htmlFor="eb-task" className="etikett">{t.aufgabe}</label><input id="eb-task" name="task" required maxLength={300} defaultValue={e.task ?? ""} className="feld" /></div>
                              <div className="col-span-2"><label htmlFor="eb-phone" className="etikett">{w.telefon}</label><input id="eb-phone" name="phone" type="tel" maxLength={40} defaultValue={e.phone ?? ""} className="feld" /></div>
                              <div><label htmlFor="eb-von" className="etikett">{t.von}</label><input id="eb-von" name="von" type="time" defaultValue={e.starts_at ? uhrzeit(e.starts_at, false) : ""} className="feld" /></div>
                              <div><label htmlFor="eb-bis" className="etikett">{t.bisFeld}</label><input id="eb-bis" name="bis" type="time" defaultValue={e.ends_at ? uhrzeit(e.ends_at, false) : ""} className="feld" /></div>
                              <label className="col-span-2 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="is_lead" defaultChecked={e.is_lead} className="h-4 w-4 accent-ink" /> {t.entscheidetVorOrt}</label>
                              <div className="col-span-2 flex flex-wrap gap-2">
                                <button type="submit" className="knopf">{w.speichern}</button>
                                <Link href={`/team/regieplan/?tag=${tag.id}`} className="knopf-hell">{w.abbrechen}</Link>
                              </div>
                            </form>
                          </li>
                        ) : (
                          <li key={e.id} className="group flex items-center gap-3 px-5 py-2.5 has-[details[open]]:relative has-[details[open]]:z-30">
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold">{e.person_name}{e.is_lead && <span className="chip ml-1.5 bg-gelb-hell">{t.leitung}</span>}</p>
                              <p className="truncate text-sm text-ink-soft">{e.task} · {zeitspanne(e.starts_at, e.ends_at)}</p>
                            </div>
                            {e.phone && <a href={telLink(e.phone)} title={e.phone} aria-label={t.anrufen(e.person_name)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper text-ink-soft ring-1 ring-line hover:bg-forest hover:text-paper"><Phone className="h-4 w-4" /></a>}
                            <details className="relative shrink-0">
                              <summary aria-label={t.optionenPerson(e.person_name)} className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-full text-ink-soft hover:bg-paper hover:text-ink [&::-webkit-details-marker]:hidden"><Ellipsis aria-hidden className="h-5 w-5" /></summary>
                              <div className="absolute right-0 z-20 mt-1 w-44 rounded-2xl bg-weiss p-1.5 shadow-xl ring-1 ring-ink/10">
                                <Link href={`/team/regieplan/?tag=${tag.id}&einsatz=${e.id}#einsatz-${e.id}`} className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-paper">{w.bearbeiten}</Link>
                                <form action={einsatzEntfernen}>
                                  <input type="hidden" name="tag" value={tag.id} /><input type="hidden" name="id" value={e.id} />
                                  <Rueckfrage sprache={l} knopf={t.entfernen} knopfKlasse="w-full rounded-xl px-3 py-2 text-left text-sm text-rot hover:bg-rot-hell" gefahr ja={t.jaEntfernen}
                                    frage={t.einsatzEntfernenFrage(e.person_name)} />
                                </form>
                              </div>
                            </details>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="px-5 pt-2 text-sm text-ink-soft">{t.niemand}</p>}
                    <details className="mt-2 border-t border-line px-5 py-4">
                      <summary className="cursor-pointer list-none text-sm font-semibold [&::-webkit-details-marker]:hidden">{t.einsatzEintragen}</summary>
                      <form action={einsatzAnlegen} className="mt-3 grid grid-cols-2 gap-3">
                        <input type="hidden" name="tag" value={tag.id} />
                        <div className="col-span-2"><label htmlFor="person_name" className="etikett">{w.name}</label><input id="person_name" name="person_name" required maxLength={200} className="feld" /></div>
                        <div className="col-span-2"><label htmlFor="task" className="etikett">{t.aufgabe}</label><input id="task" name="task" required maxLength={300} className="feld" placeholder={t.aufgabeBeispiel} /></div>
                        <div className="col-span-2"><label htmlFor="phone" className="etikett">{w.telefon}</label><input id="phone" name="phone" type="tel" maxLength={40} className="feld" /></div>
                        <div><label htmlFor="e-von" className="etikett">{t.von}</label><input id="e-von" name="von" type="time" className="feld" /></div>
                        <div><label htmlFor="e-bis" className="etikett">{t.bisFeld}</label><input id="e-bis" name="bis" type="time" className="feld" /></div>
                        <p className="col-span-2 -mt-1 text-xs text-ink-soft">{t.ohneUhrzeit}</p>
                        <label className="col-span-2 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="is_lead" className="h-4 w-4 accent-ink" /> {t.entscheidetVorOrt}</label>
                        <div className="col-span-2"><button type="submit" className="knopf">{t.eintragen}</button></div>
                      </form>
                      {andereTage.length > 0 && (
                        <form action={einsaetzeUebernehmen} className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4">
                          <input type="hidden" name="tag" value={tag.id} />
                          <div className="min-w-0 flex-1">
                            <label htmlFor="von_tag" className="etikett">{t.kopierenVon}</label>
                            <select id="von_tag" name="von_tag" className="feld">
                              {andereTage.map((x) => <option key={x.id} value={x.id}>{tagBezeichnungIn(l, x, x.module.title)}</option>)}
                            </select>
                          </div>
                          <button type="submit" className="knopf-hell">{t.einsaetzeUebernehmen}</button>
                        </form>
                      )}
                    </details>
                  </section>
                </aside>
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}

/** Ist eine PDF festgelegt, steht die Programmliste (mit Zeitplan verschieben, Punkte eintragen) aufklappbar darunter. */
function ProgrammHuelle({ eingeklappt, zusammenfassung, children }: { eingeklappt: boolean; zusammenfassung: string; children: React.ReactNode }) {
  if (!eingeklappt) return <>{children}</>;
  return (
    <details className="mt-4 rounded-3xl bg-weiss p-4 ring-1 ring-line">
      <summary className="cursor-pointer font-semibold">{zusammenfassung}</summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}
