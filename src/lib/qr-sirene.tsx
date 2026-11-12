import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";

/**
 * Ticket-QR mit der Sirene (Megafon) in der Mitte, für Ticket-Seite, „Mein Bereich“ und Info-/Ticket-Mail.
 *
 * Gestaltung nach Yusufs Vorlage (12.11.2026): runde Punkte statt Quadrate, abgerundete Eckmarken,
 * Waldgrün der Website, die Sirene größer und frei in einem runden Feld (statt im weißen Kasten).
 *
 * Lesbarkeit: höchste Fehlerkorrektur (H, bis 30 %); das runde Feld deckt etwa 6 % der Fläche ab und lässt Eck-,
 * Ausrichtungs- und Taktmuster frei (bei Version 6 liegt kein Ausrichtungsmuster in der Mitte). Geprüft mit jsQR, dem
 * Leser des Einlass-Scanners. Der Inhalt bleibt derselbe (ses:checkin:…). In Apple/Google Wallet zeichnet das Handy
 * den Code selbst, dort gibt es weder Punkte noch Sirene.
 */

const GRUEN = "#173226";                   // --forest der Website
const RAND = 2;                            // Ruhezone in Modulen
const PUNKT = 0.44;
// Eckmarken: außen kräftig gerundet, der Kern aber ein abgerundetes QUADRAT. Ein runder Kern (wie in der Vorlage)
// ließ jsQR bei vielen Bildgrößen scheitern (188/273 statt 273/273 im Größentest 12.11.2026).
const ECKE_AUSSEN = 2.1;
const ECKE_KERN = 0.8;                        // Radius eines Punkts in Modulen (1 = Modulbreite)
const FELD = 0.29;                         // Durchmesser des freien Felds im Verhältnis zur Code-Breite (ohne Rand)
const SIRENE_B = 240, SIRENE_H = 182;      // assets/qr-sirene.png
const sirene = `data:image/png;base64,${readFileSync(join(process.cwd(), "assets/qr-sirene.png")).toString("base64")}`;

type Code = { n: number; dunkel: (x: number, y: number) => boolean; ausrichtung: [number, number][] };

function erzeuge(inhalt: string): Code {
  const qr = QRCode.create(inhalt, { errorCorrectionLevel: "H" });
  const n = qr.modules.size;
  const daten = qr.modules.data;
  // Mittelpunkte der Ausrichtungsmuster (ohne die drei, die in den Eckmarken liegen würden)
  const pos = qr.version > 1 ? ausrichtungsPositionen(qr.version, n) : [];
  const ausrichtung: [number, number][] = [];
  for (const y of pos) for (const x of pos) {
    const imEck = (x < 9 && y < 9) || (x > n - 10 && y < 9) || (x < 9 && y > n - 10);
    if (!imEck) ausrichtung.push([x, y]);
  }
  return { n, dunkel: (x, y) => Boolean(daten[y * n + x]), ausrichtung };
}

/** Wie in der QR-Norm (ISO/IEC 18004, Anhang E): Zeilen/Spalten der Ausrichtungsmuster je Version. */
function ausrichtungsPositionen(version: number, n: number): number[] {
  const anzahl = Math.floor(version / 7) + 2;
  const abstand = n === 145 ? 26 : Math.ceil((n - 13) / (2 * anzahl - 2)) * 2;
  const pos = [n - 7];
  for (let i = 1; i < anzahl - 1; i++) pos[i] = pos[i - 1] - abstand;
  pos.push(6);
  return pos.reverse();
}

