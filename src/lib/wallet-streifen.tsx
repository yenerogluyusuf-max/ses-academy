import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { StreifenTitel } from "./wallet-anzeige";
import { streifenGrund } from "./wallet-bilder";

/**
 * Bildstreifen der Apple-Wallet-Karte (375×98 pt): beiger Grund mit der Sirene rechts, links der Titel des nächsten
 * Moduls in der Schrift der Website (Bricolage Grotesque ExtraBold), ein Wort mit Textmarker wie auf der Website.
 *
 * Bewusste Abweichung von Apples Rat „kein Text in Bildern“ (Entscheidung 11.11.2026): Der Titel steht deshalb
 * zusätzlich als Text auf der Rückseite und in den semantischen Angaben der Karte (eventName), lesbar für VoiceOver.
 */

const TINTE = "#13201a";
const SIGNAL = "#d7f36b";
// SIL Open Font License, siehe assets/fonts/OFL.txt
const schrift = readFile(join(process.cwd(), "assets/fonts/BricolageGrotesque-ExtraBold.ttf"));
const fertig = new Map<string, Promise<Record<string, Buffer>>>();

async function zeichne(titel: StreifenTitel | null, s: 1 | 2 | 3): Promise<Buffer> {
  const breite = 375 * s;
  const hoehe = 98 * s;
  // Links der Sirene sind gut 210 pt frei; lange Titel werden kleiner (Breite einer Ziffer/Buchstabe ≈ 0,56 em)
  const laengste = Math.max(1, ...(titel?.zeilen ?? []).map((z) => z.length));
  const groesse = Math.min(33, 210 / (0.56 * laengste)) * s;
  const bild = new ImageResponse(
    (
      <div style={{ display: "flex", position: "relative", width: breite, height: hoehe }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse zeichnet nur <img> */}
        <img src={`data:image/png;base64,${streifenGrund[s]}`} width={breite} height={hoehe} alt="" style={{ position: "absolute", left: 0, top: 0 }} />
        {titel && (
          <div style={{ position: "absolute", left: 16 * s, top: 0, height: hoehe, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            {titel.zeilen.map((zeile, i) => (
              <div key={i} style={{ display: "flex", fontFamily: "Bricolage", fontWeight: 800, fontSize: groesse, lineHeight: 0.92, letterSpacing: -0.035 * groesse, color: TINTE }}>
                {zeile.split(" ").map((wort, j) => (
                  <div
                    key={j}
                    style={{
                      display: "flex",
                      // Wortabstand; beim Marker-Wort zählt dessen Innenabstand mit, damit der Abstand gleich wirkt
                      marginLeft: j === 0 ? 0 : (wort === titel.marker ? 0.14 : 0.22) * groesse,
                      ...(wort === titel.marker
                        ? { backgroundImage: `linear-gradient(to bottom, transparent 58%, ${SIGNAL} 58%, ${SIGNAL} 92%, transparent 92%)`, padding: `0 ${0.08 * groesse}px` }
                        : {}),
                    }}
                  >
                    {wort}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    ),
    { width: breite, height: hoehe, fonts: [{ name: "Bricolage", data: await schrift, weight: 800, style: "normal" }] },
  );
  return Buffer.from(await bild.arrayBuffer());
}

/** strip.png in drei Auflösungen; je Titel nur einmal gezeichnet. Ohne Titel (kein nächstes Modul) nur der Grund. */
export function walletStreifen(titel: StreifenTitel | null): Promise<Record<string, Buffer>> {
  const schluessel = JSON.stringify(titel);
  let bilder = fertig.get(schluessel);
  if (!bilder) {
    bilder = Promise.all(([1, 2, 3] as const).map((s) => zeichne(titel, s))).then(([a, b, c]) => ({ "strip.png": a, "strip@2x.png": b, "strip@3x.png": c }));
    bilder.catch(() => fertig.delete(schluessel));
    fertig.set(schluessel, bilder);
  }
  return bilder;
}
