"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { importieren, type ImportZustand } from "@/lib/aktionen/import";
import type { TeamSprache } from "@/lib/team-sprache";

type Art = "zusagen" | "emails" | "teilnehmerliste" | "hausaufgaben" | "bewertungsbogen";
const arten: Art[] = ["zusagen", "emails", "teilnehmerliste", "hausaufgaben", "bewertungsbogen"];

const de = {
  arten: {
    zusagen: { name: "Zusagen für ein Modul", text: "z. B. „Katılım ve Konaklama“-Formular: Name und „Katılım sağlayacak mısınız?“ (Evet/Hayır). Ergänzt fehlende Telefonnummern." },
    emails: { name: "E-Mail-Adressen", text: "z. B. Export der Google-Formular-Antworten: Spalten mit Name (oder Vor-/Nachname) und E-Mail." },
    teilnehmerliste: { name: "Teilnehmerliste", text: "„SES Academy Katılımcı listesi“: Bölge, İsim Soyisim, KGT/GT, Modul 1…n (+/–), Sorumlu Kişi. Modul 1 = Auftakt, 2 = Verfassungen, 3 = Skills-Workshop." },
    hausaufgaben: { name: "Hausaufgabenliste", text: "„Ödev Takip Çizelgesi“: Name, Bölge, Ülke, Ödev 1…n (✓)." },
    bewertungsbogen: { name: "Bewertungsbogen Rhetorik", text: "„Bewertungsbogen_Rhetorik“ (.xlsx/.xlsm): Blatt „Alle Videos“ mit 9 Kriterien und Feedback." },
  } as Record<Art, { name: string; text: string }>,
  schritt1: "1. Was für eine Datei?",
  schritt2: "2. Datei auswählen",
  schritt3: "3. Optionen",
  modul: "Modul",
  hausaufgabeNr: "Gehört zu Hausaufgabe Nr.",
  vorschlaege: "Ähnliche Namen automatisch zuordnen (Tippfehler, nur Vorname, abgeschnittene Namen) – erst nach Prüfung der Vorschau anhaken",
  anlegen: "Personen, die noch nicht im Portal sind, neu anlegen",
  ueberschreiben: "Vorhandene E-Mail-Adressen überschreiben",
  liest: "Wird gelesen …",
  vorschau: "Vorschau anzeigen",
  uebernehmen: "Jetzt übernehmen",
  rueckfrage: "Rückfrage",
  frage: (titel: string) => `„${titel}“ jetzt in die Datenbank übernehmen?`,
  wieVorschau: (zahlen: string, warnungen: number) => `So wie in der Vorschau: ${zahlen}.${warnungen ? ` ${warnungen} Hinweise zum Prüfen.` : ""} Rückgängig machen geht nur von Hand.`,
  geaendert: "Geänderte Datei oder Optionen? Dann vorher noch einmal „Vorschau anzeigen“.",
  ja: "Ja, übernehmen",
  abbrechen: "Abbrechen",
  fussnote: "Die Vorschau ändert nichts. Erst „Jetzt übernehmen“ schreibt in die Datenbank. Mehrfaches Importieren derselben Datei legt nichts doppelt an.",
  uebernommen: "Übernommen",
  nurVorschau: "Vorschau – noch nichts gespeichert",
  pruefen: (n: number) => `Bitte prüfen (${n})`,
  hinweise: "Hinweise",
  soGehts: "So funktioniert’s",
  schritte: [
    "Art der Datei wählen und Datei hochladen.",
    "„Vorschau anzeigen“: Das Portal zeigt, was es erkannt hat und welche Namen unklar sind.",
    "Bei Bedarf „Ähnliche Namen zuordnen“ anhaken und erneut Vorschau ansehen.",
    "„Jetzt übernehmen“. Unklare Fälle danach im Portal von Hand zuordnen.",
  ],
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    arten: {
      zusagen: { name: "Bir modül için katılım cevapları", text: "örn. “Katılım ve Konaklama” formu: isim ve “Katılım sağlayacak mısınız?” (Evet/Hayır). Eksik telefon numaralarını tamamlar." },
      emails: { name: "E-posta adresleri", text: "örn. Google Form yanıtlarının dışa aktarımı: isim (ya da ad/soyad) ve e-posta sütunları." },
      teilnehmerliste: { name: "Katılımcı listesi", text: "“SES Academy Katılımcı listesi”: Bölge, İsim Soyisim, KGT/GT, Modul 1…n (+/–), Sorumlu Kişi. Modül 1 = Açılış, 2 = Anayasalar, 3 = Beceri atölyesi." },
      hausaufgaben: { name: "Ödev listesi", text: "“Ödev Takip Çizelgesi”: Name, Bölge, Ülke, Ödev 1…n (✓)." },
      bewertungsbogen: { name: "Hitabet değerlendirme formu", text: "“Bewertungsbogen_Rhetorik” (.xlsx/.xlsm): 9 kriter ve geri bildirim içeren “Alle Videos” sayfası." },
    },
    schritt1: "1. Ne tür bir dosya?",
    schritt2: "2. Dosya seç",
    schritt3: "3. Seçenekler",
    modul: "Modül",
    hausaufgabeNr: "Ait olduğu ödev no.",
    vorschlaege: "Benzer isimleri otomatik eşleştir (yazım hatası, yalnızca ad, kesik isimler) – önce önizlemeyi kontrol et, sonra işaretle",
    anlegen: "Portalda henüz olmayan kişileri yeni oluştur",
    ueberschreiben: "Mevcut e-posta adreslerinin üzerine yaz",
    liest: "Okunuyor …",
    vorschau: "Önizlemeyi göster",
    uebernehmen: "Şimdi aktar",
    rueckfrage: "Onay sorusu",
    frage: (titel) => `“${titel}” şimdi veritabanına aktarılsın mı?`,
    wieVorschau: (zahlen, warnungen) => `Önizlemedeki gibi: ${zahlen}.${warnungen ? ` Kontrol edilecek ${warnungen} not var.` : ""} Geri almak yalnızca elle mümkün.`,
    geaendert: "Dosyayı ya da seçenekleri değiştirdin mi? O zaman önce bir kez daha “Önizlemeyi göster”e tıkla.",
    ja: "Evet, aktar",
    abbrechen: "Vazgeç",
    fussnote: "Önizleme hiçbir şeyi değiştirmez. Veritabanına ancak “Şimdi aktar” yazar. Aynı dosyayı birkaç kez içe aktarmak hiçbir şeyi iki kez oluşturmaz.",
    uebernommen: "Aktarıldı",
    nurVorschau: "Önizleme – henüz hiçbir şey kaydedilmedi",
    pruefen: (n) => `Lütfen kontrol et (${n})`,
    hinweise: "Notlar",
    soGehts: "Nasıl çalışır",
    schritte: [
      "Dosya türünü seç ve dosyayı yükle.",
      "“Önizlemeyi göster”: Portal neyi tanıdığını ve hangi isimlerin belirsiz olduğunu gösterir.",
      "Gerekirse “Benzer isimleri otomatik eşleştir”i işaretle ve önizlemeye tekrar bak.",
      "“Şimdi aktar”. Belirsiz durumları ardından portalda elle eşleştir.",
    ],
  },
  fr: {
    arten: {
      zusagen: { name: "Confirmations pour un module", text: "p.\u00a0ex. formulaire «\u00a0Katılım ve Konaklama\u00a0»\u00a0: nom et «\u00a0Katılım sağlayacak mısınız?\u00a0» (Evet/Hayır). Complète les numéros de téléphone manquants." },
      emails: { name: "Adresses e-mail", text: "p.\u00a0ex. export des réponses d’un Google Form\u00a0: colonnes avec le nom (ou prénom/nom) et l’e-mail." },
      teilnehmerliste: { name: "Liste des participants", text: "«\u00a0SES Academy Katılımcı listesi\u00a0»\u00a0: Bölge, İsim Soyisim, KGT/GT, Modul 1…n (+/–), Sorumlu Kişi. Module 1 = lancement, 2 = constitutions, 3 = atelier de compétences." },
      hausaufgaben: { name: "Liste des devoirs", text: "«\u00a0Ödev Takip Çizelgesi\u00a0»\u00a0: Name, Bölge, Ülke, Ödev 1…n (✓)." },
      bewertungsbogen: { name: "Grille d’évaluation rhétorique", text: "«\u00a0Bewertungsbogen_Rhetorik\u00a0» (.xlsx/.xlsm)\u00a0: feuille «\u00a0Alle Videos\u00a0» avec 9\u00a0critères et des retours." },
    },
    schritt1: "1. Quel type de fichier\u00a0?",
    schritt2: "2. Choisir le fichier",
    schritt3: "3. Options",
    modul: "Module",
    hausaufgabeNr: "Correspond au devoir n°",
    vorschlaege: "Associer automatiquement les noms similaires (fautes de frappe, prénom seul, noms tronqués) – à cocher seulement après avoir vérifié l’aperçu",
    anlegen: "Créer les personnes qui ne sont pas encore dans le portail",
    ueberschreiben: "Remplacer les adresses e-mail existantes",
    liest: "Lecture…",
    vorschau: "Afficher l’aperçu",
    uebernehmen: "Appliquer maintenant",
    rueckfrage: "Confirmation",
    frage: (titel) => `Appliquer «\u00a0${titel}\u00a0» à la base de données maintenant\u00a0?`,
    wieVorschau: (zahlen, warnungen) => `Comme dans l’aperçu\u00a0: ${zahlen}.${warnungen ? ` ${warnungen}\u00a0remarques à vérifier.` : ""} L’annulation ne peut se faire qu’à la main.`,
    geaendert: "Fichier ou options modifiés\u00a0? Alors clique d’abord encore une fois sur «\u00a0Afficher l’aperçu\u00a0».",
    ja: "Oui, appliquer",
    abbrechen: "Annuler",
    fussnote: "L’aperçu ne modifie rien. Seul «\u00a0Appliquer maintenant\u00a0» écrit dans la base de données. Importer plusieurs fois le même fichier ne crée pas de doublons.",
    uebernommen: "Appliqué",
    nurVorschau: "Aperçu – rien n’est encore enregistré",
    pruefen: (n) => `À vérifier (${n})`,
    hinweise: "Remarques",
    soGehts: "Comment ça marche",
    schritte: [
      "Choisis le type de fichier et charge le fichier.",
      "«\u00a0Afficher l’aperçu\u00a0»\u00a0: le portail montre ce qu’il a reconnu et quels noms ne sont pas clairs.",
      "Si besoin, coche «\u00a0Associer automatiquement les noms similaires\u00a0» et regarde à nouveau l’aperçu.",
      "«\u00a0Appliquer maintenant\u00a0». Associe ensuite à la main, dans le portail, les cas peu clairs.",
    ],
  },
};

