import type { Metadata } from "next";
import { TeamKopf } from "@/components/team/TeamKopf";
import { requireStaff } from "@/lib/auth";
import type { TeamSprache } from "@/lib/team-sprache";
import { PasswortFormular } from "./PasswortFormular";

export const metadata: Metadata = { title: "Passwort | SES Academy" };

const T: Record<TeamSprache, { titel: string }> = {
  de: { titel: "Passwort ändern" },
  tr: { titel: "Şifreyi değiştir" },
  fr: { titel: "Changer le mot de passe" },
};

export default async function PasswortSeite() {
  const staff = await requireStaff("einlass");
  const l = staff.sprache;
  return (
    <>
      <TeamKopf staff={staff} />
      <main lang={l} className="mx-auto max-w-md px-4 py-8">
        <h1 className="font-display text-3xl font-bold">{T[l].titel}</h1>
        <PasswortFormular key={l} sprache={l} />
      </main>
    </>
  );
}