/** Der Code als SVG-Zeichnung in Modul-Einheiten (viewBox), ohne Sirene. */
function zeichnung(code: Code): { svgInhalt: string; groesse: number; feldMitte: number; feldRadius: number } {
  const { n, dunkel, ausrichtung } = code;
  const groesse = n + 2 * RAND;
  const mitte = groesse / 2;
  const radius = (FELD * n) / 2;
  const imEckmuster = (x: number, y: number) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  const imAusrichtung = (x: number, y: number) => ausrichtung.some(([ax, ay]) => Math.abs(x - ax) <= 2 && Math.abs(y - ay) <= 2);
  const imFeld = (x: number, y: number) => Math.hypot(x + 0.5 + RAND - mitte, y + 0.5 + RAND - mitte) < radius + 0.35;
  const teile: string[] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!dunkel(x, y) || imEckmuster(x, y) || imAusrichtung(x, y) || imFeld(x, y)) continue;
    teile.push(`<circle cx="${x + RAND + 0.5}" cy="${y + RAND + 0.5}" r="${PUNKT}"/>`);
  }
  // Eckmarken: abgerundeter Ring (7×7) mit abgerundetem quadratischem Kern (3×3)
  for (const [ex, ey] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
    const x = ex + RAND, y = ey + RAND;
    teile.push(`<path fill-rule="evenodd" d="${ring(x, y, 7, ECKE_AUSSEN)} ${ring(x + 1, y + 1, 5, ECKE_AUSSEN * 0.6)}"/>`);
    teile.push(`<path d="${ring(x + 2, y + 2, 3, ECKE_KERN)}"/>`);
  }
  // Ausrichtungsmuster: kleiner Ring (5×5) mit Punkt
  for (const [ax, ay] of ausrichtung) {
    const x = ax - 2 + RAND, y = ay - 2 + RAND;
    teile.push(`<path fill-rule="evenodd" d="${ring(x, y, 5, 1.4)} ${ring(x + 1, y + 1, 3, 0.8)}"/>`);
    teile.push(`<circle cx="${ax + RAND + 0.5}" cy="${ay + RAND + 0.5}" r="0.55"/>`);
  }
  return { svgInhalt: `<g fill="${GRUEN}">${teile.join("")}</g>`, groesse, feldMitte: mitte, feldRadius: radius };
}

/** Abgerundetes Quadrat als Pfad (für Ringe mit fill-rule evenodd). */
function ring(x: number, y: number, s: number, r: number): string {
  return `M${x + r} ${y}H${x + s - r}A${r} ${r} 0 0 1 ${x + s} ${y + r}V${y + s - r}A${r} ${r} 0 0 1 ${x + s - r} ${y + s}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + s - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
}

/** Größe der Sirene im freien Feld (in Modul-Einheiten). */
function sireneMasse(radius: number) {
  const b = radius * 1.62, h = (b * SIRENE_H) / SIRENE_B;
  return { b, h };
}

/** SVG (für Webseiten): gestalteter Code mit der Sirene im runden Feld. */
export async function sireneSvg(inhalt: string, breite: number): Promise<string> {
  const z = zeichnung(erzeuge(inhalt));
  const { b, h } = sireneMasse(z.feldRadius);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${z.groesse} ${z.groesse}" width="${breite}" height="${breite}" shape-rendering="geometricPrecision">`
    + `<rect width="${z.groesse}" height="${z.groesse}" fill="#ffffff"/>${z.svgInhalt}`
    + `<image href="${sirene}" x="${z.feldMitte - b / 2}" y="${z.feldMitte - h / 2}" width="${b}" height="${h}"/></svg>`;
}

/** PNG (für Mails, viele Mailprogramme zeigen kein SVG): derselbe Code, gezeichnet mit next/og. */
export async function sirenePng(inhalt: string, breite: number): Promise<Buffer> {
  const z = zeichnung(erzeuge(inhalt));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${z.groesse} ${z.groesse}" width="${breite}" height="${breite}"><rect width="${z.groesse}" height="${z.groesse}" fill="#ffffff"/>${z.svgInhalt}</svg>`;
  const faktor = breite / z.groesse;
  const { b, h } = sireneMasse(z.feldRadius);
  const bild = new ImageResponse(
    (
      <div style={{ display: "flex", position: "relative", width: breite, height: breite, background: "#ffffff" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse zeichnet nur <img> */}
        <img src={`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`} width={breite} height={breite} alt="" style={{ position: "absolute", left: 0, top: 0 }} />
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse zeichnet nur <img> */}
        <img src={sirene} width={b * faktor} height={h * faktor} alt="" style={{ position: "absolute", left: (z.feldMitte - b / 2) * faktor, top: (z.feldMitte - h / 2) * faktor }} />
      </div>
    ),
    { width: breite, height: breite },
  );
  return Buffer.from(await bild.arrayBuffer());
}
