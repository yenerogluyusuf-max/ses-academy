import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Hinweis } from "@/components/team/Hinweis";
import { ModulReiter } from "@/components/team/ModulReiter";
import { Rueckfrage } from "@/components/team/Rueckfrage";
import { TeamKopf } from "@/components/team/TeamKopf";
import { einladungEntfernen, gaesteblattSpeichern, referentAnlegen, referentEinladen } from "@/lib/aktionen/modulwerkzeuge";
import { requireStaff } from "@/lib/auth";
import { istToken } from "@/lib/codes";
import { seitenUrl } from "@/lib/mail";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";

export const metadata: Metadata = { title: "Referenten | SES Academy" };

type Status = "idee" | "angefragt" | "zugesagt" | "abgesagt" | "bestaetigt";

const de = {
  hinweise: {
    betrag: { text: "Honorar oder Reisekosten bitte als Betrag eingeben, z. B. 1.250,50. Nichts gespeichert.", gut: false },
    "referent-angelegt": { text: "Im Pool angelegt und für dieses Modul vorgemerkt.", gut: true },
    eingeladen: { text: "Für dieses Modul vorgemerkt.", gut: true },
    "schon-eingeladen": { text: "Diese Person ist mit dieser Rolle schon dabei.", gut: false },
    gespeichert: { text: "Gästeblatt gespeichert.", gut: true },
    entfernt: { text: "Aus dem Modul entfernt (bleibt im Pool).", gut: true },
    eingabe: { text: "Bitte die Angaben prüfen.", gut: false },
    fehler: { text: "Das hat nicht geklappt.", gut: false },
  } as Record<string, { text: string; gut: boolean }>,
  status: { idee: "Idee", angefragt: "angefragt", zugesagt: "zugesagt", abgesagt: "abgesagt", bestaetigt: "bestätigt" } as Record<Status, string>,
  zaehlung: (n: number, status: string) => `${n} ${status}`,
  rollen: { vortrag: "Vortrag", podium: "Podium", laendergruppe: "Ländergruppe", workshop: "Workshop", grusswort: "Grußwort", moderation: "Moderation", diskussion: "Diskussion" } as Record<string, string>,
  niemand: "Noch niemand vorgemerkt.",
  offen: (n: number) => ` · bei ${n} fehlen noch Anreise, Folien oder Kurzprofil`,
  anreiseDa: "Anreise ✓", anreiseFehlt: "Anreise fehlt", folienDa: "Folien ✓", folienFehlen: "Folien fehlen", profilDa: "Profil ✓", profilFehlt: "Profil fehlt",
  thema: "Thema", betreuung: "Betreuung aus dem Team", anreise: "Anreise", anreiseWie: "Anreise wie, Abholung",
  anreiseBeispiel: "z. B. ICE 10:12 Köln Messe/Deutz, Abholung durch …", abreise: "Abreise", technik: "Technik",
  technikBeispiel: "Beamer, Mikrofon, Laptop, Übersetzung", honorar: "Honorar (€)", reisekosten: "Reisekosten (€)",
  folienErhalten: "Folien erhalten", profilErhalten: "Kurzprofil und Foto erhalten", notizen: "Notizen",
  gastLink: "Link für den Gast", gastLinkText: " (Ablauf, Anreise, Hotel; Folien, Foto und Kurzprofil hochladen):", folien: "Folien", foto: "Foto",
  entfernen: "aus diesem Modul entfernen", entfernenJa: "Ja, entfernen",
  entfernenFrage: "Aus diesem Modul entfernen? Das Gästeblatt (Anreise, Hotel, Honorar, Notizen) für dieses Modul geht dabei verloren. Im Referentenpool bleibt die Person.",
  ausPool: "Aus dem Pool vormerken", poolLeer: "Der Pool ist noch leer.", rolle: "Rolle", vormerken: "Vormerken",
  neuePerson: "Neue Person", funktion: "Funktion", funktionBeispiel: "z. B. Politikwissenschaftlerin, Uni Münster",
  themen: "Themen (mit Komma)", sprachen: "Sprachen (mit Komma)", rolleModul: "Rolle in diesem Modul", kurzprofil: "Kurzprofil",
  anlegen: "Anlegen und vormerken",
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    hinweise: {
      betrag: { text: "Ücreti veya yol masraflarını tutar olarak gir, ör. 1.250,50. Hiçbir şey kaydedilmedi.", gut: false },
      "referent-angelegt": { text: "Havuza eklendi ve bu modül için listeye alındı.", gut: true },
      eingeladen: { text: "Bu modül için listeye alındı.", gut: true },
      "schon-eingeladen": { text: "Bu kişi bu rolle zaten listede.", gut: false },
      gespeichert: { text: "Misafir bilgi kartı kaydedildi.", gut: true },
      entfernt: { text: "Modülden çıkarıldı (havuzda kalıyor).", gut: true },
      eingabe: { text: teamTexte.tr.meldung.eingabe, gut: false },
      fehler: { text: teamTexte.tr.meldung.fehler, gut: false },
    },
    status: { idee: "Fikir", angefragt: "Davet edildi", zugesagt: "Kabul etti", abgesagt: "Reddetti", bestaetigt: "Kesinleşti" },
    zaehlung: (n, status) => `${status}: ${n}`,
    rollen: { vortrag: "Konuşma", podium: "Panel", laendergruppe: "Ülke grubu", workshop: "Atölye", grusswort: "Selamlama konuşması", moderation: "Moderasyon", diskussion: "Tartışma" },
    niemand: "Henüz kimse listeye alınmadı.",
    offen: (n) => ` · ${n} kişide geliş bilgisi, sunum ya da kısa profil hâlâ eksik`,
    anreiseDa: "Geliş ✓", anreiseFehlt: "Geliş eksik", folienDa: "Sunum ✓", folienFehlen: "Sunum eksik", profilDa: "Profil ✓", profilFehlt: "Profil eksik",
    thema: "Konu", betreuung: "Ekipten ilgilenen kişi", anreise: "Geliş", anreiseWie: "Nasıl gelecek, karşılama",
    anreiseBeispiel: "ör. ICE 10:12 Köln Messe/Deutz, karşılayan: …", abreise: "Dönüş", technik: "Teknik",
    technikBeispiel: "Projeksiyon, mikrofon, dizüstü bilgisayar, çeviri", honorar: "Ücret (€)", reisekosten: "Yol masrafları (€)",
    folienErhalten: "Sunum alındı", profilErhalten: "Kısa profil ve fotoğraf alındı", notizen: "Notlar",
    gastLink: "Misafir bağlantısı", gastLinkText: " (akış, geliş, otel; sunum, fotoğraf ve kısa profil yükleme):", folien: "Sunum", foto: "Fotoğraf",
    entfernen: "bu modülden çıkar", entfernenJa: "Evet, çıkar",
    entfernenFrage: "Bu modülden çıkarılsın mı? Bu modüle ait misafir bilgi kartı (geliş, otel, ücret, notlar) silinir. Kişi konuşmacı havuzunda kalır.",
    ausPool: "Havuzdan listeye al", poolLeer: "Havuz henüz boş.", rolle: "Rol", vormerken: "Listeye al",
    neuePerson: "Yeni kişi", funktion: "Görevi", funktionBeispiel: "ör. siyaset bilimci, Münster Üniversitesi",
    themen: "Konular (virgülle)", sprachen: "Diller (virgülle)", rolleModul: "Bu modüldeki rolü", kurzprofil: "Kısa profil",
    anlegen: "Oluştur ve listeye al",
  },
  fr: {
    hinweise: {
      betrag: { text: "Merci de saisir les honoraires ou frais de déplacement sous forme de montant, p. ex. 1\u00a0250,50. Rien n’a été enregistré.", gut: false },
      "referent-angelegt": { text: "Ajouté au vivier et retenu pour ce module.", gut: true },
      eingeladen: { text: "Retenu pour ce module.", gut: true },
      "schon-eingeladen": { text: "Cette personne figure déjà avec ce rôle.", gut: false },
      gespeichert: { text: "Fiche invité enregistrée.", gut: true },
      entfernt: { text: "Retiré du module (reste dans le vivier).", gut: true },
      eingabe: { text: teamTexte.fr.meldung.eingabe, gut: false },
      fehler: { text: teamTexte.fr.meldung.fehler, gut: false },
    },
    status: { idee: "Idée", angefragt: "Sollicité", zugesagt: "Accepté", abgesagt: "Décliné", bestaetigt: "Confirmé" },
    zaehlung: (n, status) => `${status}\u00a0: ${n}`,
    rollen: { vortrag: "Conférence", podium: "Table ronde", laendergruppe: "Groupe pays", workshop: "Atelier", grusswort: "Mot d’accueil", moderation: "Animation", diskussion: "Débat" },
    niemand: "Personne n’est encore retenu.",
    offen: (n) => ` · pour ${n}, il manque encore l’arrivée, les diapos ou la bio`,
    anreiseDa: "Arrivée ✓", anreiseFehlt: "Arrivée manquante", folienDa: "Diapos ✓", folienFehlen: "Diapos manquantes", profilDa: "Bio ✓", profilFehlt: "Bio manquante",
    thema: "Sujet", betreuung: "Accompagnement par l’équipe", anreise: "Arrivée", anreiseWie: "Mode d’arrivée, prise en charge",
    anreiseBeispiel: "p. ex. ICE 10:12 Köln Messe/Deutz, prise en charge par …", abreise: "Départ", technik: "Technique",
    technikBeispiel: "Vidéoprojecteur, micro, ordinateur portable, traduction", honorar: "Honoraires (€)", reisekosten: "Frais de déplacement (€)",
    folienErhalten: "Diapos reçues", profilErhalten: "Bio et photo reçues", notizen: "Notes",
    gastLink: "Lien pour l’invité", gastLinkText: " (déroulé, arrivée, hôtel\u00a0; dépôt des diapos, de la photo et de la bio)\u00a0:", folien: "Diapos", foto: "Photo",
    entfernen: "retirer de ce module", entfernenJa: "Oui, retirer",
    entfernenFrage: "Retirer de ce module\u00a0? La fiche invité (arrivée, hôtel, honoraires, notes) de ce module sera perdue. La personne reste dans le vivier d’intervenants.",
    ausPool: "Retenir depuis le vivier", poolLeer: "Le vivier est encore vide.", rolle: "Rôle", vormerken: "Retenir",
    neuePerson: "Nouvelle personne", funktion: "Fonction", funktionBeispiel: "p. ex. politologue, université de Münster",
    themen: "Sujets (séparés par des virgules)", sprachen: "Langues (séparées par des virgules)", rolleModul: "Rôle dans ce module", kurzprofil: "Bio",
    anlegen: "Créer et retenir",
  },
};