export type ModulWahl = { id: string; titel: string };

export function ImportFormular({ module = [], sprache = "de" }: { module?: ModulWahl[]; sprache?: TeamSprache }) {
  const t = T[sprache];
  const [z, aktion, laeuft] = useActionState<ImportZustand, FormData>(importieren, {});
  const [art, setArt] = useState<string>("emails");
  const form = useRef<HTMLFormElement>(null);
  const warnungen = z.bericht?.hinweise.filter((h) => h.stufe === "warnung") ?? [];
  const infos = z.bericht?.hinweise.filter((h) => h.stufe !== "warnung") ?? [];

  // Ohne <form action>: React würde das Formular (samt gewählter Datei) nach der Vorschau zurücksetzen.
  const [rueckfrage, setRueckfrage] = useState(false);
  const senden = (m: "vorschau" | "anwenden") => {
    if (!form.current?.reportValidity()) return;
    const daten = new FormData(form.current);
    daten.set("modus", m);
    if (m === "anwenden") daten.set("bestaetigt", "ja");
    setRueckfrage(false);
    startTransition(() => aktion(daten));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <form ref={form} onSubmit={(e) => { e.preventDefault(); senden("vorschau"); }} className="karte space-y-5">
        <fieldset>
          <legend className="etikett">{t.schritt1}</legend>
          <div className="space-y-2">
            {arten.map((a) => (
              <label key={a} className={`flex cursor-pointer gap-3 rounded-2xl p-3 ring-1 transition ${art === a ? "bg-paper ring-ink" : "ring-line hover:bg-paper"}`}>
                <input type="radio" name="art" value={a} checked={art === a} onChange={() => setArt(a)} className="mt-1 accent-ink" />
                <span><span className="font-semibold">{t.arten[a].name}</span><span className="block text-xs text-ink-soft">{t.arten[a].text}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label className="etikett" htmlFor="datei">{t.schritt2}</label>
          <input id="datei" name="datei" type="file" accept=".xlsx,.xlsm,.csv" required className="feld file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-1.5 file:text-sm file:font-semibold file:text-paper" />
        </div>
        <fieldset className="space-y-2 text-sm">
          <legend className="etikett">{t.schritt3}</legend>
          {art === "zusagen" && (
            <label className="block">{t.modul}
              <select name="modul_id" required defaultValue={module[0]?.id} className="feld mt-1">
                {module.map((m) => <option key={m.id} value={m.id}>{m.titel}</option>)}
              </select>
            </label>
          )}
          {art === "bewertungsbogen" && (
            <label className="flex items-center gap-2">{t.hausaufgabeNr} <input name="hausaufgabe_nr" type="number" min={1} defaultValue={1} className="feld w-20 py-1" /></label>
          )}
          <label className="flex items-start gap-2"><input type="checkbox" name="vorschlaege" className="mt-0.5 accent-ink" /> {t.vorschlaege}</label>
          {art !== "teilnehmerliste" && <label className="flex items-start gap-2"><input type="checkbox" name="anlegen" className="mt-0.5 accent-ink" /> {t.anlegen}</label>}
          {art === "emails" && <label className="flex items-start gap-2"><input type="checkbox" name="ueberschreiben" className="mt-0.5 accent-ink" /> {t.ueberschreiben}</label>}
        </fieldset>
        <div className="flex flex-wrap gap-3 border-t border-line pt-5">
          <button type="button" onClick={() => senden("vorschau")} className="knopf-hell" disabled={laeuft}>{laeuft ? t.liest : t.vorschau}</button>
          <button type="button" onClick={() => setRueckfrage(true)} className="knopf" disabled={laeuft || !z.bericht || z.bericht.angewendet || rueckfrage}>{t.uebernehmen}</button>
        </div>
        {rueckfrage && z.bericht && !z.bericht.angewendet && (
          <div role="group" aria-label={t.rueckfrage} className="rounded-2xl bg-gelb-hell p-4 text-sm">
            <p className="font-semibold">{t.frage(z.bericht.titel)}</p>
            <p className="mt-1">{t.wieVorschau(z.bericht.zahlen.map(([k, v]) => `${k}${sprache === "fr" ? "\u00a0" : ""}: ${v}`).join(" · "), warnungen.length)}</p>
            <p className="mt-1 text-ink-soft">{t.geaendert}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => senden("anwenden")} className="knopf" disabled={laeuft}>{t.ja}</button>
              <button type="button" onClick={() => setRueckfrage(false)} className="knopf-hell">{t.abbrechen}</button>
            </div>
          </div>
        )}
        <p className="text-xs text-ink-soft">{t.fussnote}</p>
      </form>

      <section aria-live="polite">
        {z.fehler && <div className="rounded-3xl bg-rot-hell p-6 font-semibold text-rot">{z.fehler}</div>}
        {z.bericht && (
          <div className="karte">
            <p className="text-sm font-semibold tracking-wide text-sage uppercase">{z.bericht.angewendet ? t.uebernommen : t.nurVorschau}</p>
            <h2 className="font-display mt-1 text-2xl font-bold">{z.bericht.titel}</h2>
            <p className="text-sm text-ink-soft">{z.dateiname}</p>
            <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {z.bericht.zahlen.map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-paper p-3">
                  <dt className="text-xs text-ink-soft">{k}</dt>
                  <dd className="font-display text-2xl font-bold">{v}</dd>
                </div>
              ))}
            </dl>
            {warnungen.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold">{t.pruefen(warnungen.length)}</h3>
                <ul className="mt-2 max-h-96 space-y-1.5 overflow-y-auto text-sm">
                  {warnungen.map((h, i) => <li key={i} className="rounded-xl bg-gelb-hell px-3 py-2">{h.text}</li>)}
                </ul>
              </div>
            )}
            {infos.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold">{t.hinweise}</h3>
                <ul className="mt-2 max-h-72 space-y-1.5 overflow-y-auto text-sm text-ink-soft">
                  {infos.map((h, i) => <li key={i}>• {h.text}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
        {!z.bericht && !z.fehler && (
          <div className="rounded-3xl border-2 border-dashed border-line p-8 text-ink-soft">
            <p className="font-semibold text-ink">{t.soGehts}</p>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
              {t.schritte.map((schritt) => <li key={schritt}>{schritt}</li>)}
            </ol>
          </div>
        )}
      </section>
    </div>
  );
}
