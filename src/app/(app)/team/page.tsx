import type { Metadata } from "next";
import Link from "next/link";
import { TeamKopf } from "@/components/team/TeamKopf";
import { aufgabeUmschalten } from "@/lib/aktionen/modulwerkzeuge";
import { darf, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { jetztMs } from "@/lib/zeit";

const datum = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const tageBis = (tag: string, heute: string) => Math.round((Date.parse(`${tag}T12:00:00Z`) - Date.parse(`${heute}T12:00:00Z`)) / 86_400_000);

export const metadata: Metadata = { title: "Team | SES Academy" };

export default async function TeamStart({ searchParams }: PageProps<"/team">) {
  const staff = await requireStaff();
  const { fehler } = await searchParams;
  const kachel = "block rounded-3xl bg-white/80 p-6 ring-1 ring-line transition hover:ring-ink";
  const heute = new Date(jetztMs()).toISOString().slice(0, 10);
  const inZweiWochen = new Date(jetztMs() + 14 * 86_400_000).toISOString().slice(0, 10);
  const supabase = await createClient();
  // Startseite (Plan, Phase 3): nächstes Modul, meine Aufgaben, Fristen der nächsten zwei Wochen
  const [{ data: naechste }, { data: meine }, { data: fristen }, { data: hotels }, { data: hausaufgaben }] = darf.orga(staff.role)
    ? await Promise.all([
      supabase.from("module_days").select("day, module:modules!inner(id, title, status, cancelled_at)").gte("day", heute).eq("module.status", "published").is("module.cancelled_at", null).order("day").limit(1),
      supabase.from("tasks").select("id, title, due_date, module:modules(id, title)").eq("assignee_user", staff.userId).is("done_at", null).order("due_date", { nullsFirst: false }).limit(10),
      supabase.from("tasks").select("id, title, due_date, module:modules(id, title)").is("done_at", null).lte("due_date", inZweiWochen).order("due_date").limit(12),
      supabase.from("hotels").select("name, cancellation_deadline, module:modules(id, title)").gte("cancellation_deadline", heute).lte("cancellation_deadline", inZweiWochen),
      supabase.from("assignments").select("number, title, due_date").gte("due_date", heute).lte("due_date", inZweiWochen),
    ])
    : [{ data: null }, { data: null }, { data: null }, { data: null }, { data: null }];
  const naechstes = naechste?.[0];
  return (
    <>
      <TeamKopf staff={staff} />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="font-display text-3xl font-bold">Hallo {staff.name}</h1>
        {fehler === "rechte" && (
          <p role="alert" className="mt-4 rounded-2xl bg-amber-100 p-4 text-amber-900">Für diesen Bereich fehlt deiner Rolle die Berechtigung.</p>
        )}
        {darf.orga(staff.role) && (
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <section className="karte">
              <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Nächstes Modul</p>
              {naechstes ? (
                <>
                  <Link href={`/team/module/${naechstes.module.id}/`} className="font-display mt-1 block text-2xl font-bold hover:underline">{naechstes.module.title}</Link>
                  <p className="text-ink-soft">{datum.format(new Date(`${naechstes.day}T12:00:00Z`))} · {tageBis(naechstes.day, heute) === 0 ? "heute" : `in ${tageBis(naechstes.day, heute)} Tagen`}</p>
                  <Link href={`/team/module/${naechstes.module.id}/checkliste/`} className="link mt-2 inline-block text-sm">Checkliste</Link>
                </>
              ) : <p className="mt-1 text-ink-soft">Kein Modul geplant.</p>}
            </section>
            <section className="karte">
              <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Meine Aufgaben</p>
              {(meine ?? []).length === 0 ? <p className="mt-1 text-ink-soft">Nichts offen.</p> : (
                <ul className="mt-2 space-y-2">
                  {(meine ?? []).map((a) => (
                    <li key={a.id} className="flex items-start gap-2">
                      <form action={aufgabeUmschalten}>
                        <input type="hidden" name="id" value={a.id} /><input type="hidden" name="erledigt" value="1" /><input type="hidden" name="zurueck" value="/team/" />
                        <button type="submit" aria-label={`„${a.title}“ erledigt`} className="mt-0.5 h-5 w-5 rounded-full ring-2 ring-line hover:bg-gruen-hell" />
                      </form>
                      <span className="text-sm"><span className="font-semibold">{a.title}</span>
                        <span className={`block text-xs ${a.due_date && a.due_date < heute ? "font-semibold text-rot" : "text-ink-soft"}`}>{[a.module?.title, a.due_date && datum.format(new Date(`${a.due_date}T12:00:00Z`))].filter(Boolean).join(" · ")}</span></span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="karte">
              <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Fristen bis {datum.format(new Date(`${inZweiWochen}T12:00:00Z`))}</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {(hotels ?? []).map((h) => <li key={h.name} className="font-semibold text-rot">{datum.format(new Date(`${h.cancellation_deadline}T12:00:00Z`))}: Stornofrist {h.name} ({h.module?.title})</li>)}
                {(hausaufgaben ?? []).map((h) => <li key={h.number}>{datum.format(new Date(`${h.due_date}T12:00:00Z`))}: Hausaufgabe {h.number} „{h.title}“</li>)}
                {(fristen ?? []).map((a) => (
                  <li key={a.id} className={a.due_date && a.due_date < heute ? "text-rot" : ""}>
                    {a.due_date && datum.format(new Date(`${a.due_date}T12:00:00Z`))}: {a.module ? <Link href={`/team/module/${a.module.id}/checkliste/`} className="hover:underline">{a.title}</Link> : a.title}
                  </li>
                ))}
                {!(hotels ?? []).length && !(hausaufgaben ?? []).length && !(fristen ?? []).length && <li className="text-ink-soft">Keine Fristen.</li>}
              </ul>
            </section>
          </div>
        )}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link href="/team/einlass/" className={kachel}>
            <p className="font-display text-xl font-bold">Einlass</p>
            <p className="mt-1 text-ink-soft">QR-Codes scannen, Kurzcodes eingeben, Anwesenheit sehen.</p>
          </Link>
          <Link href="/team/regieplan/" className={kachel}>
            <p className="font-display text-xl font-bold">Regieplan</p>
            <p className="mt-1 text-ink-soft">Was gerade läuft, was als Nächstes kommt, Verzögerungen für alle sichtbar.</p>
          </Link>
          {darf.orga(staff.role) && (
            <Link href="/team/gruppen/" className={kachel}>
              <p className="font-display text-xl font-bold">Gruppen · fehlt noch</p>
              <p className="mt-1 text-ink-soft">Je Sorumlu: wer am Eventtag noch nicht da ist, mit Anruf-Knopf.</p>
            </Link>
          )}
          {darf.orga(staff.role) && (
            <Link href="/team/rollenplan/" className={kachel}>
              <p className="font-display text-xl font-bold">Rollenplan</p>
              <p className="mt-1 text-ink-soft">Wer an welchem Tag wofür zuständig ist, mit Anruf-Knopf.</p>
            </Link>
          )}
          {darf.alles(staff.role) && (
            <Link href="/team/bewerbungen/" className={kachel}>
              <p className="font-display text-xl font-bold">Bewerbungen</p>
              <p className="mt-1 text-ink-soft">Bewerbungen prüfen, annehmen und Tickets verschicken.</p>
            </Link>
          )}
        </div>
      </main>
    </>
  );
}
