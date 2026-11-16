// Beiträge der Teilnehmenden („Stimmen“). Anleitung zum Eintragen: ~/SES_ACADEMY/STIMMEN_LEITFADEN.md
// Beiträge erscheinen in ihrer Originalsprache auf allen Sprachversionen der Seite.
import type { ModulSlug, Sprache } from "./typ";

export type BeitragTyp = "kommentar" | "video" | "grafik" | "podcast" | "rede" | "artikel";
export type Land = "de" | "fr" | "at" | "nl" | "be" | "ch" | "andere";

export type Beitrag = {
  slug: string;
  typ: BeitragTyp;
  /** Modul, in dem der Beitrag entstanden ist – entfällt z. B. bei Reden oder Presseartikeln außerhalb der Academy. */
  modul?: ModulSlug;
  land: Land;
  sprache: Sprache;
  datum: string; // ISO
  titel: string;
  teaser: string;
  text: string[]; // Absätze; bei Artikeln genügt eine kurze Zusammenfassung
  autor: { name: string; alter?: number; stadt?: string };
  /** YouTube-Video-ID; wird erst nach Klick geladen (Datenschutz). */
  youtube?: string;
  bild?: string;
  /** Nur bei Reden: wo und zu welchem Anlass die Rede gehalten wurde, z. B. „Landesparteitag Bündnis 90/Die Grünen NRW, Köln“. */
  anlass?: string;
  /** Nur bei Artikeln: Link zum Originalbeitrag im Medium (Zeitung, Magazin, Blog). */
  extern?: { url: string; medium: string };
  /** Fiktiver Beispielbeitrag – erscheint nur, wenn beim Build SES_MUSTER=1 gesetzt ist. */
  muster?: boolean;
};

