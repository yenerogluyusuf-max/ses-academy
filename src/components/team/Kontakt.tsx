import { MessageCircle, Phone } from "lucide-react";
import { kontaktEintragen, kontaktLoeschen, notizEintragen, zusageSetzen } from "@/lib/aktionen/kontakte";
import { teamLocale, type TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";
import { telLink, whatsappLink } from "@/lib/telefon";
import { jetztMs } from "@/lib/zeit";

type HinweisTexte = Record<string, { text: string; gut: boolean }>;

/** Rückmeldungen der Kontakt-Aktionen für <Hinweis /> je Sprache des Team-Bereichs (Codes aus lib/aktionen/kontakte.ts). */
export const kontaktHinweisTexte: Record<TeamSprache, HinweisTexte> = {
  de: {
    kontakt: { text: "Kontakt vermerkt.", gut: true },
    "kontakt-geloescht": { text: "Eintrag entfernt.", gut: true },
    notiz: { text: "Notiz gespeichert.", gut: true },
    zusage: { text: "Zusage gespeichert.", gut: true },
    "kontakt-eingabe": { text: "Bitte die Angaben prüfen.", gut: false },
    "kontakt-fehler": { text: "Das hat nicht geklappt. Eigene Einträge lassen sich nur 24 Stunden lang entfernen.", gut: false },
  },
  tr: {
    kontakt: { text: "İletişim kaydedildi.", gut: true },
    "kontakt-geloescht": { text: "Kayıt kaldırıldı.", gut: true },
    notiz: { text: "Not kaydedildi.", gut: true },
    zusage: { text: "Katılım cevabı kaydedildi.", gut: true },
    "kontakt-eingabe": { text: teamTexte.tr.meldung.eingabe, gut: false },
    "kontakt-fehler": { text: "Bu işlem olmadı. Kendi kayıtlarını yalnızca 24 saat içinde kaldırabilirsin.", gut: false },
  },
  fr: {
    kontakt: { text: "Contact noté.", gut: true },
    "kontakt-geloescht": { text: "Entrée supprimée.", gut: true },
    notiz: { text: "Note enregistrée.", gut: true },
    zusage: { text: "Réponse enregistrée.", gut: true },
    "kontakt-eingabe": { text: teamTexte.fr.meldung.eingabe, gut: false },
    "kontakt-fehler": { text: "Cela n’a pas fonctionné. Tu ne peux supprimer tes propres entrées que pendant 24 heures.", gut: false },
  },
};

/** Deutsche Rückmeldungen (bisherige Schnittstelle). */
export const kontaktHinweise: HinweisTexte = kontaktHinweisTexte.de;

const de = {
  ergebnisse: { erreicht: "erreicht", nicht_erreicht: "nicht erreicht", rueckruf: "Rückruf" },
  kanaele: { anruf: "Anruf", whatsapp: "WhatsApp", mail: "Mail", persoenlich: "persönlich", notiz: "Notiz" } as Record<string, string>,
  heute: "heute", gestern: "gestern", notiz: "Notiz", team: "Team", keineNummer: "keine Nummer", anrufen: "Anrufen",
  anrufenAria: (name: string) => `${name} anrufen`, whatsappAria: (name: string) => `${name} auf WhatsApp schreiben`,
  kanal: "Kanal", notizOptional: "Notiz (optional)", erreicht: "Erreicht", nichtErreicht: "Nicht erreicht", rueckruf: "Rückruf",
  keinKontakt: "Noch kein Kontakt vermerkt.", entfernen: "entfernen",
  notizPlatzhalter: "Notiz, z. B. Absprache, Besonderheit, Rückmeldung", notizSpeichern: "Notiz speichern",
  zusage: { zugesagt: "zugesagt", abgesagt: "abgesagt", "": "noch offen" },
  zitat: (s: string) => `„${s}“`,
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    ergebnisse: { erreicht: "ulaşıldı", nicht_erreicht: "ulaşılamadı", rueckruf: "geri aranacak" },
    kanaele: { anruf: "Arama", whatsapp: "WhatsApp", mail: "E-posta", persoenlich: "yüz yüze", notiz: "Not" } as Record<string, string>,
    heute: "bugün", gestern: "dün", notiz: "Not", team: teamTexte.tr.team, keineNummer: "numara yok", anrufen: "Ara",
    anrufenAria: (name: string) => `Ara: ${name}`, whatsappAria: (name: string) => `WhatsApp’tan yaz: ${name}`,
    kanal: "Kanal", notizOptional: "Not (isteğe bağlı)", erreicht: "Ulaşıldı", nichtErreicht: "Ulaşılamadı", rueckruf: "Geri aranacak",
    keinKontakt: "Henüz iletişim kaydı yok.", entfernen: "kaldır",
    notizPlatzhalter: "Not, ör. anlaşma, özel durum, geri bildirim", notizSpeichern: "Notu kaydet",
    zusage: { zugesagt: teamTexte.tr.rsvp.zugesagt, abgesagt: teamTexte.tr.rsvp.abgesagt, "": "henüz cevap yok" },
    zitat: (s: string) => `“${s}”`,
  },
  fr: {
    ergebnisse: { erreicht: "joint·e", nicht_erreicht: "injoignable", rueckruf: "à rappeler" },
    kanaele: { anruf: "Appel", whatsapp: "WhatsApp", mail: "E-mail", persoenlich: "en personne", notiz: "Note" } as Record<string, string>,
    heute: "aujourd’hui", gestern: "hier", notiz: "Note", team: teamTexte.fr.team, keineNummer: "pas de numéro", anrufen: "Appeler",
    anrufenAria: (name: string) => `Appeler ${name}`, whatsappAria: (name: string) => `Écrire à ${name} sur WhatsApp`,
    kanal: "Canal", notizOptional: "Note (facultatif)", erreicht: "Joint·e", nichtErreicht: "Injoignable", rueckruf: "À rappeler",
    keinKontakt: "Aucun contact noté pour l’instant.", entfernen: "supprimer",
    notizPlatzhalter: "Note, p. ex. accord, particularité, retour", notizSpeichern: "Enregistrer la note",
    zusage: { zugesagt: teamTexte.fr.rsvp.zugesagt, abgesagt: teamTexte.fr.rsvp.abgesagt, "": "en attente" },
    zitat: (s: string) => `« ${s} »`,
  },
};

