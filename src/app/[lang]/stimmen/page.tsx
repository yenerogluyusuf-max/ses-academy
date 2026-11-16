import { notFound } from "next/navigation";
import { Stimmenseite, metaFuer } from "@/components/seiten";
import { istSprache, texte } from "@/i18n";
import { freigegebeneStimmen } from "@/lib/stimmen-db";

// Eingereichte und freigegebene Beiträge kommen aus der Datenbank: alle fünf Minuten neu (sofort nach einer Freigabe).
export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<"/[lang]/stimmen">) {
  const { lang } = await params;
  return istSprache(lang) ? metaFuer(lang, "/stimmen", texte[lang].stimmen.nav, texte[lang].stimmen.meta) : {};
}

export default async function Page({ params }: PageProps<"/[lang]/stimmen">) {
  const { lang } = await params;
  if (!istSprache(lang)) notFound();
  return <Stimmenseite l={lang} extra={await freigegebeneStimmen()} />;
}
