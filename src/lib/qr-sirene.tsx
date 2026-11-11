import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";

/**
 * Ticket-QR mit der Sirene (Megafon) in der Mitte, für Ticket-Seite, „Mein Bereich“ und Ticket-Mail (Wunsch 11.11.2026).
 *
 * Der Code wird mit der höchsten Fehlerkorrektur (H, bis 30 %) erzeugt; das Feld mit der Sirene deckt gut 7 % der Fläche
 * ab. Der Inhalt bleibt derselbe (ses:checkin:…), ältere Screenshots und Mails gelten weiter. Geprüft mit jsQR, dem Leser
 * des Einlass-Scanners. In Apple/Google Wallet zeichnet das Handy den Code selbst, dort gibt es keine Sirene.
 */

const FARBEN = { dark: "#13201a", light: "#ffffff" };
const ANTEIL = 0.26;                       // Kantenlänge des weißen Felds im Verhältnis zum ganzen Code
const SIRENE_B = 240, SIRENE_H = 182;      // assets/qr-sirene.png
const sirene = `data:image/png;base64,${readFileSync(join(process.cwd(), "assets/qr-sirene.png")).toString("base64")}`;

/** SVG (für Webseiten): Code mit Stufe H, darüber ein weißes Feld mit der Sirene. */
export async function sireneSvg(inhalt: string, breite: number): Promise<string> {
  const svg = await QRCode.toString(inhalt, { type: "svg", margin: 1, width: breite, color: FARBEN, errorCorrectionLevel: "H" });
  const n = Number(svg.match(/viewBox="0 0 (\d+) \d+"/)?.[1]);
  if (!n) return svg;
  const feld = n * ANTEIL, x = (n - feld) / 2;
  const b = feld * 0.86, h = (b * SIRENE_H) / SIRENE_B;
  return svg.replace(
    "</svg>",
    `<rect x="${x}" y="${x}" width="${feld}" height="${feld}" rx="${feld * 0.18}" fill="#ffffff"/>` +
      `<image href="${sirene}" x="${(n - b) / 2}" y="${(n - h) / 2}" width="${b}" height="${h}"/></svg>`,
  );
}

/** PNG (für Mails, viele Mailprogramme zeigen kein SVG): derselbe Aufbau, gezeichnet mit next/og. */
export async function sirenePng(inhalt: string, breite: number): Promise<Buffer> {
  const code = await QRCode.toDataURL(inhalt, { margin: 2, width: breite, color: FARBEN, errorCorrectionLevel: "H" });
  const feld = Math.round(breite * ANTEIL * 0.94);   // Rand von 2 Modulen: das Feld bleibt gleich groß wie im SVG
  const b = Math.round(feld * 0.86), h = Math.round((b * SIRENE_H) / SIRENE_B);
  const bild = new ImageResponse(
    (
      <div style={{ display: "flex", position: "relative", width: breite, height: breite, background: "#ffffff" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse zeichnet nur <img> */}
        <img src={code} width={breite} height={breite} alt="" style={{ position: "absolute", left: 0, top: 0 }} />
        <div style={{ position: "absolute", left: (breite - feld) / 2, top: (breite - feld) / 2, width: feld, height: feld, borderRadius: feld * 0.18, background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse zeichnet nur <img> */}
          <img src={sirene} width={b} height={h} alt="" />
        </div>
      </div>
    ),
    { width: breite, height: breite },
  );
  return Buffer.from(await bild.arrayBuffer());
}