/** Kurzes Zitat einer Notiz mit den Anführungszeichen der Sprache. */
export const notizZitat = (note: string, sprache: TeamSprache = "de") => T[sprache].zitat(note);

const ergebnisKlassen = { erreicht: "bg-gruen-hell", nicht_erreicht: "bg-rot-hell text-rot", rueckruf: "bg-gelb-hell" } as const;
const kontaktwege = ["anruf", "whatsapp", "mail", "persoenlich"] as const;

const zeitFormate = Object.fromEntries((Object.keys(teamLocale) as TeamSprache[]).map((l) => [l, {
  uhr: new Intl.DateTimeFormat(teamLocale[l], { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }),
  tagUndUhr: new Intl.DateTimeFormat(teamLocale[l], { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }),
}])) as Record<TeamSprache, { uhr: Intl.DateTimeFormat; tagUndUhr: Intl.DateTimeFormat }>;
const tagIso = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" });

/** „heute 14:05“, „gestern 09:30“, sonst „Mo., 2.11., 14:05“ (in der Sprache des Team-Bereichs) */
export function wann(zeitpunkt: string, sprache: TeamSprache = "de") {
  const t = T[sprache];
  const { uhr, tagUndUhr } = zeitFormate[sprache];
  const d = new Date(zeitpunkt);
  const heute = tagIso.format(jetztMs());
  const gestern = tagIso.format(jetztMs() - 86_400_000);
  const tag = tagIso.format(d);
  return tag === heute ? `${t.heute} ${uhr.format(d)}` : tag === gestern ? `${t.gestern} ${uhr.format(d)}` : tagUndUhr.format(d);
}

