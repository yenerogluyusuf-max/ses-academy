-- Saalfragen, Spamschutz Teil 2 (Befunde der Sicherheitsprüfung zu 20261107):
--   * Zählung je IP serialisiert (Sperre je IP und Art), damit gleichzeitige Anfragen die Grenze nicht überholen
--   * Obergrenzen je IP über die Minute hinaus: höchstens 15 Fragen je Runde und 20 Stimmen je Frage.
--     Neue Gerätekennungen helfen damit nicht mehr. Hinweis: Teilen sich viele Geräte eine Adresse (z. B. ein
--     öffentliches WLAN hinter einem Router, wenn die Plattform im Internet läuft), wirken diese Grenzen für alle zusammen.

ALTER TABLE public.audience_questions ADD COLUMN ip_hash text;
ALTER TABLE public.question_votes     ADD COLUMN ip_hash text;
CREATE INDEX audience_questions_ip_idx ON public.audience_questions (round_id, ip_hash);
CREATE INDEX question_votes_ip_idx     ON public.question_votes (question_id, ip_hash);

CREATE OR REPLACE FUNCTION public.question_rate_exceeded(p_ip text, p_art text, p_max integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF coalesce(p_ip, '') = '' THEN RETURN true; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('saalfragen:' || p_art || ':' || p_ip));
  DELETE FROM public.question_rate WHERE at < now() - interval '10 minutes';
  IF (SELECT count(*) FROM public.question_rate WHERE ip_hash = p_ip AND art = p_art AND at > now() - interval '1 minute') >= p_max THEN
    RETURN true;
  END IF;
  INSERT INTO public.question_rate (ip_hash, art) VALUES (p_ip, p_art);
  RETURN false;
END $$;

CREATE OR REPLACE FUNCTION public.ask_question(p_code text, p_text text, p_name text, p_device text, p_ip text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.question_rounds%ROWTYPE;
BEGIN
  IF coalesce(p_device, '') = '' THEN RETURN 'device'; END IF;
  SELECT * INTO r FROM public.question_rounds WHERE code = upper(p_code);
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF NOT r.open THEN RETURN 'closed'; END IF;
  IF length(trim(coalesce(p_text, ''))) < 3 THEN RETURN 'too_short'; END IF;
  -- Minutengrenze zuerst: sperrt je IP und serialisiert damit auch die folgenden Zählungen
  IF public.question_rate_exceeded(p_ip, 'frage', 10) THEN RETURN 'too_fast'; END IF;
  IF (SELECT count(*) FROM public.audience_questions WHERE round_id = r.id AND device = p_device) >= 5 THEN RETURN 'limit'; END IF;
  IF (SELECT count(*) FROM public.audience_questions WHERE round_id = r.id AND ip_hash = p_ip) >= 15 THEN RETURN 'limit'; END IF;
  IF EXISTS (SELECT 1 FROM public.audience_questions WHERE round_id = r.id AND device = p_device AND created_at > now() - interval '20 seconds') THEN
    RETURN 'too_fast';
  END IF;
  INSERT INTO public.audience_questions (round_id, text, name, device, ip_hash, status)
  VALUES (r.id, left(trim(p_text), 500), nullif(left(trim(coalesce(p_name, '')), 80), ''), p_device, p_ip, 'neu');
  RETURN 'saved';
END $$;

CREATE OR REPLACE FUNCTION public.vote_question(p_question uuid, p_device text, p_ip text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF coalesce(p_device, '') = '' THEN RETURN 'device'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.audience_questions q JOIN public.question_rounds r ON r.id = q.round_id
                  WHERE q.id = p_question AND r.open AND q.status IN ('neu', 'sichtbar', 'dran')
                    AND (q.status <> 'neu' OR NOT r.moderated)) THEN
    RETURN 'not_found';
  END IF;
  IF EXISTS (SELECT 1 FROM public.question_votes WHERE question_id = p_question AND device = p_device) THEN RETURN 'already'; END IF;
  IF public.question_rate_exceeded(p_ip, 'stimme', 30) THEN RETURN 'too_fast'; END IF;
  IF (SELECT count(*) FROM public.question_votes WHERE question_id = p_question AND ip_hash = p_ip) >= 20 THEN RETURN 'limit'; END IF;
  INSERT INTO public.question_votes (question_id, device, ip_hash) VALUES (p_question, p_device, p_ip) ON CONFLICT DO NOTHING;
  IF FOUND THEN UPDATE public.audience_questions SET votes = votes + 1 WHERE id = p_question; RETURN 'voted'; END IF;
  RETURN 'already';
END $$;
