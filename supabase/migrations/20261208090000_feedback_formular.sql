-- Feedback-Umfrage wie das Google-Formular der Organisatoren (15.11.2026):
-- Skalen 1–5 oder 1–10, Pflichtfragen, Auswahlfrage mit „Sonstiges“, Fragen nur für ein Land (Ländergruppen)
-- und Antworten über den allgemeinen Link (/umfrage/, Person per E-Mail erkannt) statt nur über den Mail-Link.

ALTER TABLE public.feedback_questions
  ADD COLUMN scale_max smallint,
  ADD COLUMN required boolean NOT NULL DEFAULT false,
  ADD COLUMN options jsonb,
  ADD COLUMN other_option boolean NOT NULL DEFAULT false,
  ADD COLUMN country text;

UPDATE public.feedback_questions SET scale_max = 5 WHERE kind = 'skala';

ALTER TABLE public.feedback_questions DROP CONSTRAINT feedback_questions_kind_check;
ALTER TABLE public.feedback_questions
  ADD CONSTRAINT feedback_questions_kind_check CHECK (kind IN ('skala', 'text', 'auswahl')),
  ADD CONSTRAINT feedback_questions_scale_max_check CHECK (scale_max IS NULL OR scale_max IN (5, 10)),
  ADD CONSTRAINT feedback_questions_options_check CHECK (options IS NULL OR jsonb_typeof(options) = 'array'),
  ADD CONSTRAINT feedback_questions_country_check CHECK (country IS NULL OR country IN ('DE', 'AT', 'FR', 'CH', 'NL', 'BE'));

COMMENT ON COLUMN public.feedback_questions.scale_max IS 'Skala 1 bis scale_max (5 oder 10), nur bei kind = skala';
COMMENT ON COLUMN public.feedback_questions.options IS 'Antwortmöglichkeiten (Array von Texten) bei kind = auswahl; Übersetzungen in i18n.<sprache>.options';
COMMENT ON COLUMN public.feedback_questions.other_option IS 'Auswahl hat zusätzlich „Sonstiges“ mit Freitext';
COMMENT ON COLUMN public.feedback_questions.country IS 'Frage nur für Teilnehmende aus diesem Land; Personen ohne Land sehen sie auch';

