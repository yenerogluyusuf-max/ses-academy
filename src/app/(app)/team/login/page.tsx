import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { teamSpracheSetzen } from "@/lib/aktionen/team-sprache";
import { getStaff } from "@/lib/auth";
import { TEAM_SPRACH_COOKIE, teamSprachen, teamSprachNamen, type TeamSprache } from "@/lib/team-sprache";
import { LoginFormular } from "./LoginFormular";

export const metadata: Metadata = { title: "Team-Login | SES Academy" };

const T = {
  de: {
    zurWebsite: "Zur Website", titel: "Team-Bereich", intro: "Für Vorstand, Orga-Team und Einlass.", sprache: "Sprache",
    ohnePasswort: "Ohne Passwort:", mitCode: "mit Code aus der E-Mail anmelden", hinweis: "Das geht für alle Teamkonten und Teilnehmenden mit derselben Seite.",
  },
  tr: {
    zurWebsite: "Web sitesine git", titel: "Ekip alanı", intro: "Yönetim kurulu, organizasyon ekibi ve giriş görevlileri için.", sprache: "Dil",
    ohnePasswort: "Şifresiz:", mitCode: "e-postadaki kodla giriş yap", hinweis: "Bu sayfa tüm ekip hesapları ve katılımcılar için geçerli.",
  },
  fr: {
    zurWebsite: "Vers le site", titel: "Espace équipe", intro: "Pour le bureau, l’équipe d’organisation et l’accueil.", sprache: "Langue",
    ohnePasswort: "Sans mot de passe\u00a0:", mitCode: "se connecter avec le code reçu par e-mail", hinweis: "Cela fonctionne pour tous les comptes d’équipe et les participants, sur la même page.",
  },
} satisfies Record<TeamSprache, Record<string, string>>;

/** Sprache vor der Anmeldung: gewählte (Cookie), sonst die des Browsers. */
async function anmeldeSprache(): Promise<TeamSprache> {
  const gewaehlt = (await cookies()).get(TEAM_SPRACH_COOKIE)?.value;
  if (gewaehlt === "de" || gewaehlt === "tr" || gewaehlt === "fr") return gewaehlt;
  const browser = (await headers()).get("accept-language") ?? "";
  return /^\s*tr\b/i.test(browser) ? "tr" : /^\s*fr\b/i.test(browser) ? "fr" : "de";
}

export default async function LoginPage() {
  if (await getStaff()) redirect("/team/");
  const l = await anmeldeSprache();
  const t = T[l];
  return (
    <main lang={l} className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" aria-label={t.zurWebsite} title={t.zurWebsite}><img src="/brand/ses-logo.png" alt="SES Academy" className="h-12 w-auto" /></Link>
        <form action={teamSpracheSetzen} aria-label={t.sprache} className="flex flex-wrap gap-1.5">
          {teamSprachen.map((x) => x === l
            ? <span key={x} lang={x} aria-current="true" className="rounded-full bg-ink px-3 py-1.5 text-sm font-semibold text-paper">{teamSprachNamen[x]}</span>
            : <button key={x} type="submit" name="sprache" value={x} lang={x} className="rounded-full px-3 py-1.5 text-sm font-semibold text-ink-soft ring-1 ring-line hover:bg-paper-deep">{teamSprachNamen[x]}</button>)}
        </form>
      </div>
      <h1 className="font-display text-3xl font-bold">{t.titel}</h1>
      <p className="mt-2 text-ink-soft">{t.intro}</p>
      <LoginFormular key={l} sprache={l} />
      <p className="mt-6 rounded-2xl bg-white/70 p-4 text-sm ring-1 ring-line">
        {t.ohnePasswort} <Link href={`/mein-bereich/login/?sprache=${l}`} className="link">{t.mitCode}</Link>. {t.hinweis}
      </p>
    </main>
  );
}
