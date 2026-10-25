import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { abmelden } from "@/lib/aktionen/team";
import { getStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FaktorFormular } from "./FaktorFormular";

export const metadata: Metadata = { title: "Zweiter Faktor | SES Academy", robots: { index: false, follow: false } };

/** Zweiter Faktor fürs Team: beim ersten Mal einrichten, danach bei jeder Anmeldung den Code aus der App eingeben. */
export default async function ZweiterFaktor() {
  const staff = await getStaff();
  if (!staff) redirect("/team/login/");
  const supabase = await createClient();
  const [{ data: aal }, { data: faktoren }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);
  if (aal?.currentLevel === "aal2") redirect("/team/");
  const bestaetigt = faktoren?.totp.find((f) => f.status === "verified") ?? null;
  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <img src="/brand/ses-logo.png" alt="SES Academy" className="h-10 w-auto" />
      <h1 className="font-display mt-8 text-3xl font-bold">{bestaetigt ? "Code aus der App" : "Zweiten Faktor einrichten"}</h1>
      <p className="mt-2 text-ink-soft">
        Der Team-Bereich enthält Telefonnummern und Bewertungen von über 160 Personen. Deshalb braucht jede Anmeldung
        zusätzlich einen Code aus einer Authenticator-App auf deinem Handy.
      </p>
      <FaktorFormular vorhandenerFaktor={bestaetigt?.id ?? null} />
      <form action={abmelden} className="mt-6"><button type="submit" className="text-sm font-semibold text-ink-soft underline">Abmelden</button></form>
      <p className="mt-6 text-sm text-ink-soft">Handy verloren? Ein Admin kann deinen zweiten Faktor zurücksetzen.</p>
    </main>
  );
}
