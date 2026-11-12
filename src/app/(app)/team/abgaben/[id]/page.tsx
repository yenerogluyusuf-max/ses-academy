import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Rueckfrage } from "@/components/team/Rueckfrage";
import { TeamKopf } from "@/components/team/TeamKopf";
import { Rueckmeldung, Titel } from "@/components/team/Ui";
import { requireStaff } from "@/lib/auth";
import { abgabeLoeschen, abgabeSpeichern, bewertungSpeichern, personEntfernen, personZuordnen } from "@/lib/aktionen/hausaufgaben";
import { auswerten, kriterien, skala, zusammenfassen, type KriteriumFeld } from "@/lib/bewertung";
import { createClient } from "@/lib/supabase/server";
import { teamLocale, type TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";

export const metadata: Metadata = { title: "Abgabe bewerten | SES Academy" };

type Kriterium = { name: string; hinweis: string };

const de = {
  aufgabe: (nr: number) => `Hausaufgabe ${nr}`,
  deine: "Deine Bewertung",
  uebernehmen: "Bewertung aus dem Bogen übernehmen",
  bewerten: "Bewerten",
  skalaText: "Pro Kriterium 1–5 Punkte:",
  /** Kriterien, Skala und Gesamturteil: Deutsch kommt aus lib/bewertung */
  kriterien: null as Record<KriteriumFeld, Kriterium> | null,
  skala: skala,
  urteil: {} as Record<string, string>,
  gut: "Das war besonders gut",
  besser: "Das könnte verbessert werden",
  tipp: "Konkreter Tipp für das nächste Video",
  intern: "Punkte und Feedback bleiben intern; Teilnehmende sehen sie nicht.",
  speichern: "Bewertung speichern",
  personen: "Personen",
  entfernen: "entfernen",
  entfernenJa: "Ja, entfernen",
  entfernenFrage: (name: string | undefined) => `${name ?? "Person"} aus dieser Abgabe entfernen? Die Abgabe zählt dann nicht mehr für sie.`,
  niemand: "Noch niemand zugeordnet.",
  zuordnen: "Person zuordnen",
  hinzufuegen: "Person hinzufügen …",
  zuordnenKnopf: "Zuordnen",
  weitere: "Weitere Bewertungen",
  importName: "Import",
  gutKurz: "Gut:",
  besserKurz: "Verbessern:",
  tippKurz: "Tipp:",
  angaben: "Angaben",
  bezeichnung: "Bezeichnung",
  link: "Link zum Video / Text",
  linkBeispiel: "z. B. Google-Drive-Link",
  dateiname: "Dateiname",
  hinweis: "Hinweis",
  videoOeffnen: "Video öffnen ↗",
  dateiOeffnen: "Hochgeladene Datei öffnen",
  selbst: (zeit: string) => `selbst abgegeben am ${zeit} Uhr`,
  loeschen: "Abgabe löschen …",
  loeschenBestaetigen: "Abgabe samt Bewertung endgültig löschen",
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    aufgabe: (nr) => `Ödev ${nr}`,
    deine: "Senin değerlendirmen",
    uebernehmen: "Formdaki değerlendirmeyi devral",
    bewerten: "Değerlendir",
    skalaText: "Her kriter için 1–5 puan:",
    kriterien: {
      content: { name: "İçerik", hinweis: "Net ana mesaj, konuyla ilgililik, uygun argümanlar ve örnekler" },
      structure: { name: "Kurgu ve yapı", hinweis: "Başarılı giriş, tutarlı akış, mantıklı geçişler, net kapanış" },
      body_language: { name: "Beden dili", hinweis: "Dik duruş, doğal jestler, açık ve kendinden emin bir izlenim" },
      facial_expression: { name: "Mimik ve göz teması", hinweis: "Uygun yüz ifadesi, kameraya ya da dinleyicilere bakış" },
      voice: { name: "Ses ve konuşma tarzı", hinweis: "Ses yüksekliği, vurgu, tempo, net telaffuz ve yerinde duraklamalar" },
      language: { name: "İfade ve dil", hinweis: "Anlaşılır kelime seçimi, net cümleler, az dolgu kelimesi, mümkün olduğunca serbest konuşma" },
      presence: { name: "Duruş ve özgüven", hinweis: "Sakin, samimi, kendinden emin ve ikna edici bir duruş" },
      impact: { name: "Dinleyiciye etkisi", hinweis: "Dikkati canlı tuttu, ilgi uyandırdı, mesajı ikna edici şekilde aktardı" },
      overall: { name: "Genel izlenim", hinweis: "Videonun bütün olarak tutarlılığı ve etkisi" },
    },
    skala: { 5: "çok iyi", 4: "iyi", 3: "yeterli", 2: "geliştirilebilir", 1: "ciddi gelişim gerekiyor" },
    urteil: { "Sehr überzeugend": "Çok ikna edici", "Überzeugend": "İkna edici", "Solide": "Yeterli", "Ausbaufähig": "Geliştirilebilir", "Deutlicher Verbesserungsbedarf": "Ciddi gelişim gerekiyor" },
    gut: "Özellikle iyi olan",
    besser: "Geliştirilebilecek olan",
    tipp: "Bir sonraki video için somut öneri",
    intern: "Puanlar ve geri bildirim ekip içinde kalır; katılımcılar bunları görmez.",
    speichern: "Değerlendirmeyi kaydet",
    personen: "Kişiler",
    entfernen: "çıkar",
    entfernenJa: "Evet, çıkar",
    entfernenFrage: (name) => `${name ?? "Kişi"} bu teslimden çıkarılsın mı? Teslim artık bu kişi için sayılmaz.`,
    niemand: "Henüz kimse atanmadı.",
    zuordnen: "Kişi ata",
    hinzufuegen: "Kişi ekle …",
    zuordnenKnopf: "Ata",
    weitere: "Diğer değerlendirmeler",
    importName: "İçe aktarma",
    gutKurz: "İyi:",
    besserKurz: "Geliştir:",
    tippKurz: "Öneri:",
    angaben: "Bilgiler",
    bezeichnung: "Etiket",
    link: "Video / metin bağlantısı",
    linkBeispiel: "örn. Google Drive bağlantısı",
    dateiname: "Dosya adı",
    hinweis: "Not",
    videoOeffnen: "Videoyu aç ↗",
    dateiOeffnen: "Yüklenen dosyayı aç",
    selbst: (zeit) => `${zeit} tarihinde kendisi teslim etti`,
    loeschen: "Teslimi sil …",
    loeschenBestaetigen: "Teslimi değerlendirmesiyle birlikte kalıcı olarak sil",
  },
  fr: {
    aufgabe: (nr) => `Devoir ${nr}`,
    deine: "Ton évaluation",
    uebernehmen: "Reprendre l’évaluation de la grille",
    bewerten: "Évaluer",
    skalaText: "1 à 5 points par critère\u00a0:",
    kriterien: {
      content: { name: "Contenu", hinweis: "Message principal clair, pertinence, arguments et exemples adaptés" },
      structure: { name: "Construction et structure", hinweis: "Introduction réussie, fil conducteur, transitions logiques, conclusion claire" },
      body_language: { name: "Langage corporel", hinweis: "Posture droite, gestuelle naturelle, attitude ouverte et assurée" },
      facial_expression: { name: "Expressions et regard", hinweis: "Expression du visage adaptée, regard vers la caméra ou le public" },
      voice: { name: "Voix et diction", hinweis: "Volume, intonation, rythme, articulation claire et pauses judicieuses" },
      language: { name: "Expression et langue", hinweis: "Vocabulaire compréhensible, phrases claires, peu de mots de remplissage, discours le plus libre possible" },
      presence: { name: "Présence et assurance", hinweis: "Attitude calme, authentique, sûre de soi et convaincante" },
      impact: { name: "Impact sur le public", hinweis: "Attention maintenue, intérêt suscité, message transmis de façon convaincante" },
      overall: { name: "Impression générale", hinweis: "Cohérence et impact de la vidéo dans son ensemble" },
    },
    skala: { 5: "très bien", 4: "bien", 3: "solide", 2: "perfectible", 1: "nettement à améliorer" },
    urteil: { "Sehr überzeugend": "Très convaincant", "Überzeugend": "Convaincant", "Solide": "Solide", "Ausbaufähig": "Perfectible", "Deutlicher Verbesserungsbedarf": "Nettement à améliorer" },
    gut: "Ce qui était particulièrement réussi",
    besser: "Ce qui pourrait être amélioré",
    tipp: "Conseil concret pour la prochaine vidéo",
    intern: "Les points et les retours restent internes\u00a0; les participants ne les voient pas.",
    speichern: "Enregistrer l’évaluation",
    personen: "Personnes",
    entfernen: "retirer",
    entfernenJa: "Oui, retirer",
    entfernenFrage: (name) => `Retirer ${name ?? "cette personne"} de ce rendu\u00a0? Le rendu ne comptera plus pour elle.`,
    niemand: "Personne n’est encore associé.",
    zuordnen: "Associer une personne",
    hinzufuegen: "Ajouter une personne…",
    zuordnenKnopf: "Associer",
    weitere: "Autres évaluations",
    importName: "Import",
    gutKurz: "Réussi\u00a0:",
    besserKurz: "À améliorer\u00a0:",
    tippKurz: "Conseil\u00a0:",
    angaben: "Informations",
    bezeichnung: "Intitulé",
    link: "Lien vers la vidéo / le texte",
    linkBeispiel: "p.\u00a0ex. lien Google Drive",
    dateiname: "Nom du fichier",
    hinweis: "Remarque",
    videoOeffnen: "Ouvrir la vidéo ↗",
    dateiOeffnen: "Ouvrir le fichier envoyé",
    selbst: (zeit) => `rendu par la personne le ${zeit}`,
    loeschen: "Supprimer le rendu…",
    loeschenBestaetigen: "Supprimer définitivement le rendu et son évaluation",
  },
};

