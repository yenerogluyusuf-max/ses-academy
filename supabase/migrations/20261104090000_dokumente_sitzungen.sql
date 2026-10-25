-- SES-Organisation, Phase 3 (Teil 3): Dokumente mit Versionen, Sitzungen mit Protokoll und Beschlüssen,
-- Zugang für Referenten (persönlicher Link ohne Konto, Erweiterung aus dem Gesamtplan).
--
--   documents / document_versions = Ablage mit Status, Kommission, Modul, Schlagworten; jede neue Datei eine Version.
--                                   kind 'material' und 'medien' erscheinen im Modul-Reiter „Material und Medien“.
--   meetings / meeting_decisions  = Sitzungen mit Protokoll und Beschlüssen; Aufgaben über tasks.meeting_id
--   module_speakers.access_token  = Link für Gäste: Ablauf, Anreise, Hotel, Ansprechperson; Folien, Foto, Kurzprofil hochladen

-- ---------------------------------------------------------------------------
-- Dokumente
-- ---------------------------------------------------------------------------
CREATE TABLE public.documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL CHECK (length(trim(title)) > 0),
  kind            text NOT NULL DEFAULT 'dokument' CHECK (kind IN ('dokument', 'material', 'medien', 'vorlage', 'protokoll')),
  status          text NOT NULL DEFAULT 'entwurf' CHECK (status IN ('entwurf', 'pruefung', 'final', 'archiv')),
  commission      text,
  module_id       uuid REFERENCES public.modules(id) ON DELETE SET NULL,
  tags            text[] NOT NULL DEFAULT '{}',
  description     text NOT NULL DEFAULT '',
  link            text CHECK (link IS NULL OR link ~* '^https?://'),   -- statt Datei z. B. Video oder Drive-Ordner
  current_version integer NOT NULL DEFAULT 0,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX documents_module_idx ON public.documents (module_id);
CREATE TRIGGER documents_touch BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.document_versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version      integer NOT NULL CHECK (version > 0),
  storage_path text NOT NULL UNIQUE,
  file_name    text NOT NULL,
  size_bytes   bigint,
  mime_type    text,
  note         text NOT NULL DEFAULT '',
  uploaded_by  uuid REFERENCES auth.users(id),
  uploaded_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, version)
);

-- Neue Version eintragen (Datei liegt schon im Speicher „dokumente“, vom Server hochgeladen); zählt die Version hoch
CREATE FUNCTION public.add_document_version(p_document_id uuid, p_storage_path text, p_file_name text, p_mime text, p_note text DEFAULT '')
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v integer; groesse bigint;
BEGIN
  IF NOT public.has_orga_access() THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'orga_access_required'; END IF;
  IF p_storage_path !~ ('^' || p_document_id::text || '/[0-9]+-[A-Za-z0-9._-]{1,120}$') THEN RAISE EXCEPTION 'invalid_path'; END IF;
  SELECT (o.metadata ->> 'size')::bigint INTO groesse FROM storage.objects o WHERE o.bucket_id = 'dokumente' AND o.name = p_storage_path;
  IF NOT FOUND THEN RAISE EXCEPTION 'file_missing'; END IF;
  UPDATE public.documents SET current_version = current_version + 1 WHERE id = p_document_id RETURNING current_version INTO v;
  IF v IS NULL THEN RAISE EXCEPTION 'document_missing'; END IF;
  INSERT INTO public.document_versions (document_id, version, storage_path, file_name, size_bytes, mime_type, note, uploaded_by)
  VALUES (p_document_id, v, p_storage_path, left(p_file_name, 200), groesse, left(p_mime, 100), left(coalesce(p_note, ''), 500), auth.uid());
  RETURN v;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('dokumente', 'dokumente', false, 104857600), ('gaeste', 'gaeste', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Sitzungen
-- ---------------------------------------------------------------------------
CREATE TABLE public.meetings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL CHECK (length(trim(title)) > 0),
  held_on    date NOT NULL,
  commission text,
  attendees  text NOT NULL DEFAULT '',
  protocol   text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER meetings_touch BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.meeting_decisions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  text       text NOT NULL CHECK (length(trim(text)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ADD COLUMN meeting_id uuid REFERENCES public.meetings(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Zugang für Referenten
-- ---------------------------------------------------------------------------
ALTER TABLE public.module_speakers
  ADD COLUMN access_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  ADD COLUMN slides_path  text,
  ADD COLUMN photo_path   text;
-- Das Kurzprofil schreibt der Gast selbst in speakers.bio (über den Server, mit Prüfung des Links)

-- Gastseite: alles, was der Gast über seinen Einsatz wissen muss (nur serverseitig über den Link aufrufbar)
CREATE FUNCTION public.get_guest_sheet(p_token uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', ms.id, 'name', s.name, 'bio', s.bio, 'role', ms.role, 'topic', ms.topic, 'status', ms.status,
    'module', m.title, 'location', m.location, 'host', ms.host_name,
    'arrival_at', ms.arrival_at, 'arrival_info', ms.arrival_info, 'departure_at', ms.departure_at,
    'hotel', ms.hotel_info, 'tech', ms.tech_needs, 'slides', ms.slides_path IS NOT NULL, 'photo', ms.photo_path IS NOT NULL,
    'program', (SELECT coalesce(jsonb_agg(jsonb_build_object('starts_at', p.starts_at, 'ends_at', p.ends_at, 'title', p.title, 'room', p.room)
                ORDER BY p.starts_at), '[]') FROM public.program_items p JOIN public.module_days d ON d.id = p.module_day_id
                WHERE d.module_id = m.id AND p.status <> 'entfaellt'))
    FROM public.module_speakers ms
    JOIN public.speakers s ON s.id = ms.speaker_id
    JOIN public.modules m ON m.id = ms.module_id
   WHERE ms.access_token = p_token AND ms.status IN ('zugesagt', 'bestaetigt')
$$;

-- ---------------------------------------------------------------------------
-- Zeilenschutz
-- ---------------------------------------------------------------------------
ALTER TABLE public.documents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY documents_orga  ON public.documents         FOR ALL TO authenticated USING (public.has_orga_access()) WITH CHECK (public.has_orga_access());
CREATE POLICY versions_read   ON public.document_versions FOR SELECT TO authenticated USING (public.has_orga_access());
CREATE POLICY meetings_orga   ON public.meetings          FOR ALL TO authenticated USING (public.has_orga_access()) WITH CHECK (public.has_orga_access());
CREATE POLICY decisions_orga  ON public.meeting_decisions FOR ALL TO authenticated USING (public.has_orga_access()) WITH CHECK (public.has_orga_access());
REVOKE ALL ON public.documents, public.document_versions, public.meetings, public.meeting_decisions FROM anon;
-- Versionen entstehen nur über add_document_version
REVOKE INSERT, UPDATE, DELETE ON public.document_versions FROM authenticated;
-- Gast-Links sind wie die Sorumlu-Links für Teamkonten nicht lesbar
REVOKE SELECT ON public.module_speakers FROM authenticated;
GRANT SELECT (id, module_id, speaker_id, role, topic, status, status_at, program_item_id, host_name, arrival_at, arrival_info,
  departure_at, hotel_info, tech_needs, slides_received, bio_received, fee, travel_costs, notes, created_at, slides_path, photo_path)
  ON public.module_speakers TO authenticated;

REVOKE ALL ON FUNCTION public.add_document_version(uuid, text, text, text, text), public.get_guest_sheet(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_document_version(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_guest_sheet(uuid) TO service_role;
