import type { Metadata } from "next";
import Link from "next/link";
import { Hinweis } from "@/components/team/Hinweis";
import { MailHinweis } from "@/components/team/MailHinweis";
import { Rueckfrage } from "@/components/team/Rueckfrage";
import { TeamKopf } from "@/components/team/TeamKopf";
import { zweiterFaktorPflicht } from "@/lib/aktionen/team";
import { faktorZuruecksetzen, mitgliedAnlegen, mitgliedEntfernen, rolleAendern, teamZugangAusfuehren, zugangZeitraum } from "@/lib/aktionen/teamverwaltung";
import { requireStaff, type StaffRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { teamLocale, type TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";
import { jetztMs } from "@/lib/zeit";

export const metadata: Metadata = { title: "Team | SES Academy" };

const de = {
  hinweise: {
    angelegt: { text: "Konto angelegt. Die Person hat eine Willkommensmail mit der Anleitung zur Anmeldung bekommen.", gut: true },
    "angelegt-ohne-mail": { text: "Konto angelegt, aber die Willkommensmail ging nicht raus. Bitte der Person Bescheid geben: Anmeldung unter /mein-bereich/login/ mit E-Mail und Code.", gut: false },
    "angelegt-mail-aus": { text: "Konto angelegt. Der Mailversand ist noch nicht eingerichtet, die Willkommensmail ging deshalb nicht raus. Bitte der Person Bescheid geben: Anmeldung unter /mein-bereich/login/ mit E-Mail und Code.", gut: false },
    "zugang-gespeichert": { text: "Zugang gespeichert.", gut: true },
    unveraendert: { text: "Nichts geändert.", gut: true },
    "modul-rolle": { text: "Auf ein Modul begrenzen lassen sich nur Orga-Team und Einlass-Helfer. Vorstand und Admin haben immer Zugang zu allem.", gut: false },
    beantragt: { text: "Beantragt. Ein zweiter Admin gibt unter „Freigaben“ frei, danach hier ausführen.", gut: true },
    abgelaufen: { text: "Die Freigabe ist älter als 24 Stunden. Bitte neu beantragen.", gut: false },
    gespeichert: { text: "Rolle gespeichert.", gut: true },
    entfernt: { text: "Konto entfernt.", gut: true },
    existiert: { text: "Zu dieser E-Mail gibt es schon ein Konto.", gut: false },
    eingabe: { text: "Bitte E-Mail, Name und Rolle angeben.", gut: false },
    "letzter-admin": { text: "Du bist der letzte Admin. Mach zuerst jemand anderen zum Admin.", gut: false },
    selbst: { text: "Das eigene Konto kann man nicht entfernen.", gut: false },
    "modul-ohne-termin": { text: "Das Modul hat noch keine Termine.", gut: false },
    "faktor-an": { text: "Zweiter Faktor ist jetzt Pflicht. Alle Teamkonten richten ihn bei der nächsten Anmeldung ein.", gut: true },
    "faktor-aus": { text: "Zweiter Faktor ist keine Pflicht mehr.", gut: true },
    "erst-selbst": { text: "Bitte zuerst selbst den zweiten Faktor einrichten und damit anmelden (unten „Für mich einrichten“).", gut: false },
    "faktor-zurueckgesetzt": { text: "Zweiter Faktor zurückgesetzt und alle Sitzungen beendet.", gut: true },
    fehler: { text: "Das hat nicht geklappt.", gut: false },
  } as Record<string, { text: string; gut: boolean }>,
  rechte: {
    admin: "Alles, auch Team-Zugänge verwalten und freigeben",
    vorstand: "Alles außer Team-Zugängen: Module, Bewerbungen, Teilnehmende, Import, Auswertung, Nachrichten, Freigaben",
    orga_team: "Einlass mit Liste und Walk-in, Regieplan, Teilnehmende und Anrufe, Logistik und Zimmer, Hausaufgaben, Dokumente, Sitzungen",
    checkin_helper: "Nur Scanner und Kurzcode, Regieplan lesen, keine Kontaktdaten",
  } as Record<StaffRole, string>,
  zugang: "Zugang",
  alleModule: "alle Module, unbefristet",
  wieBisher: (label: string | null) => `wie bisher: nur Zeitraum${label ? ` (${label})` : ""}`,
  nurModul: (titel: string) => `nur ${titel}`,
  fruehererModul: "früheres Modul",
  freigegeben: (summary: string) => `Freigegeben: ${summary}`,
  jetztAusfuehren: "Jetzt ausführen",
  du: " (du)",
  modulBegrenzt: (titel: string | null) => ` · nur ${titel ?? "ein Modul"} (Einlass und Regieplan)`,
  gueltigAb: (datum: string) => `gültig ab ${datum} Uhr · `,
  gueltigBis: (datum: string) => `gültig bis ${datum} Uhr`,
  abgelaufen: "abgelaufen",
  zugangSpeichern: "Zugang speichern",
  faktorZuruecksetzen: "2. Faktor zurücksetzen",
  entfernen: "entfernen", jaEntfernen: "Ja, Zugang entfernen",
  frageEntfernen: (name: string) => `Team-Zugang von ${name} entfernen? Die Person kann sich danach nicht mehr im Team-Bereich anmelden. Wieder einrichten geht nur mit neuer Freigabe.`,
  zweiterFaktor: "Zweiter Faktor",
  pflichtAn: "Pflicht für alle Teamkonten: Teamrechte gelten nur nach Eingabe des Codes aus der Authenticator-App.",
  pflichtAus: "Noch keine Pflicht. Einschalten, sobald alle Admins ihn eingerichtet haben.",
  duSelbst: "Du selbst:",
  mitFaktor: "mit zweitem Faktor angemeldet.", ohneFaktor: "ohne zweiten Faktor angemeldet.",
  fuerMich: "Für mich einrichten",
  pflichtAusschalten: "Pflicht ausschalten", pflichtEinschalten: "Pflicht einschalten",
  beantragen: "Team-Zugang beantragen",
  vorlegen: "Zur Freigabe vorlegen",
  erklaerung: "Ein zweiter Admin gibt den Zugang frei; danach bekommt die Person eine Willkommensmail. Ein Passwort ist nicht nötig: Anmeldung mit E-Mail und Code. „Nur <Modul>“ (für Orga-Team und Einlass-Helfer): Zugang nur zu Einlass und Regieplan dieses Moduls und nur vom Einlassbeginn am ersten bis 6 Stunden nach dem letzten Modultag.",
};

const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    hinweise: {
      angelegt: { text: "Hesap oluşturuldu. Kişiye giriş talimatlarını içeren bir hoş geldin e-postası gitti.", gut: true },
      "angelegt-ohne-mail": { text: "Hesap oluşturuldu ama hoş geldin e-postası gitmedi. Lütfen kişiye haber ver: Giriş /mein-bereich/login/ adresinden e-posta ve kodla yapılır.", gut: false },
      "angelegt-mail-aus": { text: "Hesap oluşturuldu. E-posta gönderimi henüz kurulmadığı için hoş geldin e-postası gitmedi. Lütfen kişiye haber ver: Giriş /mein-bereich/login/ adresinden e-posta ve kodla yapılır.", gut: false },
      "zugang-gespeichert": { text: "Erişim kaydedildi.", gut: true },
      unveraendert: { text: "Değişiklik yok.", gut: true },
      "modul-rolle": { text: "Yalnızca organizasyon ekibi ve giriş görevlileri bir modülle sınırlandırılabilir. Yönetim kurulu ve yöneticiler her zaman her şeye erişir.", gut: false },
      beantragt: { text: "Talep edildi. İkinci bir yönetici „Onaylar“ bölümünde onaylar, ardından burada uygula.", gut: true },
      abgelaufen: { text: "Onay 24 saatten eski. Lütfen yeniden talep et.", gut: false },
      gespeichert: { text: "Rol kaydedildi.", gut: true },
      entfernt: { text: "Hesap kaldırıldı.", gut: true },
      existiert: { text: "Bu e-posta için zaten bir hesap var.", gut: false },
      eingabe: { text: "Lütfen e-posta, ad ve rol gir.", gut: false },
      "letzter-admin": { text: "Son yönetici sensin. Önce başka birini yönetici yap.", gut: false },
      selbst: { text: "Kendi hesabını kaldıramazsın.", gut: false },
      "modul-ohne-termin": { text: "Modülün henüz tarihi yok.", gut: false },
      "faktor-an": { text: "İkinci faktör artık zorunlu. Tüm ekip hesapları bir sonraki girişte kurar.", gut: true },
      "faktor-aus": { text: "İkinci faktör artık zorunlu değil.", gut: true },
      "erst-selbst": { text: "Lütfen önce ikinci faktörü kendin kur ve onunla giriş yap (aşağıda „Benim için kur“).", gut: false },
      "faktor-zurueckgesetzt": { text: "İkinci faktör sıfırlandı ve tüm oturumlar kapatıldı.", gut: true },
      fehler: { text: "Bu işlem olmadı.", gut: false },
    },
    rechte: {
      admin: "Her şey, ekip erişimlerini yönetmek ve onaylamak dahil",
      vorstand: "Ekip erişimleri dışında her şey: modüller, başvurular, katılımcılar, içe aktarma, değerlendirme, mesajlar, onaylar",
      orga_team: "Liste ve kapıda kayıtla giriş, akış planı, katılımcılar ve aramalar, lojistik ve odalar, ödevler, belgeler, toplantılar",
      checkin_helper: "Yalnızca tarayıcı ve kısa kod, akış planını görme, iletişim bilgisi yok",
    },
    zugang: "Erişim",
    alleModule: "tüm modüller, süresiz",
    wieBisher: (label) => `önceki gibi: yalnızca süre${label ? ` (${label})` : ""}`,
    nurModul: (titel) => `yalnızca ${titel}`,
    fruehererModul: "önceki modül",
    freigegeben: (summary) => `Onaylandı: ${summary}`,
    jetztAusfuehren: "Şimdi uygula",
    du: " (sen)",
    modulBegrenzt: (titel) => ` · yalnızca ${titel ?? "bir modül"} (giriş ve akış planı)`,
    gueltigAb: (datum) => `geçerlilik başlangıcı: ${datum} · `,
    gueltigBis: (datum) => `geçerlilik sonu: ${datum}`,
    abgelaufen: "süresi doldu",
    zugangSpeichern: "Erişimi kaydet",
    faktorZuruecksetzen: "2. faktörü sıfırla",
    entfernen: "kaldır", jaEntfernen: "Evet, erişimi kaldır",
    frageEntfernen: (name) => `${name} adlı kişinin ekip erişimi kaldırılsın mı? Bu kişi daha sonra ekip alanına giriş yapamaz. Yeniden açmak yalnızca yeni bir onayla mümkün.`,
    zweiterFaktor: "İkinci faktör",
    pflichtAn: "Tüm ekip hesapları için zorunlu: Ekip yetkileri ancak doğrulama uygulamasındaki kod girildikten sonra geçerli olur.",
    pflichtAus: "Henüz zorunlu değil. Tüm yöneticiler kurduktan sonra aç.",
    duSelbst: "Sen:",
    mitFaktor: "ikinci faktörle giriş yaptın.", ohneFaktor: "ikinci faktör olmadan giriş yaptın.",
    fuerMich: "Benim için kur",
    pflichtAusschalten: "Zorunluluğu kapat", pflichtEinschalten: "Zorunluluğu aç",
    beantragen: "Ekip erişimi talep et",
    vorlegen: "Onaya sun",
    erklaerung: "İkinci bir yönetici erişimi onaylar; ardından kişiye bir hoş geldin e-postası gider. Şifre gerekmez: Giriş e-posta ve kodla yapılır. „Yalnızca <modül>“ (organizasyon ekibi ve giriş görevlileri için): Yalnızca bu modülün giriş ve akış planına erişim; ilk modül günündeki giriş başlangıcından son modül gününden 6 saat sonrasına kadar.",
  },
  fr: {
    hinweise: {
      angelegt: { text: "Compte créé. La personne a reçu un e-mail de bienvenue avec les instructions de connexion.", gut: true },
      "angelegt-ohne-mail": { text: "Compte créé, mais l’e-mail de bienvenue n’est pas parti. Merci de prévenir la personne : connexion sur /mein-bereich/login/ avec e-mail et code.", gut: false },
      "angelegt-mail-aus": { text: "Compte créé. L’envoi d’e-mails n’est pas encore configuré, l’e-mail de bienvenue n’est donc pas parti. Merci de prévenir la personne : connexion sur /mein-bereich/login/ avec e-mail et code.", gut: false },
      "zugang-gespeichert": { text: "Accès enregistré.", gut: true },
      unveraendert: { text: "Aucun changement.", gut: true },
      "modul-rolle": { text: "Seuls l’équipe d’organisation et les bénévoles d’accueil peuvent être limités à un module. Le bureau et les admins ont toujours accès à tout.", gut: false },
      beantragt: { text: "Demandé. Un deuxième admin valide dans « Validations », ensuite exécute ici.", gut: true },
      abgelaufen: { text: "La validation date de plus de 24 heures. Merci de la redemander.", gut: false },
      gespeichert: { text: "Rôle enregistré.", gut: true },
      entfernt: { text: "Compte retiré.", gut: true },
      existiert: { text: "Un compte existe déjà pour cet e-mail.", gut: false },
      eingabe: { text: "Merci d’indiquer l’e-mail, le nom et le rôle.", gut: false },
      "letzter-admin": { text: "Tu es le dernier admin. Nomme d’abord quelqu’un d’autre admin.", gut: false },
      selbst: { text: "Tu ne peux pas retirer ton propre compte.", gut: false },
      "modul-ohne-termin": { text: "Le module n’a pas encore de dates.", gut: false },
      "faktor-an": { text: "Le second facteur est maintenant obligatoire. Tous les comptes d’équipe le configurent à la prochaine connexion.", gut: true },
      "faktor-aus": { text: "Le second facteur n’est plus obligatoire.", gut: true },
      "erst-selbst": { text: "Merci de configurer d’abord toi-même le second facteur et de te connecter avec (plus bas, « Configurer pour moi »).", gut: false },
      "faktor-zurueckgesetzt": { text: "Second facteur réinitialisé et toutes les sessions fermées.", gut: true },
      fehler: { text: "Cela n’a pas fonctionné.", gut: false },
    },
    rechte: {
      admin: "Tout, y compris gérer et valider les accès à l’équipe",
      vorstand: "Tout sauf les accès à l’équipe : modules, candidatures, participants, import, analyse, messages, validations",
      orga_team: "Accueil avec liste et inscription sur place, déroulé, participants et appels, logistique et chambres, devoirs, documents, réunions",
      checkin_helper: "Uniquement scanner et code court, lecture du déroulé, pas de coordonnées",
    },
    zugang: "Accès",
    alleModule: "tous les modules, sans limite",
    wieBisher: (label) => `comme avant : période seulement${label ? ` (${label})` : ""}`,
    nurModul: (titel) => `uniquement ${titel}`,
    fruehererModul: "module précédent",
    freigegeben: (summary) => `Validé : ${summary}`,
    jetztAusfuehren: "Exécuter maintenant",
    du: " (toi)",
    modulBegrenzt: (titel) => ` · uniquement ${titel ?? "un module"} (accueil et déroulé)`,
    gueltigAb: (datum) => `valable à partir du ${datum} · `,
    gueltigBis: (datum) => `valable jusqu’au ${datum}`,
    abgelaufen: "expiré",
    zugangSpeichern: "Enregistrer l’accès",
    faktorZuruecksetzen: "Réinitialiser le 2e facteur",
    entfernen: "retirer", jaEntfernen: "Oui, retirer l’accès",
    frageEntfernen: (name) => `Retirer l’accès à l’équipe de ${name} ? Cette personne ne pourra plus se connecter à l’espace équipe. Le rétablir nécessite une nouvelle validation.`,
    zweiterFaktor: "Second facteur",
    pflichtAn: "Obligatoire pour tous les comptes d’équipe : les droits d’équipe ne s’appliquent qu’après saisie du code de l’application d’authentification.",
    pflichtAus: "Pas encore obligatoire. À activer dès que tous les admins l’ont configuré.",
    duSelbst: "Toi :",
    mitFaktor: "connecté·e avec le second facteur.", ohneFaktor: "connecté·e sans second facteur.",
    fuerMich: "Configurer pour moi",
    pflichtAusschalten: "Désactiver l’obligation", pflichtEinschalten: "Activer l’obligation",
    beantragen: "Demander un accès à l’équipe",
    vorlegen: "Soumettre pour validation",
    erklaerung: "Un deuxième admin valide l’accès ; la personne reçoit ensuite un e-mail de bienvenue. Pas besoin de mot de passe : connexion avec e-mail et code. « Uniquement <module> » (pour l’équipe d’organisation et les bénévoles d’accueil) : accès uniquement à l’accueil et au déroulé de ce module, et seulement du début de l’accueil le premier jour jusqu’à 6 heures après le dernier jour du module.",
  },
};

