import type { Metadata } from "next";
import { Hinweis } from "@/components/team/Hinweis";
import { TeamKopf } from "@/components/team/TeamKopf";
import { mitgliedAnlegen, mitgliedEntfernen, rolleAendern, zugangZeitraum } from "@/lib/aktionen/teamverwaltung";
import { requireStaff, rollenName } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { jetztMs } from "@/lib/zeit";

export const metadata: Metadata = { title: "Team | SES Academy" };

const hinweise = {
  angelegt: { text: "Konto angelegt. Gib E-Mail und Startpasswort persönlich weiter.", gut: true },
  gespeichert: { text: "Rolle gespeichert.", gut: true },
  entfernt: { text: "Konto entfernt.", gut: true },
  existiert: { text: "Zu dieser E-Mail gibt es schon ein Konto.", gut: false },
  eingabe: { text: "Bitte E-Mail, Name, Rolle und ein Passwort mit mindestens 10 Zeichen angeben.", gut: false },
  "letzter-admin": { text: "Du bist der letzte Admin. Mach zuerst jemand anderen zum Admin.", gut: false },
  selbst: { text: "Das eigene Konto kann man nicht entfernen.", gut: false },
  "modul-ohne-termin": { text: "Das Modul hat noch keine Termine.", gut: false },
  fehler: { text: "Das hat nicht geklappt.", gut: false },
};

const bis = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" });

const rechte: Record<keyof typeof rollenName, string> = {
  admin: "Alles, auch Team verwalten",
  vorstand: "Bewerbungen, Module, Einlass mit Liste",
  orga_team: "Einlass mit Anwesenheitsliste, abhaken",
  checkin_helper: "Nur Scanner und Kurzcode, keine Kontaktdaten. Am besten „nur <Modul>“ wählen: dann gilt der Zugang nur an den Modultagen.",
};

export default async function TeamVerwaltung({ searchParams }: PageProps<"/team/team">) {
  const staff = await requireStaff("admin");
  const { hinweis } = await searchParams;
  const supabase = await createClient();
  const [{ data: mitglieder }, { data: module }] = await Promise.all([
    supabase.from("staff_members").select("user_id, role, display_name, created_at, valid_from, valid_until, label").order("display_name"),
    supabase.from("modules").select("id, title, module_days!inner(ends_at)").eq("status", "published").is("cancelled_at", null).gt("module_days.ends_at", new Date(jetztMs()).toISOString()),
  ]);
  const kommendeModule = [...new Map((module ?? []).map((m) => [m.id, m])).values()];
  const modulAuswahl = (name: string) => (
    <select name={name} defaultValue="" className={feld} aria-label="Zeitraum">
      <option value="">unbefristet</option>
      {kommendeModule.map((m) => <option key={m.id} value={m.id}>nur {m.title}</option>)}
    </select>
  );
  const jetzt = jetztMs();
  const feld = "rounded-2xl bg-white px-4 py-3 ring-1 ring-line";
  const rollenAuswahl = (name: string, wert?: string) => (
    <select name={name} defaultValue={wert ?? "checkin_helper"} className={feld}>
      {Object.entries(rollenName).map(([w, n]) => <option key={w} value={w}>{n}</option>)}
    </select>
  );

  return (
    <>
      <TeamKopf staff={staff} aktiv="team" />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="font-display text-3xl font-bold">Team</h1>
        <Hinweis code={hinweis} texte={hinweise} />
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {Object.entries(rechte).map(([r, text]) => (
            <div key={r}><dt className="inline font-semibold">{rollenName[r as keyof typeof rollenName]}: </dt><dd className="inline text-ink-soft">{text}</dd></div>
          ))}
        </dl>
        <ul className="mt-6 divide-y divide-line rounded-3xl bg-white/80 px-5 ring-1 ring-line">
          {(mitglieder ?? []).map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center gap-3 py-4">
              <p className="mr-auto font-semibold">
                {m.display_name}{m.user_id === staff.userId ? " (du)" : ""}
                {m.valid_until && (
                  <span className={`block text-sm font-normal ${Date.parse(m.valid_until) <= jetzt ? "text-red-900" : "text-ink-soft"}`}>
                    {m.label ? `${m.label} · ` : ""}{Date.parse(m.valid_until) <= jetzt ? "abgelaufen" : `gültig bis ${bis.format(new Date(m.valid_until))} Uhr`}
                  </span>
                )}
              </p>
              {m.user_id !== staff.userId && (
                <form action={zugangZeitraum} className="flex gap-2">
                  <input type="hidden" name="user_id" value={m.user_id} />
                  {modulAuswahl("modul")}
                  <button type="submit" className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-line">Zeitraum</button>
                </form>
              )}
              <form action={rolleAendern} className="flex gap-2">
                <input type="hidden" name="user_id" value={m.user_id} />
                {rollenAuswahl("rolle", m.role)}
                <button type="submit" className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-line">Speichern</button>
              </form>
              {m.user_id !== staff.userId && (
                <form action={mitgliedEntfernen}>
                  <input type="hidden" name="user_id" value={m.user_id} />
                  <button type="submit" className="text-sm font-semibold text-red-900 underline">entfernen</button>
                </form>
              )}
            </li>
          ))}
        </ul>
        <section className="mt-8 rounded-3xl bg-white/60 p-6 ring-1 ring-line">
          <h2 className="font-display text-xl font-bold">Konto anlegen</h2>
          <form action={mitgliedAnlegen} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input name="name" required placeholder="Name" className={feld} />
            <input name="email" type="email" required placeholder="E-Mail" className={feld} />
            {rollenAuswahl("rolle")}
            <input name="passwort" type="text" required minLength={10} placeholder="Startpasswort (mind. 10 Zeichen)" autoComplete="off" className={feld} />
            {modulAuswahl("modul")}
            <button type="submit" className="justify-self-start rounded-full bg-ink px-6 py-3 font-semibold text-paper">Anlegen</button>
          </form>
        </section>
      </main>
    </>
  );
}
