import "server-only";

import { ImapFlow, type MessageStructureObject } from "imapflow";
import { simpleParser, type AddressObject } from "mailparser";

/**
 * Postfach info@ses-academy.org im Team-Bereich (Wunsch 12.11.2026): eingehende Mails lesen und als info@ antworten,
 * ohne dass jemand das Postfach-Passwort braucht. Zugang über IMAP mit denselben Zugangsdaten wie der Versand
 * (SMTP_USER/SMTP_PASS; Host und Port über IMAP_HOST/IMAP_PORT änderbar, sonst SMTP_HOST und 993).
 * Nur serverseitig; die Seiten prüfen die Rolle (requireStaff("orga")).
 */

export const ordnerListe = [
  { id: "eingang", name: "Posteingang", spezial: "\\Inbox" },
  { id: "gesendet", name: "Gesendet", spezial: "\\Sent" },
  { id: "spam", name: "Spam", spezial: "\\Junk" },
] as const;
export type OrdnerId = (typeof ordnerListe)[number]["id"];

export function istOrdner(wert: unknown): wert is OrdnerId {
  return ordnerListe.some((o) => o.id === wert);
}

export function postfachBereit(): boolean {
  return Boolean((process.env.IMAP_HOST ?? process.env.SMTP_HOST) && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function mitPostfach<T>(arbeit: (c: ImapFlow) => Promise<T>): Promise<T> {
  const c = new ImapFlow({
    host: process.env.IMAP_HOST ?? process.env.SMTP_HOST ?? "",
    port: Number(process.env.IMAP_PORT ?? 993),
    secure: true,
    auth: { user: process.env.SMTP_USER ?? "", pass: process.env.SMTP_PASS ?? "" },
    logger: false,
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 60_000,
  });
  await c.connect();
  try {
    return await arbeit(c);
  } finally {
    await c.logout().catch(() => c.close());
  }
}

async function pfad(c: ImapFlow, ordner: OrdnerId): Promise<string> {
  const spezial = ordnerListe.find((o) => o.id === ordner)!.spezial;
  if (spezial === "\\Inbox") return "INBOX";
  const liste = await c.list();
  const treffer = liste.find((b) => b.specialUse === spezial);
  if (!treffer) throw new Error(`Ordner ${ordner} fehlt im Postfach`);
  return treffer.path;
}

export type Adresse = { name: string; adresse: string };
export type Kopf = { uid: number; von: Adresse | null; an: Adresse[]; betreff: string; datum: string | null; gelesen: boolean; beantwortet: boolean; anhang: boolean };

function datumText(d: Date | string | undefined): string | null {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? null : x.toISOString();
}

function hatAnhang(teil: MessageStructureObject | undefined): boolean {
  if (!teil) return false;
  if (teil.disposition === "attachment") return true;
  return (teil.childNodes ?? []).some(hatAnhang);
}

/** Die neuesten Mails eines Ordners (Kopfzeilen), neueste zuerst, dazu Gesamtzahl und ungelesene. */
export async function postfachListe(ordner: OrdnerId, anzahl = 100): Promise<{ mails: Kopf[]; gesamt: number; ungelesen: number }> {
  return mitPostfach(async (c) => {
    const p = await pfad(c, ordner);
    const lock = await c.getMailboxLock(p, { readOnly: true });
    try {
      const box = c.mailbox;
      const gesamt = box ? box.exists : 0;
      const mails: Kopf[] = [];
      if (gesamt > 0) {
        for await (const m of c.fetch(`${Math.max(1, gesamt - anzahl + 1)}:*`, { uid: true, envelope: true, flags: true, internalDate: true, bodyStructure: true })) {
          const e = m.envelope;
          const von = e?.from?.[0];
          mails.push({
            uid: m.uid,
            von: von ? { name: von.name ?? "", adresse: von.address ?? "" } : null,
            an: (e?.to ?? []).map((a) => ({ name: a.name ?? "", adresse: a.address ?? "" })),
            betreff: e?.subject ?? "",
            datum: datumText(e?.date ?? m.internalDate),
            gelesen: m.flags?.has("\\Seen") ?? false,
            beantwortet: m.flags?.has("\\Answered") ?? false,
            anhang: hatAnhang(m.bodyStructure),
          });
        }
      }
      mails.sort((a, b) => b.uid - a.uid);
      const st = await c.status(p, { unseen: true }).catch(() => null);
      return { mails, gesamt, ungelesen: (st ? st.unseen : undefined) ?? mails.filter((m) => !m.gelesen).length };
    } finally {
      lock.release();
    }
  });
}

function adressen(a: AddressObject | AddressObject[] | undefined): Adresse[] {
  const liste = Array.isArray(a) ? a : a ? [a] : [];
  return liste.flatMap((x) => x.value.map((v) => ({ name: v.name ?? "", adresse: v.address ?? "" })));
}

export type Mail = Kopf & {
  cc: Adresse[];
  antwortAn: Adresse[];
  text: string;
  html: string | null;
  messageId: string | null;
  references: string[];
  anhaenge: { nr: number; name: string; typ: string; groesse: number }[];
};

async function quelle(c: ImapFlow, uid: number): Promise<Buffer | null> {
  const m = await c.fetchOne(String(uid), { source: true, flags: true }, { uid: true });
  return m && m.source ? m.source : null;
}

/** Eine Mail vollständig. Im Posteingang gilt sie danach als gelesen (wie im Webmail). */
export async function postfachMail(ordner: OrdnerId, uid: number): Promise<Mail | null> {
  return mitPostfach(async (c) => {
    const p = await pfad(c, ordner);
    const lock = await c.getMailboxLock(p);
    try {
      const m = await c.fetchOne(String(uid), { uid: true, source: true, flags: true, envelope: true }, { uid: true });
      if (!m || !m.source) return null;
      const war = { gelesen: m.flags?.has("\\Seen") ?? false, beantwortet: m.flags?.has("\\Answered") ?? false };
      if (!war.gelesen && ordner !== "gesendet") await c.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
      // cid:-Bilder werden zu data:-URLs (keepCidLinks: false), damit sie ohne Nachladen erscheinen
      const mail = await simpleParser(m.source, { keepCidLinks: false });
      const anhaenge = mail.attachments
        .map((a, nr) => ({ nr, name: a.filename ?? `Anhang ${nr + 1}`, typ: a.contentType, groesse: a.size, sichtbar: a.contentDisposition !== "inline" || !a.related }))
        .filter((a) => a.sichtbar)
        .map(({ nr, name, typ, groesse }) => ({ nr, name, typ, groesse }));
      const von = adressen(mail.from)[0] ?? null;
      const refs = mail.references;
      return {
        uid, von, an: adressen(mail.to), cc: adressen(mail.cc), antwortAn: adressen(mail.replyTo),
        betreff: mail.subject ?? "", datum: mail.date?.toISOString() ?? null,
        gelesen: true, beantwortet: war.beantwortet, anhang: anhaenge.length > 0,
        text: mail.text ?? "", html: typeof mail.html === "string" ? mail.html : null,
        messageId: mail.messageId ?? null, references: Array.isArray(refs) ? refs : refs ? [refs] : [],
        anhaenge,
      };
    } finally {
      lock.release();
    }
  });
}

/** Ein Anhang einer Mail (Nummer wie in postfachMail). */
export async function postfachAnhang(ordner: OrdnerId, uid: number, nr: number): Promise<{ name: string; typ: string; inhalt: Buffer } | null> {
  return mitPostfach(async (c) => {
    const p = await pfad(c, ordner);
    const lock = await c.getMailboxLock(p, { readOnly: true });
    try {
      const roh = await quelle(c, uid);
      if (!roh) return null;
      const a = (await simpleParser(roh)).attachments[nr];
      return a ? { name: a.filename ?? `anhang-${nr + 1}`, typ: a.contentType, inhalt: a.content } : null;
    } finally {
      lock.release();
    }
  });
}

/** Nach dem Versand einer Antwort: Kopie in „Gesendet“ ablegen (fürs Webmail) und das Original als beantwortet markieren. */
export async function postfachNachAntwort(ordner: OrdnerId, uid: number, roh: Buffer): Promise<void> {
  await mitPostfach(async (c) => {
    const gesendet = await pfad(c, "gesendet");
    await c.append(gesendet, roh, ["\\Seen"]);
    const p = await pfad(c, ordner);
    const lock = await c.getMailboxLock(p);
    try {
      await c.messageFlagsAdd(String(uid), ["\\Answered"], { uid: true });
    } finally {
      lock.release();
    }
  });
}

/** Kopie einer von der App verschickten Mail in „Gesendet“ ablegen (fürs Postfach im Team-Bereich und das Webmail). */
export async function postfachKopieAblegen(roh: Buffer, datum?: Date): Promise<void> {
  await mitPostfach(async (c) => {
    await c.append(await pfad(c, "gesendet"), roh, ["\\Seen"], datum);
  });
}

/** Neueste Mail in „Gesendet“ an diese Adresse seit einem Zeitpunkt (für „ansehen“ im Versandprotokoll). */
export async function postfachGesendetFinden(an: string, seit: Date): Promise<number | null> {
  return mitPostfach(async (c) => {
    const lock = await c.getMailboxLock(await pfad(c, "gesendet"), { readOnly: true });
    try {
      const uids = await c.search({ to: an, since: seit }, { uid: true });
      return uids && uids.length ? Math.max(...uids) : null;
    } finally {
      lock.release();
    }
  });
}
