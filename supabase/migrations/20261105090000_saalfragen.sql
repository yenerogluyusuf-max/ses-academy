-- SES-Organisation, Phase 4: Fragen aus dem Saal per QR-Code.
--
--   question_rounds    = eine Fragerunde (z. B. zum Podium), öffentlich über einen kurzen Code erreichbar
--   audience_questions = Fragen aus dem Publikum (ohne Konto), Moderation durch das Team
--   question_votes     = Zustimmung zu einer Frage, einmal je Gerät (zufällige Kennung im Cookie, gehasht gespeichert)
-- Öffentliche Wege laufen nur serverseitig über Funktionen (service_role); das Team pflegt über RLS.

CREATE TABLE public.question_rounds (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE CHECK (code ~ '^[A-Z2-9]{5}$'),
  title           text NOT NULL CHECK (length(trim(title)) > 0),
  module_id       uuid REFERENCES public.modules(id) ON DELETE SET NULL,
  program_item_id uuid REFERENCES public.program_items(id) ON DELETE SET NULL,
  open            boolean NOT NULL DEFAULT true,
  moderated       boolean NOT NULL DEFAULT true,   -- true: Fragen erscheinen erst nach Freigabe für alle
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.audience_questions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id   uuid NOT NULL REFERENCES public.question_rounds(id) ON DELETE CASCADE,
  text       text NOT NULL CHECK (length(trim(text)) BETWEEN 3 AND 500),
  name       text CHECK (name IS NULL OR length(name) <= 80),
  status     text NOT NULL DEFAULT 'neu' CHECK (status IN ('neu', 'sichtbar', 'dran', 'beantwortet', 'ausgeblendet')),
  votes      integer NOT NULL DEFAULT 0,
  device     text NOT NULL,                       -- gehashte Gerätekennung (Spamschutz)
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audience_questions_round_idx ON public.audience_questions (round_id, status);

CREATE TABLE public.question_votes (
  question_id uuid NOT NULL REFERENCES public.audience_questions(id) ON DELETE CASCADE,
  device      text NOT NULL,
  PRIMARY KEY (question_id, device)
);

-- Kurzer Code ohne verwechselbare Zeichen (0/O, 1/I)
CREATE FUNCTION public.new_round_code() RETURNS text LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
DECLARE c text;
BEGIN
  LOOP
    SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '') INTO c FROM generate_series(1, 5);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.question_rounds WHERE code = c);
  END LOOP;
  RETURN c;
END $$;
ALTER TABLE public.question_rounds ALTER COLUMN code SET DEFAULT public.new_round_code();

-- Öffentlich: Runde mit den sichtbaren Fragen (bei unmoderierten Runden alle außer ausgeblendeten)
CREATE FUNCTION public.get_question_round(p_code text, p_device text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('id', r.id, 'title', r.title, 'open', r.open,
    'questions', coalesce((SELECT jsonb_agg(jsonb_build_object('id', q.id, 'text', q.text, 'name', q.name, 'votes', q.votes, 'status', q.status,
                                   'voted', EXISTS (SELECT 1 FROM public.question_votes v WHERE v.question_id = q.id AND v.device = p_device),
                                   'mine', q.device = p_device)
                                 ORDER BY (q.status = 'dran') DESC, (q.status = 'beantwortet'), q.votes DESC, q.created_at)
                            FROM public.audience_questions q
                           WHERE q.round_id = r.id
                             AND (q.status IN ('sichtbar', 'dran', 'beantwortet') OR (NOT r.moderated AND q.status = 'neu') OR q.device = p_device)
                             AND q.status <> 'ausgeblendet'), '[]'))
    FROM public.question_rounds r WHERE r.code = upper(p_code)
$$;

-- Öffentlich: Frage stellen. Höchstens 5 Fragen je Gerät und Runde, höchstens eine je 20 Sekunden.
CREATE FUNCTION public.ask_question(p_code text, p_text text, p_name text, p_device text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.question_rounds%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.question_rounds WHERE code = upper(p_code);
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF NOT r.open THEN RETURN 'closed'; END IF;
  IF length(trim(coalesce(p_text, ''))) < 3 THEN RETURN 'too_short'; END IF;
  IF (SELECT count(*) FROM public.audience_questions WHERE round_id = r.id AND device = p_device) >= 5 THEN RETURN 'limit'; END IF;
  IF EXISTS (SELECT 1 FROM public.audience_questions WHERE round_id = r.id AND device = p_device AND created_at > now() - interval '20 seconds') THEN
    RETURN 'too_fast';
  END IF;
  INSERT INTO public.audience_questions (round_id, text, name, device, status)
  VALUES (r.id, left(trim(p_text), 500), nullif(left(trim(coalesce(p_name, '')), 80), ''), p_device, 'neu');
  RETURN 'saved';
END $$;

-- Öffentlich: einer sichtbaren Frage zustimmen (einmal je Gerät)
CREATE FUNCTION public.vote_question(p_question uuid, p_device text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.audience_questions q JOIN public.question_rounds r ON r.id = q.round_id
                  WHERE q.id = p_question AND r.open AND q.status IN ('neu', 'sichtbar', 'dran')
                    AND (q.status <> 'neu' OR NOT r.moderated)) THEN
    RETURN 'not_found';
  END IF;
  INSERT INTO public.question_votes (question_id, device) VALUES (p_question, p_device) ON CONFLICT DO NOTHING;
  IF FOUND THEN UPDATE public.audience_questions SET votes = votes + 1 WHERE id = p_question; RETURN 'voted'; END IF;
  RETURN 'already';
END $$;

ALTER TABLE public.question_rounds    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audience_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_votes     ENABLE ROW LEVEL SECURITY;
CREATE POLICY rounds_orga    ON public.question_rounds    FOR ALL TO authenticated USING (public.has_orga_access()) WITH CHECK (public.has_orga_access());
CREATE POLICY questions_orga ON public.audience_questions FOR ALL TO authenticated USING (public.has_orga_access()) WITH CHECK (public.has_orga_access());
REVOKE ALL ON public.question_rounds, public.audience_questions, public.question_votes FROM anon;
REVOKE ALL ON public.question_votes FROM authenticated;

REVOKE ALL ON FUNCTION public.new_round_code(), public.get_question_round(text, text), public.ask_question(text, text, text, text),
  public.vote_question(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.new_round_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_question_round(text, text), public.ask_question(text, text, text, text), public.vote_question(uuid, text) TO service_role;
