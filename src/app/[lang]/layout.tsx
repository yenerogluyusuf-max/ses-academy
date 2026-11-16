import { notFound } from "next/navigation";
import { Rahmen } from "@/components/Rahmen";
import { istSprache } from "@/i18n";

// Unbekannte Sprachen fängt notFound() unten ab. Kein dynamicParams = false mehr: das galt auch für alle Unterseiten
// und hätte neue „Stimmen“-Beiträge aus der Datenbank (/fr/stimmen/<neu>/) mit 404 beantwortet.

export function generateStaticParams() {
  return (["tr", "en", "fr", "nl"] as const).map((lang) => ({ lang }));
}

export default async function SprachLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!istSprache(lang) || lang === "de") notFound();
  return <Rahmen l={lang}>{children}</Rahmen>;
}