const alle: Beitrag[] = [
  {
    slug: "muster-kommentar",
    muster: true,
    typ: "kommentar",
    modul: "verfassungen",
    land: "de",
    sprache: "de",
    datum: "2026-06-20",
    titel: "Eine Verfassung ist kein Museumsstück",
    teaser: "MUSTER – So könnte ein Kommentar nach dem Verfassungs-Modul aussehen. Dieser Text ist fiktiv.",
    text: [
      "MUSTER – Dieser Beitrag ist ein fiktiver Platzhalter und zeigt nur, wie ein echter Beitrag auf der Seite aussieht.",
      "Vor dem Wochenende in Köln hätte ich gesagt: Das Grundgesetz ist etwas für Jurist:innen. Nach zwei Tagen mit Keynotes, Panels und unserer Ländergruppe sehe ich das anders. Eine Verfassung lebt davon, dass Menschen sie kennen, sich auf sie berufen – und sie verteidigen, wenn es darauf ankommt.",
      "Am meisten hat mich der Vergleich mit Frankreich und Österreich beschäftigt: Dieselbe Idee von Religionsfreiheit, drei sehr unterschiedliche Wege, sie umzusetzen.",
    ],
    autor: { name: "Vorname N. (Muster)", alter: 22, stadt: "Köln" },
  },
  {
    slug: "muster-rede",
    muster: true,
    typ: "rede",
    land: "de",
    sprache: "de",
    datum: "2026-10-10",
    titel: "Teilhabe ist kein Gnadenakt",
    teaser: "MUSTER – So erscheint eine Rede, die eine Teilnehmerin außerhalb der Academy gehalten hat. Dieser Text ist fiktiv.",
    anlass: "Kreismitgliederversammlung einer Partei, Köln (Muster)",
    text: [
      "MUSTER – Dieser Beitrag ist ein fiktiver Platzhalter. Bei Reden steht hier der Redetext oder ein Auszug; ein Video kann zusätzlich über die YouTube-ID eingebunden werden.",
    ],
    autor: { name: "Vorname N. (Muster)", alter: 24, stadt: "Köln" },
  },
  {
    slug: "muster-artikel",
    muster: true,
    typ: "artikel",
    land: "de",
    sprache: "de",
    datum: "2026-10-01",
    titel: "Was junge Muslime von der Politik erwarten",
    teaser: "MUSTER – So erscheint ein Gastbeitrag, den ein Teilnehmer in einer Zeitung veröffentlicht hat. Dieser Text ist fiktiv.",
    extern: { url: "https://example.org/", medium: "Beispielzeitung (Muster)" },
    text: ["MUSTER – Bei Artikeln genügen zwei, drei Sätze Zusammenfassung; der vollständige Text bleibt beim Medium und wird verlinkt."],
    autor: { name: "Vorname N. (Muster)", alter: 26, stadt: "Düsseldorf" },
  },
  {
    slug: "fransa-17-ekim-eylemleri",
    typ: "artikel",
    land: "fr",
    sprache: "tr",
    datum: "2026-10-20",
    titel: "Fransa’da Sokakların Öfkesi, Devletin Sınavı: 17 Ekim Eylemlerini Nasıl Okumalı?",
    teaser: "Öğrencilerin, sendikaların ve toplumsal hareketlerin 17 Ekim’de Fransa genelinde düzenlediği gösteriler üzerine bir analiz.",
    text: [
      "Perspektif’te yayımlanan yazı, 17 Ekim eylemlerini Fransa’nın protesto geleneği, sosyal medyada yayılan görüntüler ve polis müdahalesine ilişkin tartışmalar ışığında değerlendiriyor.",
    ],
    extern: { url: "https://perspektif.eu/2026/10/20/fransada-sokaklarin-ofkesi-devletin-sinavi-17-ekim-eylemlerini-nasil-okumali", medium: "Perspektif" },
    autor: { name: "Büşra D.", stadt: "Lyon" },
  },
  {
    slug: "ed-miliband-kimdir",
    typ: "artikel",
    land: "fr",
    sprache: "tr",
    datum: "2026-09-24",
    titel: "İngiltere’nin İsrail Politikasını Sertleştiren Yahudi Dışişleri Bakanı: Ed Miliband Kimdir?",
    teaser: "Ed Miliband’ın siyasi biyografisi ve Birleşik Krallık’ın İsrail politikasındaki değişime etkisi üzerine bir portre.",
    text: [
      "Perspektif’te yayımlanan portre, Miliband’ın İşçi Partisi’ndeki yükselişini, iklim politikasındaki rolünü ve İsrail-Filistin konusundaki tutumunun aile geçmişi ve kimliğiyle bağlantısını ele alıyor.",
    ],
    extern: { url: "https://perspektif.eu/2026/09/24/ingilterenin-israil-politikasini-sertlestiren-yahudi-disisleri-bakani-ed-miliband-kimdir", medium: "Perspektif" },
    autor: { name: "Büşra D.", stadt: "Lyon" },
  },
  // Artikel von Teilnehmenden bei Perspektif, recherchiert 16.11.2026 (Zuordnung über Autorenangaben geprüft),
  // eingetragen auf Wunsch Yusuf; Zusammenfassungen eigene Worte, Originalsprache Türkisch.
  {
    slug: "bedirhan-a-yatirim-ve-risk",
    typ: "artikel",
    land: "de",
    sprache: "tr",
    datum: "2026-11-02",
    titel: "Müslümanlar Yatırım Konusunda Daha Az Risk mi Alıyor?",
    teaser: "İnançlı Müslümanlar yatırımda gerçekten daha mı temkinli? Finans, risk ve İslami ilkeler üzerine bir değerlendirme.",
    text: ["Bedirhan, finansın yalnızca paradan ibaret olmadığını, tasarruf ve yatırım kararlarının insanların geleceğini doğrudan etkilediğini anlatıyor. İslami finansı faiz yasağına indirgemek yerine adil ve sorumlu işlemleri öne çıkaran ilkeleriyle ele alıyor ve Müslümanların riskten kaçınma eğilimini bu çerçevede tartışıyor."],
    autor: { name: "Bedirhan A.", stadt: "Duisburg" },
    extern: { url: "https://perspektif.eu/2026/11/02/muslumanlar-yatirim-konusunda-daha-az-risk-mi-aliyor", medium: "Perspektif" },
  },
  {
    slug: "seyda-a-avrupa-saga-kayiyor",
    typ: "artikel",
    land: "at",
    sprache: "tr",
    datum: "2026-11-13",
    titel: "Avrupa Son 25 Yılın En Sağında: 1,6 Milyar Oyun Analizi Ne Anlatıyor?",
    teaser: "1999’dan 2024’e Avrupa seçimlerine dair kapsamlı bir veri analizi: Kıta neden ve nasıl sağa kaydı?",
    text: ["Şeyda, Der Standard’ın 1,6 milyarı aşkın oyu inceleyen veri analizini ele alıyor: 2024, son çeyrek asırda Avrupa’nın en sağda olduğu yıl. Yazı, bu kaymayı yalnızca aşırı sağın başarısıyla açıklamanın yetmediğini, geleneksel partilerin kendi siyasetlerini nasıl değiştirdiğine de bakmak gerektiğini savunuyor."],
    autor: { name: "Şeyda A.", stadt: "Vorarlberg" },
    extern: { url: "https://perspektif.eu/2026/11/13/avrupa-son-25-yilin-en-saginda-16-milyar-oyun-analizi-ne-anlatiyor", medium: "Perspektif" },
  },
  {
    slug: "sevde-a-dokustelle-raporu",
    typ: "artikel",
    land: "at",
    sprache: "tr",
    datum: "2026-06-18",
    titel: "Dokustelle Raporu: Avusturya’da Müslüman Karşıtı Irkçılık Rekor Seviyede",
    teaser: "Avusturya’da 2025’te belgelenen Müslüman karşıtı ırkçılık vakaları tarihî bir zirveye ulaştı.",
    text: ["Sevde, Dokustelle’nin 2025 raporunu özetliyor: 1.684 vaka ile kayıt tutulmaya başlandığından bu yana en yüksek sayı belgelenmiş. Yazı, raporun ayrımcılığı münferit olaylar değil yapısal bir sorun olarak gördüğünü ve ilk kez ırkçı saikle işlenmiş bir cinayetin istatistiğe girdiğini vurguluyor."],
    autor: { name: "Sevde A.", stadt: "Wien" },
    extern: { url: "https://perspektif.eu/2026/06/18/dokustelle-raporu-avusturyada-musluman-karsiti-irkcilik-rekor-seviyede", medium: "Perspektif" },
  },
  {
    slug: "busra-d-jordan-bardella",
    typ: "artikel",
    land: "fr",
    sprache: "tr",
    datum: "2026-10-05",
    titel: "Aşırı Sağın Yeni Yüzü Jordan Bardella ve Eski Bir Tartışma: Antisemitizm",
    teaser: "Bardella’ya atfedilen yazışmalar, Ulusal Birlik’in geçmişinden ne kadar uzaklaştığı sorusunu yeniden açıyor.",
    text: ["Büşra, Mediapart’ın Jordan Bardella’ya atfettiği antisemitik yazışmalara dair haberini ve Bardella’nın suçlamaları reddedişini aktarıyor. Yazı, kendini Fransız Yahudilerinin koruyucusu olarak sunan partinin aynı zamanda Müslümanların dinî görünürlüğünü kısıtlayan politikalar savunmasındaki çelişkiye dikkat çekiyor."],
    autor: { name: "Büşra D.", stadt: "Lyon" },
    extern: { url: "https://perspektif.eu/2026/10/05/asiri-sagin-yeni-yuzu-jordan-bardella-ve-eski-bir-tartisma-antisemitizm", medium: "Perspektif" },
  },
  {
    slug: "bunyamin-k-economist-ve-musluman-katilim",
    typ: "artikel",
    land: "de",
    sprache: "tr",
    datum: "2026-09-24",
    titel: "The Economist’e Göre Avrupa’da Müslümanların Siyasi Sınırları",
    teaser: "The Economist “İslamcılık”ı tehdit sayarken Müslümanların meşru siyasi katılımı ile güvenlik meselesi arasındaki sınır nerede çiziliyor?",
    text: ["Bünyamin, The Economist’in “Avrupa’da İslam” dosyasını değerlendiriyor: Dergi aşırı sağın “ele geçirme” anlatılarını reddederken “İslamcılık” ve kurumlara “sızma” kavramlarını tehdit olarak tanımlıyor. Yazı, bu ayrımın Müslümanların meşru toplumsal ve siyasi katılımını korumaya yetip yetmediğini sorguluyor."],
    autor: { name: "Bünyamin K.", stadt: "Lünen" },
    extern: { url: "https://perspektif.eu/2026/09/24/the-economiste-gore-avrupada-muslumanlarin-siyasi-sinirlari", medium: "Perspektif" },
  },
  {
    slug: "bunyamin-k-wust-ankara-ziyareti",
    typ: "artikel",
    land: "de",
    sprache: "tr",
    datum: "2026-09-30",
    titel: "Wüst’ün Ankara Ziyareti: Berlin’in Ötesinde Bir Türkiye Politikası mı?",
    teaser: "Kuzey Ren-Vestfalya Başbakanı’nın Ankara ziyareti ekonomik ortaklık ile aidiyet söylemini birleştiriyor.",
    text: ["Bünyamin, Hendrik Wüst’ün Türkiye ziyaretini ve ticaret, vize ve Gümrük Birliği gibi gündem başlıklarını anlatıyor. Asıl soruyu şöyle koyuyor: Türkiye ile yakınlaşma, Almanya’daki Türkiye kökenli toplumun eşit ve kalıcı aidiyetinin tanınmasına da yansıyacak mı?"],
    autor: { name: "Bünyamin K.", stadt: "Lünen" },
    extern: { url: "https://perspektif.eu/2026/09/30/wustun-ankara-ziyareti-berlinin-otesinde-bir-turkiye-politikasi-mi", medium: "Perspektif" },
  },
  {
    slug: "enes-k-islam-dunyasinda-universite",
    typ: "artikel",
    land: "de",
    sprache: "tr",
    datum: "2025-03-03",
    titel: "İslam Dünyasında “Üniversite” Düşüncesine Dair",
    teaser: "Medreselerden Beytü’l-Hikme’ye: İslam medeniyetinin ilim merkezleri bugüne nasıl ilham verebilir?",
    text: ["Enes, Avrupa’da üniversiteler kurulmadan önce İslam dünyasında yükselen medreseleri, kütüphaneleri ve ilim merkezlerini anlatıyor. Bilginin yalnızca dinî ilimlerle sınırlı görülmediği bu geleneği, bugünkü üniversite tartışmaları için bir ilham kaynağı olarak değerlendiriyor."],
    autor: { name: "Enes K.", stadt: "Lünen" },
    extern: { url: "https://perspektif.eu/2025/03/03/islam-dunyasinda-universite-dusuncesine-dair", medium: "Perspektif" },
  },
  {
    slug: "rumeysa-k-mutluluk-dersi",
    typ: "artikel",
    land: "de",
    sprache: "tr",
    datum: "2026-05-07",
    titel: "Performans Baskısına Karşı: Almanya Okullarında “Mutluluk Dersi” Veriliyor",
    teaser: "Okul sadece başarıyı mı ölçmeli? Almanya’da 500’ü aşkın okulda verilen bir dersin hikâyesi.",
    text: ["Rümeysa, 2007’de Ernst Fritz-Schubert’in başlattığı “Mutluluk Dersi”ni tanıtıyor. Ders, sınav ve performans baskısına karşı öğrencilerin psikolojik dayanıklılığını, sosyal ilişkilerini ve öz farkındalığını güçlendirmeyi amaçlıyor; yazı bu yaklaşımın okul deneyimini nasıl değiştirebileceğini soruyor."],
    autor: { name: "Rümeysa K.", stadt: "Schöffengrund" },
    extern: { url: "https://perspektif.eu/2026/05/07/performans-baskisina-karsi-almanya-okullarinda-mutluluk-dersi-veriliyor", medium: "Perspektif" },
  },
  {
    slug: "rumeysa-k-unicef-cocuklar",
    typ: "artikel",
    land: "de",
    sprache: "tr",
    datum: "2026-06-16",
    titel: "Zengin Ülkelerde Eşitsizliğin Bedelini En Çok Çocuklar Ödüyor",
    teaser: "UNICEF’e göre refah, zengin ülkelerde de tüm çocuklara eşit ulaşmıyor; Almanya 37 ülke arasında 25. sırada.",
    text: ["Rümeysa, UNICEF Innocenti’nin ekonomik eşitsizlik ve çocukların iyi olma hâli üzerine raporunu özetliyor. Rapor, varlıklı bir ülkede yaşamanın tüm çocuklar için eşit sağlık, mutluluk ve eğitim fırsatı anlamına gelmediğini gösteriyor; yazı Almanya’nın bu tablodaki yerini tartışıyor."],
    autor: { name: "Rümeysa K.", stadt: "Schöffengrund" },
    extern: { url: "https://perspektif.eu/2026/06/16/unicef-raporu-gelismis-ulkelerde-de-cocuklar-ekonomik-esitsizlikten-etkileniyor", medium: "Perspektif" },
  },
  {
    slug: "rumeysa-s-abdul-el-sayed",
    typ: "artikel",
    land: "de",
    sprache: "tr",
    datum: "2026-11-05",
    titel: "Trump’a Kafa Tutarak Seçilen Abdul El-Sayed Kimdir?",
    teaser: "ABD Senatosuna seçilen ilk Müslüman Abdul El-Sayed’in zaferi ne anlatıyor?",
    text: ["Rümeysa, Michigan’da Mike Rogers’ı yaklaşık 7 puan farkla yenen Abdul El-Sayed’in seçim zaferini anlatıyor. Trump’ın dinî kimliğini hedef alan saldırılarına rağmen kazanan El-Sayed’in başarısının Demokrat Parti’nin ilerici kanadı ve ABD’nin İsrail politikası için ne anlama geldiğini tartışıyor."],
    autor: { name: "Rümeysa Ş.", stadt: "Wiesbaden" },
    extern: { url: "https://perspektif.eu/2026/11/05/trumpa-kafa-tutarak-secilen-abdul-el-sayed-kimdir", medium: "Perspektif" },
  },
];

export const zeigeMuster = process.env.SES_MUSTER === "1";

export const beitraege: Beitrag[] = alle
  .filter((b) => zeigeMuster || !b.muster)
  .sort((a, b) => b.datum.localeCompare(a.datum));
