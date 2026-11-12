import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { walletStreifenTitel } from "./wallet-anzeige";
import { streifenGrund } from "./wallet-bilder";

/**
 * Kopfbild der Info-Mail (Entscheidung Yusuf 12.11.2026): Stil der Wallet-Karte, aber Titel UND Untertitel auf
 * derselben Papierfläche, damit nichts „im leeren Raum“ hängt. Rechts die Sirene aus dem Wallet-Streifen, links
 * der Titel in Bricolage (Website-Überschriften) mit Textmarker und darunter der Untertitel in Inter (Website-Text).
 * Ein Bild sieht auch im Dunkelmodus von Gmail gleich aus; Titel und Untertitel stehen zusätzlich im alt-Text.
 */

const TINTE = "#13201a";
const TINTE_LEISE = "#3c4a42";
const SIGNAL = "#d7f36b";
const PAPIER = "#f3efe4";
// Beide Schriften unter SIL Open Font License, siehe assets/fonts/OFL.txt
const bricolage = readFile(join(process.cwd(), "assets/fonts/BricolageGrotesque-ExtraBold.ttf"));
const inter = readFile(join(process.cwd(), "assets/fonts/Inter-Medium.ttf"));
const fertig = new Map<string, Promise<Buffer>>();

// 420 × 130 pt in dreifacher Auflösung. Auf dem Handy (gut 350 px breit) bleibt der Untertitel so bei etwa 13 px;
// die Mail zeigt das Bild höchstens 548 px breit.
const S = 3;
const BREITE = 420 * S;
const HOEHE = 130 * S;
// Wallet-Streifen (375 × 98) auf volle Höhe skaliert und rechtsbündig; links davon nur Papierfarbe
const GRUND_BREITE = Math.round((375 / 98) * HOEHE);

async function zeichne(titel: string, untertitel: string | null): Promise<Buffer> {
  const t = walletStreifenTitel({ slug: "", titel });
  // Platz links der Sirene: gut 215 pt; lange Titel werden kleiner (Breite eines Zeichens ≈ 0,56 em).
  // Der Untertitel darf zweizeilig laufen.
  const laengste = Math.max(1, ...t.zeilen.map((z) => z.length));
  const groesse = Math.min(30, 215 / (0.56 * laengste)) * S;
  const klein = (untertitel && untertitel.length > 48 ? 14 : 15) * S;
  const bild = new ImageResponse(
    (
      <div style={{ display: "flex", position: "relative", width: BREITE, height: HOEHE, background: PAPIER }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse zeichnet nur <img> */}
        <img src={`data:image/png;base64,${streifenGrund[3]}`} width={GRUND_BREITE} height={HOEHE} alt="" style={{ position: "absolute", right: 0, top: 0 }} />
        <div style={{ position: "absolute", left: 22 * S, top: 0, height: HOEHE, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {t.zeilen.map((zeile, i) => (
            <div key={i} style={{ display: "flex", fontFamily: "Bricolage", fontWeight: 800, fontSize: groesse, lineHeight: 0.92, letterSpacing: -0.035 * groesse, color: TINTE }}>
              {zeile.split(" ").map((wort, j) => (
                <div
                  key={j}
                  style={{
                    display: "flex",
                    marginLeft: j === 0 ? 0 : (wort === t.marker ? 0.14 : 0.22) * groesse,
                    ...(wort === t.marker
                      ? { backgroundImage: `linear-gradient(to bottom, transparent 58%, ${SIGNAL} 58%, ${SIGNAL} 92%, transparent 92%)`, padding: `0 ${0.08 * groesse}px` }
                      : {}),
                  }}
                >
                  {wort}
                </div>
              ))}
            </div>
          ))}
          {untertitel && (
            <div style={{ display: "flex", marginTop: 0.4 * groesse, fontFamily: "Inter", fontWeight: 500, fontSize: klein, lineHeight: 1.3, color: TINTE_LEISE, maxWidth: 215 * S }}>
              {untertitel}
            </div>
          )}
        </div>
      </div>
    ),
    {
      width: BREITE,
      height: HOEHE,
      fonts: [
        { name: "Bricolage", data: await bricolage, weight: 800, style: "normal" },
        { name: "Inter", data: await inter, weight: 500, style: "normal" },
      ],
    },
  );
  return Buffer.from(await bild.arrayBuffer());
}

/** Kopfbild je Titel und Untertitel (je Sprache), einmal gezeichnet und dann aus dem Speicher. */
export function mailKopf(titel: string, untertitel: string | null): Promise<Buffer> {
  const schluessel = JSON.stringify([titel, untertitel]);
  let bild = fertig.get(schluessel);
  if (!bild) {
    bild = zeichne(titel, untertitel);
    bild.catch(() => fertig.delete(schluessel));
    fertig.set(schluessel, bild);
  }
  return bild;
}
