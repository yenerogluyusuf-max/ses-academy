// Gerätekennung fürs Publikum bei den Saalfragen. Kein "server-only", weil auch der Proxy (src/proxy.ts) sie vergibt.
// Wert im Cookie: <zufällige ID>.<HMAC> – nur der Server kann gültige Kennungen ausstellen; in der Datenbank steht nur ein Hash.
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const GERAET_COOKIE = "ses_geraet";

function schluessel() {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("SUPABASE_SERVICE_ROLE_KEY fehlt (wird für die Signatur der Gerätekennung gebraucht).");
  return s;
}

const signatur = (id: string) => createHmac("sha256", schluessel()).update(`saalfragen:${id}`).digest("base64url");

export function neueGeraeteKennung(): string {
  const id = randomUUID();
  return `${id}.${signatur(id)}`;
}

/** Prüft die Signatur und liefert den Hash für die Datenbank, sonst "". */
export function geraeteHash(wert: string | undefined): string {
  if (!wert) return "";
  const [id, sig] = wert.split(".");
  if (!id || !sig) return "";
  const erwartet = Buffer.from(signatur(id));
  const bekommen = Buffer.from(sig);
  if (erwartet.length !== bekommen.length || !timingSafeEqual(erwartet, bekommen)) return "";
  return createHash("sha256").update(id).digest("hex").slice(0, 32);
}

/** IP-Adresse als Hash (für die Obergrenze je Adresse). Hinter dem eigenen HTTPS-Zugang setzt dieser x-forwarded-for. */
export function ipHash(xForwardedFor: string | null): string {
  const ip = (xForwardedFor ?? "").split(",")[0].trim();
  return ip ? createHmac("sha256", schluessel()).update(`ip:${ip}`).digest("hex").slice(0, 32) : "";
}

export const geraetCookieOptionen = {
  httpOnly: true, sameSite: "lax" as const, maxAge: 60 * 60 * 24 * 30, path: "/fragen",
  secure: (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://"),
};
