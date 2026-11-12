import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DokumentFormular, DokumentListe, TagesordnungKnoepfe } from "@/components/team/Dokumente";
import { Hinweis } from "@/components/team/Hinweis";
import { ModulReiter } from "@/components/team/ModulReiter";
import { Rueckfrage } from "@/components/team/Rueckfrage";
import { TeamKopf } from "@/components/team/TeamKopf";
import { materialAbhaken, materialEntfernen, materialSpeichern, materialUebernehmen } from "@/lib/aktionen/logistik";
import { darf, requireStaff } from "@/lib/auth";
import { istToken } from "@/lib/codes";
import { createClient } from "@/lib/supabase/server";
import type { TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";

export const metadata: Metadata = { title: "Material | SES Academy" };

const de = {
  hinweise: {
    gespeichert: { text: "Abgelegt.", gut: true },
    "zu-gross": { text: "Die Datei ist größer als 100 MB. Bitte als Link ablegen.", gut: false },
    eingabe: { text: "Bitte die Angaben prüfen (Titel bzw. Bezeichnung fehlt).", gut: false },
    material: { text: "Materialliste gespeichert.", gut: true },
    "material-erledigt": { text: "Abgehakt.", gut: true },
    "material-offen": { text: "Wieder offen.", gut: true },
    "material-entfernt": { text: "Aus der Materialliste entfernt.", gut: true },
    fehler: { text: "Das hat nicht geklappt.", gut: false },
  } as Record<string, { text: string; gut: boolean }>,
  uebernommen: (n: string) => `${n} Einträge übernommen.`,
  materialliste: "Materialliste",
  allesErledigt: "alles erledigt",
  offen: (n: number, von: number) => `${n} von ${von} offen`,
  leer: "Was mitgebracht oder besorgt werden muss (Beamer, Namensschilder, Verlängerungskabel …), mit Menge und wer sich kümmert.",
  wiederOeffnen: (label: string) => `„${label}“ wieder öffnen`,
  abhaken: (label: string) => `„${label}“ abhaken`,
  bezeichnung: "Bezeichnung",
  menge: "Menge",
  werKuemmert: "Wer kümmert sich",
  entfernen: "entfernen",
  entfernenJa: "Ja, entfernen",
  entfernenFrage: (label: string) => `„${label}“ aus der Materialliste entfernen?`,
  neuesMaterial: "Neues Material",
  neuesBeispiel: "z. B. Beamer mit HDMI-Kabel",
  uebernehmenAus: "Liste übernehmen aus",
  uebernehmen: "Übernehmen",
  ohneHaken: "Ohne Haken; was es hier schon gibt, kommt nicht doppelt.",
  unterlagen: "Unterlagen",
  medien: "Medien",
  ablegen: "Ablegen",
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    hinweise: {
      gespeichert: { text: "Kaydedildi.", gut: true },
      "zu-gross": { text: "Dosya 100 MB’tan büyük. Lütfen bağlantı olarak ekle.", gut: false },
      eingabe: { text: "Lütfen bilgileri kontrol et (başlık ya da açıklama eksik).", gut: false },
      material: { text: "Malzeme listesi kaydedildi.", gut: true },
      "material-erledigt": { text: "İşaretlendi.", gut: true },
      "material-offen": { text: "Yeniden açık.", gut: true },
      "material-entfernt": { text: "Malzeme listesinden kaldırıldı.", gut: true },
      fehler: { text: teamTexte.tr.meldung.fehler, gut: false },
    },
    uebernommen: (n) => `${n} kalem aktarıldı.`,
    materialliste: "Malzeme listesi",
    allesErledigt: "hepsi tamam",
    offen: (n, von) => `${n} açık (toplam ${von})`,
    leer: "Getirilmesi ya da alınması gerekenler (projeksiyon cihazı, yaka kartları, uzatma kablosu …), miktarı ve kimin ilgilendiğiyle birlikte.",
    wiederOeffnen: (label) => `„${label}“ yeniden aç`,
    abhaken: (label) => `„${label}“ tamamlandı olarak işaretle`,
    bezeichnung: "Açıklama",
    menge: "Miktar",
    werKuemmert: "Kim ilgileniyor",
    entfernen: "kaldır",
    entfernenJa: "Evet, kaldır",
    entfernenFrage: (label) => `„${label}“ malzeme listesinden kaldırılsın mı?`,
    neuesMaterial: "Yeni malzeme",
    neuesBeispiel: "ör. HDMI kablolu projeksiyon cihazı",
    uebernehmenAus: "Listeyi şuradan aktar:",
    uebernehmen: "Aktar",
    ohneHaken: "İşaretler aktarılmaz; burada zaten olanlar iki kez eklenmez.",
    unterlagen: "Belgeler",
    medien: "Medya",
    ablegen: "Ekle",
  },
  fr: {
    hinweise: {
      gespeichert: { text: "Ajouté.", gut: true },
      "zu-gross": { text: "Le fichier dépasse 100 Mo. Merci de l’ajouter sous forme de lien.", gut: false },
      eingabe: { text: "Merci de vérifier les informations (titre ou libellé manquant).", gut: false },
      material: { text: "Liste du matériel enregistrée.", gut: true },
      "material-erledigt": { text: "Coché.", gut: true },
      "material-offen": { text: "De nouveau à faire.", gut: true },
      "material-entfernt": { text: "Retiré de la liste du matériel.", gut: true },
      fehler: { text: teamTexte.fr.meldung.fehler, gut: false },
    },
    uebernommen: (n) => `${n} éléments repris.`,
    materialliste: "Liste du matériel",
    allesErledigt: "tout est fait",
    offen: (n, von) => `${n} sur ${von} à faire`,
    leer: "Ce qu’il faut apporter ou acheter (vidéoprojecteur, badges, rallonges …), avec la quantité et la personne responsable.",
    wiederOeffnen: (label) => `Rouvrir «\u00a0${label}\u00a0»`,
    abhaken: (label) => `Cocher «\u00a0${label}\u00a0»`,
    bezeichnung: "Libellé",
    menge: "Quantité",
    werKuemmert: "Qui s’en occupe",
    entfernen: "supprimer",
    entfernenJa: "Oui, supprimer",
    entfernenFrage: (label) => `Retirer «\u00a0${label}\u00a0» de la liste du matériel\u00a0?`,
    neuesMaterial: "Nouveau matériel",
    neuesBeispiel: "p. ex. vidéoprojecteur avec câble HDMI",
    uebernehmenAus: "Reprendre la liste de",
    uebernehmen: "Reprendre",
    ohneHaken: "Sans les coches\u00a0; ce qui existe déjà ici n’est pas ajouté en double.",
    unterlagen: "Documents",
    medien: "Médias",
    ablegen: "Ajouter",
  },
};