export { telLink, whatsappLink } from "@/lib/telefon";

export type Kontakt = {
  id: string; participant_id: string; module_title?: string | null; channel: string; outcome: string | null; note: string;
  created_at: string; by_name: string | null; mine: boolean;
};

/** Ergebnis als farbiger Chip. */
export function Ergebnis({ outcome, sprache = "de" }: { outcome: string | null; sprache?: TeamSprache }) {
  const t = T[sprache];
  if (!outcome) return <span className="chip bg-paper-deep">{t.notiz}</span>;
  if (!Object.hasOwn(ergebnisKlassen, outcome)) return null;
  const e = outcome as keyof typeof ergebnisKlassen;
  return <span className={`chip ${ergebnisKlassen[e]}`}>{t.ergebnisse[e]}</span>;
}

/** Eine Zeile „heute 14:05 · Murat · Anruf · nicht erreicht · Notiz“. */
export function LetzterKontakt({ at, outcome, channel, by, note, sprache = "de" }:
  { at: string; outcome: string | null; channel: string; by: string | null; note: string; sprache?: TeamSprache }) {
  const t = T[sprache];
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-soft">
      <Ergebnis outcome={outcome} sprache={sprache} />
      <span>{wann(at, sprache)} · {by ?? t.team}{channel !== "anruf" && channel !== "notiz" ? ` · ${t.kanaele[channel] ?? channel}` : ""}</span>
      {note && <span className="text-ink">{t.zitat(note)}</span>}
    </p>
  );
}

/** Anrufen und WhatsApp öffnen; das Ergebnis trägt man danach mit <KontaktFormular /> ein. */
export function KontaktKnoepfe({ name, phone, sprache = "de" }: { name: string; phone: string | null; sprache?: TeamSprache }) {
  const t = T[sprache];
  if (!phone) return <span className="text-sm text-ink-soft">{t.keineNummer}</span>;
  const wa = whatsappLink(phone);
  return (
    <span className="flex flex-wrap gap-2">
      <a href={telLink(phone)} className="knopf !px-4 !py-2" aria-label={t.anrufenAria(name)}><Phone aria-hidden className="h-4 w-4" />{t.anrufen}</a>
      {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="knopf-hell !px-4 !py-2" aria-label={t.whatsappAria(name)}><MessageCircle aria-hidden className="h-4 w-4" />WhatsApp</a>}
    </span>
  );
}

/**
 * Ergebnis eintragen: Kanal, kurze Notiz, dann einer der Knöpfe. kompakt = nur „erreicht“ / „nicht erreicht“
 * per Anruf (Eventtag, wenn es schnell gehen muss).
 */
export function KontaktFormular({ participantId, moduleId, zurueck, kompakt = false, sprache = "de" }:
  { participantId: string; moduleId: string | null; zurueck: string; kompakt?: boolean; sprache?: TeamSprache }) {
  const t = T[sprache];
  return (
    <form action={kontaktEintragen} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="participant_id" value={participantId} />
      <input type="hidden" name="module_id" value={moduleId ?? ""} />
      <input type="hidden" name="zurueck" value={zurueck} />
      {kompakt ? <input type="hidden" name="channel" value="anruf" /> : (
        <>
          <label className="sr-only" htmlFor={`kanal-${participantId}`}>{t.kanal}</label>
          <select id={`kanal-${participantId}`} name="channel" defaultValue="anruf" className="feld !w-auto !py-2 text-sm">
            {kontaktwege.map((wert) => <option key={wert} value={wert}>{t.kanaele[wert]}</option>)}
          </select>
          <label className="sr-only" htmlFor={`notiz-${participantId}`}>{t.notiz}</label>
          <input id={`notiz-${participantId}`} name="note" maxLength={300} placeholder={t.notizOptional} className="feld !py-2 min-w-40 flex-1 text-sm" />
        </>
      )}
      <button name="outcome" value="erreicht" className="knopf !px-4 !py-2">{t.erreicht}</button>
      <button name="outcome" value="nicht_erreicht" className="knopf-hell !px-4 !py-2">{t.nichtErreicht}</button>
      {!kompakt && <button name="outcome" value="rueckruf" className="knopf-hell !px-4 !py-2">{t.rueckruf}</button>}
    </form>
  );
}

