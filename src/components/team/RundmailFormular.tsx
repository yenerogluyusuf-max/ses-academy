"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { MailWarning } from "lucide-react";
import {
  rundmailPruefen, rundmailTesten, rundmailVorlegen, vorlageLoeschen, vorlageSpeichern,
  type RundmailFehler, type RundmailPruefung, type RundmailTest, type VorlageMeldung,
} from "@/lib/aktionen/rundmail";
import type { TeamSprache } from "@/lib/team-sprache";

export type Vorlage = { id: string; name: string; subject_de: string; body_de: string; subject_tr: string; body_tr: string };
type Option = { id: string | number; name: string };
export type FilterOptionen = { generationen: Option[]; regionen: Option[]; sorumlu: Option[]; module: Option[]; gruppen: Option[] };

/** Sprache der Mail an die Teilnehmenden (nicht die der Oberfläche). */
const sprachen = ["de", "tr", "konto"] as const;
type Sprache = (typeof sprachen)[number];

const filterFelder = [
  { k: "cohort_id", liste: "generationen" },
  { k: "region_id", liste: "regionen" },
  { k: "mentor_id", liste: "sorumlu" },
  { k: "module_id", liste: "module" },
  { k: "group_id", liste: "gruppen" },
] as const;
type FilterFeld = (typeof filterFelder)[number]["k"];

