import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Paperclip } from "lucide-react";
import { Hinweis } from "@/components/team/Hinweis";
import { TeamKopf } from "@/components/team/TeamKopf";
import { postfachAntworten } from "@/lib/aktionen/postfach";
import { requireStaff } from "@/lib/auth";
import { istOrdner, ordnerListe, postfachMail, type Adresse } from "@/lib/postfach";

export const metadata: Metadata = { title: "Postfach | SES Academy", referrer: "no-referrer" };

const hinweise: Record<string, { text: string; gut: boolean }> = {
  gesendet: { text: "Antwort verschickt. Eine Kopie liegt im Ordner „Gesendet“.", gut: true },
  "gesendet-ohne-kopie": { text: "Antwort verschickt. Die Kopie in „Gesendet“ ließ sich nicht ablegen.", gut: true },
  leer: { text: "Bitte einen Text eingeben.", gut: false },
  "zu-lang": { text: "Der Text ist zu lang.", gut: false },
  "keine-adresse": { text: "Diese Mail hat keine Absenderadresse, auf die man antworten kann.", gut: false },
  "nicht-erreichbar": { text: "Das Postfach war gerade nicht erreichbar. Die Antwort ist NICHT verschickt.", gut: false },
  fehler: { text: "Der Versand hat nicht geklappt. Die Antwort ist NICHT verschickt.", gut: false },
};

const adresse = (a: Adresse) => (a.name ? `${a.name} <${a.adresse}>` : a.adresse);

function groesse(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
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
  const { ordner, uid: uidText } = await params;
  const { hinweis } = await searchParams;
  const uid = Number(uidText);
  if (!istOrdner(ordner) || !Number.isInteger(uid) || uid <= 0) notFound();
  const mail = await postfachMail(ordner, uid).catch(() => undefined);
  const ordnerName = ordnerListe.find((o) => o.id === ordner)!.name;
  const zurueck = ordner === "eingang" ? "/team/postfach/" : `/team/postfach/?ordner=${ordner}`;
  const empfaenger = mail ? mail.antwortAn[0] ?? mail.von : null;
  const vorname = staff.name.split(" ")[0];
  const datum = mail?.datum ? new Intl.DateTimeFormat("de-DE", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(mail.datum)) : "";

  return (
    <>
      <TeamKopf staff={staff} aktiv="postfach" />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Link href={zurueck} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden /> {ordnerName}
        </Link>
        <Hinweis code={hinweis} texte={hinweise} />

        {mail === undefined ? (
          <p role="alert" className="mt-6 rounded-2xl bg-amber-100 p-4 text-amber-950">Das Postfach ist gerade nicht erreichbar. Bitte in einer Minute neu laden.</p>
        ) : mail === null ? (
          <p className="karte mt-6">Diese Mail gibt es nicht mehr. Vielleicht wurde sie im Webmail verschoben oder gelöscht.</p>
        ) : (
          <>
            <h1 className="font-display mt-4 text-3xl leading-tight font-bold [overflow-wrap:anywhere]">{mail.betreff || "(ohne Betreff)"}</h1>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm [overflow-wrap:anywhere]">
              <dt className="text-ink-soft">Von</dt><dd className="font-semibold">{mail.von ? adresse(mail.von) : "(unbekannt)"}</dd>
              <dt className="text-ink-soft">An</dt><dd>{mail.an.map(adresse).join(", ")}</dd>
              {mail.cc.length > 0 && (<><dt className="text-ink-soft">Cc</dt><dd>{mail.cc.map(adresse).join(", ")}</dd></>)}
              {datum && (<><dt className="text-ink-soft">Datum</dt><dd>{datum}</dd></>)}
            </dl>

            {mail.anhaenge.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2">
                {mail.anhaenge.map((a) => (
                  <li key={a.nr}>
                    <a href={`/team/postfach/${ordner}/${uid}/anhang/${a.nr}/`} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-weiss px-3 py-1.5 text-sm font-semibold ring-1 ring-line hover:bg-paper-deep">
                      <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{a.name}</span>
                      <span className="font-normal text-ink-soft">{groesse(a.groesse)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-6 overflow-hidden rounded-3xl bg-weiss ring-1 ring-ink/[0.06]">
              {mail.html ? (
                <iframe title="Inhalt der Mail" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer"
                  srcDoc={htmlDokument(mail.html)} className="block h-[65vh] min-h-80 w-full" />
              ) : (
                <pre className="p-5 font-sans text-[15px] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">{mail.text || "(kein Text)"}</pre>
              )}
            </div>
            {mail.html && mail.text && (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-semibold text-ink-soft">Als reinen Text anzeigen</summary>
                <pre className="karte mt-2 font-sans whitespace-pre-wrap [overflow-wrap:anywhere]">{mail.text}</pre>
              </details>
            )}
            {mail.html && <p className="mt-2 text-xs text-ink-soft">Bilder aus dem Internet werden nicht geladen, damit der Absender nicht sieht, wann die Mail gelesen wurde.</p>}

            {ordner !== "gesendet" && empfaenger && (
              <section id="antwort" className="karte mt-8">
                <h2 className="font-display text-xl font-bold">Antworten</h2>
                <p className="mt-1 text-sm text-ink-soft">An {adresse(empfaenger)}, als info@ses-academy.org{mail.beantwortet ? ". Diese Mail wurde schon beantwortet." : "."}</p>
                <form action={postfachAntworten} className="mt-4 grid gap-3">
                  <input type="hidden" name="ordner" value={ordner} />
                  <input type="hidden" name="uid" value={uid} />
                  <label htmlFor="text" className="sr-only">Antwort</label>
                  <textarea id="text" name="text" rows={10} required maxLength={20000} className="feld leading-relaxed"
                    defaultValue={`\n\nViele Grüße\n${vorname}\nSES Academy`} />
                  <p className="text-xs text-ink-soft">Die ursprüngliche Mail wird unten als Zitat angehängt.</p>
                  <button type="submit" className="knopf justify-self-start">Antwort senden</button>
                </form>
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