type R = Partial<Record<KriteriumFeld, number | null>> & { id: string; reviewer_id: string | null; reviewer_name: string | null; strengths: string | null; improvements: string | null; tip: string | null; reviewed_on: string | null };

export default async function Abgabe({ params, searchParams }: PageProps<"/team/abgaben/[id]">) {
  const staff = await requireStaff("orga");
  const l = staff.sprache;
  const t = T[l];
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: a }, { data: verzeichnis }] = await Promise.all([
    supabase.from("submissions").select("*, assignments(id,number,title), submission_participants(participant_id), reviews(*)").eq("id", id).maybeSingle(),
    supabase.rpc("get_participant_directory"),
  ]);
  if (!a) notFound();
  const h = a.assignments as { id: string; number: number; title: string };
  const namen = new Map((verzeichnis ?? []).map((p) => [p.id, p]));
  const zugeordnet = (a.submission_participants as { participant_id: string }[]).map((x) => ({ id: x.participant_id, ...namen.get(x.participant_id) }));
  const reviews = a.reviews as R[];
  // Eigene Bewertung; ein importierter Bogen ohne Bewerter:in kann übernommen werden
  const meine = reviews.find((r) => r.reviewer_id === staff.userId) ?? (reviews.length === 1 && !reviews[0].reviewer_id ? reviews[0] : undefined);
  const andere = reviews.filter((r) => r !== meine);
  const gesamt = zusammenfassen(reviews);

  return (
    <>
      <TeamKopf staff={staff} aktiv="hausaufgaben" breit />
      <main lang={l} className="mx-auto max-w-7xl px-4 py-10">
        <Link href={`/team/hausaufgaben/${h.id}/`} className="text-sm font-semibold text-ink-soft hover:text-ink">← {t.aufgabe(h.number)}: {h.title}</Link>
        <Titel kicker={t.aufgabe(h.number)} aktion={gesamt.durchschnitt != null && <span className="chip bg-gruen-hell px-4 py-2 text-base">Ø {gesamt.durchschnitt} · {gesamt.urteil && (t.urteil[gesamt.urteil] ?? gesamt.urteil)}</span>}>{a.label}</Titel>
        <Rueckmeldung hinweis={sp.hinweis} fehler={sp.fehler} sprache={l} />

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <section className="karte">
            <h2 className="font-display text-2xl font-bold">{meine?.reviewer_id === staff.userId ? t.deine : meine ? t.uebernehmen : t.bewerten}</h2>
            <p className="mt-1 mb-5 text-sm text-ink-soft">{t.skalaText} {Object.entries(t.skala).reverse().map(([k, v]) => `${k} = ${v}`).join(" · ")}</p>
            <form action={bewertungSpeichern} className="space-y-1">
              <input type="hidden" name="submission_id" value={id} />
              {meine && !meine.reviewer_id && <input type="hidden" name="review_id" value={meine.id} />}
              {kriterien.map((k) => ({ ...k, ...t.kriterien?.[k.feld] })).map((k) => (
                <fieldset key={k.feld} className="grid items-center gap-2 border-b border-line py-3 sm:grid-cols-[1fr_auto]">
                  <legend className="sr-only">{k.name}</legend>
                  <div><p className="font-semibold">{k.name}</p><p className="text-xs text-ink-soft">{k.hinweis}</p></div>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <label key={n} className="cursor-pointer">
                        <input type="radio" name={k.feld} value={n} defaultChecked={meine?.[k.feld] === n} className="peer sr-only" />
                        <span title={t.skala[n]} className="flex h-10 w-10 items-center justify-center rounded-full bg-paper font-display font-bold ring-1 ring-line transition peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:ring-2 peer-focus-visible:ring-signal hover:bg-paper-deep">{n}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              <div className="grid gap-3 pt-4">
                <div><label className="etikett" htmlFor="strengths">{t.gut}</label><textarea id="strengths" name="strengths" rows={2} defaultValue={meine?.strengths ?? ""} className="feld" /></div>
                <div><label className="etikett" htmlFor="improvements">{t.besser}</label><textarea id="improvements" name="improvements" rows={2} defaultValue={meine?.improvements ?? ""} className="feld" /></div>
                <div><label className="etikett" htmlFor="tip">{t.tipp}</label><textarea id="tip" name="tip" rows={2} defaultValue={meine?.tip ?? ""} className="feld" /></div>
                <p className="text-xs text-ink-soft">{t.intern}</p>
                <button className="knopf justify-self-start px-8 py-3">{t.speichern}</button>
              </div>
            </form>
          </section>

          <div className="space-y-6">
            <section className="karte">
              <h2 className="font-display mb-3 text-xl font-bold">{t.personen}</h2>
              {zugeordnet.length ? (
                <ul className="mb-4 space-y-2">
                  {zugeordnet.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{p.display_name ?? "?"}<span className="font-normal text-ink-soft">{p.region ? ` · ${p.region}` : ""}</span></span>
                      <form action={personEntfernen} className="max-w-56">
                        <input type="hidden" name="submission_id" value={id} /><input type="hidden" name="participant_id" value={p.id} />
                        <Rueckfrage knopf={t.entfernen} knopfKlasse="text-xs text-rot hover:underline" gefahr ja={t.entfernenJa} frage={t.entfernenFrage(p.display_name ?? undefined)} sprache={l} />
                      </form>
                    </li>
                  ))}
                </ul>
              ) : <p className="mb-4 rounded-xl bg-gelb-hell p-3 text-sm font-semibold">{t.niemand}</p>}
              <form action={personZuordnen} className="flex gap-2">
                <input type="hidden" name="submission_id" value={id} />
                <select name="participant_id" required defaultValue="" className="feld" aria-label={t.zuordnen}>
                  <option value="" disabled>{t.hinzufuegen}</option>
                  {(verzeichnis ?? []).filter((p) => p.active && !zugeordnet.some((z) => z.id === p.id)).map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
                </select>
                <button className="knopf" aria-label={t.zuordnenKnopf}>+</button>
              </form>
            </section>

            {andere.length > 0 && (
              <section className="karte">
                <h2 className="font-display mb-3 text-xl font-bold">{t.weitere}</h2>
                <ul className="space-y-3 text-sm">
                  {andere.map((r) => {
                    const e = auswerten(r);
                    return (
                      <li key={r.id} className="rounded-2xl bg-paper p-3">
                        <p className="font-semibold">{r.reviewer_name ?? t.importName} · Ø {e.durchschnitt ?? "–"} ({e.punkte ?? 0}/45)</p>
                        {r.strengths && <p className="mt-1"><strong>{t.gutKurz}</strong> {r.strengths}</p>}
                        {r.improvements && <p><strong>{t.besserKurz}</strong> {r.improvements}</p>}
                        {r.tip && <p><strong>{t.tippKurz}</strong> {r.tip}</p>}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <section className="karte">
              <h2 className="font-display mb-3 text-xl font-bold">{t.angaben}</h2>
              <form action={abgabeSpeichern} className="space-y-3">
                <input type="hidden" name="id" value={id} />
                <div><label className="etikett" htmlFor="label">{t.bezeichnung}</label><input id="label" name="label" defaultValue={a.label} className="feld" /></div>
                <div><label className="etikett" htmlFor="link">{t.link}</label><input id="link" name="link" type="url" defaultValue={a.link ?? ""} className="feld" placeholder={t.linkBeispiel} /></div>
                <div><label className="etikett" htmlFor="file_name">{t.dateiname}</label><input id="file_name" name="file_name" defaultValue={a.file_name ?? ""} className="feld" /></div>
                <div><label className="etikett" htmlFor="note">{t.hinweis}</label><input id="note" name="note" defaultValue={a.note ?? ""} className="feld" /></div>
                <div className="flex flex-wrap items-center gap-3">
                  <button className="knopf-hell">{teamTexte[l].wort.speichern}</button>
                  {a.link && <a href={a.link} target="_blank" rel="noopener noreferrer" className="link text-sm">{t.videoOeffnen}</a>}
                  {a.storage_path && <a href={`/team/abgaben/${a.id}/datei/`} target="_blank" rel="noopener" className="link text-sm">{t.dateiOeffnen}{a.size_bytes ? ` (${Math.round(a.size_bytes / 1048576 * 10) / 10} MB)` : ""}</a>}
                  {a.source === "self" && a.submitted_at && <span className="text-sm text-ink-soft">{t.selbst(new Intl.DateTimeFormat(teamLocale[l], { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(a.submitted_at)))}</span>}
                </div>
              </form>
              <details className="mt-4 border-t border-line pt-4">
                <summary className="cursor-pointer text-sm text-rot">{t.loeschen}</summary>
                <form action={abgabeLoeschen} className="mt-2 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={id} />
                  <label className="flex gap-2 text-sm"><input type="checkbox" name="bestaetigt" value="ja" required /> {t.loeschenBestaetigen}</label>
                  <button className="rounded-full bg-red-800 px-4 py-1.5 text-sm font-semibold text-white">{teamTexte[l].wort.loeschen}</button>
                </form>
              </details>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
