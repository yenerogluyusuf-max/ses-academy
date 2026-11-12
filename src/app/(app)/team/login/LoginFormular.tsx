"use client";

import { useActionState } from "react";
import { anmelden, type LoginZustand } from "@/lib/aktionen/team";
import type { TeamSprache } from "@/lib/team-sprache";

const T = {
  de: { email: "E-Mail", passwort: "Passwort", anmelden: "Anmelden", laeuft: "Anmelden …", eingabe: "Bitte E-Mail und Passwort eingeben.", falsch: "E-Mail oder Passwort stimmt nicht." },
  tr: { email: "E-posta", passwort: "Şifre", anmelden: "Giriş yap", laeuft: "Giriş yapılıyor …", eingabe: "Lütfen e-posta ve şifreni gir.", falsch: "E-posta ya da şifre yanlış." },
  fr: { email: "E-mail", passwort: "Mot de passe", anmelden: "Se connecter", laeuft: "Connexion …", eingabe: "Merci de saisir ton e-mail et ton mot de passe.", falsch: "E-mail ou mot de passe incorrect." },
} satisfies Record<TeamSprache, Record<string, string>>;

export function LoginFormular({ sprache = "de" }: { sprache?: TeamSprache }) {
  const t = T[sprache];
  const [zustand, aktion, sendet] = useActionState<LoginZustand, FormData>(anmelden, { fehler: null });
  const feld = "w-full rounded-2xl bg-white/80 px-4 py-3.5 text-lg ring-1 ring-line outline-none focus:ring-2 focus:ring-ink";
  return (
    <form action={aktion} className="mt-8 grid gap-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-semibold">{t.email}</label>
        <input id="email" name="email" type="email" required autoComplete="username" className={feld} />
      </div>
      <div>
        <label htmlFor="passwort" className="mb-1.5 block text-sm font-semibold">{t.passwort}</label>
        <input id="passwort" name="passwort" type="password" required autoComplete="current-password" className={feld} />
      </div>
      {zustand.fehler && <p role="alert" className="text-sm font-semibold text-red-800">{t[zustand.fehler]}</p>}
      <button type="submit" disabled={sendet} className="rounded-full bg-ink px-8 py-4 text-lg font-semibold text-paper transition hover:bg-forest disabled:opacity-60">
        {sendet ? t.laeuft : t.anmelden}
      </button>
    </form>
  );
}