/** Alle Einträge zu einer Person, neueste zuerst; eigene lassen sich 24 Stunden lang entfernen. */
export function KontaktVerlauf({ eintraege, zurueck, mitModul = false, sprache = "de" }:
  { eintraege: Kontakt[]; zurueck: string; mitModul?: boolean; sprache?: TeamSprache }) {
  const t = T[sprache];
  if (eintraege.length === 0) return <p className="text-sm text-ink-soft">{t.keinKontakt}</p>;
  const grenze = jetztMs() - 24 * 3600_000;
  return (
    <ul className="divide-y divide-line text-sm">
      {eintraege.map((k) => (
        <li key={k.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2">
          <Ergebnis outcome={k.outcome} sprache={sprache} />
          <span className="text-ink-soft">
            {wann(k.created_at, sprache)} · {k.by_name ?? t.team}{k.channel !== "notiz" ? ` · ${t.kanaele[k.channel] ?? k.channel}` : ""}
            {mitModul && k.module_title ? ` · ${k.module_title}` : ""}
          </span>
          {k.note && <span>{t.zitat(k.note)}</span>}
          {k.mine && Date.parse(k.created_at) > grenze && (
            <form action={kontaktLoeschen} className="ml-auto">
              <input type="hidden" name="id" value={k.id} />
              <input type="hidden" name="participant_id" value={k.participant_id} />
              <input type="hidden" name="zurueck" value={zurueck} />
              <button className="text-xs font-semibold text-ink-soft underline hover:text-rot">{t.entfernen}</button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Notiz zur Person festhalten; landet im selben Verlauf wie die Anrufe. */
export function NotizFormular({ participantId, moduleId, zurueck, sprache = "de" }:
  { participantId: string; moduleId?: string | null; zurueck: string; sprache?: TeamSprache }) {
  const t = T[sprache];
  return (
    <form action={notizEintragen} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="participant_id" value={participantId} />
      <input type="hidden" name="module_id" value={moduleId ?? ""} />
      <input type="hidden" name="zurueck" value={zurueck} />
      <label className="sr-only" htmlFor={`neue-notiz-${participantId}`}>{t.notiz}</label>
      <textarea id={`neue-notiz-${participantId}`} name="note" required maxLength={2000} rows={2} placeholder={t.notizPlatzhalter} className="feld min-w-48 flex-1 !py-2 text-sm" />
      <button className="knopf !px-4 !py-2">{t.notizSpeichern}</button>
    </form>
  );
}

const zusageKlassen = {
  zugesagt: "bg-yellow-300 text-ink ring-yellow-500",
  abgesagt: "bg-zinc-300 text-ink ring-zinc-400",
  "": "bg-rot-hell text-rot ring-rot/40",
} as const;

/** Zusage für ein Modul umschalten: zugesagt, abgesagt oder wieder offen. */
export function ZusageKnoepfe({ participantId, moduleId, rsvp, zurueck, sprache = "de" }:
  { participantId: string; moduleId: string; rsvp: string | null; zurueck: string; sprache?: TeamSprache }) {
  const t = T[sprache];
  const jetzt = (rsvp ?? "") as keyof typeof zusageKlassen;
  return (
    <form action={zusageSetzen} className="inline-flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="participant_id" value={participantId} />
      <input type="hidden" name="module_id" value={moduleId} />
      <input type="hidden" name="zurueck" value={zurueck} />
      {(Object.keys(zusageKlassen) as (keyof typeof zusageKlassen)[]).map((w) => (
        <button key={w} name="rsvp" value={w} aria-pressed={w === jetzt}
          className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${w === jetzt ? zusageKlassen[w] : "bg-weiss text-ink-soft ring-line hover:ring-ink"}`}>
          {t.zusage[w]}
        </button>
      ))}
    </form>
  );
}
