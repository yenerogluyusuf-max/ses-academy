import type { Metadata } from "next";
import { Hinweis } from "@/components/team/Hinweis";
import { TeamKopf } from "@/components/team/TeamKopf";
import { MailHinweis } from "@/components/team/MailHinweis";
import { RundmailFormular } from "@/components/team/RundmailFormular";
import { nachrichtSenden } from "@/lib/aktionen/freigaben";
import { requireStaff } from "@/lib/auth";
import { mailBereit, seitenUrl } from "@/lib/mail";
import { createClient } from "@/lib/supabase/server";
import type { TeamSprache } from "@/lib/team-sprache";
import { jetztMs } from "@/lib/zeit";

export const metadata: Metadata = { title: "Nachrichten | SES Academy" };

const de = {
  hinweise: {
    beantragt: { text: "Zur Freigabe vorgelegt. Eine zweite Person gibt sie unter „Freigaben“ frei, danach kannst du hier senden.", gut: true },
    "keine-empfaenger": { text: "Mit diesen Filtern gibt es keine Empfänger mit E-Mail-Adresse.", gut: false },
    expired: { text: "Die Freigabe ist älter als 24 Stunden. Bitte neu beantragen.", gut: false },
    ausgefuehrt: { text: "Diese Nachricht wurde schon verschickt.", gut: false },
    offen: { text: "Noch nicht freigegeben.", gut: false },
    eingabe: { text: "Bitte Betreff und Text angeben.", gut: false },
    fehler: { text: "Das hat nicht geklappt.", gut: false },
  } as Record<string, { text: string; gut: boolean }>,
  titel: "Nachrichten an alle",
  gesendet: (ok: number, fehler: number) => `${ok} Mails verschickt${fehler ? `, ${fehler} fehlgeschlagen` : ""}.`,
  verschickt: (n?: number) => `verschickt${n !== undefined ? ` (${n})` : ""}`,
  status: { offen: "wartet auf Freigabe", freigegeben: "freigegeben", abgelehnt: "abgelehnt", ausgefuehrt: "ausgeführt" } as Record<string, string>,
  abgelaufen: "Freigabe abgelaufen",
  abgelehntNotiz: "Abgelehnt mit Notiz:", freigabeNotiz: "Notiz zur Freigabe:",
  senden: (n: number) => `Jetzt an ${n} Personen senden`,
  whatsapp: "Text für die WhatsApp-Gruppe (markieren und kopieren)",
  neu: "Neue Nachricht",
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    hinweise: {
      beantragt: { text: "Onaya sunuldu. İkinci bir kişi „Onaylar“ bölümünde onaylar, ardından buradan gönderebilirsin.", gut: true },
      "keine-empfaenger": { text: "Bu filtrelerle e-posta adresi olan alıcı yok.", gut: false },
      expired: { text: "Onay 24 saatten eski. Lütfen yeniden onaya sun.", gut: false },
      ausgefuehrt: { text: "Bu mesaj zaten gönderildi.", gut: false },
      offen: { text: "Henüz onaylanmadı.", gut: false },
      eingabe: { text: "Lütfen konu ve metni gir.", gut: false },
      fehler: { text: "Bu işlem olmadı.", gut: false },
    },
    titel: "Herkese mesaj",
    gesendet: (ok, fehler) => `${ok} e-posta gönderildi${fehler ? `, ${fehler} başarısız oldu` : ""}.`,
    verschickt: (n) => `gönderildi${n !== undefined ? ` (${n})` : ""}`,
    status: { offen: "onay bekliyor", freigegeben: "onaylandı", abgelehnt: "reddedildi", ausgefuehrt: "uygulandı" },
    abgelaufen: "Onayın süresi doldu",
    abgelehntNotiz: "Not ile reddedildi:", freigabeNotiz: "Onay notu:",
    senden: (n) => `Şimdi ${n} kişiye gönder`,
    whatsapp: "WhatsApp grubu için metin (seç ve kopyala)",
    neu: "Yeni mesaj",
  },
  fr: {
    hinweise: {
      beantragt: { text: "Soumis pour validation. Une deuxième personne le valide dans « Validations », ensuite tu peux l’envoyer ici.", gut: true },
      "keine-empfaenger": { text: "Avec ces filtres, aucun destinataire n’a d’adresse e-mail.", gut: false },
      expired: { text: "La validation date de plus de 24 heures. Merci de la redemander.", gut: false },
      ausgefuehrt: { text: "Ce message a déjà été envoyé.", gut: false },
      offen: { text: "Pas encore validé.", gut: false },
      eingabe: { text: "Merci d’indiquer l’objet et le texte.", gut: false },
      fehler: { text: "Cela n’a pas fonctionné.", gut: false },
    },
    titel: "Messages à tous",
    gesendet: (ok, fehler) => `${ok} e-mails envoyés${fehler ? `, ${fehler} en échec` : ""}.`,
    verschickt: (n) => `envoyé${n !== undefined ? ` (${n})` : ""}`,
    status: { offen: "en attente de validation", freigegeben: "validé", abgelehnt: "refusé", ausgefuehrt: "exécuté" },
    abgelaufen: "Validation expirée",
    abgelehntNotiz: "Refusé avec la note :", freigabeNotiz: "Note de validation :",
    senden: (n) => `Envoyer maintenant à ${n} ${n === 1 ? "personne" : "personnes"}`,
    whatsapp: "Texte pour le groupe WhatsApp (sélectionner et copier)",
    neu: "Nouveau message",
  },
};

