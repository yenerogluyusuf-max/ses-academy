-- Saalfragen: Spamschutz, der nicht nur an der (vom Gerät gelieferten) Kennung hängt.
-- Die Gerätekennung ist serverseitig signiert (siehe src/lib/saalfragen-geraet.ts); zusätzlich zählt die Datenbank
-- je IP-Adresse (als Hash): höchstens 10 Fragen und 30 Stimmen pro Minute, egal wie viele Kennungen jemand erzeugt.

CREATE TABLE public.question_rate (
  ip_hash text NOT NULL,
  art     text NOT NULL CHECK (art IN ('frage', 'stimme')),
  at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX question_rate_idx ON public.question_rate (ip_hash, art, at);
ALTER TABLE public.question_rate ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.question_rate FROM PUBLIC, anon, authenticated;

-- true = Grenze erreicht; sonst wird der Versuch gezählt. Alte Einträge (älter als 10 Minuten) räumt die Funktion mit weg.
CREATE FUNCTION public.question_rate_exceeded(p_ip text, p_art text, p_max integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF coalesce(p_ip, '') = '' THEN RETURN true; END IF;
  DELETE FROM public.question_rate WHERE at < now() - interval '10 minutes';
  IF (SELECT count(*) FROM public.question_rate WHERE ip_hash = p_ip AND art = p_art AND at > now() - interval '1 minute') >= p_max THEN
    RETURN true;
  END IF;
  INSERT INTO public.question_rate (ip_hash, art) VALUES (p_ip, p_art);
  RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.question_rate_exceeded(text, text, integer) FROM PUBLIC, anon, authenticated;

DROP FUNCTION public.ask_question(text, text, text, text);
CREATE FUNCTION public.ask_question(p_code text, p_text text, p_name text, p_device text, p_ip text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.question_rounds%ROWTYPE;
BEGIN
  IF coalesce(p_device, '') = '' THEN RETURN 'device'; END IF;
  SELECT * INTO r FROM public.question_rounds WHERE code = upper(p_code);
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF NOT r.open THEN RETURN 'closed'; END IF;
  IF length(trim(coalesce(p_text, ''))) < 3 THEN RETURN 'too_short'; END IF;
  IF (SELECT count(*) FROM public.audience_questions WHERE round_id = r.id AND device = p_device) >= 5 THEN RETURN 'limit'; END IF;
  IF EXISTS (SELECT 1 FROM public.audience_questions WHERE round_id = r.id AND device = p_device AND created_at > now() - interval '20 seconds') THEN
    RETURN 'too_fast';
  END IF;
  IF public.question_rate_exceeded(p_ip, 'frage', 10) THEN RETURN 'too_fast'; END IF;
  INSERT INTO public.audience_questions (round_id, text, name, device, status)
  VALUES (r.id, left(trim(p_text), 500), nullif(left(trim(coalesce(p_name, '')), 80), ''), p_device, 'neu');
  RETURN 'saved';
END $$;

DROP FUNCTION public.vote_question(uuid, text);
CREATE FUNCTION public.vote_question(p_question uuid, p_device text, p_ip text)
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
  INSERT INTO public.question_votes (question_id, device) VALUES (p_question, p_device) ON CONFLICT DO NOTHING;
  IF FOUND THEN UPDATE public.audience_questions SET votes = votes + 1 WHERE id = p_question; RETURN 'voted'; END IF;
  RETURN 'already';
END $$;

REVOKE ALL ON FUNCTION public.ask_question(text, text, text, text, text), public.vote_question(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ask_question(text, text, text, text, text), public.vote_question(uuid, text, text) TO service_role;
