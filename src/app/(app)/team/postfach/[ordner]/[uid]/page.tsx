import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Paperclip } from "lucide-react";
import { Hinweis } from "@/components/team/Hinweis";
import { TeamKopf } from "@/components/team/TeamKopf";
import { postfachAntworten } from "@/lib/aktionen/postfach";
import { requireStaff } from "@/lib/auth";
import { istOrdner, postfachMail, type Adresse, type OrdnerId } from "@/lib/postfach";
import { teamLocale, type TeamSprache } from "@/lib/team-sprache";

export const metadata: Metadata = { title: "Postfach | SES Academy", referrer: "no-referrer" };

/** Ordnernamen je Sprache des Team-Bereichs (gleich in postfach/page.tsx). */
const ordnerNamen: Record<TeamSprache, Record<OrdnerId, string>> = {
  de: { eingang: "Posteingang", gesendet: "Gesendet", spam: "Spam" },
  tr: { eingang: "Gelen kutusu", gesendet: "Gönderilenler", spam: "Spam" },
  fr: { eingang: "Boîte de réception", gesendet: "Envoyés", spam: "Spam" },
};

const de = {
  hinweise: {
    gesendet: { text: "Antwort verschickt. Eine Kopie liegt im Ordner „Gesendet“.", gut: true },
    "gesendet-ohne-kopie": { text: "Antwort verschickt. Die Kopie in „Gesendet“ ließ sich nicht ablegen.", gut: true },
    leer: { text: "Bitte einen Text eingeben.", gut: false },
    "zu-lang": { text: "Der Text ist zu lang.", gut: false },
    "keine-adresse": { text: "Diese Mail hat keine Absenderadresse, auf die man antworten kann.", gut: false },
    "nicht-erreichbar": { text: "Das Postfach war gerade nicht erreichbar. Die Antwort ist NICHT verschickt.", gut: false },
    fehler: { text: "Der Versand hat nicht geklappt. Die Antwort ist NICHT verschickt.", gut: false },
  } as Record<string, { text: string; gut: boolean }>,
  nichtErreichbar: "Das Postfach ist gerade nicht erreichbar. Bitte in einer Minute neu laden.",
  weg: "Diese Mail gibt es nicht mehr. Vielleicht wurde sie im Webmail verschoben oder gelöscht.",
  ohneBetreff: "(ohne Betreff)", unbekannt: "(unbekannt)", keinText: "(kein Text)",
  von: "Von", an: "An", cc: "Cc", datum: "Datum",
  inhalt: "Inhalt der Mail",
  alsText: "Als reinen Text anzeigen",
  bilder: "Bilder aus dem Internet werden nicht geladen, damit der Absender nicht sieht, wann die Mail gelesen wurde.",
  antworten: "Antworten",
  antwortAn: (an: string, beantwortet: boolean) => `An ${an}, als info@ses-academy.org${beantwortet ? ". Diese Mail wurde schon beantwortet." : "."}`,
  antwort: "Antwort",
  signatur: (vorname: string) => `\n\nViele Grüße\n${vorname}\nSES Academy`,
  zitat: "Die ursprüngliche Mail wird unten als Zitat angehängt.",
  senden: "Antwort senden",
  mb: "MB", kb: "KB",
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    hinweise: {
      gesendet: { text: "Yanıt gönderildi. Bir kopyası „Gönderilenler“ klasöründe.", gut: true },
      "gesendet-ohne-kopie": { text: "Yanıt gönderildi. Kopyası „Gönderilenler“ klasörüne kaydedilemedi.", gut: true },
      leer: { text: "Lütfen bir metin gir.", gut: false },
      "zu-lang": { text: "Metin çok uzun.", gut: false },
      "keine-adresse": { text: "Bu e-postada yanıtlanabilecek bir gönderen adresi yok.", gut: false },
      "nicht-erreichbar": { text: "Posta kutusuna az önce ulaşılamadı. Yanıt GÖNDERİLMEDİ.", gut: false },
      fehler: { text: "Gönderim olmadı. Yanıt GÖNDERİLMEDİ.", gut: false },
    },
    nichtErreichbar: "Posta kutusuna şu an ulaşılamıyor. Lütfen bir dakika sonra sayfayı yeniden yükle.",
    weg: "Bu e-posta artık yok. Web postasında taşınmış ya da silinmiş olabilir.",
    ohneBetreff: "(konu yok)", unbekannt: "(bilinmiyor)", keinText: "(metin yok)",
    von: "Kimden", an: "Kime", cc: "Cc", datum: "Tarih",
    inhalt: "E-posta içeriği",
    alsText: "Düz metin olarak göster",
    bilder: "İnternetten görseller yüklenmez; böylece gönderen, e-postanın ne zaman okunduğunu göremez.",
    antworten: "Yanıtla",
    antwortAn: (an, beantwortet) => `Alıcı: ${an}, gönderen: info@ses-academy.org${beantwortet ? ". Bu e-posta zaten yanıtlandı." : "."}`,
    antwort: "Yanıt",
    signatur: (vorname) => `\n\nSelamlarımla\n${vorname}\nSES Academy`,
    zitat: "Orijinal e-posta alıntı olarak alta eklenir.",
    senden: "Yanıtı gönder",
    mb: "MB", kb: "KB",
  },
  fr: {
    hinweise: {
      gesendet: { text: "Réponse envoyée. Une copie se trouve dans le dossier « Envoyés ».", gut: true },
      "gesendet-ohne-kopie": { text: "Réponse envoyée. La copie n’a pas pu être placée dans « Envoyés ».", gut: true },
      leer: { text: "Merci de saisir un texte.", gut: false },
      "zu-lang": { text: "Le texte est trop long.", gut: false },
      "keine-adresse": { text: "Cet e-mail n’a pas d’adresse d’expéditeur à laquelle répondre.", gut: false },
      "nicht-erreichbar": { text: "La boîte mail était injoignable. La réponse n’a PAS été envoyée.", gut: false },
      fehler: { text: "L’envoi n’a pas fonctionné. La réponse n’a PAS été envoyée.", gut: false },
    },
    nichtErreichbar: "La boîte mail est injoignable pour le moment. Merci de recharger la page dans une minute.",
    weg: "Cet e-mail n’existe plus. Il a peut-être été déplacé ou supprimé dans le webmail.",
    ohneBetreff: "(sans objet)", unbekannt: "(inconnu)", keinText: "(pas de texte)",
    von: "De", an: "À", cc: "Cc", datum: "Date",
    inhalt: "Contenu de l’e-mail",
    alsText: "Afficher en texte brut",
    bilder: "Les images provenant d’Internet ne sont pas chargées, pour que l’expéditeur ne voie pas quand l’e-mail a été lu.",
    antworten: "Répondre",
    antwortAn: (an, beantwortet) => `À ${an}, depuis info@ses-academy.org${beantwortet ? ". Cet e-mail a déjà reçu une réponse." : "."}`,
    antwort: "Réponse",
    signatur: (vorname) => `\n\nBien cordialement\n${vorname}\nSES Academy`,
    zitat: "L’e-mail d’origine est joint en citation en dessous.",
    senden: "Envoyer la réponse",
    mb: "Mo", kb: "Ko",
  },
};

