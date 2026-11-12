import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Hinweis } from "@/components/team/Hinweis";
import { ModulReiter } from "@/components/team/ModulReiter";
import { Rueckfrage } from "@/components/team/Rueckfrage";
import { TeamKopf } from "@/components/team/TeamKopf";
import { kostenEntfernen, kostenSpeichern } from "@/lib/aktionen/logistik";
import { darf, requireStaff } from "@/lib/auth";
import { istToken } from "@/lib/codes";
import { createClient } from "@/lib/supabase/server";
import { teamLocale, type TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";
import { naechte } from "@/lib/uebernachtung";

export const metadata: Metadata = { title: "Kosten | SES Academy" };

const de = {
  hinweise: {
    kosten: { text: "Posten gespeichert.", gut: true },
    "kosten-entfernt": { text: "Posten entfernt.", gut: true },
    eingabe: { text: "Bitte Bezeichnung und Betrag angeben, z. B. 1.250,50.", gut: false },
    fehler: { text: "Das hat nicht geklappt.", gut: false },
  } as Record<string, { text: string; gut: boolean }>,
  kategorie: { verpflegung: "Verpflegung", raum: "Raum", technik: "Technik", reise: "Reise", material: "Material", sonstiges: "Sonstiges" } as Record<string, string>,
  rolle: { vortrag: "Vortrag", podium: "Podium", laendergruppe: "Ländergruppe", workshop: "Workshop", grusswort: "Grußwort", moderation: "Moderation", diskussion: "Diskussion" } as Record<string, string>,
  summen: { hotel: "Hotel", honorare: "Honorare", reise: "Reisekosten", sonstiges: "Sonstiges", gesamt: "Gesamt" },
  hotel: "Hotel",
  hotelsUnterLogistik: "Hotels und Preise unter Logistik",
  keinHotel: "Noch kein Hotel angelegt.",
  zimmerBelegt: "Zimmer belegt",
  zimmernaechte: "Zimmernächte",
  preis: "Preis je Zimmer und Nacht",
  summe: "Summe",
  vonZimmern: (belegt: number, alle: number) => `${belegt} von ${alle}`,
  preisFehlt: "Preis fehlt",
  geschaetztTitel: "Noch niemand eingeteilt: Kontingent × Nächte × Preis",
  geschaetzt: (zimmer: number | null, naechte: number) => `geschätzt: ${zimmer} Zimmer × ${naechte} Nächte`,
  zimmernaechteErklaerung: "Zimmernächte aus dem Zimmerplan: Jedes belegte Zimmer zählt von der ersten bis zur letzten Nacht seiner Gäste. Ohne Einteilung wird mit dem Kontingent geschätzt.",
  honorareReise: "Honorare und Reisekosten",
  betraegeUnterReferenten: "Beträge unter Referenten",
  keineReferenten: "Noch keine zugesagten Referent:innen.",
  referent: "Referent:in",
  rolleSpalte: "Rolle",
  honorar: "Honorar",
  reisekosten: "Reisekosten",
  sonstigePosten: "Sonstige Posten",
  entfernen: "entfernen",
  entfernenJa: "Ja, entfernen",
  entfernenFrage: (posten: string) => `Posten „${posten}“ entfernen?`,
  bezeichnung: "Bezeichnung",
  bezeichnungBeispiel: "z. B. Mittagessen Samstag",
  art: "Art",
  betrag: "Betrag (€)",
  betragBeispiel: "1.250,50",
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    hinweise: {
      kosten: { text: "Kalem kaydedildi.", gut: true },
      "kosten-entfernt": { text: "Kalem kaldırıldı.", gut: true },
      eingabe: { text: "Lütfen açıklama ve tutar gir, ör. 1.250,50.", gut: false },
      fehler: { text: teamTexte.tr.meldung.fehler, gut: false },
    },
    kategorie: { verpflegung: "Yemek", raum: "Salon", technik: "Teknik", reise: "Yol", material: "Malzeme", sonstiges: "Diğer" },
    rolle: { vortrag: "Konuşma", podium: "Panel", laendergruppe: "Ülke grubu", workshop: "Atölye", grusswort: "Selamlama", moderation: "Moderasyon", diskussion: "Tartışma" },
    summen: { hotel: "Otel", honorare: "Ücretler", reise: "Yol masrafları", sonstiges: "Diğer", gesamt: "Toplam" },
    hotel: "Otel",
    hotelsUnterLogistik: "Oteller ve fiyatlar Lojistik altında",
    keinHotel: "Henüz otel eklenmedi.",
    zimmerBelegt: "Dolu oda",
    zimmernaechte: "Oda-gece",
    preis: "Oda başına gecelik fiyat",
    summe: "Tutar",
    vonZimmern: (belegt, alle) => `${belegt} / ${alle}`,
    preisFehlt: "Fiyat eksik",
    geschaetztTitel: "Henüz kimse yerleştirilmedi: kontenjan × gece × fiyat",
    geschaetzt: (zimmer, naechte) => `tahmini: ${zimmer} oda × ${naechte} gece`,
    zimmernaechteErklaerung: "Oda-geceler oda planından: Her dolu oda, misafirlerinin ilk gecesinden son gecesine kadar sayılır. Yerleştirme yoksa kontenjanla tahmin edilir.",
    honorareReise: "Ücretler ve yol masrafları",
    betraegeUnterReferenten: "Tutarlar Konuşmacılar altında",
    keineReferenten: "Henüz katılımı kesinleşen konuşmacı yok.",
    referent: "Konuşmacı",
    rolleSpalte: "Rol",
    honorar: "Ücret",
    reisekosten: "Yol masrafları",
    sonstigePosten: "Diğer kalemler",
    entfernen: "kaldır",
    entfernenJa: "Evet, kaldır",
    entfernenFrage: (posten) => `„${posten}“ kalemi kaldırılsın mı?`,
    bezeichnung: "Açıklama",
    bezeichnungBeispiel: "ör. cumartesi öğle yemeği",
    art: "Tür",
    betrag: "Tutar (€)",
    betragBeispiel: "1.250,50",
  },
  fr: {
    hinweise: {
      kosten: { text: "Poste enregistré.", gut: true },
      "kosten-entfernt": { text: "Poste supprimé.", gut: true },
      eingabe: { text: "Merci d’indiquer un libellé et un montant, p. ex. 1250,50.", gut: false },
      fehler: { text: teamTexte.fr.meldung.fehler, gut: false },
    },
    kategorie: { verpflegung: "Repas", raum: "Salle", technik: "Technique", reise: "Voyage", material: "Matériel", sonstiges: "Divers" },
    rolle: { vortrag: "Conférence", podium: "Table ronde", laendergruppe: "Groupe par pays", workshop: "Atelier", grusswort: "Mot d’accueil", moderation: "Animation", diskussion: "Discussion" },
    summen: { hotel: "Hôtel", honorare: "Honoraires", reise: "Frais de déplacement", sonstiges: "Divers", gesamt: "Total" },
    hotel: "Hôtel",
    hotelsUnterLogistik: "Hôtels et prix dans Logistique",
    keinHotel: "Aucun hôtel ajouté pour l’instant.",
    zimmerBelegt: "Chambres occupées",
    zimmernaechte: "Nuitées-chambres",
    preis: "Prix par chambre et par nuit",
    summe: "Somme",
    vonZimmern: (belegt, alle) => `${belegt} sur ${alle}`,
    preisFehlt: "Prix manquant",
    geschaetztTitel: "Personne n’est encore réparti\u00a0: contingent × nuits × prix",
    geschaetzt: (zimmer, naechte) => `estimé\u00a0: ${zimmer} chambres × ${naechte} nuits`,
    zimmernaechteErklaerung: "Nuitées-chambres d’après le plan des chambres\u00a0: chaque chambre occupée compte de la première à la dernière nuit de ses occupants. Sans répartition, l’estimation se fait avec le contingent.",
    honorareReise: "Honoraires et frais de déplacement",
    betraegeUnterReferenten: "Montants dans Intervenants",
    keineReferenten: "Pas encore d’intervenants confirmés.",
    referent: "Intervenant·e",
    rolleSpalte: "Rôle",
    honorar: "Honoraires",
    reisekosten: "Frais de déplacement",
    sonstigePosten: "Autres postes",
    entfernen: "supprimer",
    entfernenJa: "Oui, supprimer",
    entfernenFrage: (posten) => `Supprimer le poste «\u00a0${posten}\u00a0»\u00a0?`,
    bezeichnung: "Libellé",
    bezeichnungBeispiel: "p. ex. déjeuner du samedi",
    art: "Catégorie",
    betrag: "Montant (€)",
    betragBeispiel: "1250,50",
  },
};