const de = {
  sprachen: {
    de: { name: "Deutsch", text: "alle bekommen den deutschen Text" },
    tr: { name: "Türkisch", text: "alle bekommen den türkischen Text" },
    konto: { name: "Nach Kontosprache", text: "Türkisch für Konten auf Türkisch, sonst Deutsch (beide Texte nötig)" },
  } as Record<Sprache, { name: string; text: string }>,
  filter: {
    cohort_id: { name: "Generation", leer: "alle Generationen" },
    region_id: { name: "Region", leer: "alle Regionen" },
    mentor_id: { name: "Sorumlu", leer: "alle Sorumlu-Gruppen" },
    module_id: { name: "Modul", leer: "unabhängig von Modulen" },
    group_id: { name: "Gruppe", leer: "alle Gruppen" },
  } as Record<FilterFeld, { name: string; leer: string }>,
  vorlage: "Vorlage", ohneVorlage: "ohne Vorlage", keineVorlagen: "noch keine Vorlagen gespeichert", vorlageLoeschen: "Vorlage löschen",
  sprache: "Sprache", betreff: "Betreff", text: "Text", aufDeutsch: " (Deutsch)", betreffTr: "Betreff (Türkisch)", textTr: "Text (Türkisch)",
  platzhalterDe: "Die Anrede „Hallo Vorname,“ und der Gruß kommen automatisch dazu.",
  platzhalterTr: "„Merhaba Vorname,“ und der Gruß kommen automatisch dazu.",
  alsVorlage: "Als Vorlage speichern", vorlageName: "Name der Vorlage", vorlageBeispiel: "z. B. Erinnerung Zusage", vorlageSpeichern: "Vorlage speichern",
  vorlageHinweis: "Gleicher Name überschreibt die vorhandene Vorlage. Gespeichert werden Betreff und Text in den gewählten Sprachen.",
  anWen: "An wen? (leer = alle aktiven mit E-Mail)",
  angemeldet: (modul: string) => `angemeldet: ${modul}`,
  auswahl: (n: number) => `An die Auswahl in der Liste: ${n} ${n === 1 ? "Person" : "Personen"} angehakt.`,
  filterText: (beschreibung: string) => `Filter: ${beschreibung}`,
  auswahlOhneAdresse: "Wer keine E-Mail-Adresse hat oder ausgeschieden ist, bekommt nichts.",
  pruefenTitel: "Vor dem Vorlegen prüfen",
  pruefenText: (email: string) => `Zählt die Empfänger und schickt auf Wunsch eine Testmail an dich (${email}).`,
  wirdGeprueft: "Wird geprüft …", pruefen: "Empfänger zählen und prüfen",
  geaendert: "Seit der Prüfung wurde etwas geändert. Bitte neu prüfen.",
  empfaenger: (n: number) => `${n} ${n === 1 ? "Empfänger" : "Empfänger:innen"}`,
  verteilung: (deutsch: number, tuerkisch: number) => `${deutsch} auf Deutsch, ${tuerkisch} auf Türkisch`,
  alleTr: "alle auf Türkisch", alleDe: "alle auf Deutsch",
  ohneAdresse: (n: number) => ` · ${n} aus der Auswahl ohne E-Mail-Adresse (bekommen nichts)`,
  testmail: "Testmail an mich", vorlegen: "Zur Freigabe vorlegen",
  danach: "Danach gibt eine zweite Person die Nachricht unter „Freigaben“ frei; verschickt wird erst dann, unter „Nachrichten“.",
  mailAus: "Mailversand ist nicht eingerichtet: Hier geht im Moment keine Mail raus.",
  fehler: {
    eingabe: "Bitte die Angaben prüfen.",
    "text-de": "Bitte Betreff und Text auf Deutsch angeben.",
    "text-tr": "Bitte Betreff und Text auf Türkisch angeben.",
    niemand: "Niemand ausgewählt.",
    empfaenger: "Die Empfänger konnten nicht ermittelt werden.",
    "keine-empfaenger": "Mit dieser Auswahl gibt es keine Empfänger mit E-Mail-Adresse.",
    "mail-aus": "Mailversand ist nicht eingerichtet: Die Testmail kann nicht verschickt werden.",
    "test-fehler": "Die Testmail konnte nicht verschickt werden: Der Mailserver hat sie abgelehnt oder war nicht erreichbar.",
    "vorlage-name": "Bitte einen Namen für die Vorlage angeben.",
    "vorlage-betreff": "Die Vorlage braucht mindestens einen Betreff.",
    "vorlage-fehler": "Die Vorlage konnte nicht gespeichert werden.",
    "vorlage-unbekannt": "Unbekannte Vorlage.",
    fehler: "Das hat nicht geklappt.",
  } as Record<RundmailFehler, string>,
  testGesendet: (email: string, zwei: boolean) => zwei ? `Zwei Testmails (Deutsch und Türkisch) an ${email} verschickt.` : `Testmail an ${email} verschickt.`,
  vorlageErfolg: (erfolg: "gespeichert" | "aktualisiert" | "geloescht", name = "") =>
    erfolg === "geloescht" ? "Vorlage gelöscht." : erfolg === "aktualisiert" ? `Vorlage „${name}“ aktualisiert.` : `Vorlage „${name}“ gespeichert.`,
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    sprachen: {
      de: { name: "Almanca", text: "herkese Almanca metin gider" },
      tr: { name: "Türkçe", text: "herkese Türkçe metin gider" },
      konto: { name: "Hesap diline göre", text: "hesabı Türkçe olanlara Türkçe, diğerlerine Almanca (iki metin de gerekli)" },
    },
    filter: {
      cohort_id: { name: "Dönem", leer: "tüm dönemler" },
      region_id: { name: "Bölge", leer: "tüm bölgeler" },
      mentor_id: { name: "Sorumlu", leer: "tüm sorumlu grupları" },
      module_id: { name: "Modül", leer: "modüllerden bağımsız" },
      group_id: { name: "Grup", leer: "tüm gruplar" },
    },
    vorlage: "Şablon", ohneVorlage: "şablonsuz", keineVorlagen: "henüz kayıtlı şablon yok", vorlageLoeschen: "Şablonu sil",
    sprache: "Dil", betreff: "Konu", text: "Metin", aufDeutsch: " (Almanca)", betreffTr: "Konu (Türkçe)", textTr: "Metin (Türkçe)",
    platzhalterDe: "„Hallo Ad,“ hitabı ve kapanış selamı otomatik eklenir.",
    platzhalterTr: "„Merhaba Ad,“ hitabı ve kapanış selamı otomatik eklenir.",
    alsVorlage: "Şablon olarak kaydet", vorlageName: "Şablon adı", vorlageBeispiel: "ör. Katılım hatırlatması", vorlageSpeichern: "Şablonu kaydet",
    vorlageHinweis: "Aynı ad, mevcut şablonun üzerine yazar. Seçilen dillerdeki konu ve metin kaydedilir.",
    anWen: "Kime? (boş = e-postası olan tüm aktif kişiler)",
    angemeldet: (modul) => `kayıtlı: ${modul}`,
    auswahl: (n) => `Listedeki seçime: ${n} kişi işaretli.`,
    filterText: (beschreibung) => `Filtre: ${beschreibung}`,
    auswahlOhneAdresse: "E-posta adresi olmayan ya da programdan ayrılmış olanlara bir şey gitmez.",
    pruefenTitel: "Onaya sunmadan önce kontrol et",
    pruefenText: (email) => `Alıcıları sayar ve istersen sana (${email}) bir test e-postası gönderir.`,
    wirdGeprueft: "Kontrol ediliyor …", pruefen: "Alıcıları say ve kontrol et",
    geaendert: "Kontrolden sonra bir şey değişti. Lütfen yeniden kontrol et.",
    empfaenger: (n) => `${n} alıcı`,
    verteilung: (deutsch, tuerkisch) => `${deutsch} Almanca, ${tuerkisch} Türkçe`,
    alleTr: "hepsi Türkçe", alleDe: "hepsi Almanca",
    ohneAdresse: (n) => ` · seçimdeki ${n} kişinin e-posta adresi yok (bir şey almazlar)`,
    testmail: "Bana test e-postası gönder", vorlegen: "Onaya sun",
    danach: "Ardından ikinci bir kişi mesajı „Onaylar“ bölümünde onaylar; gönderim ancak bundan sonra „Mesajlar“ bölümünden yapılır.",
    mailAus: "E-posta gönderimi kurulmadı: Şu an buradan e-posta gitmiyor.",
    fehler: {
      eingabe: "Lütfen bilgileri kontrol et.",
      "text-de": "Lütfen Almanca konu ve metni gir.",
      "text-tr": "Lütfen Türkçe konu ve metni gir.",
      niemand: "Kimse seçilmedi.",
      empfaenger: "Alıcılar belirlenemedi.",
      "keine-empfaenger": "Bu seçimde e-posta adresi olan alıcı yok.",
      "mail-aus": "E-posta gönderimi kurulmadı: Test e-postası gönderilemiyor.",
      "test-fehler": "Test e-postası gönderilemedi: Posta sunucusu e-postayı reddetti ya da sunucuya ulaşılamadı.",
      "vorlage-name": "Lütfen şablon için bir ad gir.",
      "vorlage-betreff": "Şablonun en az bir konusu olmalı.",
      "vorlage-fehler": "Şablon kaydedilemedi.",
      "vorlage-unbekannt": "Bilinmeyen şablon.",
      fehler: "Bu işlem olmadı.",
    },
    testGesendet: (email, zwei) => zwei ? `İki test e-postası (Almanca ve Türkçe) ${email} adresine gönderildi.` : `Test e-postası ${email} adresine gönderildi.`,
    vorlageErfolg: (erfolg, name = "") =>
      erfolg === "geloescht" ? "Şablon silindi." : erfolg === "aktualisiert" ? `„${name}“ şablonu güncellendi.` : `„${name}“ şablonu kaydedildi.`,
  },
  fr: {
    sprachen: {
      de: { name: "Allemand", text: "tout le monde reçoit le texte allemand" },
      tr: { name: "Turc", text: "tout le monde reçoit le texte turc" },
      konto: { name: "Selon la langue du compte", text: "turc pour les comptes en turc, sinon allemand (les deux textes sont nécessaires)" },
    },
    filter: {
      cohort_id: { name: "Promotion", leer: "toutes les promotions" },
      region_id: { name: "Région", leer: "toutes les régions" },
      mentor_id: { name: "Sorumlu", leer: "tous les groupes sorumlu" },
      module_id: { name: "Module", leer: "indépendamment des modules" },
      group_id: { name: "Groupe", leer: "tous les groupes" },
    },
    vorlage: "Modèle", ohneVorlage: "sans modèle", keineVorlagen: "aucun modèle enregistré pour l’instant", vorlageLoeschen: "Supprimer le modèle",
    sprache: "Langue", betreff: "Objet", text: "Texte", aufDeutsch: " (allemand)", betreffTr: "Objet (turc)", textTr: "Texte (turc)",
    platzhalterDe: "La formule d’appel « Hallo prénom, » et la salutation finale sont ajoutées automatiquement.",
    platzhalterTr: "La formule d’appel « Merhaba prénom, » et la salutation finale sont ajoutées automatiquement.",
    alsVorlage: "Enregistrer comme modèle", vorlageName: "Nom du modèle", vorlageBeispiel: "p. ex. Rappel confirmation", vorlageSpeichern: "Enregistrer le modèle",
    vorlageHinweis: "Un nom identique remplace le modèle existant. L’objet et le texte sont enregistrés dans les langues choisies.",
    anWen: "À qui ? (vide = toutes les personnes actives avec e-mail)",
    angemeldet: (modul) => `inscrits : ${modul}`,
    auswahl: (n) => `À la sélection de la liste : ${n} ${n === 1 ? "personne cochée" : "personnes cochées"}.`,
    filterText: (beschreibung) => `Filtre : ${beschreibung}`,
    auswahlOhneAdresse: "Les personnes sans adresse e-mail ou qui ont quitté le programme ne reçoivent rien.",
    pruefenTitel: "Vérifier avant de soumettre",
    pruefenText: (email) => `Compte les destinataires et, si tu le souhaites, t’envoie un e-mail de test (${email}).`,
    wirdGeprueft: "Vérification …", pruefen: "Compter les destinataires et vérifier",
    geaendert: "Quelque chose a changé depuis la vérification. Merci de vérifier à nouveau.",
    empfaenger: (n) => `${n} ${n === 1 ? "destinataire" : "destinataires"}`,
    verteilung: (deutsch, tuerkisch) => `${deutsch} en allemand, ${tuerkisch} en turc`,
    alleTr: "tous en turc", alleDe: "tous en allemand",
    ohneAdresse: (n) => ` · ${n} de la sélection sans adresse e-mail (ne reçoivent rien)`,
    testmail: "M’envoyer un e-mail de test", vorlegen: "Soumettre pour validation",
    danach: "Ensuite, une deuxième personne valide le message dans « Validations » ; l’envoi se fait seulement après, dans « Messages ».",
    mailAus: "L’envoi d’e-mails n’est pas configuré : aucun e-mail ne part d’ici pour le moment.",
    fehler: {
      eingabe: "Merci de vérifier les informations.",
      "text-de": "Merci d’indiquer l’objet et le texte en allemand.",
      "text-tr": "Merci d’indiquer l’objet et le texte en turc.",
      niemand: "Personne n’est sélectionné.",
      empfaenger: "Impossible de déterminer les destinataires.",
      "keine-empfaenger": "Avec cette sélection, aucun destinataire n’a d’adresse e-mail.",
      "mail-aus": "L’envoi d’e-mails n’est pas configuré : l’e-mail de test ne peut pas être envoyé.",
      "test-fehler": "L’e-mail de test n’a pas pu être envoyé : le serveur de messagerie l’a refusé ou était injoignable.",
      "vorlage-name": "Merci de donner un nom au modèle.",
      "vorlage-betreff": "Le modèle doit avoir au moins un objet.",
      "vorlage-fehler": "Le modèle n’a pas pu être enregistré.",
      "vorlage-unbekannt": "Modèle inconnu.",
      fehler: "Cela n’a pas fonctionné.",
    },
    testGesendet: (email, zwei) => zwei ? `Deux e-mails de test (allemand et turc) envoyés à ${email}.` : `E-mail de test envoyé à ${email}.`,
    vorlageErfolg: (erfolg, name = "") =>
      erfolg === "geloescht" ? "Modèle supprimé." : erfolg === "aktualisiert" ? `Modèle « ${name} » mis à jour.` : `Modèle « ${name} » enregistré.`,
  },
};

