import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { kurzcodeAnzeige } from "@/lib/tickets";
import { nachtName } from "@/lib/uebernachtung";
import { istInterneZimmerbezeichnung } from "@/lib/zimmer-anzeige";

/**
 * Info-Mail zu einem Modul: alles in EINER Mail statt getrennter Mails für Ticket, Tagesordnung und Zimmer.
 * Ticket (QR, Kurzcode), Termin und Ort, Übernachtung mit Hotel und (freigegebenem) Zimmer, Tagesordnung.
 * Inhalt und Versand nutzen dieselbe Funktion, damit die Vorschau genau der echten Mail entspricht.
 */

type Sprache = "de" | "tr" | "fr";

const texte = {
  de: {
    betreff: (modul: string) => `${modul}: Ticket, Programm und Übernachtung`,
    anrede: (vorname: string) => `Hallo ${vorname},`,
    einleitung: (modul: string) => `wir freuen uns auf dich bei „${modul}“! Hier ist alles, was du dafür brauchst, in einer Mail.`,
    termin: "Termin und Ort",
    karte: "Ort auf der Karte",
    ticket: "Dein Ticket",
    ticketText: "Zeig diesen QR-Code beim Einlass. Ohne Handy reicht auch der Kurzcode.",
    kurzcode: "Kurzcode",
    ticketLink: "Ticket öffnen",
    uebernachtung: "Übernachtung",
    hotel: "Hotel",
    naechte: "Deine Nächte",
    zimmer: "Dein Zimmer",
    zimmerFolgt: "Die Zimmereinteilung bekommst du vor Ort.",
    zimmerArt: (n: number) => (n === 1 ? "Einzelzimmer" : n === 2 ? "Doppelzimmer" : `${n}-Bett-Zimmer`),
    zimmerNummer: (nr: string) => `Zimmer ${nr}`,
    zimmerNummerFolgt: "die Zimmernummer bekommst du im Hotel",
    mitImZimmer: "Mit im Zimmer",
    keineUebernachtung: "Du hast keine Übernachtung angegeben. Falls du doch eine brauchst, antworte einfach auf diese Mail.",
    keineAngabe: "Du hast noch nicht angegeben, ob du übernachtest. Bitte trag es in „Mein Bereich“ ein.",
    keineAngabeZu: "Du hast keine Übernachtung angegeben. Falls du doch eine brauchst, antworte einfach auf diese Mail.",
    programm: "Tagesordnung",
    programmFolgt: "Das Programm für diesen Tag folgt.",
    abmelden: "Falls du nicht teilnehmen kannst, melde dich bitte vorher über dein Ticket ab. Bei Fragen antworte einfach auf diese Mail.",
    gruss: "Viele Grüße\nDein Team der SES Academy",
  },
  tr: {
    betreff: (modul: string) => `${modul}: bilet, program ve konaklama`,
    anrede: (vorname: string) => `Merhaba ${vorname},`,
    einleitung: (modul: string) => `„${modul}“ programında seni görmeyi dört gözle bekliyoruz! İhtiyacın olan her şey bu e-postada.`,
    termin: "Tarih ve yer",
    karte: "Haritada göster",
    ticket: "Biletin",
    ticketText: "Girişte bu QR kodunu göster. Telefonun yoksa kısa kod da yeterli.",
    kurzcode: "Kısa kod",
    ticketLink: "Bileti aç",
    uebernachtung: "Konaklama",
    hotel: "Otel",
    naechte: "Konaklayacağın geceler",
    zimmer: "Odan",
    zimmerFolgt: "Oda dağılımını yerinde öğreneceksin.",
    zimmerArt: (n: number) => (n === 1 ? "Tek kişilik oda" : n === 2 ? "Çift kişilik oda" : `${n} kişilik oda`),
    zimmerNummer: (nr: string) => `Oda ${nr}`,
    zimmerNummerFolgt: "oda numaranı otelde alacaksın",
    mitImZimmer: "Oda arkadaşın",
    keineUebernachtung: "Konaklama ihtiyacı belirtmedin. Yine de ihtiyacın olursa bu e-postayı yanıtlaman yeterli.",
    keineAngabe: "Konaklayıp konaklamayacağını henüz belirtmedin. Lütfen „Mein Bereich“ sayfasında bildir.",
    keineAngabeZu: "Konaklama ihtiyacı belirtmedin. Yine de ihtiyacın olursa bu e-postayı yanıtlaman yeterli.",
    programm: "Program",
    programmFolgt: "Bu günün programı daha sonra bildirilecek.",
    abmelden: "Katılamayacaksan lütfen önceden biletin üzerinden bildir. Sorun olursa bu e-postayı yanıtlaman yeterli.",
    gruss: "Selamlarımızla\nSES Academy ekibi",
  },
  fr: {
    betreff: (modul: string) => `${modul}\u00a0: billet, programme et hébergement`,
    anrede: (vorname: string) => `Bonjour ${vorname},`,
    einleitung: (modul: string) => `nous avons hâte de te retrouver à «\u00a0${modul}\u00a0»\u00a0! Voici tout ce dont tu as besoin, réuni dans un seul e-mail.`,
    termin: "Date et lieu",
    karte: "Voir sur la carte",
    ticket: "Ton billet",
    ticketText: "Montre ce QR code à l’entrée. Sans téléphone, le code court suffit.",
    kurzcode: "Code court",
    ticketLink: "Ouvrir le billet",
    uebernachtung: "Hébergement",
    hotel: "Hôtel",
    naechte: "Tes nuits",
    zimmer: "Ta chambre",
    zimmerFolgt: "Tu recevras la répartition des chambres sur place.",
    zimmerArt: (n: number) => (n === 1 ? "Chambre individuelle" : n === 2 ? "Chambre double" : `Chambre pour ${n} personnes`),
    zimmerNummer: (nr: string) => `Chambre ${nr}`,
    zimmerNummerFolgt: "tu recevras ton numéro de chambre à l’hôtel",
    mitImZimmer: "Avec toi dans la chambre",
    keineUebernachtung: "Tu n’as pas demandé d’hébergement. Si tu en as besoin malgré tout, réponds simplement à cet e-mail.",
    keineAngabe: "Tu n’as pas encore indiqué si tu as besoin d’un hébergement. Merci de le faire dans «\u00a0Mon espace\u00a0».",
    keineAngabeZu: "Tu n’as pas demandé d’hébergement. Si tu en as besoin malgré tout, réponds simplement à cet e-mail.",
    programm: "Programme",
    programmFolgt: "Le programme de cette journée suivra.",
    abmelden: "Si tu ne peux pas participer, merci de te désinscrire à l’avance depuis ton billet. Pour toute question, réponds simplement à cet e-mail.",
    gruss: "À très bientôt\nL’équipe de la SES Academy",
  },
} as const;

