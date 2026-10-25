-- SES-Organisation, Phase 2: Hausaufgaben selbst abgeben, Bewertungen bleiben intern.
--
-- Entscheidung vom 25.10.2026: Die Bewertung bleibt intern. Teilnehmende sehen nur, ob ihre Abgabe eingegangen ist.
-- Abgabe über „Mein Bereich“: Datei (privater Speicher „abgaben“) oder Link, mit Zeitpunkt; pünktlich/verspätet
-- ergibt sich wie bisher aus der Frist (get_assignment_status).

-- ---------------------------------------------------------------------------
-- Bewertungen nicht mehr für die Person selbst lesbar
-- ---------------------------------------------------------------------------
DROP POLICY reviews_self ON public.reviews;

-- ---------------------------------------------------------------------------
-- Sorumlu-Links nur serverseitig: die Spalte access_token ist für Teamkonten nicht mehr lesbar
-- (das Orga-Team liest die Tabelle für die Gruppenansicht). Admin/Vorstand sehen die Links über den Server.
-- ---------------------------------------------------------------------------
REVOKE SELECT ON public.mentors FROM authenticated, anon;
GRANT SELECT (id, name, email, user_id, created_at, phone) ON public.mentors TO authenticated;

-- ---------------------------------------------------------------------------
-- Abgaben mit Datei
-- ---------------------------------------------------------------------------
ALTER TABLE public.submissions
  ADD COLUMN storage_path text UNIQUE,       -- Pfad im Speicher „abgaben“, nur serverseitig abrufbar
  ADD COLUMN size_bytes   bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  ADD COLUMN submitted_at timestamptz;       -- genauer Zeitpunkt bei Selbst-Abgabe
-- Der Dateiname ist der Schlüssel für wiederholte Importe. Selbst-Abgaben dürfen gleiche Namen haben
-- (zwei Personen mit „video.mp4“, eine neue Version derselben Datei).
DROP INDEX public.submissions_file_unique;
CREATE UNIQUE INDEX submissions_file_unique ON public.submissions (assignment_id, file_name)
  WHERE file_name IS NOT NULL AND source <> 'self';
ALTER TABLE public.submissions DROP CONSTRAINT submissions_source_check;
ALTER TABLE public.submissions ADD CONSTRAINT submissions_source_check CHECK (source IN ('staff', 'list', 'review_sheet', 'self'));

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('abgaben', 'abgaben', false, 104857600)
ON CONFLICT (id) DO NOTHING;

-- Selbst-Abgabe der angemeldeten Person. Datei liegt schon im Speicher (vom Server hochgeladen) oder es kommt ein Link.
-- Nur Aufgaben des eigenen Jahrgangs; jede Abgabe wird neu angelegt (eine spätere ersetzt die frühere nicht).
CREATE FUNCTION public.submit_own_assignment(p_assignment_id uuid, p_link text DEFAULT NULL, p_storage_path text DEFAULT NULL,
                                             p_file_name text DEFAULT NULL, p_size_bytes bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  p public.participants%ROWTYPE;
  a public.assignments%ROWTYPE;
  sid uuid;
  link text := nullif(trim(p_link), '');
BEGIN
  SELECT * INTO p FROM public.participants WHERE user_id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('result', 'no_participant'); END IF;
  SELECT * INTO a FROM public.assignments WHERE id = p_assignment_id AND cohort_id = p.cohort_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('result', 'not_found'); END IF;
  IF link IS NULL AND p_storage_path IS NULL THEN RETURN jsonb_build_object('result', 'empty'); END IF;
  IF link IS NOT NULL AND link !~* '^https?://' THEN RETURN jsonb_build_object('result', 'invalid_link'); END IF;
  -- Der Speicherpfad muss zur Person und Aufgabe gehören (so legt ihn der Server an)
  IF p_storage_path IS NOT NULL AND p_storage_path NOT LIKE a.id::text || '/' || p.id::text || '/%' THEN
    RETURN jsonb_build_object('result', 'invalid_path');
  END IF;

  INSERT INTO public.submissions (assignment_id, label, file_name, link, submitted_on, submitted_at, source, storage_path, size_bytes)
  VALUES (a.id, public.display_name(p), nullif(left(trim(p_file_name), 200), ''), left(link, 1000),
          (now() AT TIME ZONE 'Europe/Berlin')::date, now(), 'self', p_storage_path, p_size_bytes)
  RETURNING id INTO sid;
  INSERT INTO public.submission_participants (submission_id, participant_id) VALUES (sid, p.id);
  INSERT INTO public.audit_log (actor_id, target_participant_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), p.id, 'submission_self', 'submission', sid, jsonb_build_object('assignment', a.number));
  RETURN jsonb_build_object('result', 'saved', 'submission_id', sid,
    'status', CASE WHEN a.due_at IS NULL OR now() <= a.due_at THEN 'puenktlich' ELSE 'verspaetet' END);
END $$;

REVOKE ALL ON FUNCTION public.submit_own_assignment(uuid, text, text, text, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_own_assignment(uuid, text, text, text, bigint) TO authenticated;
