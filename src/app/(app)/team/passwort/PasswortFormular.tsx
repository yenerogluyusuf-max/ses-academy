"use client";

import { useActionState } from "react";
import { passwortAendern, type PasswortZustand } from "@/lib/aktionen/teamverwaltung";
import type { TeamSprache } from "@/lib/team-sprache";

const T = {
  de: {
    neu: "Neues Passwort", wiederholen: "Wiederholen", speichern: "Speichern",
    kurz: "Das Passwort braucht mindestens 10 Zeichen.", ungleich: "Die beiden Eingaben stimmen nicht überein.",
    fehler: "Das hat nicht geklappt. Ist das neue Passwort gleich dem alten?", geaendert: "Passwort geändert.",
  },
  tr: {
    neu: "Yeni şifre", wiederholen: "Tekrar gir", speichern: "Kaydet",
    kurz: "Şifre en az 10 karakter olmalı.", ungleich: "İki giriş birbiriyle aynı değil.",
    fehler: "Bu işlem olmadı. Yeni şifre eskisiyle aynı olabilir mi?", geaendert: "Şifre değiştirildi.",
  },
  fr: {
    neu: "Nouveau mot de passe", wiederholen: "Confirmer", speichern: "Enregistrer",
    kurz: "Le mot de passe doit contenir au moins 10 caractères.", ungleich: "Les deux saisies ne correspondent pas.",
    fehler: "Cela n’a pas fonctionné. Le nouveau mot de passe est-il identique à l’ancien ?", geaendert: "Mot de passe modifié.",
  },
} satisfies Record<TeamSprache, Record<string, string>>;

export function PasswortFormular({ sprache = "de" }: { sprache?: TeamSprache }) {
  const t = T[sprache];
  const [zustand, aktion, sendet] = useActionState<PasswortZustand, FormData>(passwortAendern, { meldung: null, ok: false });
  const feld = "w-full rounded-2xl bg-white/80 px-4 py-3.5 ring-1 ring-line outline-none focus:ring-2 focus:ring-ink";
  return (
    <form action={aktion} className="mt-6 grid gap-4">
      <div><label htmlFor="neu" className="mb-1.5 block text-sm font-semibold">{t.neu}</label>
        <input id="neu" name="neu" type="password" required minLength={10} autoComplete="new-password" className={feld} /></div>
      <div><label htmlFor="wiederholung" className="mb-1.5 block text-sm font-semibold">{t.wiederholen}</label>
        <input id="wiederholung" name="wiederholung" type="password" required minLength={10} autoComplete="new-password" className={feld} /></div>
      {zustand.meldung && <p role="status" className={zustand.ok ? "font-semibold text-emerald-900" : "font-semibold text-red-900"}>{t[zustand.meldung]}</p>}
      <button type="submit" disabled={sendet} className="rounded-full bg-ink px-6 py-3.5 font-semibold text-paper disabled:opacity-60">{t.speichern}</button>
    </form>
  );
}