const locale = { de: "de-DE", tr: "tr-TR", fr: "fr-FR" } as const;

/** Übersetzung aus der Spalte i18n ({"fr": {"title": …}}), sonst der deutsche Text. */
function uebersetzt(i18n: unknown, l: Sprache, feld: "title" | "subtitle", deutsch: string | null): string | null {
  if (l === "de" || !i18n || typeof i18n !== "object") return deutsch;
  const eintrag = (i18n as Record<string, unknown>)[l];
  const wert = eintrag && typeof eintrag === "object" ? (eintrag as Record<string, unknown>)[feld] : null;
  return typeof wert === "string" && wert.trim() ? wert : deutsch;
}

/** Eine Nacht lesbar: Deutsch/Türkisch „13./14.11.“, Französisch „du 13 au 14 nov.“ */
function nachtText(nacht: string, l: Sprache): string {
  if (l !== "fr") return nachtName(nacht);
  const abend = new Date(`${nacht}T12:00:00Z`);
  const morgen = new Date(abend.getTime() + 86_400_000);
  const f = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
  return abend.getUTCMonth() === morgen.getUTCMonth() ? `du ${abend.getUTCDate()} au ${f.format(morgen)}` : `du ${f.format(abend)} au ${f.format(morgen)}`;
}

/** Sprache der Info-Mail nach der Profilsprache: Türkisch, Französisch, sonst Deutsch. */
export function infoMailSprache(preferred: string | null | undefined): Sprache {
  return preferred === "tr" || preferred === "fr" ? preferred : "de";
}