const statusFarbe = { idee: "bg-paper-deep", angefragt: "bg-gelb-hell", zugesagt: "bg-gruen-hell", abgesagt: "bg-rot-hell", bestaetigt: "bg-emerald-200" } as const;
const tagVon = (iso: string | null) => (iso ? new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date(iso)) : "");
// Wert für <input type="time"> (immer HH:MM, daher fest de-DE)
const uhrVon = (iso: string | null) => (iso ? new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(new Date(iso)) : "");

/** Referenten eines Moduls mit Status und Gästeblatt; neue Personen kommen in den gemeinsamen Pool. */
export default async function Referenten({ params, searchParams }: PageProps<"/team/module/[id]/referenten">) {
  const staff = await requireStaff("orga");
  const l = staff.sprache;
  const t = T[l];
  const w = teamTexte[l].wort;
  const { id } = await params;
  const { hinweis } = await searchParams;
  if (!istToken(id)) notFound();
  const supabase = await createClient();
  const [{ data: modul }, { data: einladungen }, { data: pool }] = await Promise.all([
    supabase.from("modules").select("id, title").eq("id", id).maybeSingle(),
    supabase.from("module_speakers").select("id, role, topic, status, host_name, arrival_at, arrival_info, departure_at, hotel_info, tech_needs, slides_received, bio_received, fee, travel_costs, notes, slides_path, photo_path, speaker:speakers(id, name, affiliation, email, phone, bio)").eq("module_id", id).order("created_at"),
    supabase.from("speakers").select("id, name, affiliation, topics").order("name"),
  ]);
  if (!modul) notFound();
  const liste = einladungen ?? [];
  // Gast-Links sind für Teamkonten nicht lesbar; nach der Rollenprüfung oben liest der Server sie
  const { data: links } = await createAdminClient().from("module_speakers").select("id, access_token").eq("module_id", id);
  const linkVon = new Map((links ?? []).map((x) => [x.id, seitenUrl(`/gast/${x.access_token}/`)]));
  const zaehlung = (Object.keys(t.status) as Status[]).map((s) => ({ s, n: liste.filter((e) => e.status === s).length })).filter((z) => z.n > 0);
  const offen = liste.filter((e) => (e.status === "zugesagt" || e.status === "bestaetigt") && (!e.slides_received || !e.bio_received || !e.arrival_at));

  return (
    <>
      <TeamKopf staff={staff} aktiv="module" breit />
      <main lang={l} className="mx-auto max-w-7xl px-4 py-8">
        <ModulReiter id={id} titel={modul.title} aktiv="referenten/" />
        <Hinweis code={hinweis} texte={t.hinweise} />
        <p className="mt-2 text-ink-soft">
          {liste.length ? zaehlung.map((z) => t.zaehlung(z.n, t.status[z.s])).join(" · ") : t.niemand}
          {offen.length > 0 && t.offen(offen.length)}
        </p>

        <div className="mt-6 space-y-4">
          {liste.map((e) => (
            <details key={e.id} className="karte">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3">
                <span className="mr-auto">
                  <span className="font-display text-lg font-bold">{e.speaker.name}</span>
                  <span className="block text-sm text-ink-soft">{t.rollen[e.role]}{e.topic ? ` · ${e.topic}` : ""}{e.speaker.affiliation ? ` · ${e.speaker.affiliation}` : ""}</span>
                </span>
                <span className={`chip ${statusFarbe[e.status]}`}>{t.status[e.status]}</span>
                {(e.status === "zugesagt" || e.status === "bestaetigt") && (
                  <span className="text-xs text-ink-soft">{[e.arrival_at ? t.anreiseDa : t.anreiseFehlt, e.slides_received ? t.folienDa : t.folienFehlen, e.bio_received ? t.profilDa : t.profilFehlt].join(" · ")}</span>
                )}
              </summary>
              <form action={gaesteblattSpeichern} className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-4">
                <input type="hidden" name="module_id" value={id} /><input type="hidden" name="id" value={e.id} />
                <div><label className="etikett" htmlFor={`st-${e.id}`}>{w.status}</label>
                  <select id={`st-${e.id}`} name="status" defaultValue={e.status} className="feld">{Object.entries(t.status).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div className="sm:col-span-2"><label className="etikett" htmlFor={`th-${e.id}`}>{t.thema}</label><input id={`th-${e.id}`} name="topic" defaultValue={e.topic} className="feld" /></div>
                <div><label className="etikett" htmlFor={`ho-${e.id}`}>{t.betreuung}</label><input id={`ho-${e.id}`} name="host_name" defaultValue={e.host_name ?? ""} className="feld" /></div>
                <div><label className="etikett" htmlFor={`at-${e.id}`}>{t.anreise}</label><input id={`at-${e.id}`} name="arrival_tag" type="date" defaultValue={tagVon(e.arrival_at)} className="feld" /></div>
                <div><label className="etikett" htmlFor={`az-${e.id}`}>{w.uhrzeit}</label><input id={`az-${e.id}`} name="arrival_zeit" type="time" defaultValue={uhrVon(e.arrival_at)} className="feld" /></div>
                <div className="sm:col-span-2"><label className="etikett" htmlFor={`ai-${e.id}`}>{t.anreiseWie}</label><input id={`ai-${e.id}`} name="arrival_info" defaultValue={e.arrival_info} className="feld" placeholder={t.anreiseBeispiel} /></div>
                <div><label className="etikett" htmlFor={`dt-${e.id}`}>{t.abreise}</label><input id={`dt-${e.id}`} name="departure_tag" type="date" defaultValue={tagVon(e.departure_at)} className="feld" /></div>
                <div><label className="etikett" htmlFor={`dz-${e.id}`}>{w.uhrzeit}</label><input id={`dz-${e.id}`} name="departure_zeit" type="time" defaultValue={uhrVon(e.departure_at)} className="feld" /></div>
                <div className="sm:col-span-2"><label className="etikett" htmlFor={`hi-${e.id}`}>{w.hotel}</label><input id={`hi-${e.id}`} name="hotel_info" defaultValue={e.hotel_info} className="feld" /></div>
                <div className="sm:col-span-2"><label className="etikett" htmlFor={`te-${e.id}`}>{t.technik}</label><input id={`te-${e.id}`} name="tech_needs" defaultValue={e.tech_needs} className="feld" placeholder={t.technikBeispiel} /></div>
                <div><label className="etikett" htmlFor={`fe-${e.id}`}>{t.honorar}</label><input id={`fe-${e.id}`} name="fee" inputMode="decimal" defaultValue={e.fee ?? ""} className="feld" /></div>
                <div><label className="etikett" htmlFor={`tc-${e.id}`}>{t.reisekosten}</label><input id={`tc-${e.id}`} name="travel_costs" inputMode="decimal" defaultValue={e.travel_costs ?? ""} className="feld" /></div>
                <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="slides_received" defaultChecked={e.slides_received} /> {t.folienErhalten}</label>
                <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="bio_received" defaultChecked={e.bio_received} /> {t.profilErhalten}</label>
                <div className="sm:col-span-2"><label className="etikett" htmlFor={`no-${e.id}`}>{t.notizen}</label><input id={`no-${e.id}`} name="notes" defaultValue={e.notes} className="feld" /></div>
                <p className="text-sm text-ink-soft sm:col-span-4">{[e.speaker.email, e.speaker.phone].filter(Boolean).join(" · ")}</p>
                {(e.status === "zugesagt" || e.status === "bestaetigt") && (
                  <p className="text-sm sm:col-span-4">
                    <span className="font-semibold">{t.gastLink}</span>{t.gastLinkText}{" "}
                    <span className="break-all font-mono text-xs">{linkVon.get(e.id)}</span>
                    {e.slides_path && <> · <a href={`/team/referenten/${e.id}/datei/?art=folien`} target="_blank" rel="noopener" className="link">{t.folien}</a></>}
                    {e.photo_path && <> · <a href={`/team/referenten/${e.id}/datei/?art=foto`} target="_blank" rel="noopener" className="link">{t.foto}</a></>}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 sm:col-span-4">
                  <button type="submit" className="knopf">{w.speichern}</button>
                </div>
              </form>
              <form action={einladungEntfernen} className="mt-2 flex flex-wrap">
                <input type="hidden" name="module_id" value={id} /><input type="hidden" name="id" value={e.id} />
                <Rueckfrage knopf={t.entfernen} knopfKlasse="text-sm font-semibold text-ink-soft underline" gefahr ja={t.entfernenJa} sprache={l}
                  frage={t.entfernenFrage} />
              </form>
            </details>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="karte">
            <h2 className="font-display text-xl font-bold">{t.ausPool}</h2>
            {(pool ?? []).length === 0 ? <p className="mt-2 text-ink-soft">{t.poolLeer}</p> : (
              <form action={referentEinladen} className="mt-4 grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="module_id" value={id} />
                <div className="sm:col-span-2"><label className="etikett" htmlFor="speaker_id">{w.person}</label>
                  <select id="speaker_id" name="speaker_id" className="feld">{(pool ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}{p.affiliation ? ` · ${p.affiliation}` : ""}{p.topics.length ? ` (${p.topics.join(", ")})` : ""}</option>)}</select></div>
                <div><label className="etikett" htmlFor="role">{t.rolle}</label><select id="role" name="role" className="feld">{Object.entries(t.rollen).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div><label className="etikett" htmlFor="topic">{t.thema}</label><input id="topic" name="topic" className="feld" /></div>
                <div className="sm:col-span-2"><button type="submit" className="knopf-hell">{t.vormerken}</button></div>
              </form>
            )}
          </section>
          <section className="karte">
            <h2 className="font-display text-xl font-bold">{t.neuePerson}</h2>
            <form action={referentAnlegen} className="mt-4 grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="module_id" value={id} />
              <div><label className="etikett" htmlFor="n-name">{w.name}</label><input id="n-name" name="name" required className="feld" /></div>
              <div><label className="etikett" htmlFor="n-aff">{t.funktion}</label><input id="n-aff" name="affiliation" className="feld" placeholder={t.funktionBeispiel} /></div>
              <div><label className="etikett" htmlFor="n-mail">{w.email}</label><input id="n-mail" name="email" type="email" className="feld" /></div>
              <div><label className="etikett" htmlFor="n-tel">{w.telefon}</label><input id="n-tel" name="phone" type="tel" className="feld" /></div>
              <div><label className="etikett" htmlFor="n-top">{t.themen}</label><input id="n-top" name="topics" className="feld" /></div>
              <div><label className="etikett" htmlFor="n-spr">{t.sprachen}</label><input id="n-spr" name="languages" className="feld" /></div>
              <div><label className="etikett" htmlFor="n-role">{t.rolleModul}</label><select id="n-role" name="role" className="feld">{Object.entries(t.rollen).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div><label className="etikett" htmlFor="n-topic">{t.thema}</label><input id="n-topic" name="topic" className="feld" /></div>
              <div className="sm:col-span-2"><label className="etikett" htmlFor="n-bio">{t.kurzprofil}</label><textarea id="n-bio" name="bio" rows={3} className="feld" /></div>
              <div className="sm:col-span-2"><button type="submit" className="knopf">{t.anlegen}</button></div>
            </form>
          </section>
        </div>
      </main>
    </>
  );
}