/**
 * Nachrichten an alle (Phase 3): an eine Generation, Region, Sorumlu-Gruppe, die Angemeldeten eines Moduls oder eine Gruppe.
 * Versand per Mail erst nach Freigabe durch eine zweite Person. Für die WhatsApp-Gruppe gibt es den Text zum Kopieren
 * (Entscheidung 25.10.2026: WhatsApp bleibt für schnelle Mitteilungen, Persönliches per Mail, das Portal liefert die Texte).
 */
export default async function Nachrichten({ searchParams }: PageProps<"/team/nachrichten">) {
  const staff = await requireStaff("alles");
  const l = staff.sprache;
  const t = T[l];
  const { hinweis } = await searchParams;
  const supabase = await createClient();
  const [{ data: generationen }, { data: regionen }, { data: sorumlu }, { data: module }, { data: gruppen }, { data: meine }, { data: vorlagen }] = await Promise.all([
    supabase.from("cohorts").select("id, name").order("year", { ascending: false }),
    supabase.from("regions").select("id, name").order("name"),
    supabase.from("mentors").select("id, name").order("name"),
    supabase.from("modules").select("id, title").eq("status", "published").order("created_at", { ascending: false }),
    supabase.from("module_groups").select("id, name, module:modules(title)").order("name"),
    supabase.from("approvals").select("*").eq("action", "nachricht").eq("requested_by", staff.userId).order("requested_at", { ascending: false }).limit(20),
    supabase.from("message_templates").select("id, name, subject_de, body_de, subject_tr, body_tr").order("name"),
  ]);
  const gesendet = typeof hinweis === "string" && hinweis.startsWith("gesendet-") ? hinweis.split("-").slice(1).map(Number) : null;
  const jetzt = jetztMs();

  return (
    <>
      <TeamKopf staff={staff} aktiv="nachrichten" />
      <main lang={l} className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="font-display text-3xl font-bold">{t.titel}</h1>
        <Hinweis code={gesendet ? undefined : hinweis} texte={t.hinweise} />
        {gesendet && <p role="status" className={`mt-4 rounded-2xl p-4 ${gesendet[1] ? "bg-amber-100" : "bg-emerald-100"}`}>{t.gesendet(gesendet[0], gesendet[1])}</p>}

        {(meine ?? []).length > 0 && (
          <section className="mt-6 space-y-3">
            {(meine ?? []).map((a) => {
              const p = a.payload as { betreff: string; text: string; betreff_tr?: string; text_tr?: string; sprache?: string; anzahl: number };
              const titel = p.sprache === "tr" ? p.betreff_tr : p.betreff;
              const sendbar = a.status === "freigegeben" && a.decided_at && Date.parse(a.decided_at) > jetzt - 86_400_000;
              // Text für die Teilnehmenden (in der Sprache der Nachricht, nicht der Oberfläche)
              const whatsapp = [
                ...(p.sprache !== "tr" ? [`*${p.betreff}*\n\n${p.text}`] : []),
                ...(p.sprache && p.sprache !== "de" ? [`*${p.betreff_tr}*\n\n${p.text_tr}`] : []),
              ].join("\n\n———\n\n") + `\n\nMein Bereich: ${seitenUrl("/mein-bereich/")}`;
              const r = a.result as { gesendet?: number; fehler?: number } | null;
              return (
                <details key={a.id} className="karte" open={!!sendbar}>
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2">
                    <span lang={p.sprache === "tr" ? "tr" : "de"} className="mr-auto font-semibold">{titel}</span>
                    <span className={`chip ${sendbar ? "bg-gruen-hell" : a.status === "ausgefuehrt" ? "bg-paper-deep" : a.status === "abgelehnt" ? "bg-rot-hell text-rot" : "bg-gelb-hell"}`}>
                      {a.status === "ausgefuehrt" ? t.verschickt(r?.gesendet) : sendbar ? t.status.freigegeben : a.status === "freigegeben" ? t.abgelaufen : t.status[a.status] ?? a.status}
                    </span>
                  </summary>
                  <p className="mt-2 text-sm text-ink-soft">{a.summary}</p>
                  {a.decision_note && (
                    <p className={`mt-2 rounded-2xl p-3 text-sm ${a.status === "abgelehnt" ? "bg-rot-hell text-rot" : "bg-paper-deep"}`}>
                      <span className="font-semibold">{a.status === "abgelehnt" ? t.abgelehntNotiz : t.freigabeNotiz}</span> {a.decision_note}
                    </p>
                  )}
                  {sendbar && (
                    <form action={nachrichtSenden} className="mt-3">
                      <input type="hidden" name="id" value={a.id} />
                      <button type="submit" className="knopf">{t.senden(p.anzahl)}</button>
                      <MailHinweis knapp className="mt-3" sprache={l} />
                    </form>
                  )}
                  <label className="etikett mt-4" htmlFor={`wa-${a.id}`}>{t.whatsapp}</label>
                  <textarea id={`wa-${a.id}`} readOnly rows={6} defaultValue={whatsapp} className="feld font-mono text-sm" />
                </details>
              );
            })}
          </section>
        )}

        <section className="karte mt-8">
          <h2 className="font-display text-xl font-bold">{t.neu}</h2>
          <div className="mt-4">
            <RundmailFormular sprache={l} vorlagen={vorlagen ?? []} mailBereit={mailBereit()} email={staff.email} filterOptionen={{
              generationen: generationen ?? [], regionen: regionen ?? [], sorumlu: sorumlu ?? [],
              module: (module ?? []).map((m) => ({ id: m.id, name: m.title })),
              gruppen: (gruppen ?? []).map((g) => ({ id: g.id, name: `${g.name}${g.module ? ` (${g.module.title})` : ""}` })),
            }} />
          </div>
        </section>
      </main>
    </>
  );
}