export type InfoDaten = NonNullable<Awaited<ReturnType<typeof ladeInfoMail>>>;

/** Alles für die Info-Mail einer Person zu einem Modul (mit Dienstschlüssel; Aufrufer prüft die Rolle). */
export async function ladeInfoMail(participantId: string, modulId: string) {
  const admin = createAdminClient();
  const [{ data: p }, { data: modul }, { data: reg }, { data: hotels }, { data: zuteilung }] = await Promise.all([
    admin.from("participants").select("id, first_name, last_name, email, preferred_language, checkin_token, link_token, short_code").eq("id", participantId).maybeSingle(),
    admin.from("modules").select("id, title, subtitle, i18n, location, ticket_required, stay_form_open, module_days(id, starts_at, ends_at, program_items(starts_at, ends_at, title, i18n, status))").eq("id", modulId).maybeSingle(),
    admin.from("registrations").select("id, status, rsvp, stay_requests(nights)").eq("module_id", modulId).eq("participant_id", participantId).maybeSingle(),
    admin.from("hotels").select("id, name, address, rooms_visible").eq("module_id", modulId).order("created_at"),
    admin.from("room_assignments").select("hotel_id, room_id, rooms(label, capacity)").eq("participant_id", participantId),
  ]);
  if (!p || !modul || !reg) return null;
  // Mehrere Hotels je Modul: das Hotel der Person, sobald ihre Zimmer freigegeben sind; bis dahin nur, wenn es
  // ohnehin nur ein Hotel gibt (sonst „Zimmer folgt“ ohne Hotelnamen, damit kein ungeprüfter Plan durchsickert)
  const liste = hotels ?? [];
  const eigene = zuteilung?.find((z) => liste.some((h) => h.id === z.hotel_id));
  const eigenesHotel = liste.find((h) => h.id === eigene?.hotel_id);
  const hotel = eigenesHotel?.rooms_visible ? eigenesHotel : liste.length === 1 ? liste[0] : null;
  // Zimmer erst nach Freigabe, dann mit Zimmerart und den Namen der anderen im selben Zimmer (wie Ticket-Seite und Mein Bereich)
  let zimmer: { label: string; betten: number; mitbewohner: string[] } | null = null;
  if (eigenesHotel?.rooms_visible && eigene?.rooms) {
    const { data: andere } = await admin.from("room_assignments").select("participants!inner(first_name, last_name)")
      .eq("room_id", eigene.room_id).neq("participant_id", participantId);
    zimmer = {
      label: eigene.rooms.label, betten: eigene.rooms.capacity,
      mitbewohner: (andere ?? []).map((a) => `${a.participants.first_name} ${a.participants.last_name}`.trim()).sort((x, y) => x.localeCompare(y, "de")),
    };
  }
  const stay = Array.isArray(reg.stay_requests) ? reg.stay_requests[0] : reg.stay_requests;
  const tage = [...modul.module_days].sort((a, b) => a.starts_at.localeCompare(b.starts_at)).map((t) => ({
    ...t, punkte: t.program_items.filter((x) => x.status !== "entfaellt").sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
  }));
  return { p, modul, tage, reg, naechte: stay ? [...stay.nights].sort() : null, hotel, zimmer };
}

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Betreff, Text- und HTML-Fassung. Das QR-Bild steckt im HTML als cid:ticket-qr (Anhang beim Versand).
 * wallet: Links „Zu Apple Wallet hinzufügen“ / „In Google Wallet speichern“, nur wenn die Wallets eingerichtet sind.
 */
