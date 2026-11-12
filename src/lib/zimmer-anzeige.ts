/**
 * Zimmer für Teilnehmende anzeigen. Die automatische Einteilung benennt Zimmer intern „1er 01“, „2er 14“ usw.; die echte
 * Zimmernummer vergibt das Hotel. Interne Namen zeigen wir deshalb nicht; stattdessen den Zimmercode (rooms.access_code),
 * den das Hotel am Anreisetag ausgibt, bzw. bis dahin den Hinweis, wann er kommt.
 */
export function istInterneZimmerbezeichnung(label: string): boolean {
  return /^\d+er \d+$/.test(label.trim());
}
