import { Stimmenseite, metaFuer } from "@/components/seiten";
import { texte } from "@/i18n";
import { freigegebeneStimmen } from "@/lib/stimmen-db";

export const metadata = metaFuer("de", "/stimmen", texte.de.stimmen.nav, texte.de.stimmen.meta);

// Eingereichte und freigegebene Beiträge kommen aus der Datenbank: alle fünf Minuten neu (sofort nach einer Freigabe).
export const revalidate = 300;

export default async function Page() {
  return <Stimmenseite l="de" extra={await freigegebeneStimmen()} />;
}
