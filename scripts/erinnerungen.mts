// Erinnerung an Hausaufgaben: zwei Tage vor der Frist an alle Teilnehmenden des Jahrgangs, die noch nicht abgegeben
// haben und nicht entschuldigt sind. Läuft täglich (siehe betrieb/ses.sh autostart), lässt sich auch von Hand starten:
//   npx tsx --conditions=react-server --env-file=.env.local scripts/erinnerungen.mts [JJJJ-MM-TT]   (Datum = „heute“)
// Wer am selben Tag schon erinnert wurde, bekommt keine zweite Mail.
import { sendeHausaufgabenErinnerung } from "../src/lib/mail";
import { createAdminClient } from "../src/lib/supabase/admin";

const db = createAdminClient();
const heute = process.argv[2] ?? new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
const inZweiTagen = new Date(Date.parse(`${heute}T12:00:00Z`) + 2 * 86_400_000).toISOString().slice(0, 10);

const { data: aufgaben, error } = await db.from("assignments").select("id, number, title, cohort_id, due_date").eq("due_date", inZweiTagen);
if (error) throw new Error(error.message);
if (!aufgaben?.length) {
  console.log(`Keine Frist am ${inZweiTagen}.`);
  process.exit(0);
}

for (const a of aufgaben) {
  const [{ data: personen }, { data: abgaben }, { data: entschuldigt }, { data: schon }] = await Promise.all([
    db.from("participants").select("id").eq("cohort_id", a.cohort_id).eq("active", true).eq("affiliation_status", "academy_student").not("email", "is", null),
    db.from("submission_participants").select("participant_id, submission:submissions!inner(assignment_id)").eq("submission.assignment_id", a.id),
    db.from("assignment_excusals").select("participant_id").eq("assignment_id", a.id),
    db.from("email_log").select("participant_id").eq("kind", `erinnerung_hausaufgabe_${a.number}`).gte("created_at", `${heute}T00:00:00Z`),
  ]);
  const fertig = new Set([...(abgaben ?? []), ...(entschuldigt ?? []), ...(schon ?? [])].map((x) => x.participant_id));
  const offen = (personen ?? []).filter((p) => !fertig.has(p.id));
  let ok = 0;
  for (const p of offen) if ((await sendeHausaufgabenErinnerung(p.id, a.id)).ok) ok++;
  console.log(`Hausaufgabe ${a.number} (${a.title}), Frist ${a.due_date}: ${ok} von ${offen.length} erinnert.`);
}