/**
 * Reiter „Material“: Materialliste zum Abhaken (was mitgebracht oder besorgt werden muss), Unterlagen fürs Modul
 * (Folien, Reader) und Medien (Fotos, Videos, Presse).
 */
export default async function Material({ params, searchParams }: PageProps<"/team/module/[id]/material">) {
  const staff = await requireStaff("orga");
  const l = staff.sprache;
  const t = T[l];
  const w = teamTexte[l].wort;
  const { id } = await params;
  const { hinweis } = await searchParams;
  if (!istToken(id)) notFound();
  const supabase = await createClient();
  const [{ data: modul }, { data: dokumente }, { data: materialliste }, { data: andere }] = await Promise.all([
    supabase.from("modules").select("id, title").eq("id", id).maybeSingle(),
    supabase.from("documents").select("id, title, kind, status, commission, tags, link, current_version, updated_at").eq("module_id", id).order("updated_at", { ascending: false }),
    supabase.from("module_materials").select("*").eq("module_id", id).order("created_at"),
    supabase.from("module_materials").select("module_id, modules(title)").neq("module_id", id),
  ]);
  if (!modul) notFound();
  const material = (dokumente ?? []).filter((d) => d.kind !== "medien");
  const medien = (dokumente ?? []).filter((d) => d.kind === "medien");
  const zurueck = `/team/module/${id}/material/`;
  const hinweisText = typeof hinweis === "string" && hinweis.startsWith("material-uebernommen-") ? t.uebernommen(hinweis.split("-").at(-1) ?? "0") : null;
  const liste = materialliste ?? [];
  const offen = liste.filter((m) => !m.done_at).length;
  const quellen = [...new Map((andere ?? []).map((a) => [a.module_id, a.modules?.title ?? "?"])).entries()];
  return (
    <>
      <TeamKopf staff={staff} aktiv={darf.alles(staff.role) ? "module" : "logistik"} breit />
      <main lang={l} className="mx-auto max-w-6xl px-4 py-8">
        <ModulReiter id={id} titel={modul.title} aktiv="material/" />
        <Hinweis code={hinweis} texte={t.hinweise} />
        {hinweisText && <p role="status" className="mt-4 rounded-2xl bg-emerald-100 p-4 text-emerald-950">{hinweisText}</p>}

        <section id="materialliste" className="karte mt-6 mb-10 scroll-mt-4">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="font-display mr-auto text-xl font-bold">{t.materialliste}</h2>
            {liste.length > 0 && <span className="text-sm text-ink-soft">{offen === 0 ? t.allesErledigt : t.offen(offen, liste.length)}</span>}
          </div>
          {liste.length === 0 && <p className="mt-2 text-sm text-ink-soft">{t.leer}</p>}
          <ul className="mt-3 divide-y divide-line">
            {liste.map((m) => (
              <li key={m.id} id={`m-${m.id}`} className="flex scroll-mt-4 items-start gap-3 py-2.5">
                <form action={materialAbhaken}>
                  <input type="hidden" name="module_id" value={id} /><input type="hidden" name="id" value={m.id} /><input type="hidden" name="erledigt" value={m.done_at ? "0" : "1"} />
                  <button type="submit" aria-label={m.done_at ? t.wiederOeffnen(m.label) : t.abhaken(m.label)}
                    className={`flex h-7 w-7 items-center justify-center rounded-full ring-2 ${m.done_at ? "bg-ink text-paper ring-ink" : "ring-line"}`}>{m.done_at ? "✓" : ""}</button>
                </form>
                <details className="min-w-0 flex-1">
                  <summary className="cursor-pointer list-none">
                    <span className={`font-semibold ${m.done_at ? "text-ink-soft line-through" : ""}`}>{m.label}</span>
                    {m.quantity && <span className="ml-1.5 text-sm text-ink-soft">· {m.quantity}</span>}
                    {m.responsible && <span className="chip ml-1.5 bg-paper-deep">{m.responsible}</span>}
                    {m.note && <span className="block text-sm text-ink-soft">{m.note}</span>}
                  </summary>
                  <form action={materialSpeichern} className="mt-2 grid gap-2 sm:grid-cols-4">
                    <input type="hidden" name="module_id" value={id} /><input type="hidden" name="id" value={m.id} />
                    <input name="label" defaultValue={m.label} required maxLength={200} className="feld sm:col-span-2" aria-label={t.bezeichnung} />
                    <input name="quantity" defaultValue={m.quantity} maxLength={50} className="feld" aria-label={t.menge} placeholder={t.menge} />
                    <input name="responsible" defaultValue={m.responsible} maxLength={100} className="feld" aria-label={t.werKuemmert} placeholder={t.werKuemmert} />
                    <input name="note" defaultValue={m.note} maxLength={500} className="feld sm:col-span-3" aria-label={w.notiz} placeholder={w.notiz} />
                    <button type="submit" className="knopf-hell">{w.speichern}</button>
                  </form>
                  <form action={materialEntfernen} className="mt-1 flex flex-wrap">
                    <input type="hidden" name="module_id" value={id} /><input type="hidden" name="id" value={m.id} />
                    <Rueckfrage sprache={l} knopf={t.entfernen} knopfKlasse="text-xs font-semibold text-ink-soft underline" gefahr ja={t.entfernenJa} frage={t.entfernenFrage(m.label)} />
                  </form>
                </details>
              </li>
            ))}
          </ul>
          <form action={materialSpeichern} className="mt-3 grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
            <input type="hidden" name="module_id" value={id} />
            <input name="label" required maxLength={200} className="feld" aria-label={t.neuesMaterial} placeholder={t.neuesBeispiel} />
            <input name="quantity" maxLength={50} className="feld" aria-label={t.menge} placeholder={t.menge} />
            <input name="responsible" maxLength={100} className="feld" aria-label={t.werKuemmert} placeholder={t.werKuemmert} />
            <button type="submit" className="knopf">{w.hinzufuegen}</button>
          </form>
          {quellen.length > 0 && (
            <form action={materialUebernehmen} className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <input type="hidden" name="module_id" value={id} />
              <label htmlFor="von" className="text-ink-soft">{t.uebernehmenAus}</label>
              <select id="von" name="von" className="feld !w-auto !py-1.5">{quellen.map(([mid, titel]) => <option key={mid} value={mid}>{titel}</option>)}</select>
              <button type="submit" className="knopf-hell !py-1.5">{t.uebernehmen}</button>
              <span className="w-full text-xs text-ink-soft">{t.ohneHaken}</span>
            </form>
          )}
        </section>
        <TagesordnungKnoepfe dokumente={material} sprache={l} />
        <h2 className="font-display mt-2 mb-3 text-xl font-bold">{t.unterlagen}</h2>
        <DokumentListe dokumente={material} ohneModul sprache={l} />
        <h2 className="font-display mt-8 mb-3 text-xl font-bold">{t.medien}</h2>
        <DokumentListe dokumente={medien} ohneModul sprache={l} />
        <h2 className="font-display mt-10 mb-3 text-xl font-bold">{t.ablegen}</h2>
        <DokumentFormular zurueck={zurueck} modulId={id} art="material" sprache={l} />
      </main>
    </>
  );
}