/**
 * Kostenübersicht eines Moduls (ab Orga-Team): Hotel (Zimmer × Nächte × Preis je Zimmer und Nacht, aus dem Zimmerplan),
 * Honorare und Reisekosten der zugesagten Referent:innen, sonstige Posten. Alles in Euro, ohne Gewähr auf Vollständigkeit:
 * nur was hier und unter Logistik/Referenten eingetragen ist.
 */
export default async function Kosten({ params, searchParams }: PageProps<"/team/module/[id]/kosten">) {
  const staff = await requireStaff("orga");
  const l = staff.sprache;
  const t = T[l];
  const w = teamTexte[l].wort;
  // Wie euro() aus lib/betrag, aber im Zahlenformat der Sprache des Team-Bereichs
  const euroFormat = new Intl.NumberFormat(teamLocale[l], { style: "currency", currency: "EUR" });
  const euro = (n: number) => euroFormat.format(n);
  const { id } = await params;
  const { hinweis } = await searchParams;
  if (!istToken(id)) notFound();
  const supabase = await createClient();
  const [{ data: modul }, { data: hotels }, { data: planung }, { data: referenten }, { data: posten }] = await Promise.all([
    supabase.from("modules").select("id, title, module_days(day)").eq("id", id).maybeSingle(),
    supabase.from("hotels").select("id, name, price_per_night, quota_rooms, rooms(id, label)").eq("module_id", id).order("created_at"),
    supabase.rpc("get_room_planning", { p_module_id: id }),
    supabase.from("module_speakers").select("id, role, status, fee, travel_costs, speakers(name)").eq("module_id", id).in("status", ["zugesagt", "bestaetigt"]),
    supabase.from("module_costs").select("*").eq("module_id", id).order("created_at"),
  ]);
  if (!modul) notFound();
  const modulNaechte = naechte(modul.module_days.map((d) => d.day)).length;

  // Hotel: jedes belegte Zimmer ist von der ersten bis zur letzten Nacht seiner Gäste gebucht (wie die Zimmerliste)
  const hotelZeilen = (hotels ?? []).map((h) => {
    const zimmerNaechte = h.rooms.reduce((summe, z) => {
      const gaeste = (planung ?? []).filter((p) => p.room_id === z.id);
      return summe + new Set(gaeste.flatMap((p) => p.nights)).size;
    }, 0);
    const belegt = h.rooms.filter((z) => (planung ?? []).some((p) => p.room_id === z.id)).length;
    const preis = h.price_per_night === null ? null : Number(h.price_per_night);
    const schaetzung = !zimmerNaechte && h.quota_rooms && preis !== null ? h.quota_rooms * modulNaechte * preis : null;
    return { ...h, belegt, zimmerNaechte, preis, summe: preis !== null ? zimmerNaechte * preis : null, schaetzung };
  });
  const hotelSumme = hotelZeilen.reduce((s, h) => s + (h.summe ?? h.schaetzung ?? 0), 0);
  const honorare = (referenten ?? []).map((r) => ({ ...r, fee: r.fee === null ? null : Number(r.fee), travel: r.travel_costs === null ? null : Number(r.travel_costs) }));
  const honorarSumme = honorare.reduce((s, r) => s + (r.fee ?? 0), 0);
  const reiseSumme = honorare.reduce((s, r) => s + (r.travel ?? 0), 0);
  const sonstiges = (posten ?? []).map((p) => ({ ...p, amount: Number(p.amount) }));
  const sonstigeSumme = sonstiges.reduce((s, p) => s + p.amount, 0);
  const gesamt = hotelSumme + honorarSumme + reiseSumme + sonstigeSumme;

  return (
    <>
      <TeamKopf staff={staff} aktiv={darf.alles(staff.role) ? "module" : "logistik"} breit />
      <main lang={l} className="mx-auto max-w-6xl px-4 py-8">
        <ModulReiter id={id} titel={modul.title} aktiv="kosten/" />
        <Hinweis code={hinweis} texte={t.hinweise} />

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {([["hotel", hotelSumme], ["honorare", honorarSumme], ["reise", reiseSumme], ["sonstiges", sonstigeSumme], ["gesamt", gesamt]] as const).map(([n, wert]) => (
            <div key={n} className={`rounded-3xl p-5 ring-1 ring-line ${n === "gesamt" ? "bg-gelb-hell" : "bg-weiss"}`}>
              <span className="font-display block text-2xl font-extrabold">{euro(wert)}</span>
              <span className="mt-1 block text-sm text-ink-soft">{t.summen[n]}</span>
            </div>
          ))}
        </section>

        <section className="karte relative mt-6 overflow-x-auto">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="font-display mr-auto text-xl font-bold">{t.hotel}</h2>
            <Link href={`/team/module/${id}/hotel/`} className="text-sm font-semibold underline">{t.hotelsUnterLogistik}</Link>
          </div>
          {hotelZeilen.length === 0 ? <p className="mt-3 text-ink-soft">{t.keinHotel}</p> : (
            <table className="tabelle mt-4 min-w-[34rem]">
              <thead><tr><th>{t.hotel}</th><th className="text-right">{t.zimmerBelegt}</th><th className="text-right">{t.zimmernaechte}</th><th className="text-right">{t.preis}</th><th className="text-right">{t.summe}</th></tr></thead>
              <tbody>
                {hotelZeilen.map((h) => (
                  <tr key={h.id}>
                    <td className="font-semibold">{h.name}</td>
                    <td className="text-right">{t.vonZimmern(h.belegt, h.rooms.length)}</td>
                    <td className="text-right">{h.zimmerNaechte}</td>
                    <td className="text-right">{h.preis === null ? <span className="chip bg-gelb-hell">{t.preisFehlt}</span> : euro(h.preis)}</td>
                    <td className="text-right font-semibold">
                      {h.summe !== null && h.zimmerNaechte > 0 ? euro(h.summe)
                        : h.schaetzung !== null ? <span title={t.geschaetztTitel}>{euro(h.schaetzung)} <span className="block text-xs font-normal text-ink-soft">{t.geschaetzt(h.quota_rooms, modulNaechte)}</span></span>
                        : "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-xs text-ink-soft">{t.zimmernaechteErklaerung}</p>
        </section>

        <section className="karte relative mt-6 overflow-x-auto">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="font-display mr-auto text-xl font-bold">{t.honorareReise}</h2>
            <Link href={`/team/module/${id}/referenten/`} className="text-sm font-semibold underline">{t.betraegeUnterReferenten}</Link>
          </div>
          {honorare.length === 0 ? <p className="mt-3 text-ink-soft">{t.keineReferenten}</p> : (
            <table className="tabelle mt-4 min-w-[30rem]">
              <thead><tr><th>{t.referent}</th><th>{t.rolleSpalte}</th><th className="text-right">{t.honorar}</th><th className="text-right">{t.reisekosten}</th></tr></thead>
              <tbody>
                {honorare.map((r) => (
                  <tr key={r.id}>
                    <td className="font-semibold">{r.speakers?.name ?? "?"}</td>
                    <td>{t.rolle[r.role] ?? r.role}</td>
                    <td className="text-right">{r.fee === null ? <span className="text-ink-soft">–</span> : euro(r.fee)}</td>
                    <td className="text-right">{r.travel === null ? <span className="text-ink-soft">–</span> : euro(r.travel)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="karte mt-6">
          <h2 className="font-display text-xl font-bold">{t.sonstigePosten}</h2>
          {sonstiges.length > 0 && (
            <ul className="mt-3 divide-y divide-line">
              {sonstiges.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                  <span className="mr-auto"><span className="font-semibold">{p.label}</span> <span className="chip bg-paper-deep">{t.kategorie[p.category] ?? p.category}</span>{p.note && <span className="block text-sm text-ink-soft">{p.note}</span>}</span>
                  <span className="font-semibold">{euro(p.amount)}</span>
                  <form action={kostenEntfernen} className="flex flex-wrap">
                    <input type="hidden" name="module_id" value={id} /><input type="hidden" name="id" value={p.id} />
                    <Rueckfrage sprache={l} knopf={t.entfernen} knopfKlasse="text-xs font-semibold text-ink-soft underline" gefahr ja={t.entfernenJa} frage={t.entfernenFrage(p.label)} />
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form action={kostenSpeichern} className="mt-4 grid gap-3 sm:grid-cols-[2fr_1fr_1fr] lg:grid-cols-[2fr_1fr_1fr_2fr_auto] lg:items-end">
            <input type="hidden" name="module_id" value={id} />
            <div><label className="etikett" htmlFor="label">{t.bezeichnung}</label><input id="label" name="label" required maxLength={200} className="feld" placeholder={t.bezeichnungBeispiel} /></div>
            <div><label className="etikett" htmlFor="category">{t.art}</label>
              <select id="category" name="category" className="feld">{Object.entries(t.kategorie).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div><label className="etikett" htmlFor="amount">{t.betrag}</label><input id="amount" name="amount" required inputMode="decimal" className="feld" placeholder={t.betragBeispiel} /></div>
            <div><label className="etikett" htmlFor="note">{w.notiz}</label><input id="note" name="note" maxLength={1000} className="feld" /></div>
            <button type="submit" className="knopf">{w.hinzufuegen}</button>
          </form>
        </section>
      </main>
    </>
  );
}
