import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth";
import { LoginFormular } from "./LoginFormular";

export const metadata: Metadata = { title: "Team-Login | SES Academy" };

export default async function LoginPage() {
  if (await getStaff()) redirect("/team/");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
      <img src="/brand/ses-logo.png" alt="SES Academy" className="mb-8 h-12 w-auto self-start" />
      <h1 className="font-display text-3xl font-bold">Team-Bereich</h1>
      <p className="mt-2 text-ink-soft">Für Vorstand, Orga-Team und Einlass.</p>
      <LoginFormular />
      <p className="mt-6 rounded-2xl bg-white/70 p-4 text-sm ring-1 ring-line">
        Ohne Passwort: <Link href="/mein-bereich/login/" className="link">mit Code aus der E-Mail anmelden</Link>. Das geht für alle
        Teamkonten und Teilnehmenden mit derselben Seite.
      </p>
    </main>
  );
}
