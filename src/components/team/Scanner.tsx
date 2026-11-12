"use client";

import jsQR from "jsqr";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TeamSprache } from "@/lib/team-sprache";

type Props = {
  /** Wird mit dem gelesenen QR-Inhalt aufgerufen. Während das Promise läuft, pausiert die Erkennung. */
  onCode: (inhalt: string) => Promise<void>;
  /** Kamera geht nicht: Die Seite soll auf die Codeeingabe umlenken. */
  onKeineKamera: () => void;
  sprache?: TeamSprache;
};

const de = {
  start: "Kamera starten und den QR-Code in den Rahmen halten.",
  unsicher: "Die Kamera funktioniert nur über eine sichere Verbindung (https). Bitte den Kurzcode eingeben.",
  keinZugriff: "Dieser Browser erlaubt keinen Kamerazugriff. Bitte den Kurzcode eingeben.",
  aktiv: "Scanner aktiv. Er liest Code für Code weiter, ohne neu zu starten.",
  verweigert: "Kamerazugriff wurde verweigert. In den Browser-Einstellungen erlauben oder den Kurzcode eingeben.",
  keineKamera: "Keine Kamera gefunden. Bitte den Kurzcode eingeben.",
  belegt: "Die Kamera wird gerade von einer anderen App benutzt. Bitte die App schließen oder den Kurzcode eingeben.",
  fehler: "Kamera konnte nicht geöffnet werden. Bitte den Kurzcode eingeben.",
  starten: "Kamera starten",
  stoppen: "Kamera stoppen",
  lampeAus: "Taschenlampe aus",
  lampeAn: "Taschenlampe an",
};

// Türkisch „okuyucu“ (QR-Leser) statt „tarayıcı“, das dort auch „Browser“ heißt
const T: Record<TeamSprache, typeof de> = {
  de,
  tr: {
    start: "Kamerayı başlat ve QR kodu çerçevenin içine tut.",
    unsicher: "Kamera yalnızca güvenli bağlantıda (https) çalışır. Lütfen kısa kodu gir.",
    keinZugriff: "Bu tarayıcı kameraya erişime izin vermiyor. Lütfen kısa kodu gir.",
    aktiv: "QR okuyucu açık. Yeniden başlatmadan kodları art arda okur.",
    verweigert: "Kamera erişimi reddedildi. Tarayıcı ayarlarından izin ver ya da kısa kodu gir.",
    keineKamera: "Kamera bulunamadı. Lütfen kısa kodu gir.",
    belegt: "Kamera şu anda başka bir uygulama tarafından kullanılıyor. Lütfen o uygulamayı kapat ya da kısa kodu gir.",
    fehler: "Kamera açılamadı. Lütfen kısa kodu gir.",
    starten: "Kamerayı başlat",
    stoppen: "Kamerayı durdur",
    lampeAus: "Feneri kapat",
    lampeAn: "Feneri aç",
  },
  fr: {
    start: "Démarre la caméra et place le QR code dans le cadre.",
    unsicher: "La caméra ne fonctionne qu’avec une connexion sécurisée (https). Saisis le code court.",
    keinZugriff: "Ce navigateur n’autorise pas l’accès à la caméra. Saisis le code court.",
    aktiv: "Scanner actif. Il lit les codes les uns après les autres, sans redémarrer.",
    verweigert: "Accès à la caméra refusé. Autorise-le dans les réglages du navigateur ou saisis le code court.",
    keineKamera: "Aucune caméra trouvée. Saisis le code court.",
    belegt: "La caméra est utilisée par une autre application. Ferme cette application ou saisis le code court.",
    fehler: "Impossible d’ouvrir la caméra. Saisis le code court.",
    starten: "Démarrer la caméra",
    stoppen: "Arrêter la caméra",
    lampeAus: "Éteindre la lampe",
    lampeAn: "Allumer la lampe",
  },
};

type Hinweis = "start" | "unsicher" | "keinZugriff" | "aktiv" | "verweigert" | "keineKamera" | "belegt" | "fehler";

// Taschenlampe ist (noch) nicht in den Standard-Typen von TypeScript.
type MitTaschenlampe = MediaTrackCapabilities & { torch?: boolean };

const GLEICHER_CODE_SPERRE_MS = 4000; // derselbe Code wird so lange nicht erneut gesendet
const PRUEF_ABSTAND_MS = 120; // nicht jedes Videobild auswerten, schont den Akku

