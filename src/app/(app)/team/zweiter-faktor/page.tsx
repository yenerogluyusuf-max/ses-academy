import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { abmelden } from "@/lib/aktionen/team";
import { getStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { TeamSprache } from "@/lib/team-sprache";
import { teamTexte } from "@/lib/team-texte";
import { FaktorFormular } from "./FaktorFormular";

export const metadata: Metadata = { title: "Zweiter Faktor | SES Academy", robots: { index: false, follow: false } };

const de = {
  codeAusApp: "Code aus der App",
  einrichten: "Zweiten Faktor einrichten",
  intro: "Der Team-Bereich enthält Telefonnummern und Bewertungen von über 160 Personen. Deshalb braucht jede Anmeldung zusätzlich einen Code aus einer Authenticator-App auf deinem Handy.",
  verloren: "Handy verloren? Ein Admin kann deinen zweiten Faktor zurücksetzen.",
};
const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    codeAusApp: "Uygulamadaki kod",
    einrichten: "İkinci faktörü kur",
    intro: "Ekip alanında 160’tan fazla kişinin telefon numaraları ve değerlendirmeleri var. Bu yüzden her girişte ayrıca telefonundaki bir doğrulama uygulamasından kod gerekiyor.",
    verloren: "Telefonunu mu kaybettin? Bir yönetici ikinci faktörünü sıfırlayabilir.",
  },
  fr: {
    codeAusApp: "Code de l’application",
    einrichten: "Configurer le second facteur",
    intro: "L’espace équipe contient les numéros de téléphone et les évaluations de plus de 160 personnes. C’est pourquoi chaque connexion demande en plus un code issu d’une application d’authentification sur ton téléphone.",
    verloren: "Téléphone perdu ? Un admin peut réinitialiser ton second facteur.",
  },
};

/** Zweiter Faktor fürs Team: beim ersten Mal einrichten, danach bei jeder Anmeldung den Code aus der App eingeben. */
export default async function ZweiterFaktor() {
  const staff = await getStaff();
  if (!staff) redirect("/team/login/");
  const l = staff.sprache;
  const t = T[l];
  const supabase = await createClient();
  const [{ data: aal }, { data: faktoren }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);
  if (aal?.currentLevel === "aal2") redirect("/team/");
  const bestaetigt = faktoren?.totp.find((f) => f.status === "verified") ?? null;
  return (
    <main lang={l} className="mx-auto max-w-lg px-4 py-12">
      <img src="/brand/ses-logo.png" alt="SES Academy" className="h-10 w-auto" />
      <h1 className="font-display mt-8 text-3xl font-bold">{bestaetigt ? t.codeAusApp : t.einrichten}</h1>
      <p className="mt-2 text-ink-soft">{t.intro}</p>
      <FaktorFormular vorhandenerFaktor={bestaetigt?.id ?? null} sprache={l} />
      <form action={abmelden} className="mt-6"><button type="submit" className="text-sm font-semibold text-ink-soft underline">{teamTexte[l].abmelden}</button></form>
      <p className="mt-6 text-sm text-ink-soft">{t.verloren}</p>
    </main>
  );
}
