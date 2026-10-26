// Neues Startpasswort für ein bestehendes Teamkonto setzen (z. B. wenn es vergessen wurde).
// Aufruf über ./ses.sh passwort <email>. Das Passwort wird genau einmal im Terminal angezeigt;
// nach dem Login unter „Passwort“ ändern.
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Aufruf: ./ses.sh passwort <email>");
  process.exit(1);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: liste, error: fehler } = await db.auth.admin.listUsers({ perPage: 1000 });
const konto = liste?.users.find((u) => u.email?.toLowerCase() === email);
if (fehler || !konto) {
  console.error(`Kein Konto mit ${email} gefunden.`);
  process.exit(1);
}
const passwort = randomBytes(12).toString("base64url");
const { error } = await db.auth.admin.updateUserById(konto.id, { password: passwort });
if (error) {
  console.error(`Passwort nicht gesetzt: ${error.message}`);
  process.exit(1);
}
console.log(`Neues Startpasswort für ${email} (nur jetzt sichtbar): ${passwort}`);
