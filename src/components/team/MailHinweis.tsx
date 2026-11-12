import { MailWarning } from "lucide-react";
import { getStaff } from "@/lib/auth";
import { mailBereit } from "@/lib/mail";
import type { TeamSprache } from "@/lib/team-sprache";

const T: Record<TeamSprache, { knapp: string; titel: string; text: string; zugang: string }> = {
  de: {
    knapp: "Mailversand ist nicht eingerichtet: Hier geht im Moment keine Mail raus.",
    titel: "Mailversand ist noch nicht eingerichtet.",
    text: "Es gehen keine Mails raus: keine Tickets, Info-Mails, Willkommens- und Absagemails und auch keine Login-Codes für „Mein Bereich“.",
    zugang: "Die Zugangsdaten für das Postfach info@ses-academy.org müssen noch auf dem Server eingetragen werden.",
  },
  tr: {
    knapp: "E-posta gönderimi kurulmadı: Şu an buradan e-posta gitmiyor.",
    titel: "E-posta gönderimi henüz kurulmadı.",
    text: "Hiç e-posta gitmiyor: bilet, bilgilendirme, hoş geldin ve iptal e-postaları gitmiyor, „Mein Bereich“ için giriş kodları da gitmiyor.",
    zugang: "info@ses-academy.org posta kutusunun erişim bilgileri henüz sunucuya girilmedi.",
  },
  fr: {
    knapp: "L’envoi d’e-mails n’est pas configuré : aucun e-mail ne part d’ici pour le moment.",
    titel: "L’envoi d’e-mails n’est pas encore configuré.",
    text: "Aucun e-mail ne part : ni billets, ni e-mails d’information, de bienvenue ou d’annulation, ni codes de connexion pour « Mon espace ».",
    zugang: "Les identifiants de la boîte mail info@ses-academy.org doivent encore être saisis sur le serveur.",
  },
};

/**
 * Deutlicher Hinweis, solange keine SMTP-Zugangsdaten eingetragen sind (mailBereit). Dann gehen keine Mails raus:
 * weder Tickets und Info-Mails noch die Login-Codes. Groß auf der Startseite, knapp direkt an jedem Versandknopf.
 * sprache: Sprache des Team-Bereichs; ohne Angabe die des angemeldeten Teamkontos (sonst Deutsch).
 */
export async function MailHinweis({ knapp = false, className = "", sprache }: { knapp?: boolean; className?: string; sprache?: TeamSprache }) {
  if (mailBereit()) return null;
  const l = sprache ?? (await getStaff())?.sprache ?? "de";
  const t = T[l];
  if (knapp)
    return (
      <p role="alert" lang={l} className={`flex items-start gap-2 rounded-2xl bg-rot-hell px-4 py-2.5 text-sm font-semibold text-rot ${className}`}>
        <MailWarning aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
        {t.knapp}
      </p>
    );
  return (
    <div role="alert" lang={l} className={`flex items-start gap-3 rounded-2xl bg-rot-hell p-4 text-rot ${className}`}>
      <MailWarning aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-semibold">{t.titel}</p>
        <p className="mt-1 text-sm">
          {t.text}
          {" "}{t.zugang}
        </p>
      </div>
    </div>
  );
}
