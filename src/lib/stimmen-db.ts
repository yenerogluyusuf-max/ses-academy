import "server-only";

import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { Beitrag, BeitragTyp, Land } from "@/i18n/stimmen";
import { sprachen, type Sprache } from "@/i18n/typ";

/**
 * Freigegebene Beiträge aus „Beitrag einreichen“ (Tabelle contributions, status = veroeffentlicht) für /stimmen/.
 * Liest ohne Sitzung über public_stimmen() – die Funktion gibt nur, was auf der Seite steht. Ist die Datenbank nicht
 * erreichbar (z. B. beim Bauen), zeigt die Seite einfach nur die fest eingetragenen Beiträge.
 */
export const freigegebeneStimmen = cache(async (): Promise<Beitrag[]> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  try {
    const sb = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (eingabe, init) => fetch(eingabe, { ...init, signal: AbortSignal.timeout(5000) }) },
    });
    const { data, error } = await sb.rpc("public_stimmen");
    if (error || !data) return [];
    return data.map(zuBeitrag);
  } catch {
    return [];
  }
}); // cache: Metadaten und Seite teilen sich einen Abruf pro Aufruf

const typen: BeitragTyp[] = ["kommentar", "video", "grafik", "podcast", "rede", "artikel"];
const laender: Land[] = ["de", "fr", "at", "nl", "be", "ch", "andere"];

/** YouTube-Video-ID aus einem Link (watch?v=, youtu.be/, shorts/, embed/). */
export function youtubeId(link: string | null): string | null {
  if (!link) return null;
  try {
    const u = new URL(link);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    const id = host === "youtu.be" ? u.pathname.slice(1)
      : host === "youtube.com" || host === "youtube-nocookie.com"
        ? u.searchParams.get("v") ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1] ?? null
        : null;
    return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function host(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return link;
  }
}

/** Erster Absatz als Anreißer, an einer Wortgrenze gekürzt. */
function anreisser(text: string, laenge = 220): string {
  if (text.length <= laenge) return text;
  const schnitt = text.lastIndexOf(" ", laenge);
  return `${text.slice(0, schnitt > 80 ? schnitt : laenge).replace(/[,;:–-]\s*$/, "")} …`;
}

type Zeile = Database["public"]["Functions"]["public_stimmen"]["Returns"][number];

function zuBeitrag(z: Zeile): Beitrag {
  const absaetze = (z.summary ?? "").split(/\n\s*\n/).map((a) => a.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
  const yt = youtubeId(z.url);
  const typ = typen.includes(z.kind as BeitragTyp) ? (z.kind as BeitragTyp) : "artikel";
  return {
    slug: z.slug,
    typ,
    land: laender.includes(z.country as Land) ? (z.country as Land) : "andere",
    sprache: (sprachen as readonly string[]).includes(z.language ?? "") ? (z.language as Sprache) : "de",
    datum: z.published_on ?? z.created_at.slice(0, 10),
    titel: z.title,
    teaser: anreisser(absaetze[0] ?? ""),
    text: absaetze,
    autor: { name: z.author_name ?? "", stadt: z.city ?? undefined },
    youtube: yt ?? undefined,
    anlass: typ === "rede" && z.outlet ? z.outlet : undefined,
    extern: z.url && !yt ? { url: z.url, medium: (typ !== "rede" && z.outlet) || host(z.url) } : undefined,
  };
}
