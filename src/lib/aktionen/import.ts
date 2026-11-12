"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { istToken } from "@/lib/codes";
import { importiere, type Bericht, type ImportArt } from "@/lib/import/importe";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TeamSprache } from "@/lib/team-sprache";

export type ImportZustand = { bericht?: Bericht; fehler?: string; dateiname?: string };

/** Fehlertexte in der Sprache des Teamkontos (der Bericht selbst kommt aus lib/import/importe in derselben Sprache). */
const fehlerTexte: Record<TeamSprache, { art: string; datei: string; gross: string; format: string; bestaetigen: string; lesen: string }> = {
  de: {
    art: "Bitte die Art der Datei wählen.",
    datei: "Bitte eine Datei auswählen.",
    gross: "Die Datei ist größer als 10 MB.",
    format: "Bitte eine Excel-Datei (.xlsx, .xlsm) oder CSV hochladen.",
    bestaetigen: "Bitte das Übernehmen bestätigen. Es wurde nichts gespeichert.",
    lesen: "Die Datei konnte nicht gelesen werden.",
  },
  tr: {
    art: "Lütfen dosya türünü seç.",
    datei: "Lütfen bir dosya seç.",
    gross: "Dosya 10 MB’tan büyük.",
    format: "Lütfen bir Excel dosyası (.xlsx, .xlsm) ya da CSV yükle.",
    bestaetigen: "Lütfen aktarmayı onayla. Hiçbir şey kaydedilmedi.",
    lesen: "Dosya okunamadı.",
  },
  fr: {
    art: "Merci de choisir le type de fichier.",
    datei: "Merci de choisir un fichier.",
    gross: "Le fichier dépasse 10\u00a0Mo.",
    format: "Merci d’envoyer un fichier Excel (.xlsx, .xlsm) ou CSV.",
    bestaetigen: "Merci de confirmer l’application. Rien n’a été enregistré.",
    lesen: "Le fichier n’a pas pu être lu.",
  },
};

const arten: ImportArt[] = ["teilnehmerliste", "hausaufgaben", "bewertungsbogen", "emails", "zusagen"];

/**
 * Excel-/CSV-Import. Nur admin/vorstand. Läuft mit Dienstschlüssel, weil historische Anwesenheiten
 * (attendances) sonst nur über die Check-in-Funktionen geschrieben werden dürfen.
 */
export async function importieren(_: ImportZustand, formData: FormData): Promise<ImportZustand> {
  const sprache = (await requireStaff("alles")).sprache;
  const f = fehlerTexte[sprache];
  const art = String(formData.get("art")) as ImportArt;
  const datei = formData.get("datei");
  if (!arten.includes(art)) return { fehler: f.art };
  if (!(datei instanceof File) || datei.size === 0) return { fehler: f.datei };
  if (datei.size > 10 * 1024 * 1024) return { fehler: f.gross };
  if (!/\.(xlsx|xlsm|csv)$/i.test(datei.name)) return { fehler: f.format };
  // Übernehmen schreibt in die Datenbank: nur nach der Rückfrage im Formular
  if (formData.get("modus") === "anwenden" && formData.get("bestaetigt") !== "ja") return { fehler: f.bestaetigen };
  try {
    const bericht = await importiere(createAdminClient(), art, datei, {
      anwenden: formData.get("modus") === "anwenden",
      vorschlaegeUebernehmen: formData.get("vorschlaege") === "on",
      fehlendeAnlegen: formData.get("anlegen") === "on",
      ueberschreiben: formData.get("ueberschreiben") === "on",
      hausaufgabeNr: Number(formData.get("hausaufgabe_nr")) || 1,
      modulId: istToken(String(formData.get("modul_id") ?? "")) ? String(formData.get("modul_id")) : undefined,
      sprache,
    });
    if (bericht.angewendet) revalidatePath("/team/", "layout");
    return { bericht, dateiname: datei.name };
  } catch (e) {
    return { fehler: e instanceof Error ? e.message : f.lesen, dateiname: datei.name };
  }
}
