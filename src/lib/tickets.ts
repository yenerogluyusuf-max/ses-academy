import "server-only";

import QRCode from "qrcode";
import { qrInhalt } from "./codes";
import { sirenePng, sireneSvg } from "./qr-sirene";

export * from "./codes";

const farben = { dark: "#13201a", light: "#ffffff" };

/** Schlichter QR (z. B. Namensschilder mit dem Kurzcode). */
export function qrSvg(token: string): Promise<string> {
  return QRCode.toString(qrInhalt(token), { type: "svg", margin: 1, width: 240, color: farben });
}

/** Ticket-QR mit der Sirene in der Mitte (Ticket-Seite, Mein Bereich), siehe qr-sirene.tsx. */
export function ticketQrSvg(token: string): Promise<string> {
  return sireneSvg(qrInhalt(token), 240);
}

/** Ticket-QR mit Sirene als PNG für E-Mails (SVG zeigen viele Mailprogramme nicht an). */
export function qrPng(token: string): Promise<Buffer> {
  return sirenePng(qrInhalt(token), 480);
}

/** QR-Code für eine beliebige Adresse (z. B. Fragen aus dem Saal), groß für Beamer und Ausdruck. */
export function qrSvgText(text: string, breite = 320): Promise<string> {
  return QRCode.toString(text, { type: "svg", margin: 1, width: breite, color: farben });
}
