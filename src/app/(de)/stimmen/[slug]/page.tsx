import { notFound } from "next/navigation";
import { Beitragsseite, metaFuer } from "@/components/seiten";
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

export function generateStaticParams() {
  // Statischer Export verlangt mindestens einen Pfad; ohne Beiträge entsteht nur eine 404-Seite.
  return beitraege.length ? beitraege.map((b) => ({ slug: b.slug })) : [{ slug: "leer" }];
}

export async function generateMetadata({ params }: PageProps<"/stimmen/[slug]">) {
  const { slug } = await params;
  const f = await finde(slug);
  return f ? metaFuer("de", `/stimmen/${f.b.slug}`, f.b.titel, f.b.teaser) : {};
}

export default async function Page({ params }: PageProps<"/stimmen/[slug]">) {
  const { slug } = await params;
  const f = await finde(slug);
  if (!f) notFound();
  return <Beitragsseite l="de" slug={slug} extra={f.extra} />;
}
