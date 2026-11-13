import "server-only";

import type { Database } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";

type Row<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];

export type TicketModul = {
  registrationId: string;
  moduleId: string;
  /** feste Kennung des Moduls (z. B. „demokratie“), anders als der Titel nicht zum Umbenennen gedacht */
  slug: string;
  titel: string;
  ort: string | null;
  status: Row<"registrations">["status"];
  ticketNoetig: boolean;
  abgesagt: boolean;
  tage: { id: string; tag: string; beginn: string; ende: string; besucht: boolean }[];
  beginn: string | null;
};

/**
 * Zimmer der Person in einem Modul. Einzelheiten nur, wenn das Team die Zimmer freigegeben hat (hotels.rooms_visible);
 * sonst versteckt = true und alle Felder leer.
 */
export type TicketZimmer = { moduleId: string; versteckt: boolean; hotel: string | null; adresse: string | null; label: string; betten: number; mitbewohner: string[]; code: string | null };

export type TicketDaten = {
  participant: Pick<Row<"participants">, "id" | "first_name" | "last_name" | "email" | "preferred_language" | "checkin_token" | "link_token" | "short_code">;
  module: TicketModul[];
  /** Freigegebene Zimmer mit Zimmerpartner:innen. Die Ticket-Seite zeigt sie nur über den Mail-Link (perLink). */
  zimmer: TicketZimmer[];
  /** Über den Mail-Link (link_token) geöffnet. Nur dann darf die Seite abmelden; der QR-Inhalt (checkin_token) zeigt nur das Ticket. */
  perLink: boolean;
};

/**
 * Alles, was Ticket-Seite und Ticket-Mail brauchen. Läuft mit Dienstschlüssel, daher nur serverseitig.
 * token: zuerst der Link aus der Mail (link_token), sonst der QR-Inhalt bzw. ältere Links (checkin_token).
 */
export async function ladeTicket(filter: { token: string } | { participantId: string }): Promise<TicketDaten | null> {
  const admin = createAdminClient();
  const spalten = "id, first_name, last_name, email, preferred_language, checkin_token, link_token, short_code";
  let perLink = false;
  let participant: TicketDaten["participant"] | null = null;
  if ("token" in filter) {
    const { data: perMail } = await admin.from("participants").select(spalten).eq("link_token", filter.token).maybeSingle();
    if (perMail) {
      participant = perMail;
      perLink = true;
    } else {
      const { data: perQr } = await admin.from("participants").select(spalten).eq("checkin_token", filter.token).maybeSingle();
      participant = perQr;
    }
  } else {
    const { data } = await admin.from("participants").select(spalten).eq("id", filter.participantId).maybeSingle();
    participant = data;
  }
  if (!participant) return null;

  const { data: regs } = await admin
    .from("registrations")
    .select("id, status, module:modules!inner(id, slug, title, location, status, ticket_required, cancelled_at, module_days(id, day, starts_at, ends_at)), attendances(module_day_id)")
    .eq("participant_id", participant.id)
    .eq("module.status", "published");

  const liste: TicketModul[] = (regs ?? []).map((r) => {
    const besucht = new Set(r.attendances.map((a) => a.module_day_id));
    const tage = [...r.module.module_days]
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .map((d) => ({ id: d.id, tag: d.day, beginn: d.starts_at, ende: d.ends_at, besucht: besucht.has(d.id) }));
    return {
      registrationId: r.id,
      moduleId: r.module.id,
      slug: r.module.slug,
      titel: r.module.title,
      ort: r.module.location,
      status: r.status,
      ticketNoetig: r.module.ticket_required,
      abgesagt: r.module.cancelled_at !== null,
      tage,
      beginn: tage[0]?.beginn ?? null,
    };
  });
  liste.sort((a, b) => (a.beginn ?? "").localeCompare(b.beginn ?? ""));
  return { participant, module: nurNaechstesKommendes(liste), perLink, zimmer: await ladeZimmer(admin, participant.id) };
}

/**
 * Teilnehmende sehen vergangene Module und nur das NÄCHSTE kommende (Wunsch Yusuf 12.11.2026: spätere Module wie die
 * Winter School noch nicht zeigen; der QR-Code gilt ohnehin nur für das kommende Modul). Gilt für Ticket-Seite,
 * Ticket-Mail und Wallet; „Mein Bereich“ filtert genauso.
 */
export function nurNaechstesKommendes(liste: TicketModul[], jetzt = Date.now()): TicketModul[] {
  const vorbei = (m: TicketModul) => m.tage.length > 0 && m.tage.every((t) => Date.parse(t.ende) < jetzt);
  const naechstes = liste.filter((m) => !vorbei(m) && !m.abgesagt && m.beginn !== null).sort((a, b) => a.beginn!.localeCompare(b.beginn!))[0];
  return liste.filter((m) => vorbei(m) || m === naechstes || (m.abgesagt && naechstes !== undefined && (m.beginn ?? "") <= naechstes.beginn!));
}

/** Datum eines Moduls lesbar, z. B. „14.–15. November 2026“. */
export function modulZeitraum(m: TicketModul, locale: string): string {
  if (m.tage.length === 0) return "";
  const f = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" });
  const von = new Date(m.tage[0].beginn);
  const bis = new Date(m.tage[m.tage.length - 1].beginn);
  return m.tage.length === 1 ? f.format(von) : f.formatRange(von, bis);
}

/**
 * Zimmer einer Person mit den Namen der anderen im selben Zimmer (wie get_my_rooms in der Datenbank).
 * Hat das Team die Zimmer eines Hotels wieder ausgeblendet (rooms_visible = false, z. B. weil sich die Einteilung noch
 * ändert), kommt nur ein Platzhalter ohne Hotel, Zimmer, Code und Namen zurück („wird aktualisiert“).
 */
async function ladeZimmer(admin: ReturnType<typeof createAdminClient>, participantId: string): Promise<TicketZimmer[]> {
  const { data: alle } = await admin
    .from("room_assignments")
    .select("room_id, room:rooms!inner(label, capacity, access_code), hotel:hotels!inner(module_id, name, address, rooms_visible)")
    .eq("participant_id", participantId);
  if (!alle?.length) return [];
  const eigene = alle.filter((e) => e.hotel.rooms_visible);
  const versteckt = alle.filter((e) => !e.hotel.rooms_visible).map((e): TicketZimmer => ({
    moduleId: e.hotel.module_id, versteckt: true, hotel: null, adresse: null, label: "", betten: 0, code: null, mitbewohner: [],
  }));
  if (!eigene.length) return versteckt;
  const { data: andere } = await admin
    .from("room_assignments")
    .select("room_id, participant:participants!inner(first_name, last_name)")
    .in("room_id", eigene.map((e) => e.room_id))
    .neq("participant_id", participantId);
  return [...eigene.map((e): TicketZimmer => ({
    moduleId: e.hotel.module_id,
    versteckt: false,
    hotel: e.hotel.name === "Hotel (Name folgt)" ? null : e.hotel.name,
    adresse: e.hotel.address,
    label: e.room.label,
    betten: e.room.capacity,
    code: e.room.access_code,
    mitbewohner: (andere ?? []).filter((a) => a.room_id === e.room_id)
      .map((a) => `${a.participant.first_name} ${a.participant.last_name}`.trim())
      .sort((x, y) => x.localeCompare(y, "de")),
  })), ...versteckt];
}
