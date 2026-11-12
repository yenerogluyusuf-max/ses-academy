"use client";

import { useActionState } from "react";
import { faktorEinrichten, faktorPruefen, type FaktorZustand } from "@/lib/aktionen/team";
import type { TeamSprache } from "@/lib/team-sprache";

const T = {
  de: {
    schritt1: "1. Eine Authenticator-App öffnen (z. B. Google Authenticator, Microsoft Authenticator, 1Password) und diesen QR-Code scannen:",
    qrAlt: "QR-Code für die Authenticator-App",
    ohneKamera: "Ohne Kamera diesen Schlüssel in der App eintragen:",
    schritt2: "2. Den 6-stelligen Code aus der App eingeben:",
    start: "Du brauchst eine Authenticator-App auf dem Handy (z. B. Google Authenticator, Microsoft Authenticator, 1Password). Danach zeigt die Seite einen QR-Code zum Scannen.",
    vorbereitet: "Wird vorbereitet …", starten: "Einrichtung starten",
    code: "Code aus der App", prueft: "Prüfe …", bestaetigen: "Bestätigen",
    einrichten: "Das Einrichten hat nicht geklappt. Bitte neu laden.",
    stellen: "Der Code hat 6 Ziffern.",
    falsch: "Der Code stimmt nicht. Bitte den aktuellen Code aus der App eingeben.",
  },
  tr: {
    schritt1: "1. Bir doğrulama uygulaması aç (ör. Google Authenticator, Microsoft Authenticator, 1Password) ve bu QR kodu tara:",
    qrAlt: "Doğrulama uygulaması için QR kod",
    ohneKamera: "Kamera olmadan bu anahtarı uygulamaya gir:",
    schritt2: "2. Uygulamadaki 6 haneli kodu gir:",
    start: "Telefonunda bir doğrulama uygulaması olmalı (ör. Google Authenticator, Microsoft Authenticator, 1Password). Ardından sayfa taraman için bir QR kod gösterir.",
    vorbereitet: "Hazırlanıyor …", starten: "Kurulumu başlat",
    code: "Uygulamadaki kod", prueft: "Kontrol ediliyor …", bestaetigen: "Onayla",
    einrichten: "Kurulum olmadı. Lütfen sayfayı yeniden yükle.",
    stellen: "Kod 6 haneli olmalı.",
    falsch: "Kod doğru değil. Lütfen uygulamadaki güncel kodu gir.",
  },
  fr: {
    schritt1: "1. Ouvre une application d’authentification (p. ex. Google Authenticator, Microsoft Authenticator, 1Password) et scanne ce QR code :",
    qrAlt: "QR code pour l’application d’authentification",
    ohneKamera: "Sans caméra, saisis cette clé dans l’application :",
    schritt2: "2. Saisis le code à 6 chiffres affiché dans l’application :",
    start: "Il te faut une application d’authentification sur ton téléphone (p. ex. Google Authenticator, Microsoft Authenticator, 1Password). La page affiche ensuite un QR code à scanner.",
    vorbereitet: "Préparation …", starten: "Commencer la configuration",
    code: "Code de l’application", prueft: "Vérification …", bestaetigen: "Confirmer",
    einrichten: "La configuration n’a pas fonctionné. Merci de recharger la page.",
    stellen: "Le code comporte 6 chiffres.",
    falsch: "Le code est incorrect. Merci de saisir le code actuel de l’application.",
  },
} satisfies Record<TeamSprache, Record<string, string>>;

/** Einrichten (QR-Code scannen, Code bestätigen) oder Anmelden mit dem Code aus der Authenticator-App. */
export function FaktorFormular({ vorhandenerFaktor, sprache = "de" }: { vorhandenerFaktor: string | null; sprache?: TeamSprache }) {
  const t = T[sprache];
  const start: FaktorZustand = vorhandenerFaktor ? { schritt: "pruefen", faktorId: vorhandenerFaktor } : { schritt: "start" };
  const [zustand, pruefen, laeuft] = useActionState(faktorPruefen, start);
  // Erst auf Knopfdruck einrichten: bloßes Ansehen der Seite legt keinen (unbestätigten) Faktor an
  const [einrichtung, einrichten, bereitet] = useActionState(async () => faktorEinrichten(), null as FaktorZustand | null);
  const aktiv = vorhandenerFaktor ? zustand : { ...(einrichtung ?? { schritt: "start" as const }), fehler: zustand.fehler ?? einrichtung?.fehler };

  return (
    <div className="karte mt-6">
      {aktiv.schritt === "einrichten" && (
        <div className="mb-5">
          <p>{t.schritt1}</p>
          <img src={aktiv.qr} alt={t.qrAlt} className="mx-auto my-4 h-48 w-48 rounded-2xl bg-white p-2 ring-1 ring-line" />
          <p className="text-sm text-ink-soft">{t.ohneKamera} <code className="break-all font-mono">{aktiv.geheimnis}</code></p>
          <p className="mt-4">{t.schritt2}</p>
        </div>
      )}
      {aktiv.schritt === "start" && (
        <form action={einrichten} className="space-y-3">
          <p>{t.start}</p>
          <button type="submit" disabled={bereitet} className="knopf">{bereitet ? t.vorbereitet : t.starten}</button>
        </form>
      )}
      {(aktiv.schritt === "einrichten" || aktiv.schritt === "pruefen") && (
        <form action={pruefen} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="faktor_id" value={aktiv.faktorId} />
          <div className="min-w-0 flex-1">
            <label htmlFor="code" className="etikett">{t.code}</label>
            <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required autoFocus className="feld text-center font-display text-2xl tracking-[0.4em]" />
          </div>
          <button type="submit" disabled={laeuft} className="knopf !py-3">{laeuft ? t.prueft : t.bestaetigen}</button>
        </form>
      )}
      {aktiv.fehler && <p role="alert" className="mt-3 rounded-2xl bg-rot-hell p-3 text-sm font-semibold text-rot">{t[aktiv.fehler]}</p>}
    </div>
  );
}
