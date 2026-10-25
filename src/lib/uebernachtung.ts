// Nächte rund um ein Modul. Eine Nacht heißt nach ihrem Datum: Nacht vom 18. auf den 19.12. = "2026-12-18".

/** Mögliche Nächte: von der Nacht vor dem ersten Tag bis zur Nacht vor dem letzten Tag (wie save_my_stay). */
export function naechte(tage: string[]): string[] {
  if (tage.length === 0) return [];
  const sortiert = [...tage].sort();
  const plusTage = (tag: string, n: number) => new Date(Date.parse(`${tag}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
  const ergebnis: string[] = [];
  for (let n = plusTage(sortiert[0], -1); n <= plusTage(sortiert.at(-1)!, -1); n = plusTage(n, 1)) ergebnis.push(n);
  return ergebnis;
}

const kurz = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "numeric", timeZone: "UTC" });

/** "2026-12-18" → "18./19.12." */
export function nachtName(nacht: string): string {
  const abend = new Date(`${nacht}T12:00:00Z`);
  const morgen = new Date(abend.getTime() + 86_400_000);
  // gleicher Monat: "18./19.12.", sonst "31.12./1.1."
  const erster = abend.getUTCMonth() === morgen.getUTCMonth() ? `${abend.getUTCDate()}.` : kurz.format(abend);
  return `${erster}/${kurz.format(morgen)}`;
}