export function Scanner({ onCode, onKeineKamera, sprache = "de" }: Props) {
  const t = T[sprache];
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const aktivRef = useRef(false);
  const beschaeftigtRef = useRef(false);
  const letzterRef = useRef<{ inhalt: string; zeit: number }>({ inhalt: "", zeit: 0 });
  const geprueftRef = useRef(0);
  const onCodeRef = useRef(onCode);
  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  const [laeuft, setLaeuft] = useState(false);
  // Schlüssel statt Text: so passt der Hinweis auch nach einem Sprachwechsel
  const [hinweis, setHinweis] = useState<Hinweis>("start");
  const [lampeMoeglich, setLampeMoeglich] = useState(false);
  const [lampeAn, setLampeAn] = useState(false);
  const [treffer, setTreffer] = useState(false);

  const stoppen = useCallback(() => {
    aktivRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setLaeuft(false);
    setLampeAn(false);
    setLampeMoeglich(false);
  }, []);

  useEffect(() => stoppen, [stoppen]);

  const pruefen = useCallback(function schleife() {
    if (!aktivRef.current) return;
    rafRef.current = requestAnimationFrame(schleife);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const jetzt = performance.now();
    if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) return;
    if (beschaeftigtRef.current || jetzt - geprueftRef.current < PRUEF_ABSTAND_MS) return;
    geprueftRef.current = jetzt;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const bild = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // attemptBoth: liest auch helle Codes auf dunklem Grund (Handy im Dunkelmodus)
    const code = jsQR(bild.data, bild.width, bild.height, { inversionAttempts: "attemptBoth" });
    if (!code?.data) return;

    const letzter = letzterRef.current;
    if (code.data === letzter.inhalt && Date.now() - letzter.zeit < GLEICHER_CODE_SPERRE_MS) return;
    letzterRef.current = { inhalt: code.data, zeit: Date.now() };

    beschaeftigtRef.current = true;
    setTreffer(true);
    navigator.vibrate?.(60);
    onCodeRef.current(code.data).finally(() => {
      beschaeftigtRef.current = false;
      setTimeout(() => setTreffer(false), 600);
    });
  }, []);

  async function starten() {
    if (!window.isSecureContext) {
      setHinweis("unsicher");
      onKeineKamera();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setHinweis("keinZugriff");
      onKeineKamera();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      const spur = stream.getVideoTracks()[0];
      setLampeMoeglich(Boolean((spur?.getCapabilities?.() as MitTaschenlampe | undefined)?.torch));
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      aktivRef.current = true;
      setLaeuft(true);
      setHinweis("aktiv");
      pruefen();
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      setHinweis(
        name === "NotAllowedError"
          ? "verweigert"
          : name === "NotFoundError" || name === "OverconstrainedError"
            ? "keineKamera"
            : name === "NotReadableError"
              ? "belegt"
              : "fehler",
      );
      stoppen();
      onKeineKamera();
    }
  }

  async function lampeUmschalten() {
    const spur = streamRef.current?.getVideoTracks()[0];
    if (!spur) return;
    try {
      await spur.applyConstraints({ advanced: [{ torch: !lampeAn } as MediaTrackConstraintSet] });
      setLampeAn(!lampeAn);
    } catch {
      setLampeMoeglich(false);
    }
  }

  const ecke = `absolute h-7 w-7 border-[3px] transition-colors ${treffer ? "border-signal" : "border-white"}`;

  return (
    <div>
      <canvas ref={canvasRef} className="hidden" />
      <div className="relative overflow-hidden rounded-3xl bg-ink" style={{ aspectRatio: "4 / 3" }}>
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        {!laeuft && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-paper/80">
            <p>{t[hinweis]}</p>
          </div>
        )}
        {laeuft && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-56 w-56">
              <span className={`${ecke} left-0 top-0 rounded-tl-xl border-b-0 border-r-0`} />
              <span className={`${ecke} right-0 top-0 rounded-tr-xl border-b-0 border-l-0`} />
              <span className={`${ecke} bottom-0 left-0 rounded-bl-xl border-r-0 border-t-0`} />
              <span className={`${ecke} bottom-0 right-0 rounded-br-xl border-l-0 border-t-0`} />
            </div>
          </div>
        )}
      </div>
      {laeuft && <p className="mt-3 text-sm text-ink-soft">{t[hinweis]}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {!laeuft ? (
          <button type="button" onClick={starten} className="rounded-full bg-ink px-6 py-3 font-semibold text-paper hover:bg-forest">
            {t.starten}
          </button>
        ) : (
          <button type="button" onClick={stoppen} className="rounded-full bg-white/80 px-6 py-3 font-semibold ring-1 ring-line">
            {t.stoppen}
          </button>
        )}
        {laeuft && lampeMoeglich && (
          <button type="button" onClick={lampeUmschalten} aria-pressed={lampeAn}
            className={`rounded-full px-6 py-3 font-semibold ring-1 ring-line ${lampeAn ? "bg-signal" : "bg-white/80"}`}>
            {lampeAn ? t.lampeAus : t.lampeAn}
          </button>
        )}
      </div>
    </div>
  );
}
