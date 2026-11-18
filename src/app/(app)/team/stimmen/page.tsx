import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Hinweis } from "@/components/team/Hinweis";
import { Rueckfrage } from "@/components/team/Rueckfrage";
import { TeamKopf } from "@/components/team/TeamKopf";
import { beitragNichtUebernehmen, beitragVeroeffentlichen, beitragZurueckstellen } from "@/lib/aktionen/beitraege";
import { requireStaff } from "@/lib/auth";
import { beitraege as festeBeitraege } from "@/i18n/stimmen";
import { createClient } from "@/lib/supabase/server";
import { teamLocale, type TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";

export const metadata: Metadata = { title: "Stimmen | SES Academy" };

const de = {
  intro: "Unter „Stimmen“ auf ses-academy.org stehen Beiträge, die das Team eingetragen hat, und Beiträge, die Teilnehmende selbst in „Mein Bereich“ einreichen. Eingereichte prüft ihr hier; erst nach „Veröffentlichen“ stehen sie auf der Website. Stil und Meinung bleiben die der Person – nur behutsam kürzen oder korrigieren.",
  hinweise: {
    veroeffentlicht: { text: "Veröffentlicht. Der Beitrag steht jetzt unter „Stimmen“.", gut: true },
    nicht_uebernommen: { text: "Gespeichert: nicht übernommen. Die Person sieht das (und deine Rückmeldung) in „Mein Bereich“.", gut: true },
    zurueckgestellt: { text: "Zurück in „Wartet auf Prüfung“.", gut: true },
    eingabe: { text: "Bitte Titel (höchstens 200 Zeichen) und Text (mindestens 40 Zeichen) prüfen.", gut: false },
    einwilligung: { text: "Ohne Einwilligung kann der Beitrag nicht veröffentlicht werden.", gut: false },
    fehler: { text: "Das hat nicht geklappt.", gut: false },
  } as Record<string, { text: string; gut: boolean }>,
  warten: (n: number) => `Wartet auf Prüfung (${n})`,
  nichtsOffen: "Nichts offen.",
  online: (n: number) => `Auf der Website (${n})`,
  keineOnline: "Noch nichts veröffentlicht.",
  abgelehnt: (n: number) => `Nicht übernommen (${n})`,
  arten: { kommentar: "Kommentar", video: "Video", grafik: "Grafik", podcast: "Podcast", rede: "Rede", artikel: "Artikel" } as Record<string, string>,
  sprachen: { de: "Deutsch", tr: "Türkisch", en: "Englisch", fr: "Französisch", nl: "Niederländisch" } as Record<string, string>,
  eingereicht: (wann: string) => `eingereicht am ${wann}`,
  erscheintAls: "erscheint als",
  titel: "Titel",
  text: "Text auf der Website",
  medium: "Medium bzw. Anlass",
  veroeffentlichen: "Veröffentlichen",
  nichtUebernehmen: "Nicht übernehmen …",
  notiz: "Rückmeldung an die Person (optional)",
  notizBeispiel: "z. B. Danke! Passt thematisch nicht zur Academy, weil …",
  speichern: "Nicht übernehmen",
  ansehen: "Auf der Website ansehen",
  vonWebsite: "Von der Website nehmen",
  vonWebsiteFrage: "Den Beitrag von der Website nehmen? Er wartet dann wieder auf Prüfung.",
  vonWebsiteJa: "Ja, von der Website nehmen",
  zurueckholen: "Erneut prüfen",
  original: "Original öffnen",
  vomTeam: "vom Team eingetragen",
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    intro: "ses-academy.org'daki „Sesler“ bölümünde ekibin eklediği katkılar ve katılımcıların „Benim alanım“dan kendilerinin gönderdiği katkılar yer alır. Gönderilenleri burada incelersiniz; ancak „Yayınla“dan sonra web sitesinde görünür. Üslup ve görüş kişiye aittir – yalnızca dikkatle kısaltın veya düzeltin.",
    hinweise: {
      veroeffentlicht: { text: "Yayınlandı. Katkı artık „Sesler“ bölümünde.", gut: true },
      nicht_uebernommen: { text: "Kaydedildi: yayınlanmadı. Kişi bunu (ve notunu) „Benim alanım“da görür.", gut: true },
      zurueckgestellt: { text: "Tekrar „İnceleme bekliyor“ bölümünde.", gut: true },
      eingabe: { text: "Lütfen başlığı (en fazla 200 karakter) ve metni (en az 40 karakter) kontrol et.", gut: false },
      einwilligung: { text: "İzin olmadan katkı yayınlanamaz.", gut: false },
      fehler: { text: teamTexte.tr.meldung.fehler, gut: false },
    },
    warten: (n) => `İnceleme bekliyor (${n})`,
    nichtsOffen: "Bekleyen bir şey yok.",
    online: (n) => `Web sitesinde (${n})`,
    keineOnline: "Henüz yayınlanan yok.",
    abgelehnt: (n) => `Yayınlanmadı (${n})`,
    arten: { kommentar: "Yorum", video: "Video", grafik: "Grafik", podcast: "Podcast", rede: "Konuşma", artikel: "Makale" },
    sprachen: { de: "Almanca", tr: "Türkçe", en: "İngilizce", fr: "Fransızca", nl: "Felemenkçe" },
    eingereicht: (wann) => `${wann} tarihinde gönderildi`,
    erscheintAls: "görünen ad",
    titel: "Başlık",
    text: "Web sitesindeki metin",
    medium: "Yayın yeri veya etkinlik",
    veroeffentlichen: "Yayınla",
    nichtUebernehmen: "Yayınlama …",
    notiz: "Kişiye not (isteğe bağlı)",
    notizBeispiel: "ör. Teşekkürler! Konu olarak Akademi'ye uymuyor, çünkü …",
    speichern: "Yayınlama",
    ansehen: "Web sitesinde gör",
    vonWebsite: "Web sitesinden kaldır",
    vonWebsiteFrage: "Katkı web sitesinden kaldırılsın mı? Sonra tekrar inceleme bekler.",
    vonWebsiteJa: "Evet, kaldır",
    zurueckholen: "Tekrar incele",
    original: "Orijinali aç",
    vomTeam: "ekip tarafından eklendi",
  },
  fr: {
    intro: "Dans « Voix » sur ses-academy.org figurent des contributions ajoutées par l’équipe et d’autres que les participants proposent eux-mêmes dans « Mon espace ». Vous examinez ici celles qui sont proposées ; elles n’apparaissent sur le site qu’après « Publier ». Le style et l’opinion restent ceux de la personne – raccourcir ou corriger seulement avec soin.",
    hinweise: {
      veroeffentlicht: { text: "Publié. La contribution est maintenant dans « Voix ».", gut: true },
      nicht_uebernommen: { text: "Enregistré : non retenu. La personne le voit (avec ton retour) dans « Mon espace ».", gut: true },
      zurueckgestellt: { text: "De nouveau dans « En attente d’examen ».", gut: true },
      eingabe: { text: "Merci de vérifier le titre (200 caractères au plus) et le texte (40 caractères au moins).", gut: false },
      einwilligung: { text: "Sans accord, la contribution ne peut pas être publiée.", gut: false },
      fehler: { text: teamTexte.fr.meldung.fehler, gut: false },
    },
    warten: (n) => `En attente d’examen (${n})`,
    nichtsOffen: "Rien en attente.",
    online: (n) => `Sur le site (${n})`,
    keineOnline: "Rien de publié pour l’instant.",
    abgelehnt: (n) => `Non retenu (${n})`,
    arten: { kommentar: "Commentaire", video: "Vidéo", grafik: "Graphique", podcast: "Podcast", rede: "Discours", artikel: "Article" },
    sprachen: { de: "allemand", tr: "turc", en: "anglais", fr: "français", nl: "néerlandais" },
    eingereicht: (wann) => `envoyé le ${wann}`,
    erscheintAls: "apparaît comme",
    titel: "Titre",
    text: "Texte sur le site",
    medium: "Média ou occasion",
    veroeffentlichen: "Publier",
    nichtUebernehmen: "Ne pas retenir …",
    notiz: "Retour à la personne (facultatif)",
    notizBeispiel: "p. ex. Merci ! Le sujet ne correspond pas à l’Academy, parce que …",
    speichern: "Ne pas retenir",
    ansehen: "Voir sur le site",
    vonWebsite: "Retirer du site",
    vonWebsiteFrage: "Retirer la contribution du site ? Elle attendra de nouveau d’être examinée.",
    vonWebsiteJa: "Oui, retirer du site",
    zurueckholen: "Examiner de nouveau",
    original: "Ouvrir l’original",
    vomTeam: "ajouté par l’équipe",
  },
};

