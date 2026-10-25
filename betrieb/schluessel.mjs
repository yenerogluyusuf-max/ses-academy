// Legt ~/SES_ACADEMY/betrieb-daten/.env mit neuen Passwörtern und Schlüsseln an (einmalig, überschreibt nie).
// Aufruf: node betrieb/schluessel.mjs [ordner]
// Die Datei enthält Geheimnisse: nur lesbar für den eigenen Benutzer, nie ins Repo, nie in den Chat.
import { execFileSync } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { homedir, hostname } from "node:os";
import { join } from "node:path";

const ordner = process.argv[2] ?? join(homedir(), "SES_ACADEMY", "betrieb-daten");
const datei = join(ordner, ".env");
if (existsSync(datei)) {
  console.log(`${datei} gibt es schon, nichts geändert.`);
  process.exit(0);
}

const zufall = (bytes) => randomBytes(bytes).toString("base64url");
const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");

/** HS256-JWT wie die Supabase-Schlüssel (anon / service_role), gültig 10 Jahre. */
function schluessel(rolle, geheimnis) {
  const jetzt = Math.floor(Date.now() / 1000);
  const kopf = b64({ alg: "HS256", typ: "JWT" });
  const inhalt = b64({ iss: "supabase", role: rolle, iat: jetzt, exp: jetzt + 10 * 365 * 86400 });
  const signatur = createHmac("sha256", geheimnis).update(`${kopf}.${inhalt}`).digest("base64url");
  return `${kopf}.${inhalt}.${signatur}`;
}

const jwt = zufall(48);
// Name im lokalen Netz, z. B. MacBook-Pro-von-Yusuf.local; Handys öffnen https://<name>:8443
// (scutil liefert den Bonjour-Namen; hostname() wäre im Heimnetz oft der Name vom Router, z. B. Mac.fritz.box)
function bonjourName() {
  try {
    return execFileSync("scutil", ["--get", "LocalHostName"], { encoding: "utf8" }).trim();
  } catch {
    return hostname().split(".")[0];
  }
}
const lokalerName = `${bonjourName()}.local`;

const inhalt = `# SES-Organisation · Betrieb. Erzeugt am ${new Date().toISOString().slice(0, 10)} von betrieb/schluessel.mjs.
# GEHEIM: nicht weitergeben, nicht ins Repo, nicht in Chats kopieren.

# Datenbank und Schlüssel (nicht ändern, sonst passen gespeicherte Sitzungen und Sicherungen nicht mehr)
POSTGRES_PASSWORD=${zufall(24)}
JWT_SECRET=${jwt}
ANON_KEY=${schluessel("anon", jwt)}
SERVICE_ROLE_KEY=${schluessel("service_role", jwt)}

# Adressen
LOKALER_NAME=${lokalerName}
SITE_URL=https://${lokalerName}:8443
API_PORT=56321
DB_PORT=56322
WEB_PORT=3200
HTTPS_PORT=8443

# Mailversand über ses@islamrat.de: Zugangsdaten hier selbst eintragen (Postausgangsserver des Islamrat-Postfachs)
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=ses@islamrat.de
SMTP_PASS=
SMTP_FROM_ADDRESS=ses@islamrat.de
MAIL_FROM="SES Academy <ses@islamrat.de>"

# Tägliche Sicherung: Ordner auf einem zweiten Gerät (z. B. /Volumes/SES-Sicherung). Leer = nur lokal.
SICHERUNG_ZIEL=
`;

await mkdir(ordner, { recursive: true, mode: 0o700 });
await writeFile(datei, inhalt, { mode: 0o600 });
await chmod(ordner, 0o700);
console.log(`${datei} angelegt. Jetzt SMTP_HOST und SMTP_PASS eintragen.`);