export default async function TeamVerwaltung({ searchParams }: PageProps<"/team/team">) {
  const staff = await requireStaff("admin");
  const l = staff.sprache;
  const t = T[l];
  const w = teamTexte[l];
  const bis = new Intl.DateTimeFormat(teamLocale[l], { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" });
  const { hinweis } = await searchParams;
  const supabase = await createClient();
  const [{ data: mitglieder }, { data: module }] = await Promise.all([
    supabase.from("staff_members").select("user_id, role, display_name, created_at, valid_from, valid_until, label, module_id, modul:modules(title)").order("display_name"),
    supabase.from("modules").select("id, title, module_days!inner(ends_at)").eq("status", "published").is("cancelled_at", null).gt("module_days.ends_at", new Date(jetztMs()).toISOString()),
  ]);
  const kommendeModule = [...new Map((module ?? []).map((m) => [m.id, m])).values()];
  // Auswahl zeigt den aktuellen Stand: das Modul, „unbefristet“ oder (ältere Zugänge) den bisherigen Zeitraum
  const modulAuswahl = (name: string, aktuell?: { module_id: string | null; valid_until: string | null; label: string | null; modulTitel?: string | null }) => {
    const bisher = aktuell && !aktuell.module_id && aktuell.valid_until;
    const fremd = aktuell?.module_id && !kommendeModule.some((m) => m.id === aktuell.module_id);
    return (
      <select name={name} defaultValue={aktuell?.module_id ?? (bisher ? "__bisher" : "")} className={feld} aria-label={t.zugang}>
        <option value="">{t.alleModule}</option>
        {bisher && <option value="__bisher">{t.wieBisher(aktuell.label)}</option>}
        {fremd && <option value={aktuell.module_id!}>{t.nurModul(aktuell.modulTitel ?? t.fruehererModul)}</option>}
        {kommendeModule.map((m) => <option key={m.id} value={m.id}>{t.nurModul(m.title)}</option>)}
      </select>
    );
  };
  const jetzt = jetztMs();
  const [{ data: pflicht }, { data: aal }, { data: freigegeben }] = await Promise.all([
    supabase.rpc("mfa_required"), supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.from("approvals").select("id, summary, decided_at").eq("action", "team_zugang").eq("status", "freigegeben").eq("requested_by", staff.userId),
  ]);
  const ausfuehrbar = (freigegeben ?? []).filter((f) => f.decided_at && Date.parse(f.decided_at) > jetzt - 86_400_000);
  const feld = "rounded-2xl bg-white px-4 py-3 ring-1 ring-line";
  const rollenAuswahl = (name: string, wert?: string) => (
    <select name={name} defaultValue={wert ?? "checkin_helper"} className={feld}>
      {Object.entries(w.rollen).map(([r, n]) => <option key={r} value={r}>{n}</option>)}
    </select>
  );

  return (
    <>
      <TeamKopf staff={staff} aktiv="team" />
      <main lang={l} className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="font-display text-3xl font-bold">{w.bereiche.team}</h1>
        <Hinweis code={hinweis} texte={t.hinweise} />
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {Object.entries(t.rechte).map(([r, text]) => (
            <div key={r}><dt className="inline font-semibold">{w.rollen[r as StaffRole]}: </dt><dd className="inline text-ink-soft">{text}</dd></div>
          ))}
        </dl>
        {ausfuehrbar.map((f) => (
          <form key={f.id} action={teamZugangAusfuehren} className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-gruen-hell p-4">
            <input type="hidden" name="id" value={f.id} />
            <p className="mr-auto text-sm font-semibold">{t.freigegeben(f.summary)}</p>
            <button type="submit" className="rounded-full bg-ink px-5 py-2.5 font-semibold text-paper">{t.jetztAusfuehren}</button>
          </form>
        ))}
        <ul className="mt-6 divide-y divide-line rounded-3xl bg-white/80 px-5 ring-1 ring-line">
          {(mitglieder ?? []).map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center gap-3 py-4">
              <p className="mr-auto font-semibold">
                {m.display_name}{m.user_id === staff.userId ? t.du : ""}
                <span className="block text-sm font-normal text-ink-soft">{w.rollen[m.role]}{m.module_id ? t.modulBegrenzt(m.modul?.title ?? null) : ""}</span>
                {m.valid_until && (
                  <span className={`block text-sm font-normal ${Date.parse(m.valid_until) <= jetzt ? "text-red-900" : "text-ink-soft"}`}>
                    {m.valid_from && Date.parse(m.valid_from) > jetzt ? t.gueltigAb(bis.format(new Date(m.valid_from))) : ""}
                    {Date.parse(m.valid_until) <= jetzt ? t.abgelaufen : t.gueltigBis(bis.format(new Date(m.valid_until)))}
                  </span>
                )}
              </p>
              {m.user_id !== staff.userId && (m.role === "orga_team" || m.role === "checkin_helper" || m.valid_until) && (
                <form action={zugangZeitraum} className="flex flex-wrap gap-2">
                  <input type="hidden" name="user_id" value={m.user_id} />
                  {modulAuswahl("modul", { module_id: m.module_id, valid_until: m.valid_until, label: m.label, modulTitel: m.modul?.title })}
                  <button type="submit" className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-line">{t.zugangSpeichern}</button>
                </form>
              )}
              <form action={rolleAendern} className="flex flex-wrap gap-2">
                <input type="hidden" name="user_id" value={m.user_id} />
                {rollenAuswahl("rolle", m.role)}
                <button type="submit" className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-line">{w.wort.speichern}</button>
              </form>
              {m.user_id !== staff.userId && (
                <form action={faktorZuruecksetzen}>
                  <input type="hidden" name="user_id" value={m.user_id} />
                  <button type="submit" className="text-sm font-semibold text-ink-soft underline">{t.faktorZuruecksetzen}</button>
                </form>
              )}
              {m.user_id !== staff.userId && (
                <form action={mitgliedEntfernen} className="contents">
                  <input type="hidden" name="user_id" value={m.user_id} />
                  <Rueckfrage sprache={l} knopf={t.entfernen} knopfKlasse="text-sm font-semibold text-red-900 underline" gefahr ja={t.jaEntfernen}
                    frage={t.frageEntfernen(m.display_name)} />
                </form>
              )}
            </li>
          ))}
        </ul>
        <section className="mt-8 rounded-3xl bg-white/60 p-6 ring-1 ring-line">
          <h2 className="font-display text-xl font-bold">{t.zweiterFaktor}</h2>
          <p className="mt-1 text-sm text-ink-soft">
            {pflicht ? t.pflichtAn : t.pflichtAus}
            {" "}{t.duSelbst} {aal?.currentLevel === "aal2" ? t.mitFaktor : t.ohneFaktor}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {aal?.currentLevel !== "aal2" && <Link href="/team/zweiter-faktor/" className="rounded-full bg-white px-5 py-2.5 font-semibold ring-1 ring-line">{t.fuerMich}</Link>}
            <form action={zweiterFaktorPflicht}>
              <input type="hidden" name="an" value={pflicht ? "0" : "1"} />
              <button type="submit" className={`rounded-full px-5 py-2.5 font-semibold ${pflicht ? "bg-white ring-1 ring-line" : "bg-ink text-paper"}`}>{pflicht ? t.pflichtAusschalten : t.pflichtEinschalten}</button>
            </form>
          </div>
        </section>
        <section className="mt-8 rounded-3xl bg-white/60 p-6 ring-1 ring-line">
          <h2 className="font-display text-xl font-bold">{t.beantragen}</h2>
          <form action={mitgliedAnlegen} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input name="name" required placeholder={w.wort.name} aria-label={w.wort.name} className={feld} />
            <input name="email" type="email" required placeholder={w.wort.email} aria-label={w.wort.email} className={feld} />
            {rollenAuswahl("rolle")}
            {modulAuswahl("modul")}
            <button type="submit" className="justify-self-start rounded-full bg-ink px-6 py-3 font-semibold text-paper">{t.vorlegen}</button>
            <p className="text-sm text-ink-soft sm:col-span-2">{t.erklaerung}</p>
            <MailHinweis knapp className="sm:col-span-2" sprache={l} />
          </form>
        </section>
      </main>
    </>
  );
}