/** Angehakte Personen der Teilnehmendenliste (Kästchen mit data-rundmail). */
function angehakt(): string[] {
  return [...document.querySelectorAll<HTMLInputElement>("input[data-rundmail]:checked")].map((e) => e.value);
}

/**
 * Rundmail schreiben und zur Freigabe vorlegen: Vorlage wählen oder speichern, Deutsch/Türkisch/nach Kontosprache,
 * an Filter (Nachrichten) oder an die Auswahl (Teilnehmende). Vor dem Vorlegen: Empfängerzahl und Testmail an sich selbst.
 * sprache: Sprache des Team-Bereichs (Oberfläche, Standard Deutsch); die Mails selbst gehen auf Deutsch bzw. Türkisch.
 */
export function RundmailFormular({ vorlagen, mailBereit, email, filterOptionen, auswahl, sprache: uiSprache = "de" }: {
  vorlagen: Vorlage[]; mailBereit: boolean; email: string; filterOptionen?: FilterOptionen;
  auswahl?: { beschreibung: string }; sprache?: TeamSprache;
}) {
  const t = T[uiSprache];
  const [vorlage, setVorlage] = useState("");
  const [sprache, setSprache] = useState<Sprache>("de");
  const [betreff, setBetreff] = useState("");
  const [text, setText] = useState("");
  const [betreffTr, setBetreffTr] = useState("");
  const [textTr, setTextTr] = useState("");
  const [filter, setFilter] = useState<Record<string, string>>({});
  const [pruefung, setPruefung] = useState<{ schluessel: string; ergebnis: RundmailPruefung } | null>(null);
  const [test, setTest] = useState<RundmailTest | null>(null);
  const [meldung, setMeldung] = useState<VorlageMeldung | null>(null);
  const [vorlageName, setVorlageName] = useState("");
  const [laeuft, starte] = useTransition();

  // Auswahl in der Liste mitverfolgen (Kästchen sind Teil der Tabelle, nicht dieses Formulars)
  const auswahlText = useSyncExternalStore(
    (melden) => {
      if (!auswahl) return () => {};
      document.addEventListener("change", melden);
      return () => document.removeEventListener("change", melden);
    },
    () => (auswahl ? angehakt().join(",") : ""),
    () => "",
  );
  const ids = useMemo(() => (auswahlText ? auswahlText.split(",") : []), [auswahlText]);

  const eingabe = useMemo(() => ({
    betreff, text, betreffTr, textTr, sprache, filter: auswahl ? {} : filter, ids: auswahl ? ids : undefined, auswahl: auswahl?.beschreibung,
  }), [betreff, text, betreffTr, textTr, sprache, filter, ids, auswahl]);
  const schluessel = JSON.stringify(eingabe);
  // Nach jeder Änderung muss neu geprüft werden: was vorgelegt wird, ist genau das Geprüfte
  const aktuell = pruefung?.schluessel === schluessel ? pruefung.ergebnis : null;
  const deutsch = sprache !== "tr";
  const tuerkisch = sprache !== "de";

  const vorlageWaehlen = (id: string) => {
    setVorlage(id);
    const v = vorlagen.find((x) => x.id === id);
    if (!v) return;
    setBetreff(v.subject_de); setText(v.body_de); setBetreffTr(v.subject_tr); setTextTr(v.body_tr); setVorlageName(v.name);
    setSprache(v.subject_de && v.subject_tr ? "konto" : v.subject_tr ? "tr" : "de");
    setMeldung(null);
  };

  const pruefen = () => starte(async () => {
    setTest(null);
    const ergebnis = await rundmailPruefen(eingabe);
    setPruefung({ schluessel, ergebnis });
  });
  const testen = () => starte(async () => setTest(await rundmailTesten(eingabe)));
  const vorlegen = () => starte(async () => {
    const r = await rundmailVorlegen(eingabe);
    if (r?.fehler) setPruefung({ schluessel, ergebnis: { ok: false, fehler: r.fehler } });
  });
  const speichern = () => starte(async () => {
    const r = await vorlageSpeichern({ name: vorlageName, betreff: deutsch ? betreff : "", text: deutsch ? text : "", betreffTr: tuerkisch ? betreffTr : "", textTr: tuerkisch ? textTr : "" });
    setMeldung(r);
    if (r.ok && r.id) setVorlage(r.id);
  });
  const loeschen = () => starte(async () => {
    if (!vorlage) return;
    setMeldung(await vorlageLoeschen(vorlage));
    setVorlage("");
  });

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label className="etikett" htmlFor="vorlage">{t.vorlage}</label>
          <select id="vorlage" value={vorlage} onChange={(e) => vorlageWaehlen(e.target.value)} className="feld">
            <option value="">{vorlagen.length ? t.ohneVorlage : t.keineVorlagen}</option>
            {vorlagen.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        {vorlage && <button type="button" onClick={loeschen} disabled={laeuft} className="text-sm font-semibold text-ink-soft underline sm:mb-3">{t.vorlageLoeschen}</button>}
      </div>

      <fieldset>
        <legend className="etikett">{t.sprache}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {sprachen.map((s) => (
            <label key={s} className={`flex cursor-pointer gap-2 rounded-2xl p-3 ring-1 ${sprache === s ? "bg-paper ring-ink" : "ring-line"}`}>
              <input type="radio" name="sprache" value={s} checked={sprache === s} onChange={() => setSprache(s)} className="mt-1 accent-ink" />
              <span><span className="font-semibold">{t.sprachen[s].name}</span><span className="block text-xs text-ink-soft">{t.sprachen[s].text}</span></span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className={`grid gap-4 ${deutsch && tuerkisch ? "lg:grid-cols-2" : ""}`}>
        {deutsch && (
          <div className="grid gap-3">
            <div><label className="etikett" htmlFor="betreff">{t.betreff}{tuerkisch ? t.aufDeutsch : ""}</label><input id="betreff" lang="de" value={betreff} onChange={(e) => setBetreff(e.target.value)} maxLength={200} className="feld" /></div>
            <div><label className="etikett" htmlFor="text">{t.text}{tuerkisch ? t.aufDeutsch : ""}</label><textarea id="text" lang="de" value={text} onChange={(e) => setText(e.target.value)} rows={8} maxLength={10000} className="feld" placeholder={t.platzhalterDe} /></div>
          </div>
        )}
        {tuerkisch && (
          <div className="grid gap-3">
            <div><label className="etikett" htmlFor="betreff_tr">{t.betreffTr}</label><input id="betreff_tr" lang="tr" value={betreffTr} onChange={(e) => setBetreffTr(e.target.value)} maxLength={200} className="feld" /></div>
            <div><label className="etikett" htmlFor="text_tr">{t.textTr}</label><textarea id="text_tr" lang="tr" value={textTr} onChange={(e) => setTextTr(e.target.value)} rows={8} maxLength={10000} className="feld" placeholder={t.platzhalterTr} /></div>
          </div>
        )}
      </div>

      <details className="rounded-2xl bg-paper p-3 text-sm">
        <summary className="cursor-pointer font-semibold">{t.alsVorlage}</summary>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1"><label className="etikett" htmlFor="vorlage_name">{t.vorlageName}</label><input id="vorlage_name" value={vorlageName} onChange={(e) => setVorlageName(e.target.value)} maxLength={100} className="feld" placeholder={t.vorlageBeispiel} /></div>
          <button type="button" onClick={speichern} disabled={laeuft} className="knopf-hell">{t.vorlageSpeichern}</button>
        </div>
        <p className="mt-2 text-xs text-ink-soft">{t.vorlageHinweis}</p>
      </details>
      {meldung && <p role="status" className={`rounded-2xl p-3 text-sm ${meldung.ok ? "bg-gruen-hell" : "bg-gelb-hell"}`}>{meldung.ok ? t.vorlageErfolg(meldung.erfolg, meldung.name) : t.fehler[meldung.fehler]}</p>}

      {filterOptionen && (
        <fieldset className="grid gap-3 sm:grid-cols-3">
          <legend className="etikett">{t.anWen}</legend>
          {filterFelder.map((f) => (
            <select key={f.k} aria-label={t.filter[f.k].name} value={filter[f.k] ?? ""} onChange={(e) => setFilter({ ...filter, [f.k]: e.target.value })} className="feld">
              <option value="">{t.filter[f.k].leer}</option>
              {filterOptionen[f.liste].map((o) => <option key={o.id} value={String(o.id)}>{f.k === "module_id" ? t.angemeldet(o.name) : o.name}</option>)}
            </select>
          ))}
        </fieldset>
      )}
      {auswahl && (
        <p className="rounded-2xl bg-paper p-3 text-sm">
          <span className="font-semibold">{t.auswahl(ids.length)}</span>
          {auswahl.beschreibung && <span className="block text-ink-soft">{t.filterText(auswahl.beschreibung)}</span>}
          <span className="block text-ink-soft">{t.auswahlOhneAdresse}</span>
        </p>
      )}

      <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
        <p className="font-semibold">{t.pruefenTitel}</p>
        <p className="text-sm text-ink-soft">{t.pruefenText(email)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={pruefen} disabled={laeuft} className="knopf-hell">{laeuft && !aktuell ? t.wirdGeprueft : t.pruefen}</button>
        </div>
        {pruefung && !aktuell && pruefung.ergebnis.ok && <p className="mt-3 text-sm text-amber-900">{t.geaendert}</p>}
        {aktuell && !aktuell.ok && <p role="alert" className="mt-3 rounded-2xl bg-gelb-hell p-3 text-sm font-semibold">{t.fehler[aktuell.fehler]}</p>}
        {aktuell?.ok && (
          <div className="mt-3 space-y-3" role="status">
            <p className="rounded-2xl bg-gruen-hell p-3">
              <span className="font-display block text-2xl font-extrabold">{t.empfaenger(aktuell.anzahl)}</span>
              <span className="text-sm">
                {sprache === "konto" ? t.verteilung(aktuell.anzahl - aktuell.tuerkisch, aktuell.tuerkisch) : sprache === "tr" ? t.alleTr : t.alleDe}
                {aktuell.ohneAdresse > 0 ? t.ohneAdresse(aktuell.ohneAdresse) : ""}
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={testen} disabled={laeuft || !mailBereit} className="knopf-hell">{t.testmail}</button>
              <button type="button" onClick={vorlegen} disabled={laeuft || aktuell.anzahl === 0} className="knopf">{t.vorlegen}</button>
            </div>
            {test && <p role="status" className={`rounded-2xl p-3 text-sm ${test.ok ? "bg-gruen-hell" : "bg-gelb-hell"}`}>{test.ok ? t.testGesendet(test.email, test.zwei) : t.fehler[test.fehler]}</p>}
            <p className="text-xs text-ink-soft">{t.danach}</p>
          </div>
        )}
        {!mailBereit && (
          <p role="alert" className="mt-3 flex items-start gap-2 rounded-2xl bg-rot-hell px-4 py-2.5 text-sm font-semibold text-rot">
            <MailWarning aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            {t.mailAus}
          </p>
        )}
      </div>
    </div>
  );
}
