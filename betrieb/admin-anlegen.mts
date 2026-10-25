// Erstes Teamkonto (Rolle Admin) im Betrieb anlegen, solange es noch keinen Admin gibt, der das über /team/team/ tun kann.
// Aufruf über ./ses.sh admin <email> "<Name>". Das Startpasswort wird genau einmal im Terminal angezeigt;
// persönlich weitergeben und nach dem ersten Login unter „Passwort“ ändern.
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const [email, name] = process.argv.slice(2);
if (!email || !name) {
  console.error('Aufruf: ./ses.sh admin <email> "<Name>"');
  process.exit(1);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const passwort = randomBytes(12).toString("base64url");
const { data, error } = await db.auth.admin.createUser({ email: email.trim().toLowerCase(), password: passwort, email_confirm: true });
if (error || !data.user) {
  console.error(`Konto nicht angelegt: ${error?.message ?? "unbekannter Fehler"}`);
  process.exit(1);
}
const { error: fehler } = await db.from("staff_members").insert({ user_id: data.user.id, role: "admin", display_name: name.trim() });
if (fehler) {
  await db.auth.admin.deleteUser(data.user.id);
  console.error(`Rolle nicht gesetzt: ${fehler.message}`);
  process.exit(1);
}
console.log(`Admin ${name} <${email}> angelegt. Startpasswort (nur jetzt sichtbar): ${passwort}`);
