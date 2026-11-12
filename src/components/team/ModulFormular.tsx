import type { Database } from "@/lib/database.types";
import type { TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";

type Modul = Partial<Database["public"]["Tables"]["modules"]["Row"]>;
type Art = Database["public"]["Enums"]["module_kind"];
type Status = Database["public"]["Enums"]["module_status"];

/** Art des Moduls in der Sprache des Team-Bereichs. */
export const artNamen: Record<TeamSprache, Record<Art, string>> = {
  de: { auftakt: "Auftakt", seminar: "Seminar", workshop: "Workshop", winterschool: "Winter School", sonstiges: "Sonstiges" },
  tr: { auftakt: "Açılış", seminar: "Seminer", workshop: "Atölye", winterschool: "Kış okulu", sonstiges: "Diğer" },
  fr: { auftakt: "Lancement", seminar: "Séminaire", workshop: "Atelier", winterschool: "École d’hiver", sonstiges: "Autre" },
};

/** Status des Moduls in der Sprache des Team-Bereichs. */
export const statusNamen: Record<TeamSprache, Record<Status, string>> = {
  de: { draft: "Entwurf (unsichtbar)", published: "Veröffentlicht", archived: "Archiviert" },
  tr: { draft: "Taslak (görünmez)", published: "Yayında", archived: "Arşivlendi" },
  fr: { draft: "Brouillon (invisible)", published: "Publié", archived: "Archivé" },
};

/** Deutsche Namen, für Aufrufer ohne Sprache. */
export const artName = artNamen.de;
export const statusName = statusNamen.de;

const T = {
  de: {
    slug: "Kurzname in der Adresse", slugBeispiel: "z. B. demokratie",
    slugHilfe: "Gleich wie auf der Website (/seminar/…/), dann erscheint dort das Anmeldeformular.",
    art: "Art", ortLeer: "leer = Ort folgt", plaetze: "Plätze für Gäste insgesamt", plaetzeLeer: "leer = unbegrenzt",
    plaetzeHilfe: "Zählt alle bestätigten Anmeldungen. Wer danach kommt, landet auf der Warteliste.",
    untertitel: "Untertitel (Tagesordnung, Deckblatt)", untertitelBeispiel: "z. B. Modelle, Chancen und Belastungsproben",
    beschreibung: "Interne Beschreibung",
    ticket: "Mit QR-Ticket", ticketText: "Aus: Einlass nur durch Abhaken in der Liste.",
    serie: "Zählt für Serien", serieText: "Reguläres Academy-Modul, fließt in Teilnahme-Serien ein.",
    offen: "Offene Anmeldung", offenText: "Auch Gäste ohne Bewerbung können sich auf der Website anmelden.",
  },
  tr: {
    slug: "Adresteki kısa ad", slugBeispiel: "ör. demokratie",
    slugHilfe: "Web sitesindekiyle aynı olsun (/seminar/…/), o zaman kayıt formu orada görünür.",
    art: "Tür", ortLeer: "boş = yer daha sonra bildirilecek", plaetze: "Toplam katılımcı kontenjanı", plaetzeLeer: "boş = sınırsız",
    plaetzeHilfe: "Onaylanan tüm kayıtlar sayılır. Sonra gelenler bekleme listesine alınır.",
    untertitel: "Alt başlık (gündem, kapak sayfası)", untertitelBeispiel: "ör. Modeller, fırsatlar ve sınamalar",
    beschreibung: "Dahili açıklama",
    ticket: "QR biletli", ticketText: "Kapalıysa: giriş yalnızca listeden işaretleyerek.",
    serie: "Serilere sayılır", serieText: "Normal Academy modülü, katılım serilerine dahil edilir.",
    offen: "Açık kayıt", offenText: "Başvurusu olmayan misafirler de web sitesinden kayıt olabilir.",
  },
  fr: {
    slug: "Nom court dans l’adresse", slugBeispiel: "p. ex. demokratie",
    slugHilfe: "Identique à celui du site (/seminar/…/)\u00a0: le formulaire d’inscription y apparaît alors.",
    art: "Type", ortLeer: "vide = lieu à venir", plaetze: "Nombre total de places", plaetzeLeer: "vide = illimité",
    plaetzeHilfe: "Toutes les inscriptions confirmées comptent. Les suivantes vont sur la liste d’attente.",
    untertitel: "Sous-titre (ordre du jour, page de garde)", untertitelBeispiel: "p. ex. Modèles, opportunités et mises à l’épreuve",
    beschreibung: "Description interne",
    ticket: "Avec billet QR", ticketText: "Désactivé\u00a0: accueil uniquement en cochant dans la liste.",
    serie: "Compte pour les séries", serieText: "Module régulier de l’Academy, pris en compte dans les séries de participation.",
    offen: "Inscription ouverte", offenText: "Les invités sans candidature peuvent aussi s’inscrire sur le site.",
  },
} satisfies Record<TeamSprache, Record<string, string>>;

const feld = "w-full rounded-2xl bg-white px-4 py-3 ring-1 ring-line outline-none focus:ring-2 focus:ring-ink";
const label = "mb-1.5 block text-sm font-semibold";

/** Formularfelder für Anlegen und Bearbeiten eines Moduls. */
export function ModulFormular({ modul, aktion, knopf, sprache = "de" }: { modul?: Modul; aktion: (f: FormData) => Promise<void>; knopf: string; sprache?: TeamSprache }) {
  const t = T[sprache];
  const w = teamTexte[sprache].wort;
  const schalter = (name: "ticket_required" | "counts_for_streak" | "open_registration", titel: string, text: string, standard: boolean) => (
    <label className="flex cursor-pointer gap-3 rounded-2xl bg-white/70 p-4 ring-1 ring-line">
      <input type="checkbox" name={name} defaultChecked={modul?.[name] ?? standard} className="mt-1 h-5 w-5 shrink-0" />
      <span><span className="font-semibold">{titel}</span><span className="block text-sm text-ink-soft">{text}</span></span>
    </label>
  );
  return (
    <form action={aktion} className="grid gap-4 sm:grid-cols-2">
      {modul?.id && <input type="hidden" name="id" value={modul.id} />}
      <div>
        <label htmlFor="title" className={label}>{w.titel}</label>
        <input id="title" name="title" required defaultValue={modul?.title} className={feld} />
      </div>
      <div>
        <label htmlFor="slug" className={label}>{t.slug}</label>
        <input id="slug" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={modul?.slug} placeholder={t.slugBeispiel} className={feld} />
        <p className="mt-1 text-xs text-ink-soft">{t.slugHilfe}</p>
      </div>
      <div>
        <label htmlFor="kind" className={label}>{t.art}</label>
        <select id="kind" name="kind" defaultValue={modul?.kind ?? "seminar"} className={feld}>
          {Object.entries(artNamen[sprache]).map(([wert, n]) => <option key={wert} value={wert}>{n}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="status" className={label}>{w.status}</label>
        <select id="status" name="status" defaultValue={modul?.status ?? "draft"} className={feld}>
          {Object.entries(statusNamen[sprache]).map(([wert, n]) => <option key={wert} value={wert}>{n}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="location" className={label}>{w.ort}</label>
        <input id="location" name="location" defaultValue={modul?.location ?? ""} placeholder={t.ortLeer} className={feld} />
      </div>
      <div>
        <label htmlFor="capacity" className={label}>{t.plaetze}</label>
        <input id="capacity" name="capacity" inputMode="numeric" pattern="\d*" defaultValue={modul?.capacity ?? ""} placeholder={t.plaetzeLeer} className={feld} />
        <p className="mt-1 text-xs text-ink-soft">{t.plaetzeHilfe}</p>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="subtitle" className={label}>{t.untertitel}</label>
        <input id="subtitle" name="subtitle" maxLength={200} defaultValue={modul?.subtitle ?? ""} placeholder={t.untertitelBeispiel} className={feld} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="description" className={label}>{t.beschreibung}</label>
        <textarea id="description" name="description" rows={3} defaultValue={modul?.description} className={feld} />
      </div>
      <div className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
        {schalter("ticket_required", t.ticket, t.ticketText, true)}
        {schalter("counts_for_streak", t.serie, t.serieText, true)}
        {schalter("open_registration", t.offen, t.offenText, false)}
      </div>
      <div className="sm:col-span-2">
        <button type="submit" className="rounded-full bg-ink px-6 py-3 font-semibold text-paper hover:bg-forest">{knopf}</button>
      </div>
    </form>
  );
}
