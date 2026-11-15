-- Feedback anonym (Wunsch 15.11.2026): Antworten werden ohne Person gespeichert. Wer teilgenommen hat, steht getrennt
-- in feedback_teilnahmen (nur damit niemand doppelt antwortet und die Einladung nur an die anderen geht), ohne
-- Zeitstempel, damit sich Teilnahme und Antwort nicht über die Uhrzeit zuordnen lassen. Antworten tragen nur den Tag.
-- Folge: Eine abgeschickte Antwort lässt sich nicht mehr ansehen oder ändern.

CREATE TABLE public.feedback_teilnahmen (
  survey_id uuid NOT NULL REFERENCES public.feedback_surveys(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  PRIMARY KEY (survey_id, participant_id)
);
ALTER TABLE public.feedback_teilnahmen ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.feedback_teilnahmen FROM anon, authenticated;
GRANT ALL ON public.feedback_teilnahmen TO service_role;
COMMENT ON TABLE public.feedback_teilnahmen IS 'Wer an einer Feedback-Umfrage teilgenommen hat; die Antworten selbst sind anonym (feedback_responses ohne Person)';

-- Bisherige Antworten (nur Probeantworten) umstellen
INSERT INTO public.feedback_teilnahmen (survey_id, participant_id)
  SELECT survey_id, participant_id FROM public.feedback_responses WHERE participant_id IS NOT NULL ON CONFLICT DO NOTHING;
ALTER TABLE public.feedback_responses DROP CONSTRAINT feedback_responses_survey_id_participant_id_key;
ALTER TABLE public.feedback_responses ALTER COLUMN participant_id DROP NOT NULL;
UPDATE public.feedback_responses SET participant_id = NULL, submitted_at = date_trunc('day', submitted_at);
ALTER TABLE public.feedback_responses ADD CONSTRAINT feedback_responses_anonym CHECK (participant_id IS NULL);
COMMENT ON COLUMN public.feedback_responses.participant_id IS 'Immer leer: Antworten sind anonym (seit 15.11.2026), Teilnahme steht in feedback_teilnahmen';

CREATE OR REPLACE FUNCTION public.feedback_speichern(p_participant_id uuid, p_survey_id uuid, p_answers jsonb)
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
  IF EXISTS (SELECT 1 FROM public.feedback_teilnahmen WHERE survey_id = s.id AND participant_id = p_participant_id) THEN
    RETURN 'already';
  END IF;
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
  IF sauber = '{}'::jsonb THEN RETURN 'empty'; END IF;
  INSERT INTO public.feedback_teilnahmen (survey_id, participant_id) VALUES (s.id, p_participant_id);
  INSERT INTO public.feedback_responses (survey_id, participant_id, answers, submitted_at)
    VALUES (s.id, NULL, sauber, date_trunc('day', now()));
  RETURN 'saved';
END $$;
