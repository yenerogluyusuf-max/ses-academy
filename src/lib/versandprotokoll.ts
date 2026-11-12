import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Von der App verschickte Mails (email_log) für den Ordner „Gesendet“ im Postfach (Wunsch 12.11.2026).
 * Die App verschickt direkt per SMTP und legt keine Kopie im Postfach ab; hier steht deshalb das Protokoll:
 * wer, welche Mail, wann, mit welchem Ergebnis. Liest mit Dienstschlüssel (email_log ist sonst nur für Admin/Vorstand);
 * der Aufrufer prüft die Rolle (Postfach: Orga-Team und höher).
 */
export type VersandEintrag = {
  id: number;
  art: string;
  an: string;
  name: string | null;
  personId: string | null;
  modulId: string | null;
  modulTitel: string | null;
  status: "sent" | "failed";
  fehler: string | null;
  zeit: string;
  mitTicket: boolean;
};

const SPALTEN = "id, kind, recipient, status, error, created_at, participant_id, module_id, participant:participants(first_name, last_name), modul:modules(title)";

/** Neueste Einträge, optional gesucht nach Name oder Adresse. */
export async function ladeVersandprotokoll({ suche = "", grenze = 300 }: { suche?: string; grenze?: number } = {}): Promise<VersandEintrag[]> {
  const db = createAdminClient();
  const q = suche.trim().slice(0, 80).replace(/[%_\\,()*]/g, "");
  // Antworten aus dem Postfach stehen schon als echte Mails in „Gesendet“
  let abfrage = db.from("email_log").select(SPALTEN).neq("kind", "postfach_antwort").order("created_at", { ascending: false }).limit(grenze * 2);
  if (q) {
    const { data: personen } = await db.from("participants").select("id").or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`).limit(100);
    const ids = (personen ?? []).map((p) => p.id);
    abfrage = abfrage.or(ids.length ? `recipient.ilike.%${q}%,participant_id.in.(${ids.join(",")})` : `recipient.ilike.%${q}%`);
  }
  const { data } = await abfrage;
  const zeilen = data ?? [];
  // Die Info-Mail enthält das Ticket; die App protokolliert beides. Nur eine Zeile zeigen („mit Ticket“).
  const infos = zeilen.filter((z) => z.kind === "info");
  const gehoertZuInfo = (z: (typeof zeilen)[number]) => z.kind === "ticket" && infos.some((i) => i.participant_id === z.participant_id
    && i.module_id === z.module_id && Math.abs(Date.parse(i.created_at) - Date.parse(z.created_at)) < 60_000);
  return zeilen.filter((z) => !gehoertZuInfo(z)).slice(0, grenze).map((z): VersandEintrag => ({
    id: z.id, art: z.kind, an: z.recipient,
    name: z.participant ? `${z.participant.first_name} ${z.participant.last_name}`.trim() : null,
    personId: z.participant_id, modulId: z.module_id, modulTitel: z.modul?.title ?? null,
    status: z.status === "failed" ? "failed" : "sent", fehler: z.error, zeit: z.created_at,
    mitTicket: z.kind === "info",
  }));
}