-- Speichern für eine bekannte Person (Mail-Link oder allgemeiner Link). Nur der Server ruft das auf.
CREATE FUNCTION public.feedback_speichern(p_participant_id uuid, p_survey_id uuid, p_answers jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  s public.feedback_surveys%ROWTYPE;
  land text;
  sauber jsonb := '{}';
  q record;
  wert jsonb;
  zahl numeric;
BEGIN
  SELECT * INTO s FROM public.feedback_surveys WHERE id = p_survey_id;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  SELECT country INTO land FROM public.participants WHERE id = p_participant_id;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF now() < s.opens_at OR now() > s.closes_at THEN RETURN 'closed'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.attendances a
      JOIN public.registrations r ON r.id = a.registration_id
     WHERE r.participant_id = p_participant_id AND r.module_id = s.module_id) THEN
    RETURN 'not_attended';
  END IF;
  -- nur bekannte Fragen, die für die Person gelten; Skala 1 bis scale_max, Text höchstens 2000 Zeichen,
  -- Auswahl nur aus den Möglichkeiten (oder Freitext bei „Sonstiges“, höchstens 300 Zeichen)
  FOR q IN SELECT id, kind, scale_max, options, other_option, required, country FROM public.feedback_questions WHERE survey_id = s.id LOOP
    IF q.country IS NOT NULL AND land IS NOT NULL AND q.country <> land THEN CONTINUE; END IF;
    wert := p_answers -> q.id::text;
    IF wert IS NOT NULL AND wert <> 'null'::jsonb THEN
      IF q.kind = 'skala' AND jsonb_typeof(wert) = 'number' THEN
        zahl := (wert #>> '{}')::numeric;
        IF zahl = trunc(zahl) AND zahl BETWEEN 1 AND coalesce(q.scale_max, 5) THEN
          sauber := sauber || jsonb_build_object(q.id::text, zahl::int);
        END IF;
      ELSIF q.kind = 'text' AND jsonb_typeof(wert) = 'string' AND length(trim(wert #>> '{}')) > 0 THEN
        sauber := sauber || jsonb_build_object(q.id::text, left(trim(wert #>> '{}'), 2000));
      ELSIF q.kind = 'auswahl' AND jsonb_typeof(wert) = 'string' AND length(trim(wert #>> '{}')) > 0 THEN
        IF coalesce(q.options, '[]'::jsonb) ? (wert #>> '{}') OR q.other_option THEN
          sauber := sauber || jsonb_build_object(q.id::text, left(trim(wert #>> '{}'), 300));
        END IF;
      END IF;
    END IF;
    IF q.required AND NOT sauber ? q.id::text THEN RETURN 'missing'; END IF;
  END LOOP;
  -- Ein leeres Formular ist keine Antwort (zählte sonst in der Auswertung mit)
  IF sauber = '{}'::jsonb THEN RETURN 'empty'; END IF;
  INSERT INTO public.feedback_responses (survey_id, participant_id, answers) VALUES (s.id, p_participant_id, sauber)
  ON CONFLICT (survey_id, participant_id) DO UPDATE SET answers = excluded.answers, submitted_at = now();
  RETURN 'saved';
END $$;

CREATE OR REPLACE FUNCTION public.submit_feedback(p_token uuid, p_survey_id uuid, p_answers jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE pid uuid;
BEGIN
  SELECT id INTO pid FROM public.participants WHERE link_token = p_token;
  IF pid IS NULL THEN RETURN 'not_found'; END IF;
  RETURN public.feedback_speichern(pid, p_survey_id, p_answers);
END $$;

REVOKE EXECUTE ON FUNCTION public.feedback_speichern(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.feedback_speichern(uuid, uuid, jsonb) TO service_role;

-- Auswertung: Verteilung über die ganze Skala (1–5 oder 1–10), bei Auswahl die Anzahl je Möglichkeit
-- (texts = Freitexte unter „Sonstiges“).
DROP FUNCTION public.get_feedback_results(uuid);
CREATE FUNCTION public.get_feedback_results(p_survey_id uuid)
RETURNS TABLE(question_id uuid, nr integer, kind text, prompt text, answers integer, average numeric,
              distribution integer[], texts text[], scale_max integer, options text[], country text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT q.id, q.position, q.kind, q.prompt,
         (SELECT count(*)::int FROM public.feedback_responses r WHERE r.survey_id = q.survey_id AND r.answers ? q.id::text),
         CASE WHEN q.kind = 'skala' THEN (SELECT round(avg((r.answers ->> q.id::text)::numeric), 2)
           FROM public.feedback_responses r WHERE r.survey_id = q.survey_id AND r.answers ? q.id::text) END,
         CASE
           WHEN q.kind = 'skala' THEN ARRAY(
             SELECT (SELECT count(*) FROM public.feedback_responses r
                      WHERE r.survey_id = q.survey_id AND r.answers ->> q.id::text = n::text)::int
               FROM generate_series(1, coalesce(q.scale_max, 5)) n ORDER BY n)
           WHEN q.kind = 'auswahl' THEN ARRAY(
             SELECT (SELECT count(*) FROM public.feedback_responses r
                      WHERE r.survey_id = q.survey_id AND r.answers ->> q.id::text = o.wert)::int
               FROM jsonb_array_elements_text(coalesce(q.options, '[]'::jsonb)) WITH ORDINALITY AS o(wert, i) ORDER BY o.i)
         END,
         CASE
           WHEN q.kind = 'text' THEN ARRAY(
             SELECT r.answers ->> q.id::text FROM public.feedback_responses r
              WHERE r.survey_id = q.survey_id AND r.answers ? q.id::text ORDER BY r.submitted_at)
           WHEN q.kind = 'auswahl' THEN ARRAY(
             SELECT r.answers ->> q.id::text FROM public.feedback_responses r
              WHERE r.survey_id = q.survey_id AND r.answers ? q.id::text
                AND NOT coalesce(q.options, '[]'::jsonb) ? (r.answers ->> q.id::text) ORDER BY r.submitted_at)
         END,
         q.scale_max::int,
         ARRAY(SELECT jsonb_array_elements_text(coalesce(q.options, '[]'::jsonb))),
         q.country
    FROM public.feedback_questions q
   WHERE q.survey_id = p_survey_id AND public.has_full_access()
   ORDER BY q.position
$$;

REVOKE EXECUTE ON FUNCTION public.get_feedback_results(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_feedback_results(uuid) TO authenticated, service_role;
