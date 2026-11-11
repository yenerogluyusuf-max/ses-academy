/**
 * Zimmer für Teilnehmende anzeigen. Die automatische Einteilung benennt Zimmer intern „1er 01“, „2er 14“ usw.; die echte
 * Zimmernummer vergibt das Hotel. Interne Namen zeigen wir deshalb nicht, sondern „Die Zimmernummer bekommst du im Hotel“.
 */
export function istInterneZimmerbezeichnung(label: string): boolean {
  return /^\d+er \d+$/.test(label.trim());
}
