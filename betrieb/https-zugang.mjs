// HTTPS-Zugang im lokalen Netz: nimmt https://<rechner>.local:8443 entgegen und reicht an Next.js (127.0.0.1:3200) weiter.
// Die Handykamera für den QR-Scanner gibt es nur über HTTPS. Das Zertifikat ist selbst ausgestellt
// (betrieb-daten/tls), jedes Handy bestätigt es beim ersten Öffnen einmal.
// Aufruf über ./ses.sh (liest betrieb-daten/.env); keine Abhängigkeiten außer Node.
import { readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { homedir } from "node:os";
import { join } from "node:path";

const daten = process.env.SES_DATEN ?? join(homedir(), "SES_ACADEMY", "betrieb-daten");
const ziel = { host: "127.0.0.1", port: Number(process.env.WEB_PORT ?? 3200) };
const port = Number(process.env.HTTPS_PORT ?? 8443);

const server = https.createServer(
  { key: readFileSync(join(daten, "tls", "schluessel.pem")), cert: readFileSync(join(daten, "tls", "zertifikat.pem")) },
  (anfrage, antwort) => {
    const weiter = http.request(
      {
        ...ziel,
        method: anfrage.method,
        path: anfrage.url,
        headers: {
          ...anfrage.headers,
          "x-forwarded-proto": "https",
          "x-forwarded-host": anfrage.headers.host ?? "",
          "x-forwarded-for": anfrage.socket.remoteAddress ?? "",
        },
      },
      (r) => {
        antwort.writeHead(r.statusCode ?? 502, r.headers);
        r.pipe(antwort);
      },
    );
    weiter.on("error", () => {
      if (!antwort.headersSent) antwort.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      antwort.end("Die Plattform startet gerade oder ist nicht erreichbar. Bitte gleich noch einmal versuchen.");
    });
    anfrage.pipe(weiter);
  },
);

server.listen(port, "0.0.0.0", () => console.log(`HTTPS-Zugang auf Port ${port} → http://${ziel.host}:${ziel.port}`));
