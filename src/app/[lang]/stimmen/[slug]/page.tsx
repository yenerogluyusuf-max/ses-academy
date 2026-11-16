import { notFound } from "next/navigation";
import { Beitragsseite, metaFuer } from "@/components/seiten";
import { istSprache } from "@/i18n";
import { beitraege } from "@/i18n/stimmen";
import { freigegebeneStimmen } from "@/lib/stimmen-db";

async function finde(slug: string) {
  const fest = beitraege.find((x) => x.slug === slug);
  if (fest) return { b: fest, extra: [] };
  const extra = await freigegebeneStimmen();
  const b = extra.find((x) => x.slug === slug);
  return b ? { b, extra } : null;
}

// Fest eingetragene Beiträge werden vorgerendert, freigegebene aus der Datenbank beim ersten Aufruf (dann zwischengespeichert).
export const revalidate = 300;
// Freigegebene Beiträge aus der Datenbank haben Adressen, die beim Bauen noch nicht bekannt sind.
export const dynamicParams = true;

export function generateStaticParams() {
  // Statischer Export verlangt mindestens einen Pfad; ohne Beiträge entsteht nur eine 404-Seite.
  return beitraege.length ? beitraege.map((b) => ({ slug: b.slug })) : [{ slug: "leer" }];
}

export async function generateMetadata({ params }: PageProps<"/[lang]/stimmen/[slug]">) {
  const { lang, slug } = await params;
  const f = istSprache(lang) ? await finde(slug) : null;
  return f && istSprache(lang) ? metaFuer(lang, `/stimmen/${f.b.slug}`, f.b.titel, f.b.teaser) : {};
}

export default async function Page({ params }: PageProps<"/[lang]/stimmen/[slug]">) {
  const { lang, slug } = await params;
  const f = istSprache(lang) ? await finde(slug) : null;
  if (!f || !istSprache(lang)) notFound();
  return <Beitragsseite l={lang} slug={slug} extra={f.extra} />;
}
