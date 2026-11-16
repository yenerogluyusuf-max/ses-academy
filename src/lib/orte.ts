import type { TeamSprache } from "@/lib/team-sprache";

/**
 * Orts-, Länder- und Regionsnamen in der Sprache des Team-Bereichs (Wunsch Yusuf 16.11.2026: „Deutsch soll auch
 * Deutsch sein, nicht Münich, sondern München“).
 * Die Daten selbst bleiben unverändert: Wohnort und Land stammen wörtlich aus dem (türkischsprachigen)
 * Bewerbungsformular, die IGMG-Regionen tragen türkische Namen. Übersetzt wird nur in der Anzeige; im türkischen
 * Team-Bereich bleibt das Original stehen.
 */

/** Einzelne Wörter bzw. ganze Namen, ohne Rücksicht auf Groß-/Kleinschreibung verglichen. */
const woerter: Record<"de" | "fr", Record<string, string>> = {
  de: {
    // Städte
    viyana: "Wien", "münih": "München", "münich": "München", munich: "München", "brüksel": "Brüssel", londra: "London",
    kolonya: "Köln", "zürih": "Zürich", cenevre: "Genf", lahey: "Den Haag", strasbourg: "Straßburg", strazburg: "Straßburg",
    marsilya: "Marseille", lozan: "Lausanne", "nürnberg": "Nürnberg",
    // Länder
    almanya: "Deutschland", almayana: "Deutschland", avusturya: "Österreich", avustruya: "Österreich", aut: "Österreich",
    fransa: "Frankreich", hollanda: "Niederlande", "belçika": "Belgien", belcika: "Belgien", "i̇sviçre": "Schweiz", "isviçre": "Schweiz",
    ingiltere: "England", isvec: "Schweden", "isveç": "Schweden", "türkiye": "Türkei",
    // Regionsbestandteile
    bavyera: "Bayern",
  },
  fr: {
    viyana: "Vienne", "münih": "Munich", "münich": "Munich", "münchen": "Munich", "brüksel": "Bruxelles", londra: "Londres",
    kolonya: "Cologne", "köln": "Cologne", "zürih": "Zurich", cenevre: "Genève", lahey: "La Haye", strazburg: "Strasbourg",
    marsilya: "Marseille", lozan: "Lausanne",
    almanya: "Allemagne", almayana: "Allemagne", avusturya: "Autriche", avustruya: "Autriche", aut: "Autriche",
    fransa: "France", hollanda: "Pays-Bas", "belçika": "Belgique", belcika: "Belgique", "i̇sviçre": "Suisse", "isviçre": "Suisse",
    ingiltere: "Angleterre", isvec: "Suède", "isveç": "Suède", "türkiye": "Turquie", deutschland: "Allemagne", "österreich": "Autriche",
    bavyera: "Bavière",
  },
};

/** IGMG-Regionen mit türkischem Namen: ganze Bezeichnung (Abkürzungen wie „D.“ = Doğu = Ost). */
const regionen: Record<"de" | "fr", Record<string, string>> = {
  de: {
    "A-Viyana": "A-Wien", "Güney Bavyera": "Südbayern", "Kuzey Ruhr": "Nord-Ruhr", "D. Fransa": "Ostfrankreich",
    "G.B. Fransa": "Südwestfrankreich", "İsviçre": "Schweiz",
  },
  fr: {
    "A-Viyana": "A-Vienne", "Güney Bavyera": "Bavière du Sud", "Kuzey Ruhr": "Ruhr Nord", "D. Fransa": "France de l’Est",
    "G.B. Fransa": "France du Sud-Ouest", "İsviçre": "Suisse", "Köln": "Cologne", "Württemberg": "Wurtemberg",
    "Schwaben": "Souabe", "Hessen": "Hesse",
  },
};

const klein = (x: string) => x.toLocaleLowerCase("tr");

/** Freie Ortsangabe („Viyana“, „Almanya, Berlin“, „Viyana, Aut“) Wort für Wort in die Sprache übertragen. */
export function ort(text: string | null | undefined, sprache: TeamSprache): string | null {
  if (!text) return null;
  const t = text.trim();
  if (sprache === "tr" || !t) return t || null;
  const karte = woerter[sprache];
  return t.split(/([,/;]\s*|\s+)/).map((teil) => karte[klein(teil)] ?? teil).join("");
}

/** Name einer IGMG-Region in der Sprache des Team-Bereichs (Türkisch: Original). */
export function regionName(name: string | null | undefined, sprache: TeamSprache): string | null {
  if (!name) return null;
  if (sprache === "tr") return name;
  return regionen[sprache][name] ?? ort(name, sprache);
}