export function infoMailInhalt(d: InfoDaten, ticketLink: string, wallet: { apple: string | null; google: string | null; appleText: string; googleText: string } | null = null) {
  const l = infoMailSprache(d.p.preferred_language);
  const t = texte[l];
  const modulTitel = uebersetzt(d.modul.i18n, l, "title", d.modul.title) ?? d.modul.title;
  const modulUntertitel = uebersetzt(d.modul.i18n, l, "subtitle", d.modul.subtitle);
  const punktTitel = (pk: { title: string; i18n: unknown }) => uebersetzt(pk.i18n, l, "title", pk.title) ?? pk.title;
  const tagLang = new Intl.DateTimeFormat(locale[l], { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" });
  const uhr = new Intl.DateTimeFormat(locale[l], { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
  const zeit = (von: string, bis: string | null) => `${uhr.format(new Date(von))}${bis ? `–${uhr.format(new Date(bis))}` : ""}`;
  const code = kurzcodeAnzeige(d.p.short_code ?? "");
  const karte = d.modul.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.modul.location)}` : null;
  const termine = d.tage.map((x) => `${tagLang.format(new Date(x.starts_at))}, ${zeit(x.starts_at, x.ends_at)}`);

  const uebernachtung: { text: string[]; html: string } = (() => {
    // Ohne Angabe: in „Mein Bereich“ nachtragen geht nur, solange die Abfrage offen ist
    const ohne = d.modul.stay_form_open ? t.keineAngabe : t.keineAngabeZu;
    if (d.naechte === null) return { text: [ohne], html: `<p style="margin:0">${esc(ohne)}</p>` };
    if (d.naechte.length === 0) return { text: [t.keineUebernachtung], html: `<p style="margin:0">${esc(t.keineUebernachtung)}</p>` };
    const zeilen: [string, string][] = [];
    if (d.hotel && d.hotel.name !== "Hotel (Name folgt)") zeilen.push([t.hotel, [d.hotel.name, d.hotel.address].filter(Boolean).join(", ")]);
    zeilen.push([t.naechte, d.naechte.map((n) => nachtText(n, l)).join(", ")]);
    zeilen.push([t.zimmer, d.zimmer
      ? `${t.zimmerArt(d.zimmer.betten)} · ${istInterneZimmerbezeichnung(d.zimmer.label) ? t.zimmerNummerFolgt : t.zimmerNummer(d.zimmer.label)}`
      : t.zimmerFolgt]);
    if (d.zimmer?.mitbewohner.length) zeilen.push([t.mitImZimmer, d.zimmer.mitbewohner.join(", ")]);
    return {
      text: zeilen.map(([k, v]) => `${k}: ${v}`),
      html: zeilen.map(([k, v]) => `<p style="margin:0 0 6px"><span style="color:#3c4a42">${esc(k)}:</span> <strong>${esc(v)}</strong></p>`).join(""),
    };
  })();

  const programmText = d.tage.flatMap((x) => [
    "", tagLang.format(new Date(x.starts_at)),
    ...(x.punkte.length ? x.punkte.map((pk) => `${zeit(pk.starts_at, pk.ends_at)}  ${punktTitel(pk)}`) : [t.programmFolgt]),
  ]);
  const programmHtml = d.tage.map((x) => `
    <p style="margin:18px 0 6px;font-weight:bold;color:#3d7a61">${esc(tagLang.format(new Date(x.starts_at)))}</p>
    ${x.punkte.length ? `<table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px">${x.punkte.map((pk) => `
      <tr><td style="padding:6px 10px 6px 0;white-space:nowrap;vertical-align:top;font-weight:bold;border-bottom:1px solid #e4e1d8">${esc(zeit(pk.starts_at, pk.ends_at))}</td>
      <td style="padding:6px 0;border-bottom:1px solid #e4e1d8">${esc(punktTitel(pk))}</td></tr>`).join("")}</table>`
      : `<p style="margin:0;color:#3c4a42">${esc(t.programmFolgt)}</p>`}`).join("");

  const abschnitt = (titel: string, inhalt: string) =>
    `<div style="background:#ffffff;border-radius:20px;padding:20px 22px;margin:0 0 16px"><p style="margin:0 0 10px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#3d7a61;font-weight:bold">${esc(titel)}</p>${inhalt}</div>`;

  const walletText = [
    ...(wallet?.apple ? [`${wallet.appleText}: ${wallet.apple}`] : []),
    ...(wallet?.google ? [`${wallet.googleText}: ${wallet.google}`] : []),
  ];
  const walletKnopf = (href: string, beschriftung: string) =>
    `<br><a href="${esc(href)}" style="display:inline-block;margin-top:10px;background:#000000;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:12px;font-weight:bold;font-size:14px">${esc(beschriftung)}</a>`;
  const walletHtml = `${wallet?.apple ? walletKnopf(wallet.apple, wallet.appleText) : ""}${wallet?.google ? walletKnopf(wallet.google, wallet.googleText) : ""}`;

  const betreff = t.betreff(modulTitel);
  const text = [
    t.anrede(d.p.first_name), "", t.einleitung(modulTitel), "",
    `${t.termin}:`, ...termine, d.modul.location ?? "", ...(karte ? [`${t.karte}: ${karte}`] : []), "",
    ...(d.modul.ticket_required ? [`${t.ticket}:`, t.ticketText, `${t.kurzcode}: ${code}`, `${t.ticketLink}: ${ticketLink}`, ...walletText, ""] : []),
    `${t.uebernachtung}:`, ...uebernachtung.text, "",
    `${t.programm}:`, ...programmText, "",
    t.abmelden, "", t.gruss,
  ].join("\n");

  const html = `<!doctype html><html lang="${l}"><body style="margin:0;background:#f3efe4;font-family:Arial,Helvetica,sans-serif;color:#13201a">
<div style="max-width:580px;margin:0 auto;padding:28px 16px">
  <div style="background:#3d7a61;color:#ffffff;border-radius:20px;padding:24px 22px;margin:0 0 16px">
    <p style="margin:0;font-size:12px;letter-spacing:.3em;font-weight:bold">SES ACADEMY</p>
    <p style="margin:10px 0 0;font-family:Georgia,serif;font-size:26px;line-height:1.2">${esc(modulTitel)}</p>
    ${modulUntertitel ? `<p style="margin:6px 0 0;font-family:Georgia,serif;font-size:16px;opacity:.9">${esc(modulUntertitel)}</p>` : ""}
  </div>
  <p style="font-size:16px;line-height:1.6;margin:0 0 16px">${esc(t.anrede(d.p.first_name))}<br>${esc(t.einleitung(modulTitel))}</p>
  ${abschnitt(t.termin, `${termine.map((z) => `<p style="margin:0 0 4px;font-weight:bold">${esc(z)}</p>`).join("")}${d.modul.location ? `<p style="margin:8px 0 0">${esc(d.modul.location)}${karte ? ` · <a href="${esc(karte)}" style="color:#3d7a61;font-weight:bold">${esc(t.karte)}</a>` : ""}</p>` : ""}`)}
  ${!d.modul.ticket_required ? "" : abschnitt(t.ticket, `<p style="margin:0 0 12px;font-size:14px;line-height:1.5">${esc(t.ticketText)}</p>
    <div style="text-align:center">
      <img src="cid:ticket-qr" width="220" height="220" alt="QR-Code" style="display:block;margin:0 auto">
      <p style="margin:12px 0 2px;font-size:13px;color:#3c4a42">${esc(t.kurzcode)}</p>
      <p style="margin:0 0 14px;font-family:Menlo,Consolas,monospace;font-size:24px;font-weight:bold;letter-spacing:.12em">${esc(code)}</p>
      <a href="${esc(ticketLink)}" style="display:inline-block;background:#13201a;color:#f3efe4;text-decoration:none;padding:12px 26px;border-radius:999px;font-weight:bold">${esc(t.ticketLink)}</a>${walletHtml}
    </div>`)}
  ${abschnitt(t.uebernachtung, uebernachtung.html)}
  ${abschnitt(t.programm, programmHtml)}
  <p style="font-size:14px;line-height:1.6;color:#3c4a42;margin:8px 4px">${esc(t.abmelden)}</p>
  <p style="font-size:14px;line-height:1.6;white-space:pre-line;margin:8px 4px">${esc(t.gruss)}</p>
</div></body></html>`;
  return { betreff, text, html, sprache: l };
}
