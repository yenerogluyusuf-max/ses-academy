// Notfall-Liste als PDF für alle Module, die morgen (Berliner Zeit) einen Termin haben.
// Läuft am Vorabend automatisch (siehe betrieb/README.md), lässt sich aber auch von Hand starten:
//   npx tsx --conditions=react-server --env-file=.env.local scripts/notfall-pdf.mts [ziel-ordner] [JJJJ-MM-TT]
// Ohne Datum: morgen. Ziel: ~/SES_ACADEMY/dokumente/notfall-listen (liegt außerhalb des Repos).
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { createAdminClient } from "../src/lib/supabase/admin";
import { ladeNotfallListe, notfallHtml } from "../src/lib/notfall-liste";

const ziel = process.argv[2] ?? join(homedir(), "SES_ACADEMY", "dokumente", "notfall-listen");
const morgen = process.argv[3] ?? new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date(Date.now() + 86_400_000));

const { data: tage, error } = await createAdminClient()
  .from("module_days")
  .select("module_id, module:modules!inner(status, cancelled_at)")
  .eq("day", morgen)
  .eq("module.status", "published")
  .is("module.cancelled_at", null);
if (error) throw new Error(error.message);

const modulIds = [...new Set((tage ?? []).map((t) => t.module_id))];
if (modulIds.length === 0) {
  console.log(`Keine Termine am ${morgen}.`);
  process.exit(0);
}

await mkdir(ziel, { recursive: true });
const browser = await chromium.launch();
try {
  for (const id of modulIds) {
    const daten = await ladeNotfallListe(id);
    if (!daten) continue;
    const seite = await browser.newPage();
    await seite.setContent(notfallHtml(daten), { waitUntil: "load" });
    const datei = join(ziel, `notfall-${daten.modul.slug}-${morgen}.pdf`);
    await seite.pdf({ path: datei, format: "A4", printBackground: true, preferCSSPageSize: true });
    await seite.close();
    console.log(`${datei} (${daten.personen.length} Personen)`);
  }
} finally {
  await browser.close();
}
