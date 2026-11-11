import type { TicketModul } from "./teilnahme";

/** Wallet-Karten sind bewusst immer englisch (Veranstaltung ist international), unabhängig von der Sprache der Person. */
export const WALLET_SPRACHE = "en" as const;

/** Englische Namen nach der festen Kennung (slug) des Moduls: Der Titel heißt im Betrieb „Demokratie in Europa“, in der Entwicklung „Demokratie“. */
const EVENT_NAMEN: Record<string, string> = { demokratie: "DEMOCRACY IN EUROPE" };

/** Titel der Veranstaltung auf der Karte: bekannte Module mit englischem Namen, sonst der Titel in Großbuchstaben. */
export function walletEventName(m: { slug: string; titel: string }): string {
  return EVENT_NAMEN[m.slug] ?? m.titel.toUpperCase();
}

/** Titel im Bildstreifen der Karte (Website-Schrift): Zeilen und das Wort mit Textmarker. */
export type StreifenTitel = { zeilen: string[]; marker: string | null };

const STREIFEN: Record<string, StreifenTitel> = { demokratie: { zeilen: ["Democracy", "in Europe"], marker: "Europe" } };

/** Bekannte Module wie festgelegt, sonst der Titel auf höchstens zwei möglichst gleich lange Zeilen verteilt, Marker auf dem letzten Wort. */
export function walletStreifenTitel(m: { slug: string; titel: string }): StreifenTitel {
  if (STREIFEN[m.slug]) return STREIFEN[m.slug];
  const woerter = m.titel.trim().split(/\s+/);
  if (woerter.length === 1) return { zeilen: woerter, marker: woerter[0] };
  let besser = 1;
  for (let i = 1; i < woerter.length; i++) {
    const laenge = (k: number) => Math.max(woerter.slice(0, k).join(" ").length, woerter.slice(k).join(" ").length);
    if (laenge(i) < laenge(besser)) besser = i;
  }
  return { zeilen: [woerter.slice(0, besser).join(" "), woerter.slice(besser).join(" ")], marker: woerter.at(-1)! };
}

/** Name der Veranstaltung als Text (Rückseite, semantische Angaben), z. B. „Democracy in Europe“. */
export function walletEventTitel(m: { slug: string; titel: string }): string {
  return STREIFEN[m.slug]?.zeilen.join(" ") ?? m.titel;
}

/** Kurzes Datum für die Kopfzeile ohne Jahr, z. B. „14–15 Nov“. */
export function walletDatumKurz(m: TicketModul): string {
  if (m.tage.length === 0) return "–";
  const teil = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", ...o }).format(new Date(d));
  const von = m.tage[0].beginn, bis = m.tage[m.tage.length - 1].beginn;
  const tag = (d: string) => teil(d, { day: "numeric" }), monat = (d: string) => teil(d, { month: "short" });
  if (monat(von) !== monat(bis)) return `${tag(von)} ${monat(von)} – ${tag(bis)} ${monat(bis)}`;
  return tag(von) === tag(bis) ? `${tag(von)} ${monat(von)}` : `${tag(von)}–${tag(bis)} ${monat(von)}`;
}

/** Kurzes Datum wie „14-15 Nov 2026“ bzw. „14 Nov 2026“. */
export function walletDatum(m: TicketModul): string {
  if (m.tage.length === 0) return "–";
  const teil = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", ...o }).format(new Date(d));
  const von = m.tage[0].beginn, bis = m.tage[m.tage.length - 1].beginn;
  const tag = (d: string) => teil(d, { day: "numeric" });
  const monatJahr = (d: string) => teil(d, { month: "short", year: "numeric" });
  const tagMonat = (d: string) => teil(d, { day: "numeric", month: "short" });
  if (tag(von) === tag(bis) && monatJahr(von) === monatJahr(bis)) return `${tag(von)} ${monatJahr(von)}`;
  if (monatJahr(von) === monatJahr(bis)) return `${tag(von)}-${tag(bis)} ${monatJahr(von)}`;
  return `${tagMonat(von)} - ${tagMonat(bis)} ${teil(bis, { year: "numeric" })}`;
}