/**
 * Prüfung der eingereichten „Stimmen“-Beiträge (16.11.2026). Oben, was wartet – mit Titel und Text zum behutsamen
 * Redigieren direkt im Formular –, darunter, was online steht; „nicht übernommen“ eingeklappt. Nur Admin/Vorstand.
 */
export default async function StimmenPruefen({ searchParams }: PageProps<"/team/stimmen">) {
  const staff = await requireStaff("alles");
  const l = staff.sprache;
  const t = T[l];
  const { hinweis } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("contributions")
    .select("id, participant_id, kind, title, url, outlet, published_on, summary, language, country, author_name, city, status, website_slug, submitted_at, consent_at, review_note, participants(first_name, last_name)")
    .in("status", ["eingereicht", "veroeffentlicht", "nicht_uebernommen"])
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: false });
  const alle = data ?? [];
  const warten = alle.filter((b) => b.status === "eingereicht").reverse(); // älteste zuerst
  const online = alle.filter((b) => b.status === "veroeffentlicht");
  const abgelehnt = alle.filter((b) => b.status === "nicht_uebernommen");
  // „Auf der Website“ = alles, was unter /stimmen/ steht: freigegebene Einreichungen und die vom Team fest eingetragenen
  // Beiträge (src/i18n/stimmen.ts). Nur Einreichungen lassen sich hier von der Website nehmen.
  const aufWebsite = [
    ...online.map((b) => ({ key: b.id, id: b.id as string | null, slug: b.website_slug ?? "", titel: b.title, sprache: b.language, art: b.kind,
      wer: `${b.author_name ?? ""}${b.city ? ` · ${b.city}` : ""}`, datum: b.published_on ?? b.submitted_at })),
    ...festeBeitraege.map((b) => ({ key: b.slug, id: null, slug: b.slug, titel: b.titel, sprache: b.sprache as string | null, art: b.typ as string,
      wer: `${b.autor.name}${b.autor.stadt ? ` · ${b.autor.stadt}` : ""}`, datum: b.datum as string | null })),
  ].sort((a, b) => (b.datum ?? "").localeCompare(a.datum ?? ""));
  const tag = new Intl.DateTimeFormat(teamLocale[l], { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" });
  const datum = (d: string | null) => (d ? tag.format(new Date(d.length === 10 ? `${d}T12:00:00Z` : d)) : "");

  const kopf = (b: (typeof alle)[number]) => (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <p className="text-sm">
        <Link href={`/team/teilnehmende/${b.participant_id}/`} className="font-semibold hover:underline">
          {b.participants ? `${b.participants.first_name} ${b.participants.last_name}` : b.author_name}
        </Link>
        <span className="text-ink-soft"> · {t.erscheintAls} „{b.author_name}{b.city ? ` · ${b.city}` : ""}“</span>
      </p>
      <p className="text-xs text-ink-soft">{t.eingereicht(datum(b.submitted_at))}</p>
    </div>
  );
  const angaben = (b: (typeof alle)[number]) => (
    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
      <span className="chip bg-paper-deep py-0.5">{t.arten[b.kind]}</span>
      {b.language && <span>{t.sprachen[b.language]}</span>}
      {b.published_on && <span>{datum(b.published_on)}</span>}
      {b.url && (
        <a href={b.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-ink underline underline-offset-4">
          {t.original}<ExternalLink aria-hidden className="h-3.5 w-3.5" />
        </a>
      )}
    </p>
  );

  return (
    <>
      <TeamKopf staff={staff} aktiv="stimmen" />
      <main lang={l} className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="font-display text-4xl font-extrabold">{teamTexte[l].bereiche.stimmen}</h1>
        <p className="mt-2 max-w-2xl text-ink-soft">{t.intro}</p>
        <Hinweis code={hinweis} texte={t.hinweise} />

        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-ink-soft uppercase">{t.warten(warten.length)}</h2>
          {warten.length === 0 && <p className="karte text-ink-soft">{t.nichtsOffen}</p>}
          <div className="space-y-4">
            {warten.map((b) => (
              <article key={b.id} className="karte">
                {kopf(b)}
                {angaben(b)}
                <form action={beitragVeroeffentlichen} className="mt-4 grid gap-3">
                  <input type="hidden" name="id" value={b.id} />
                  <div>
                    <label className="etikett" htmlFor={`titel-${b.id}`}>{t.titel}</label>
                    <input id={`titel-${b.id}`} name="titel" required maxLength={200} defaultValue={b.title} lang={b.language ?? undefined} className="feld font-semibold" />
                  </div>
                  <div>
                    <label className="etikett" htmlFor={`text-${b.id}`}>{t.text}</label>
                    <textarea id={`text-${b.id}`} name="text" required minLength={40} maxLength={8000} rows={b.kind === "kommentar" ? 12 : 4} defaultValue={b.summary ?? ""} lang={b.language ?? undefined} className="feld" />
                  </div>
                  <div>
                    <label className="etikett" htmlFor={`medium-${b.id}`}>{t.medium}</label>
                    <input id={`medium-${b.id}`} name="medium" maxLength={120} defaultValue={b.outlet ?? ""} className="feld" />
                  </div>
                  <div><button type="submit" className="knopf">{t.veroeffentlichen}</button></div>
                </form>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-ink-soft underline underline-offset-4">{t.nichtUebernehmen}</summary>
                  <form action={beitragNichtUebernehmen} className="mt-3 grid gap-3">
                    <input type="hidden" name="id" value={b.id} />
                    <div>
                      <label className="etikett" htmlFor={`notiz-${b.id}`}>{t.notiz}</label>
                      <textarea id={`notiz-${b.id}`} name="notiz" rows={2} maxLength={1000} placeholder={t.notizBeispiel} className="feld" />
                    </div>
                    <div><button type="submit" className="knopf-hell">{t.speichern}</button></div>
                  </form>
                </details>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-ink-soft uppercase">{t.online(aufWebsite.length)}</h2>
          {aufWebsite.length === 0 ? <p className="karte text-ink-soft">{t.keineOnline}</p> : (
            <ul className="karte divide-y divide-line py-1">
              {aufWebsite.map((b) => (
                <li key={b.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold" lang={b.sprache ?? undefined}>{b.titel}</p>
                    <p className="text-sm text-ink-soft">
                      {b.wer} · {t.arten[b.art]}{b.datum ? ` · ${datum(b.datum)}` : ""}{b.id ? "" : ` · ${t.vomTeam}`}
                    </p>
                  </div>
                  <div className="ml-auto flex flex-wrap items-center gap-3">
                    <a href={`/stimmen/${b.slug}/`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold underline underline-offset-4">{t.ansehen}</a>
                    {b.id && (
                      <form action={beitragZurueckstellen}>
                        <input type="hidden" name="id" value={b.id} />
                        <Rueckfrage knopf={t.vonWebsite} knopfKlasse="knopf-hell text-sm" gefahr frage={t.vonWebsiteFrage} ja={t.vonWebsiteJa} sprache={l} />
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {abgelehnt.length > 0 && (
          <details className="mt-10 rounded-3xl bg-white/60 ring-1 ring-line">
            <summary className="cursor-pointer px-6 py-4 font-semibold">{t.abgelehnt(abgelehnt.length)}</summary>
            <ul className="divide-y divide-line px-6 pb-4">
              {abgelehnt.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold" lang={b.language ?? undefined}>{b.title}</p>
                    <p className="text-sm text-ink-soft">{b.author_name} · {t.arten[b.kind]}{b.review_note ? ` · „${b.review_note}“` : ""}</p>
                  </div>
                  <form action={beitragZurueckstellen}>
                    <input type="hidden" name="id" value={b.id} />
                    <button type="submit" className="knopf-hell text-sm">{t.zurueckholen}</button>
                  </form>
                </li>
              ))}
            </ul>
          </details>
        )}
      </main>
    </>
  );
}
