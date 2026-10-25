-- SES-Organisation, Phase 2 (Teil für den Eventtag): Feedback-Umfrage je Modul, Sorumlu-Ansicht „fehlt noch“.
--
--   feedback_surveys    = eine Umfrage je Modul, offen von opens_at bis closes_at
--   feedback_questions  = Fragen der Umfrage (Skala 1–5 oder Freitext), Reihenfolge über position
--   feedback_responses  = eine Antwort je Person und Umfrage; Ergebnisse sieht das Team nur zusammengefasst
--   mentors.phone       = Telefon der Sorumlu für den Anruf-Knopf
--   mentors.access_token = geheimer Link, über den eine Sorumlu am Eventtag ohne Konto ihre Gruppe sieht

-- ---------------------------------------------------------------------------
-- Sorumlu
-- ---------------------------------------------------------------------------
ALTER TABLE public.mentors
  ADD COLUMN phone        text,
  ADD COLUMN access_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid();

-- Anwesenheit eines Modultags nach Sorumlu-Gruppe. Team ab Orga-Team: alle Gruppen.
-- Über den Sorumlu-Link (nur serverseitig, service_role) nur die eigene Gruppe, siehe get_group_status_by_token.
CREATE FUNCTION public.get_group_status(p_module_day_id uuid)
RETURNS TABLE (mentor_id uuid, mentor_name text, mentor_phone text, participant_id uuid, name text, phone text,
               registration_status public.registration_status, checked_in_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT m.id, m.name, m.phone, p.id, public.display_name(p), p.phone, r.status, a.checked_in_at
    FROM public.module_days d
    JOIN public.registrations r ON r.module_id = d.module_id AND r.status IN ('confirmed', 'excused', 'cancelled')
    JOIN public.participants p ON p.id = r.participant_id
    LEFT JOIN public.mentors m ON m.id = p.mentor_id
    LEFT JOIN public.attendances a ON a.registration_id = r.id AND a.module_day_id = d.id
   WHERE d.id = p_module_day_id AND public.has_orga_access()
   ORDER BY m.name NULLS LAST, p.last_name, p.first_name
$$;

CREATE FUNCTION public.get_group_status_by_token(p_token uuid, p_module_day_id uuid)
RETURNS TABLE (mentor_name text, participant_id uuid, name text, phone text,
               registration_status public.registration_status, checked_in_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT m.name, p.id, public.display_name(p), p.phone, r.status, a.checked_in_at
    FROM public.mentors m
    JOIN public.participants p ON p.mentor_id = m.id
    JOIN public.module_days d ON d.id = p_module_day_id
    JOIN public.registrations r ON r.module_id = d.module_id AND r.participant_id = p.id
                               AND r.status IN ('confirmed', 'excused', 'cancelled')
    LEFT JOIN public.attendances a ON a.registration_id = r.id AND a.module_day_id = d.id
   WHERE m.access_token = p_token
   ORDER BY p.last_name, p.first_name
$$;

-- ---------------------------------------------------------------------------
-- Feedback
-- ---------------------------------------------------------------------------
CREATE TABLE public.feedback_surveys (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id  uuid NOT NULL UNIQUE REFERENCES public.modules(id) ON DELETE CASCADE,
  opens_at   timestamptz NOT NULL,
  closes_at  timestamptz NOT NULL,
  sent_at    timestamptz,             -- wann die Einladung an die Anwesenden verschickt wurde
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (closes_at > opens_at)
);

CREATE TABLE public.feedback_questions (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.feedback_surveys(id) ON DELETE CASCADE,
  position  integer NOT NULL,
  kind      text NOT NULL CHECK (kind IN ('skala', 'text')),
  prompt    text NOT NULL CHECK (length(trim(prompt)) > 0),
  UNIQUE (survey_id, position)
);

CREATE TABLE public.feedback_responses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id      uuid NOT NULL REFERENCES public.feedback_surveys(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  answers        jsonb NOT NULL DEFAULT '{}',   -- { "<question_id>": 1..5 | "Text" }
  submitted_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (survey_id, participant_id)
);

-- Standardfragen für eine neue Umfrage (vom Team danach änderbar)
CREATE FUNCTION public.create_feedback_survey(p_module_id uuid, p_opens_at timestamptz, p_closes_at timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE sid uuid;
BEGIN
  IF NOT public.has_full_access() THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'full_access_required'; END IF;
  INSERT INTO public.feedback_surveys (module_id, opens_at, closes_at) VALUES (p_module_id, p_opens_at, p_closes_at)
  RETURNING id INTO sid;
  INSERT INTO public.feedback_questions (survey_id, position, kind, prompt) VALUES
    (sid, 1, 'skala', 'Wie zufrieden bist du insgesamt mit dem Modul?'),
    (sid, 2, 'skala', 'Wie gut waren die Vorträge und Referierenden?'),
    (sid, 3, 'skala', 'Wie hilfreich waren die Ländergruppen bzw. Workshops?'),
    (sid, 4, 'skala', 'Wie gut war die Organisation (Ablauf, Zeitplan, Kommunikation)?'),
    (sid, 5, 'skala', 'Wie zufrieden warst du mit Verpflegung und Unterkunft?'),
    (sid, 6, 'text',  'Was hat dir besonders gefallen?'),
    (sid, 7, 'text',  'Was sollen wir beim nächsten Modul besser machen?');
  RETURN sid;
END $$;

-- Antwort über den persönlichen Ticket-Token (Link aus der Mail oder Mein Bereich). Nur wer an einem Tag
-- des Moduls eingecheckt war, kann antworten; ein zweites Absenden überschreibt die erste Antwort.
CREATE FUNCTION public.submit_feedback(p_token uuid, p_survey_id uuid, p_answers jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  pid uuid;
  s public.feedback_surveys%ROWTYPE;
  sauber jsonb := '{}';
  q record;
  wert jsonb;
BEGIN
  SELECT id INTO pid FROM public.participants WHERE checkin_token = p_token;
  IF pid IS NULL THEN RETURN 'not_found'; END IF;
  SELECT * INTO s FROM public.feedback_surveys WHERE id = p_survey_id;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF now() < s.opens_at OR now() > s.closes_at THEN RETURN 'closed'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.attendances a
      JOIN public.registrations r ON r.id = a.registration_id
     WHERE r.participant_id = pid AND r.module_id = s.module_id) THEN
    RETURN 'not_attended';
  END IF;
  -- nur bekannte Fragen, Skala 1–5, Text höchstens 2000 Zeichen
  FOR q IN SELECT id, kind FROM public.feedback_questions WHERE survey_id = s.id LOOP
    wert := p_answers -> q.id::text;
    IF wert IS NULL OR wert = 'null'::jsonb THEN CONTINUE; END IF;
    IF q.kind = 'skala' AND jsonb_typeof(wert) = 'number' AND (wert #>> '{}')::numeric IN (1, 2, 3, 4, 5) THEN
      sauber := sauber || jsonb_build_object(q.id::text, (wert #>> '{}')::int);
    ELSIF q.kind = 'text' AND jsonb_typeof(wert) = 'string' AND length(trim(wert #>> '{}')) > 0 THEN
      sauber := sauber || jsonb_build_object(q.id::text, left(trim(wert #>> '{}'), 2000));
    END IF;
  END LOOP;
  INSERT INTO public.feedback_responses (survey_id, participant_id, answers) VALUES (s.id, pid, sauber)
  ON CONFLICT (survey_id, participant_id) DO UPDATE SET answers = excluded.answers, submitted_at = now();
  RETURN 'saved';
END $$;

-- Ergebnisse zusammengefasst: je Skalenfrage Anzahl und Durchschnitt, je Textfrage die Antworten ohne Namen.
CREATE FUNCTION public.get_feedback_results(p_survey_id uuid)
RETURNS TABLE (question_id uuid, nr integer, kind text, prompt text, answers integer,
               average numeric, distribution integer[], texts text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT q.id, q.position, q.kind, q.prompt,
         count(r.answers -> q.id::text)::int,
         round(avg(CASE WHEN q.kind = 'skala' THEN (r.answers ->> q.id::text)::numeric END), 2),
         CASE WHEN q.kind = 'skala' THEN ARRAY(
           SELECT count(*) FILTER (WHERE (r2.answers ->> q.id::text)::int = n)::int
             FROM generate_series(1, 5) n
             LEFT JOIN public.feedback_responses r2 ON r2.survey_id = q.survey_id
            GROUP BY n ORDER BY n) END,
         CASE WHEN q.kind = 'text' THEN array_agg(r.answers ->> q.id::text ORDER BY r.submitted_at)
                                         FILTER (WHERE r.answers ? q.id::text) END
    FROM public.feedback_questions q
    LEFT JOIN public.feedback_responses r ON r.survey_id = q.survey_id
   WHERE q.survey_id = p_survey_id AND public.has_full_access()
   GROUP BY q.id, q.position, q.kind, q.prompt, q.survey_id
   ORDER BY q.position
$$;

-- ---------------------------------------------------------------------------
-- Zeilenschutz
-- ---------------------------------------------------------------------------
ALTER TABLE public.feedback_surveys   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_responses ENABLE ROW LEVEL SECURITY;

-- Umfrage und Fragen: Team liest, Admin/Vorstand pflegen. Einzelantworten liest niemand direkt,
-- das Team sieht nur get_feedback_results.
CREATE POLICY surveys_staff_read  ON public.feedback_surveys FOR SELECT TO authenticated USING (public.has_orga_access());
CREATE POLICY surveys_full_write  ON public.feedback_surveys FOR ALL TO authenticated USING (public.has_full_access()) WITH CHECK (public.has_full_access());
CREATE POLICY questions_staff_read ON public.feedback_questions FOR SELECT TO authenticated USING (public.has_orga_access());
CREATE POLICY questions_full_write ON public.feedback_questions FOR ALL TO authenticated USING (public.has_full_access()) WITH CHECK (public.has_full_access());

REVOKE ALL ON public.feedback_surveys, public.feedback_questions, public.feedback_responses FROM anon;
REVOKE ALL ON FUNCTION public.get_group_status(uuid), public.get_group_status_by_token(uuid, uuid),
  public.create_feedback_survey(uuid, timestamptz, timestamptz), public.submit_feedback(uuid, uuid, jsonb),
  public.get_feedback_results(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_status(uuid), public.create_feedback_survey(uuid, timestamptz, timestamptz),
  public.get_feedback_results(uuid) TO authenticated;
-- Wege über geheime Links laufen nur serverseitig
GRANT EXECUTE ON FUNCTION public.get_group_status_by_token(uuid, uuid), public.submit_feedback(uuid, uuid, jsonb) TO service_role;
