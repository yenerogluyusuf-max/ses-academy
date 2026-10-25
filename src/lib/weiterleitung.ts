import { NextResponse } from "next/server";

/**
 * Weiterleitung mit relativer Adresse. Nicht aus request.url bauen: hinter dem HTTPS-Zugang (Betrieb) ist das die
 * interne Adresse http://127.0.0.1:3200, in der Entwicklung oft localhost statt 127.0.0.1 (dann fehlt das Login-Cookie).
 */
export function weiterleiten(pfad: string, status: 302 | 303 | 307 = 307): NextResponse {
  return new NextResponse(null, { status, headers: { Location: pfad } });
}
