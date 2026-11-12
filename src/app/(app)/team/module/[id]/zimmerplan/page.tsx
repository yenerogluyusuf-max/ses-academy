import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Hinweis } from "@/components/team/Hinweis";
import { ModulReiter } from "@/components/team/ModulReiter";
import { TeamKopf } from "@/components/team/TeamKopf";
import { SendeKnopf } from "@/components/team/SendeKnopf";
import { planUebernehmen, probeUebernehmen, vorschlagZuruecksetzen, wunschKorrigieren, zuteilungFestlegen } from "@/lib/aktionen/zimmerplan";
import { darf, requireStaff } from "@/lib/auth";
import { istToken } from "@/lib/codes";
import { teamLocale, type TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";
import { nachtName } from "@/lib/uebernachtung";
import { hinweisTexte, wuenschtEinzelzimmer, type Grund, type Hinweis as PlanHinweis, type Teil } from "@/lib/zimmerplan";
import { ladeZimmerplan, probeplan, vorschlag, zimmerArt } from "@/lib/zimmerplan-daten";

export const metadata: Metadata = { title: "Zimmerplan | SES Academy" };

const gruendeKlasse: Record<Grund, string> = {
  fest: "bg-ink text-paper",
  wunsch_gegenseitig: "bg-gruen-hell",
  wunsch: "bg-mint/40",
  gemischt: "bg-paper-deep",
  einzelzimmer: "bg-paper-deep",
};

const teilArtKlasse: Record<Teil["art"], string> = {
  sicher: "bg-gruen-hell",
  korrigiert: "bg-gruen-hell",
  aehnlich: "bg-gelb-hell",
  mehrdeutig: "bg-rot-hell text-rot",
  unbekannt: "bg-rot-hell text-rot",
  ignoriert: "bg-paper-deep line-through",
};

type Meldung = { text: string; gut: boolean };

const de = {
  hinweise: {
    wunsch: { text: "Zuordnung gespeichert.", gut: true },
    zurueckgesetzt: { text: "Vorschlag zurückgesetzt. Handzuteilungen sind geblieben.", gut: true },
    festgelegt: { text: "Bleibt jetzt fest in diesem Zimmer, auch bei neuen Vorschlägen.", gut: true },
    freigegeben: { text: "Freigegeben: Ein neuer Vorschlag darf die Person umsetzen.", gut: true },
    "kein-hotel": { text: "Zuerst unter Logistik das Hotel und die Zimmer anlegen.", gut: false },
    "schon-uebernommen": { text: "Die Einteilung ist schon übernommen. Unten steht der aktuelle Zimmerplan zum Anpassen.", gut: true },
    eingabe: { text: "Bitte die Angaben prüfen.", gut: false },
    fehler: { text: "Das hat nicht geklappt. Ist ein Zimmer schon voll? Dann bleibt alles beim alten Stand.", gut: false },
  } as Record<string, Meldung>,
  gruende: { fest: "fest", wunsch_gegenseitig: "Wunsch ✓", wunsch: "Wunsch", gemischt: "gemischt", einzelzimmer: "Einzelzimmer" } as Record<Grund, string>,
  teilArt: { sicher: "", korrigiert: "zugeordnet", aehnlich: "ähnlich, bitte prüfen", mehrdeutig: "mehrere möglich", unbekannt: "nicht gefunden", ignoriert: "ignoriert" } as Record<Teil["art"], string>,
  /** Bereiche der automatischen Einteilung (Schlüssel bleiben deutsch, sie stehen so auch in der Datenbank) */
  bereich: { Frauen: "Frauen", Männer: "Männer", "ohne Angabe": "ohne Angabe" } as Record<string, string>,
  g: { w: "w", m: "m" } as Record<string, string>,
  keineNacht: "keine Nacht",
  zitat: (s: string) => `„${s}“`,
  planUebernommen: (n: number) => `Vorschlag übernommen: ${n} Personen eingeteilt. Handzuteilungen sind geblieben.`,
  hotel: "Hotel",
  hotelDoppelpunkt: "Hotel:",
  nurDiesesHotel: (n: number) => `Geplant wird hier nur für dieses Hotel; ${n} sind in einem anderen Hotel eingeteilt.`,
  kUebernachten: (w: number, m: number) => `übernachten (${w} w · ${m} m)`,
  kBetten: (n: number) => `Betten in ${n} Zimmern`,
  kEingeteiltHotel: (n: number) => `in diesem Hotel eingeteilt (${n} in anderen)`,
  kEingeteilt: "eingeteilt",
  kOhneZimmer: "übernachten, noch ohne Zimmer",
  nochNiemand: "Noch hat niemand eine Übernachtung angegeben. Die automatische Einteilung erscheint, sobald Angaben da sind (Übernachtungs-Abfrage unter Logistik oder Import).",
  autoTitel: "Automatische Einteilung",
  autoIntroHotel: (hotel: string, n: number) => `In „${hotel}“ sind noch keine Zimmer angelegt. So verteilen sich die ${n} Übernachtenden, die noch in keinem anderen Hotel sind:`,
  autoIntro: (n: number) => `Noch sind keine Zimmer angelegt. So verteilen sich die ${n} Übernachtenden:`,
  autoRegeln: "Frauen und Männer getrennt, gegenseitige Wünsche zusammen, sonst gemischt nach Region und ohne frühere Zimmerpartner. Die Liste könnt ihr so ans Hotel schicken, die Zimmernummern vergibt das Hotel.",
  variante: (g: 2 | 3) => `mit ${zimmerArt[g]}n (${g} Betten)`,
  zimmerZahl: (n: number) => `${n} Zimmer`,
  aufteilung: (f: number, m: number, o: number) => `${f} für Frauen · ${m} für Männer${o ? ` · ${o} ohne Angabe zum Geschlecht` : ""}`,
  pdfFuersHotel: "Zimmerliste als PDF (fürs Hotel)",
  excelLaden: "Excel-Liste herunterladen",
  wirdUebernommen: "Wird übernommen …",
  soUebernehmen: "So übernehmen und von Hand anpassen",
  uebernehmenErklaerung: (n: number) => `„Übernehmen“ legt die ${n} Zimmer unter Logistik an (dort den Hotelnamen eintragen) und teilt alle ein. Danach lässt sich jede Person einzeln umsetzen, und es gibt die Zimmerliste auch zum Drucken. Teilnehmende sehen ihr Zimmer erst nach der Freigabe unter Logistik.`,
  hinweiseZahl: (n: number) => `${n} Hinweise`,
  bereichKopf: (bereich: string, zimmer: number, personen: number) => `${bereich} · ${zimmer} Zimmer, ${personen} Personen`,
  vorschlag: "Vorschlag",
  vorschlagRegeln: "Gegenseitige Wünsche zuerst, Zimmer nur Frauen oder nur Männer, sonst gemischt nach Region und ohne frühere Zimmerpartner. Von Hand Zugeteiltes bleibt.",
  achtung: "Achtung:",
  sofortSichtbar: "Die Zimmer sind in „Mein Bereich“ freigegeben, Übernommenes sehen die Teilnehmenden sofort.",
  erstNachFreigabe: ["Teilnehmende sehen ihr Zimmer erst, wenn es unter ", " freigegeben ist."] as [string, string],
  logistik: "Logistik",
  verwerfen: "Verwerfen",
  vorschlagUebernehmen: "Vorschlag übernehmen",
  vorschlagBerechnen: "Vorschlag berechnen",
  ohneBett: "Ohne Bett:",
  aktuellerPlan: "Aktueller Zimmerplan",
  einzelnUmsetzen: "Einzeln umsetzen (Logistik)",
  listeExcel: "Zimmerliste als Excel",
  vorschlagZuruecksetzen: "Vorschlag zurücksetzen",
  nochNiemandEingeteilt: "Noch niemand eingeteilt.",
  fest: "fest",
  vorschlagChip: "Vorschlag",
  freigeben: "freigeben",
  festhalten: "festhalten",
  schonZusammenImZimmer: (a: string, b: string, gewuenscht: boolean) => `${a} und ${b} waren schon zusammen im Zimmer${gewuenscht ? " (gewünscht)" : ""}`,
  nochOhneZimmer: "Noch ohne Zimmer:",
  wuensche: "Zimmerwünsche",
  wuenscheStand: (n: number, offen: number) => `${n} Personen haben einen Wunsch angegeben, ${offen} davon brauchen einen Blick (oben). Nicht erkannte Namen hier zuordnen; die Zuordnung gilt für den Vorschlag.`,
  einzelzimmerWunsch: "Einzelzimmer-Wunsch",
  keinWunsch: "kein bestimmter Wunsch",
  werGemeint: (text: string) => `Wer ist mit „${text}“ gemeint?`,
  automatisch: "automatisch erkennen",
  ignorieren: "ignorieren",
  vorgeschlagen: (name: string) => `${name} (vorgeschlagen)`,
  ok: "OK",
  aendern: "ändern",
  keineWuensche: "Noch keine Zimmerwünsche.",
  verlauf: "Wer war schon mit wem im Zimmer",
  keinVerlauf: "Aus früheren Modulen ist noch kein Zimmerplan gespeichert. Der Verlauf beginnt mit dem ersten übernommenen Plan und wird beim nächsten Modul berücksichtigt.",
  zimmerBelegt: (belegt: number, alle: number) => `${belegt} von ${alle} Zimmern belegt, ${alle - belegt} bleiben frei.`,
  kommtDazu: (ab: string) => `kommt ${ab} dazu`,
  schonZusammen: (a: string, b: string) => `${a} und ${b} waren schon zusammen`,
};

type Texte = typeof de;

const T: Record<TeamSprache, Texte> = {
  de,
  tr: {
    hinweise: {
      wunsch: { text: "Eşleştirme kaydedildi.", gut: true },
      zurueckgesetzt: { text: "Öneri geri alındı. Elle yapılan yerleştirmeler duruyor.", gut: true },
      festgelegt: { text: "Artık bu odada sabit kalıyor, yeni önerilerde de.", gut: true },
      freigegeben: { text: "Serbest bırakıldı: Yeni bir öneri bu kişiyi başka odaya alabilir.", gut: true },
      "kein-hotel": { text: "Önce Lojistik altında oteli ve odaları ekle.", gut: false },
      "schon-uebernommen": { text: "Yerleştirme zaten uygulandı. Aşağıda düzenleyebileceğin güncel oda planı var.", gut: true },
      eingabe: { text: teamTexte.tr.meldung.eingabe, gut: false },
      fehler: { text: "Bu işlem olmadı. Bir oda dolu mu? O zaman her şey eski haliyle kalır.", gut: false },
    },
    gruende: { fest: "sabit", wunsch_gegenseitig: "İstek ✓", wunsch: "İstek", gemischt: "karışık", einzelzimmer: "Tek kişilik oda" },
    teilArt: { sicher: "", korrigiert: "eşleştirildi", aehnlich: "benzer, lütfen kontrol et", mehrdeutig: "birden fazla olası", unbekannt: "bulunamadı", ignoriert: "yok sayıldı" },
    bereich: { Frauen: "Kadınlar", Männer: "Erkekler", "ohne Angabe": "Belirtilmemiş" },
    g: { w: "K", m: "E" },
    keineNacht: "gece yok",
    zitat: (s) => `„${s}“`,
    planUebernommen: (n) => `Öneri uygulandı: ${n} kişi yerleştirildi. Elle yapılan yerleştirmeler duruyor.`,
    hotel: "Otel",
    hotelDoppelpunkt: "Otel:",
    nurDiesesHotel: (n) => `Burada sadece bu otel için planlanıyor; ${n} kişi başka bir otele yerleştirildi.`,
    kUebernachten: (w, m) => `konaklayan (${w} K · ${m} E)`,
    kBetten: (n) => `${n} odada yatak`,
    kEingeteiltHotel: (n) => `bu otele yerleştirildi (${n} kişi diğerlerinde)`,
    kEingeteilt: "yerleştirildi",
    kOhneZimmer: "konaklayan, henüz odasız",
    nochNiemand: "Henüz kimse konaklama bildirmedi. Bilgiler gelince otomatik dağılım burada görünür (Lojistik altındaki konaklama anketi veya içe aktarma).",
    autoTitel: "Otomatik dağılım",
    autoIntroHotel: (hotel, n) => `„${hotel}“ otelinde henüz oda eklenmedi. Henüz başka bir otelde olmayan ${n} konaklayan şöyle dağılıyor:`,
    autoIntro: (n) => `Henüz oda eklenmedi. ${n} konaklayan şöyle dağılıyor:`,
    autoRegeln: "Kadınlar ve erkekler ayrı, karşılıklı istekler bir arada, diğerleri bölgeye göre karışık ve daha önceki oda arkadaşlarından ayrı. Listeyi otele bu haliyle gönderebilirsiniz, oda numaralarını otel verir.",
    variante: (g) => (g === 2 ? "Çift kişilik odalarla (2 yatak)" : "Üç kişilik odalarla (3 yatak)"),
    zimmerZahl: (n) => `${n} oda`,
    aufteilung: (f, m, o) => `${f} kadınlar için · ${m} erkekler için${o ? ` · ${o} cinsiyet belirtilmemiş` : ""}`,
    pdfFuersHotel: "Oda listesi PDF (otel için)",
    excelLaden: "Excel listesini indir",
    wirdUebernommen: "Uygulanıyor …",
    soUebernehmen: "Bu haliyle uygula ve elle düzenle",
    uebernehmenErklaerung: (n) => `„Uygula“, ${n} odayı Lojistik altında ekler (oradan otelin adını gir) ve herkesi yerleştirir. Sonra her kişiyi tek tek başka odaya alabilirsin; oda listesini yazdırmak da mümkün. Katılımcılar odalarını ancak Lojistik altında yayınlandıktan sonra görür.`,
    hinweiseZahl: (n) => `${n} not`,
    bereichKopf: (bereich, zimmer, personen) => `${bereich} · ${zimmer} oda, ${personen} kişi`,
    vorschlag: "Öneri",
    vorschlagRegeln: "Önce karşılıklı istekler, odalar ya sadece kadın ya sadece erkek, diğerleri bölgeye göre karışık ve daha önceki oda arkadaşlarından ayrı. Elle yerleştirilenler yerinde kalır.",
    achtung: "Dikkat:",
    sofortSichtbar: "Odalar „Mein Bereich“ sayfasında yayında; uygulananları katılımcılar hemen görür.",
    erstNachFreigabe: ["Katılımcılar odalarını ancak ", " altında yayınlandıktan sonra görür."],
    logistik: teamTexte.tr.bereiche.logistik,
    verwerfen: "Vazgeç",
    vorschlagUebernehmen: "Öneriyi uygula",
    vorschlagBerechnen: "Öneri hesapla",
    ohneBett: "Yataksız:",
    aktuellerPlan: "Güncel oda planı",
    einzelnUmsetzen: "Tek tek taşı (Lojistik)",
    listeExcel: "Oda listesi Excel",
    vorschlagZuruecksetzen: "Öneriyi geri al",
    nochNiemandEingeteilt: "Henüz kimse yerleştirilmedi.",
    fest: "sabit",
    vorschlagChip: "öneri",
    freigeben: "serbest bırak",
    festhalten: "sabitle",
    schonZusammenImZimmer: (a, b, gewuenscht) => `${a} ve ${b} daha önce aynı odada kaldı${gewuenscht ? " (istenmiş)" : ""}`,
    nochOhneZimmer: "Henüz odasız:",
    wuensche: "Oda istekleri",
    wuenscheStand: (n, offen) => `${n} kişi oda isteği belirtti, bunlardan ${offen} tanesine bakmak gerekiyor (yukarıda). Tanınmayan adları burada eşleştir; eşleştirme öneri için geçerli.`,
    einzelzimmerWunsch: "Tek kişilik oda isteği",
    keinWunsch: "belirli bir istek yok",
    werGemeint: (text) => `„${text}“ ile kim kastediliyor?`,
    automatisch: "otomatik tanı",
    ignorieren: "yok say",
    vorgeschlagen: (name) => `${name} (önerilen)`,
    ok: "Tamam",
    aendern: "değiştir",
    keineWuensche: "Henüz oda isteği yok.",
    verlauf: "Kim kiminle daha önce aynı odada kaldı",
    keinVerlauf: "Önceki modüllerden henüz kayıtlı oda planı yok. Geçmiş, ilk uygulanan planla başlar ve bir sonraki modülde dikkate alınır.",
    zimmerBelegt: (belegt, alle) => `${alle} odadan ${belegt} tanesi dolu, ${alle - belegt} tanesi boş kalıyor.`,
    kommtDazu: (ab) => `katılış: ${ab}`,
    schonZusammen: (a, b) => `${a} ve ${b} daha önce aynı odadaydı`,
  },
  fr: {
    hinweise: {
      wunsch: { text: "Attribution enregistrée.", gut: true },
      zurueckgesetzt: { text: "Proposition annulée. Les attributions manuelles restent.", gut: true },
      festgelegt: { text: "Reste désormais fixé dans cette chambre, même avec de nouvelles propositions.", gut: true },
      freigegeben: { text: "Libéré : une nouvelle proposition peut déplacer cette personne.", gut: true },
      "kein-hotel": { text: "Ajoute d’abord l’hôtel et les chambres dans Logistique.", gut: false },
      "schon-uebernommen": { text: "La répartition est déjà appliquée. Le plan des chambres actuel se trouve ci-dessous, à ajuster.", gut: true },
      eingabe: { text: teamTexte.fr.meldung.eingabe, gut: false },
      fehler: { text: "Cela n’a pas fonctionné. Une chambre est-elle déjà pleine ? Dans ce cas, rien ne change.", gut: false },
    },
    gruende: { fest: "fixé", wunsch_gegenseitig: "Souhait ✓", wunsch: "Souhait", gemischt: "mélangé", einzelzimmer: "Chambre individuelle" },
    teilArt: { sicher: "", korrigiert: "attribué", aehnlich: "proche, à vérifier", mehrdeutig: "plusieurs possibles", unbekannt: "introuvable", ignoriert: "ignoré" },
    bereich: { Frauen: "Femmes", Männer: "Hommes", "ohne Angabe": "Non renseigné" },
    g: { w: "F", m: "H" },
    keineNacht: "aucune nuit",
    zitat: (s) => `« ${s} »`,
    planUebernommen: (n) => `Proposition appliquée : ${n} personnes réparties. Les attributions manuelles restent.`,
    hotel: "Hôtel",
    hotelDoppelpunkt: "Hôtel :",
    nurDiesesHotel: (n) => `Ici, on planifie seulement pour cet hôtel ; ${n} personnes sont réparties dans un autre hôtel.`,
    kUebernachten: (w, m) => `personnes hébergées (${w} F · ${m} H)`,
    kBetten: (n) => `lits dans ${n} chambres`,
    kEingeteiltHotel: (n) => `réparties dans cet hôtel (${n} dans d’autres)`,
    kEingeteilt: "réparties",
    kOhneZimmer: "hébergées, encore sans chambre",
    nochNiemand: "Personne n’a encore indiqué de nuitée. La répartition automatique apparaît dès que des réponses arrivent (formulaire d’hébergement dans Logistique ou import).",
    autoTitel: "Répartition automatique",
    autoIntroHotel: (hotel, n) => `Aucune chambre n’est encore créée dans « ${hotel} ». Voici comment se répartissent les ${n} personnes hébergées qui ne sont dans aucun autre hôtel :`,
    autoIntro: (n) => `Aucune chambre n’est encore créée. Voici comment se répartissent les ${n} personnes hébergées :`,
    autoRegeln: "femmes et hommes séparés, souhaits réciproques ensemble, sinon mélangés par région et sans anciens compagnons de chambre. Vous pouvez envoyer la liste telle quelle à l’hôtel ; c’est l’hôtel qui attribue les numéros de chambre.",
    variante: (g) => (g === 2 ? "avec chambres doubles (2 lits)" : "avec chambres triples (3 lits)"),
    zimmerZahl: (n) => `${n} chambres`,
    aufteilung: (f, m, o) => `${f} pour femmes · ${m} pour hommes${o ? ` · ${o} sans sexe renseigné` : ""}`,
    pdfFuersHotel: "Liste des chambres en PDF (pour l’hôtel)",
    excelLaden: "Télécharger la liste Excel",
    wirdUebernommen: "Application en cours …",
    soUebernehmen: "Appliquer ainsi et ajuster à la main",
    uebernehmenErklaerung: (n) => `« Appliquer » crée les ${n} chambres dans Logistique (y indiquer le nom de l’hôtel) et répartit tout le monde. Ensuite, chaque personne peut être déplacée individuellement, et la liste des chambres peut aussi être imprimée. Les participants ne voient leur chambre qu’après publication dans Logistique.`,
    hinweiseZahl: (n) => `${n} remarques`,
    bereichKopf: (bereich, zimmer, personen) => `${bereich} · ${zimmer} chambres, ${personen} personnes`,
    vorschlag: "Proposition",
    vorschlagRegeln: "Souhaits réciproques d’abord, chambres uniquement femmes ou uniquement hommes, sinon mélangés par région et sans anciens compagnons de chambre. Les attributions manuelles restent.",
    achtung: "Attention :",
    sofortSichtbar: "Les chambres sont publiées dans « Mein Bereich » ; les participants voient tout de suite ce qui est appliqué.",
    erstNachFreigabe: ["Les participants ne voient leur chambre qu’une fois publiée dans ", "."],
    logistik: teamTexte.fr.bereiche.logistik,
    verwerfen: "Abandonner",
    vorschlagUebernehmen: "Appliquer la proposition",
    vorschlagBerechnen: "Calculer une proposition",
    ohneBett: "Sans lit :",
    aktuellerPlan: "Plan des chambres actuel",
    einzelnUmsetzen: "Déplacer individuellement (Logistique)",
    listeExcel: "Liste des chambres en Excel",
    vorschlagZuruecksetzen: "Annuler la proposition",
    nochNiemandEingeteilt: "Personne n’est encore réparti.",
    fest: "fixé",
    vorschlagChip: "proposition",
    freigeben: "libérer",
    festhalten: "fixer",
    schonZusammenImZimmer: (a, b, gewuenscht) => `${a} et ${b} ont déjà partagé une chambre${gewuenscht ? " (souhaité)" : ""}`,
    nochOhneZimmer: "Encore sans chambre :",
    wuensche: "Souhaits de chambre",
    wuenscheStand: (n, offen) => `${n} personnes ont indiqué un souhait, dont ${offen} à regarder (ci-dessus). Attribue ici les noms non reconnus ; l’attribution vaut pour la proposition.`,
    einzelzimmerWunsch: "Souhait de chambre individuelle",
    keinWunsch: "pas de souhait précis",
    werGemeint: (text) => `Qui est désigné par « ${text} » ?`,
    automatisch: "reconnaître automatiquement",
    ignorieren: "ignorer",
    vorgeschlagen: (name) => `${name} (proposé)`,
    ok: "OK",
    aendern: "modifier",
    keineWuensche: "Pas encore de souhaits de chambre.",
    verlauf: "Qui a déjà partagé une chambre avec qui",
    keinVerlauf: "Aucun plan des chambres n’est encore enregistré pour les modules précédents. L’historique commence avec le premier plan appliqué et sera pris en compte au prochain module.",
    zimmerBelegt: (belegt, alle) => `${belegt} chambres occupées sur ${alle}, ${alle - belegt} restent libres.`,
    kommtDazu: (ab) => `arrive le ${ab.replace(/\.$/, "")}`,
    schonZusammen: (a, b) => `${a} et ${b} ont déjà partagé une chambre`,
  },
};

/**
 * Zimmerplan eines Moduls: Zimmerwünsche verstehen (und korrigieren), Vorschlag mit Durchmischung berechnen und
 * übernehmen, aktueller Plan, Verlauf „wer war schon mit wem im Zimmer“. Hotel und Zimmer werden unter Logistik angelegt.
 */
export default async function ZimmerplanSeite({ params, searchParams }: PageProps<"/team/module/[id]/zimmerplan">) {
  const staff = await requireStaff("orga");
  const l = staff.sprache;
  const t = T[l];
  const naechteKurz = (n: string[]) => (n.length ? n.map(nachtName).join(", ") : t.keineNacht);
  const datum = new Intl.DateTimeFormat(teamLocale[l], { month: "short", year: "numeric", timeZone: "Europe/Berlin" });
  const hinweisText = (h: PlanHinweis) => hinweisTexte[l][h.art](h);
  const { id } = await params;
  const sp = await searchParams;
  if (!istToken(id)) notFound();
  const d = await ladeZimmerplan(id, typeof sp.hotel === "string" ? sp.hotel : null);
  if (!d.modul) notFound();
  // Adressen innerhalb der Seite behalten das gewählte Hotel
  const mitHotel = (extra: Record<string, string> = {}, pfad = `/team/module/${id}/zimmerplan/`) => {
    const q = new URLSearchParams({ ...(d.hotel ? { hotel: d.hotel.id } : {}), ...extra });
    return `${pfad}${q.size ? `?${q}` : ""}`;
  };
  const hotelFeld = d.hotel ? <input type="hidden" name="hotel_id" value={d.hotel.id} /> : null;

  const plan = vorschlag(d);
  // Noch keine Zimmer: automatische Einteilung mit 2er- oder 3er-Zimmern zeigen (Hinweise dann auch von dort)
  const ohneZimmerAngelegt = d.zimmer.length === 0;
  const groesse = sp.groesse === "3" ? 3 : 2;
  const varianten = ohneZimmerAngelegt ? { 2: probeplan(d, 2), 3: probeplan(d, 3) } : null;
  const probe = varianten?.[groesse] ?? null;
  const zeigeVorschlag = sp.vorschlag === "1";
  const korrigieren = typeof sp.korrigieren === "string" ? sp.korrigieren : "";
  const plancode = typeof sp.hinweis === "string" && sp.hinweis.startsWith("plan-") ? Number(sp.hinweis.slice(5)) : null;

  const byId = new Map(d.personen.map((p) => [p.participant_id, p]));
  const name = (pid: string) => byId.get(pid)?.name ?? "?";
  const uebernachten = d.personen.filter((p) => p.nights.length > 0);
  const betten = d.zimmer.reduce((s, z) => s + z.capacity, 0);
  const eingeteilt = d.imHotel;
  const ohneZimmer = uebernachten.filter((p) => !p.room_id);
  const mehrereHotels = d.hotels.length > 1;
  const hinweiseJePerson = new Map<string, string[]>();
  for (const h of probe?.hinweise ?? plan.hinweise) hinweiseJePerson.set(h.personId, [...(hinweiseJePerson.get(h.personId) ?? []), hinweisText(h)]);
  const mitWunsch = d.personen.filter((p) => p.room_wish.trim())
    .map((p) => ({ p, teile: d.teile.get(p.participant_id) ?? [], probleme: hinweiseJePerson.get(p.participant_id) ?? [] }))
    .map((x) => ({ ...x, offen: x.teile.some((t) => t.art === "unbekannt" || t.art === "mehrdeutig" || t.art === "aehnlich") || x.probleme.length > 0 }))
    .sort((a, b) => Number(b.offen) - Number(a.offen) || a.p.name.localeCompare(b.p.name, "de"));
  const wuenscheVon = (pid: string) => new Set((d.teile.get(pid) ?? []).flatMap((t) => (t.ziel ? [t.ziel.id] : [])));
  const gegenseitig = (a: string, b: string) => wuenscheVon(a).has(b) && wuenscheVon(b).has(a);
  const alleSortiert = [...d.personen].sort((a, b) => a.name.localeCompare(b.name, "de"));

  // aktueller Plan je Zimmer, mit Paaren, die schon einmal zusammen waren
  const belegung = d.zimmer.map((z) => ({ ...z, leute: d.personen.filter((p) => p.room_id === z.id) }));
  const schonZusammen = (a: string, b: string) => d.paare.has(`${a}|${b}`);
  const verlaufJePerson = new Map<string, typeof d.verlauf>();
  for (const v of d.verlauf) verlaufJePerson.set(v.participant_id, [...(verlaufJePerson.get(v.participant_id) ?? []), v]);

  return (
    <>
      <TeamKopf staff={staff} aktiv={darf.alles(staff.role) ? "module" : "logistik"} breit />
      <main lang={l} className="mx-auto max-w-7xl px-4 py-8">
        <ModulReiter id={id} titel={d.modul.title} aktiv="zimmerplan/" />
        <Hinweis code={sp.hinweis} texte={t.hinweise} />
        {plancode !== null && <p role="status" className="mt-4 rounded-2xl bg-emerald-100 p-4 text-emerald-950">{t.planUebernommen(plancode)}</p>}

        {mehrereHotels && (
          <nav aria-label={t.hotel} className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{t.hotelDoppelpunkt}</span>
            {d.hotels.map((h) => (
              <Link key={h.id} href={`/team/module/${id}/zimmerplan/?hotel=${h.id}`} aria-current={h.id === d.hotel?.id ? "page" : undefined}
                className={`rounded-full px-4 py-2 text-sm font-semibold ring-1 ${h.id === d.hotel?.id ? "bg-ink text-paper ring-ink" : "bg-weiss ring-line hover:ring-ink"}`}>
                {h.name} <span className="opacity-70">{d.personen.filter((p) => p.hotel_id === h.id).length}</span>
              </Link>
            ))}
            {d.inAnderenHotels.length > 0 && <span className="text-sm text-ink-soft">{t.nurDiesesHotel(d.inAnderenHotels.length)}</span>}
          </nav>
        )}

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kachel wert={uebernachten.length} text={t.kUebernachten(uebernachten.filter((p) => p.gender === "w").length, uebernachten.filter((p) => p.gender === "m").length)} />
          <Kachel wert={betten} text={t.kBetten(d.zimmer.length)} ton={betten < uebernachten.length ? "warnung" : "neutral"} />
          <Kachel wert={eingeteilt.length} text={mehrereHotels ? t.kEingeteiltHotel(d.inAnderenHotels.length) : t.kEingeteilt} ton={eingeteilt.length && !ohneZimmer.length ? "gut" : "neutral"} />
          <Kachel wert={ohneZimmer.length} text={t.kOhneZimmer} ton={ohneZimmer.length ? "warnung" : "neutral"} />
        </section>

        {(!d.hotel || d.zimmer.length === 0) && uebernachten.length === 0 ? (
          <p className="karte mt-6">{t.nochNiemand}</p>
        ) : !d.hotel || d.zimmer.length === 0 ? (
          <section id="einteilung" className="karte mt-6 scroll-mt-4">
            <h2 className="font-display text-2xl font-bold">{t.autoTitel}</h2>
            <p className="mt-1 max-w-3xl text-sm text-ink-soft">
              {mehrereHotels ? t.autoIntroHotel(d.hotel?.name ?? "", d.planPersonen.filter((p) => p.nights.length > 0).length) : t.autoIntro(uebernachten.length)} {t.autoRegeln}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {([2, 3] as const).map((g) => {
                const v = varianten![g];
                const zahl = (b: string) => v.zimmer.filter((z) => z.bereich === b).length;
                const aktiv = g === groesse;
                return (
                  <Link key={g} href={`${mitHotel({ groesse: String(g) })}#einteilung`} aria-current={aktiv ? "true" : undefined}
                    className={`rounded-3xl p-5 ring-1 transition ${aktiv ? "bg-ink text-paper ring-ink" : "bg-white ring-line hover:ring-ink"}`}>
                    <span className="block font-semibold">{t.variante(g)}</span>
                    <span className="font-display mt-1 block text-3xl font-extrabold">{t.zimmerZahl(v.zimmer.length)}</span>
                    <span className={`mt-1 block text-sm ${aktiv ? "text-paper/75" : "text-ink-soft"}`}>
                      {t.aufteilung(zahl("Frauen"), zahl("Männer"), zahl("ohne Angabe"))}
                    </span>
                  </Link>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <a href={mitHotel({ groesse: String(groesse) }, `/team/module/${id}/zimmerliste/pdf/`)} className="knopf">{t.pdfFuersHotel}</a>
              <a href={mitHotel({ groesse: String(groesse) }, `/team/module/${id}/zimmerplan/liste/`)} className="knopf-hell">{t.excelLaden}</a>
              <form action={probeUebernehmen}>
                <input type="hidden" name="module_id" value={id} /><input type="hidden" name="groesse" value={groesse} />{hotelFeld}
                <SendeKnopf className="knopf-hell" laeuft={t.wirdUebernommen}>{t.soUebernehmen}</SendeKnopf>
              </form>
            </div>
            <p className="mt-2 max-w-3xl text-xs text-ink-soft">{t.uebernehmenErklaerung(probe!.zimmer.length)}</p>
            {probe!.hinweise.length > 0 && (
              <details className="mt-4 rounded-2xl bg-gelb-hell p-4" open={probe!.hinweise.length <= 8}>
                <summary className="cursor-pointer font-semibold">{t.hinweiseZahl(probe!.hinweise.length)}</summary>
                <ul className="mt-2 space-y-1 text-sm">{probe!.hinweise.map((h, i) => <li key={i}><span className="font-semibold">{name(h.personId)}</span> {hinweisText(h)}</li>)}</ul>
              </details>
            )}
            {(["Frauen", "Männer", "ohne Angabe"] as const).map((b) => {
              const teil = probe!.zimmer.filter((z) => z.bereich === b);
              return teil.length > 0 && (
                <div key={b} className="mt-6">
                  <h3 className="font-display text-xl font-bold">{t.bereichKopf(t.bereich[b] ?? b, teil.length, teil.reduce((n, z) => n + z.belegung.length, 0))}</h3>
                  <ZimmerRaster t={t} naechteKurz={naechteKurz} zimmer={teil.map((z) => ({ ...z, leute: z.belegung.map((x) => ({ pid: x.id, grund: x.grund })) }))} personen={byId} schonZusammen={schonZusammen} zusammenfassung={false} />
                </div>
              );
            })}
          </section>
        ) : (
          <>
            {/* Vorschlag */}
            <section className="karte mt-6">
              <div className="flex flex-wrap items-center gap-3">
                <div className="mr-auto">
                  <h2 className="font-display text-2xl font-bold">{t.vorschlag}</h2>
                  <p className="text-sm text-ink-soft">{t.vorschlagRegeln}</p>
                  <p className="mt-1 text-sm">
                    {d.hotel.rooms_visible
                      ? <><span className="font-semibold">{t.achtung}</span> {t.sofortSichtbar}</>
                      : <>{t.erstNachFreigabe[0]}<Link href={mitHotel({}, `/team/module/${id}/hotel/`)} className="link font-semibold">{t.logistik}</Link>{t.erstNachFreigabe[1]}</>}
                  </p>
                </div>
                {zeigeVorschlag ? (
                  <>
                    <Link href={mitHotel()} className="knopf-hell">{t.verwerfen}</Link>
                    <form action={planUebernehmen}><input type="hidden" name="module_id" value={id} />{hotelFeld}<button className="knopf">{t.vorschlagUebernehmen}</button></form>
                  </>
                ) : <Link href={mitHotel({ vorschlag: "1" })} className="knopf">{t.vorschlagBerechnen}</Link>}
              </div>
              {zeigeVorschlag && (
                <>
                  {plan.hinweise.length > 0 && (
                    <details className="mt-4 rounded-2xl bg-gelb-hell p-4" open={plan.hinweise.length <= 8}>
                      <summary className="cursor-pointer font-semibold">{t.hinweiseZahl(plan.hinweise.length)}</summary>
                      <ul className="mt-2 space-y-1 text-sm">{plan.hinweise.map((h, i) => <li key={i}><span className="font-semibold">{name(h.personId)}</span> {hinweisText(h)}</li>)}</ul>
                    </details>
                  )}
                  <ZimmerRaster t={t} naechteKurz={naechteKurz} zimmer={plan.zimmer.map((z) => ({ ...z, leute: z.belegung.map((b) => ({ pid: b.id, grund: b.grund })) }))} personen={byId} schonZusammen={schonZusammen} />
                  {plan.ohneZimmer.length > 0 && <p className="mt-4 rounded-2xl bg-rot-hell p-3 text-sm text-rot">{t.ohneBett} {plan.ohneZimmer.map(name).join(", ")}</p>}
                </>
              )}
            </section>

            {/* aktueller Plan */}
            <section className="karte mt-6">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-display mr-auto text-2xl font-bold">{t.aktuellerPlan}</h2>
                <Link href={mitHotel({}, `/team/module/${id}/hotel/`)} className="knopf-hell">{t.einzelnUmsetzen}</Link>
                <a href={mitHotel({}, `/team/module/${id}/zimmerliste/pdf/`)} className="knopf-hell">{t.pdfFuersHotel}</a>
                <a href={mitHotel({}, `/team/module/${id}/zimmerplan/liste/`)} className="knopf-hell">{t.listeExcel}</a>
                {eingeteilt.some((p) => p.source === "auto") && (
                  <form action={vorschlagZuruecksetzen}>
                    <input type="hidden" name="module_id" value={id} /><input type="hidden" name="hotel_id" value={d.hotel.id} />
                    <button className="text-sm font-semibold text-ink-soft underline">{t.vorschlagZuruecksetzen}</button>
                  </form>
                )}
              </div>
              {eingeteilt.length === 0 ? <p className="mt-3 text-ink-soft">{t.nochNiemandEingeteilt}</p> : (
                <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {belegung.filter((z) => z.leute.length > 0).map((z) => (
                    <li key={z.id} className="rounded-2xl bg-white p-4 ring-1 ring-line">
                      <p className="flex items-center gap-2 font-semibold">{z.label}{z.section && <span className="font-normal text-ink-soft">· {t.bereich[z.section] ?? z.section}</span>}<span className="chip ml-auto bg-paper-deep">{z.leute.length}/{z.capacity}</span></p>
                      <ul className="mt-2 space-y-1.5 text-sm">
                        {z.leute.map((p) => (
                          <li key={p.participant_id} id={`z-${p.participant_id}`} className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold">{p.name}</span>
                            <span className={`chip ${p.source === "manual" ? "bg-ink text-paper" : "bg-paper-deep"}`}>{p.source === "manual" ? t.fest : t.vorschlagChip}</span>
                            <form action={zuteilungFestlegen} className="ml-auto">
                              <input type="hidden" name="module_id" value={id} /><input type="hidden" name="hotel_id" value={d.hotel!.id} />
                              <input type="hidden" name="participant_id" value={p.participant_id} /><input type="hidden" name="fest" value={p.source === "manual" ? "0" : "1"} />
                              <button className="text-xs font-semibold text-ink-soft underline">{p.source === "manual" ? t.freigeben : t.festhalten}</button>
                            </form>
                          </li>
                        ))}
                      </ul>
                      {z.leute.flatMap((a, i) => z.leute.slice(i + 1).filter((b) => schonZusammen(a.participant_id, b.participant_id)).map((b) => (
                        <p key={a.participant_id + b.participant_id} className="mt-2 rounded-xl bg-gelb-hell px-2 py-1 text-xs">{t.schonZusammenImZimmer(a.name, b.name, gegenseitig(a.participant_id, b.participant_id))}</p>
                      )))}
                    </li>
                  ))}
                </ul>
              )}
              {ohneZimmer.length > 0 && eingeteilt.length > 0 && <p className="mt-4 text-sm text-ink-soft"><span className="font-semibold text-ink">{t.nochOhneZimmer}</span> {ohneZimmer.map((p) => p.name).join(", ")}</p>}
            </section>
          </>
        )}

        {/* Zimmerwünsche */}
        <section className="karte mt-6">
          <h2 className="font-display text-2xl font-bold">{t.wuensche}</h2>
          <p className="text-sm text-ink-soft">{t.wuenscheStand(mitWunsch.length, mitWunsch.filter((x) => x.offen).length)}</p>
          <ul className="mt-4 divide-y divide-line">
            {mitWunsch.map(({ p, teile, probleme }) => (
              <li key={p.participant_id} id={`w-${p.participant_id}`} className="scroll-mt-4 py-3">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold">{p.name}</span>
                  {p.gender && <span className={`chip ${p.gender === "w" ? "bg-rose-100" : "bg-sky-100"}`}>{t.g[p.gender] ?? p.gender}</span>}
                  <span className="text-sm text-ink-soft">{naechteKurz(p.nights)} · {t.zitat(p.room_wish)}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                  {teile.length === 0 && <span className="text-ink-soft">{wuenschtEinzelzimmer(p.room_wish) ? t.einzelzimmerWunsch : t.keinWunsch}</span>}
                  {teile.map((teil) => {
                    const art = t.teilArt[teil.art];
                    const gegen = teil.ziel && gegenseitig(p.participant_id, teil.ziel.id);
                    const auswahl = teil.art !== "sicher" || korrigieren === p.participant_id;
                    return (
                      <span key={teil.schluessel} className="inline-flex flex-wrap items-center gap-1.5">
                        <span className={`chip ${teilArtKlasse[teil.art]}`}>
                          {teil.ziel ? `${gegen ? "⇄" : "→"} ${teil.ziel.name}` : teil.text}{art && ` · ${art}`}{teil.ziel && teil.text !== teil.ziel.name && teil.art !== "sicher" ? ` (${teil.text})` : ""}
                        </span>
                        {auswahl ? (
                          <form action={wunschKorrigieren} className="inline-flex gap-1">
                            <input type="hidden" name="module_id" value={id} /><input type="hidden" name="participant_id" value={p.participant_id} /><input type="hidden" name="token" value={teil.schluessel} />{hotelFeld}
                            <label className="sr-only" htmlFor={`k-${p.participant_id}-${teil.schluessel}`}>{t.werGemeint(teil.text)}</label>
                            <select id={`k-${p.participant_id}-${teil.schluessel}`} name="wished_id" defaultValue={teil.art === "korrigiert" ? teil.ziel?.id : teil.art === "ignoriert" ? "-" : teil.kandidaten?.[0]?.id ?? teil.ziel?.id ?? "auto"} className="feld !w-56 !py-1 text-sm">
                              <option value="auto">{t.automatisch}</option>
                              <option value="-">{t.ignorieren}</option>
                              {(teil.kandidaten ?? []).map((k) => <option key={`k${k.id}`} value={k.id}>{t.vorgeschlagen(k.name)}</option>)}
                              {alleSortiert.filter((x) => x.participant_id !== p.participant_id).map((x) => <option key={x.participant_id} value={x.participant_id}>{x.name}</option>)}
                            </select>
                            <button className="knopf-hell !px-3 !py-1">{t.ok}</button>
                          </form>
                        ) : null}
                      </span>
                    );
                  })}
                  {teile.some((teil) => teil.art === "sicher") && korrigieren !== p.participant_id && (
                    <Link href={`${mitHotel({ korrigieren: p.participant_id })}#w-${p.participant_id}`} className="text-xs font-semibold text-ink-soft underline">{t.aendern}</Link>
                  )}
                </div>
                {probleme.length > 0 && <ul className="mt-1.5 space-y-0.5 text-sm text-amber-900">{probleme.map((text, i) => <li key={i}>⚠ {text}</li>)}</ul>}
              </li>
            ))}
          </ul>
          {mitWunsch.length === 0 && <p className="mt-3 text-ink-soft">{t.keineWuensche}</p>}
        </section>

        {/* Verlauf */}
        <section className="karte mt-6">
          <h2 className="font-display text-2xl font-bold">{t.verlauf}</h2>
          {d.verlauf.length === 0 ? (
            <p className="mt-2 text-ink-soft">{t.keinVerlauf}</p>
          ) : (
            <ul className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              {[...verlaufJePerson.entries()].sort((a, b) => name(a[0]).localeCompare(name(b[0]), "de")).map(([pid, vs]) => (
                <li key={pid}><span className="font-semibold">{name(pid)}</span>: {vs.map((v) => `${v.mate_name} (${v.module_title}${v.module_start ? `, ${datum.format(new Date(v.module_start))}` : ""})`).join(", ")}</li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}

function Kachel({ wert, text, ton = "neutral" }: { wert: number; text: string; ton?: "neutral" | "warnung" | "gut" }) {
  const farbe = ton === "warnung" ? "bg-gelb-hell" : ton === "gut" ? "bg-gruen-hell" : "bg-weiss";
  return <div className={`rounded-3xl p-5 ring-1 ring-line ${farbe}`}><span className="font-display block text-3xl font-extrabold">{wert}</span><span className="mt-1 block text-sm text-ink-soft">{text}</span></div>;
}

type Zeile = { name: string; gender: string | null; region: string | null; nights: string[] };

function ZimmerRaster({ t, naechteKurz, zimmer, personen, schonZusammen, zusammenfassung = true }: {
  t: Texte;
  naechteKurz: (n: string[]) => string;
  zimmer: { id: string; label: string; capacity: number; leute: { pid: string; grund: Grund }[] }[];
  personen: Map<string, Zeile>;
  schonZusammen: (a: string, b: string) => boolean;
  zusammenfassung?: boolean;
}) {
  const belegt = zimmer.filter((z) => z.leute.length > 0);
  return (
    <>
      {zusammenfassung && <p className="mt-4 text-sm text-ink-soft">{t.zimmerBelegt(belegt.length, zimmer.length)}</p>}
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {belegt.map((z) => {
          // Gebucht ab der frühesten Nacht der Gäste; wer später dazukommt, wird markiert
          const gebucht = [...new Set(z.leute.flatMap((l) => personen.get(l.pid)?.nights ?? []))].sort();
          return (
            <li key={z.id} className="rounded-2xl bg-white p-4 ring-1 ring-line">
              <p className="flex items-center gap-2 font-semibold">{z.label}<span className="text-xs font-normal text-ink-soft">{gebucht.length ? `${naechteKurz([gebucht[0]]).split("/")[0]}–${naechteKurz([gebucht.at(-1)!]).split("/")[1]}` : ""}</span><span className="chip ml-auto bg-paper-deep">{z.leute.length}/{z.capacity}</span></p>
              <ul className="mt-2 space-y-1 text-sm">
                {z.leute.map((l) => {
                  const p = personen.get(l.pid);
                  return (
                    <li key={l.pid} className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold">{p?.name}</span>
                      <span className={`chip ${gruendeKlasse[l.grund]}`}>{t.gruende[l.grund]}</span>
                      {p?.region && <span className="text-xs text-ink-soft">{p.region}</span>}
                      {p && gebucht[0] && [...p.nights].sort()[0] !== gebucht[0] && <span className="chip bg-gelb-hell text-xs">{t.kommtDazu(naechteKurz([[...p.nights].sort()[0]]).split("/")[0])}</span>}
                    </li>
                  );
                })}
              </ul>
              {z.leute.flatMap((a, i) => z.leute.slice(i + 1).filter((b) => schonZusammen(a.pid, b.pid)).map((b) => (
                <p key={a.pid + b.pid} className="mt-2 rounded-xl bg-gelb-hell px-2 py-1 text-xs">{t.schonZusammen(personen.get(a.pid)?.name ?? "", personen.get(b.pid)?.name ?? "")}</p>
              )))}
            </li>
          );
        })}
      </ul>
    </>
  );
}