const adresse = (a: Adresse) => (a.name ? `${a.name} <${a.adresse}>` : a.adresse);

function groesse(bytes: number, t: typeof de): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} ${t.mb}` : `${Math.max(1, Math.round(bytes / 1024))} ${t.kb}`;
}

/**
 * HTML einer fremden Mail abgeschottet anzeigen: im iframe ohne Skripte (sandbox) und mit eigener CSP – keine Skripte,
 * keine nachgeladenen Inhalte (Zählpixel), nur eingebettete Bilder (data:). Links öffnen in einem neuen Tab.
 */
function htmlDokument(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8">`
    + `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:">`
    + `<base target="_blank"><style>body{margin:16px;font:15px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#13201a;background:#fffdf8;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{max-width:100%}</style>`
    + `</head><body>${html}</body></html>`;
}

/** Eine Mail aus dem Postfach, mit Anhängen und Antwortfeld (Antwort als info@ses-academy.org). */
export default async function PostfachMail({ params, searchParams }: PageProps<"/team/postfach/[ordner]/[uid]">) {
  const staff = await requireStaff("orga");
  const l = staff.sprache;
  const t = T[l];
  const { ordner, uid: uidText } = await params;
  const { hinweis } = await searchParams;
  const uid = Number(uidText);
  if (!istOrdner(ordner) || !Number.isInteger(uid) || uid <= 0) notFound();
  const mail = await postfachMail(ordner, uid).catch(() => undefined);
  const ordnerName = ordnerNamen[l][ordner];
  const zurueck = ordner === "eingang" ? "/team/postfach/" : `/team/postfach/?ordner=${ordner}`;
  const empfaenger = mail ? mail.antwortAn[0] ?? mail.von : null;
  const vorname = staff.name.split(" ")[0];
  const datum = mail?.datum ? new Intl.DateTimeFormat(teamLocale[l], { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(mail.datum)) : "";

  return (
    <>
      <TeamKopf staff={staff} aktiv="postfach" />
      <main lang={l} className="mx-auto max-w-4xl px-4 py-8">
        <Link href={zurueck} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden /> {ordnerName}
        </Link>
        <Hinweis code={hinweis} texte={t.hinweise} />

        {mail === undefined ? (
          <p role="alert" className="mt-6 rounded-2xl bg-amber-100 p-4 text-amber-950">{t.nichtErreichbar}</p>
        ) : mail === null ? (
          <p className="karte mt-6">{t.weg}</p>
        ) : (
          <>
            <h1 className="font-display mt-4 text-3xl leading-tight font-bold [overflow-wrap:anywhere]">{mail.betreff || t.ohneBetreff}</h1>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm [overflow-wrap:anywhere]">
              <dt className="text-ink-soft">{t.von}</dt><dd className="font-semibold">{mail.von ? adresse(mail.von) : t.unbekannt}</dd>
              <dt className="text-ink-soft">{t.an}</dt><dd>{mail.an.map(adresse).join(", ")}</dd>
              {mail.cc.length > 0 && (<><dt className="text-ink-soft">{t.cc}</dt><dd>{mail.cc.map(adresse).join(", ")}</dd></>)}
              {datum && (<><dt className="text-ink-soft">{t.datum}</dt><dd>{datum}</dd></>)}
            </dl>

            {mail.anhaenge.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2">
                {mail.anhaenge.map((a) => (
                  <li key={a.nr}>
                    <a href={`/team/postfach/${ordner}/${uid}/anhang/${a.nr}/`} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-weiss px-3 py-1.5 text-sm font-semibold ring-1 ring-line hover:bg-paper-deep">
                      <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{a.name}</span>
                      <span className="font-normal text-ink-soft">{groesse(a.groesse, t)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-6 overflow-hidden rounded-3xl bg-weiss ring-1 ring-ink/[0.06]">
              {mail.html ? (
                <iframe title={t.inhalt} sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer"
                  srcDoc={htmlDokument(mail.html)} className="block h-[65vh] min-h-80 w-full" />
              ) : (
                <pre className="p-5 font-sans text-[15px] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">{mail.text || t.keinText}</pre>
              )}
            </div>
            {mail.html && mail.text && (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-semibold text-ink-soft">{t.alsText}</summary>
                <pre className="karte mt-2 font-sans whitespace-pre-wrap [overflow-wrap:anywhere]">{mail.text}</pre>
              </details>
            )}
            {mail.html && <p className="mt-2 text-xs text-ink-soft">{t.bilder}</p>}

            {ordner !== "gesendet" && empfaenger && (
              <section id="antwort" className="karte mt-8">
                <h2 className="font-display text-xl font-bold">{t.antworten}</h2>
                <p className="mt-1 text-sm text-ink-soft">{t.antwortAn(adresse(empfaenger), mail.beantwortet)}</p>
                <form action={postfachAntworten} className="mt-4 grid gap-3">
                  <input type="hidden" name="ordner" value={ordner} />
                  <input type="hidden" name="uid" value={uid} />
                  <label htmlFor="text" className="sr-only">{t.antwort}</label>
                  <textarea id="text" name="text" rows={10} required maxLength={20000} className="feld leading-relaxed"
                    defaultValue={t.signatur(vorname)} />
                  <p className="text-xs text-ink-soft">{t.zitat}</p>
                  <button type="submit" className="knopf justify-self-start">{t.senden}</button>
                </form>
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
