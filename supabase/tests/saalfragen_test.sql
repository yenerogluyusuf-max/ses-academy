-- Tests für Migration 20261105090000_saalfragen.sql: Fragen aus dem Saal.
\set ON_ERROR_STOP 1
BEGIN;

CREATE FUNCTION pg_temp.login(p_email text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE uid uuid;
BEGIN
  RESET ROLE;
  SELECT id INTO uid FROM auth.users WHERE email = p_email;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'email', p_email,
    'amr', json_build_array(json_build_object('method', 'password', 'timestamp', 0)))::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
END $$;
CREATE FUNCTION pg_temp.server() RETURNS void LANGUAGE plpgsql AS $$
BEGIN RESET ROLE; PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true); EXECUTE 'SET LOCAL ROLE service_role'; END $$;
CREATE FUNCTION pg_temp.ok(label text, actual text, expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'FEHLER %: erwartet %, bekommen %', label, expected, actual; END IF;
  RAISE NOTICE 'ok  %', label;
END $$;

SELECT pg_temp.login('orga@ses.test');
INSERT INTO public.question_rounds (title) VALUES ('Podium Test');
CREATE TEMP TABLE r AS SELECT id, code FROM public.question_rounds;
GRANT SELECT ON r TO service_role, authenticated;
SELECT pg_temp.ok('Code hat 5 Zeichen ohne 0/O/1/I', ((SELECT code FROM r) ~ '^[A-HJ-NP-Z2-9]{5}$')::text, 'true');

SELECT pg_temp.server();
SELECT pg_temp.ok('Frage stellen', public.ask_question((SELECT lower(code) FROM r), 'Wie sieht Europa 2030 aus?', 'Amina', 'geraet-a'), 'saved');
SELECT pg_temp.ok('Zu schnell hintereinander', public.ask_question((SELECT code FROM r), 'Zweite Frage', NULL, 'geraet-a'), 'too_fast');
SELECT pg_temp.ok('Andere Person', public.ask_question((SELECT code FROM r), 'Was bedeutet Demokratie für Minderheiten?', NULL, 'geraet-b'), 'saved');
SELECT pg_temp.ok('Moderiert: andere sehen neue Fragen nicht', (SELECT jsonb_array_length(public.get_question_round((SELECT code FROM r), 'geraet-c') -> 'questions')::text), '0');
SELECT pg_temp.ok('Eigene Frage sieht man sofort', (SELECT jsonb_array_length(public.get_question_round((SELECT code FROM r), 'geraet-a') -> 'questions')::text), '1');
SELECT pg_temp.ok('Unfreigegebene Frage: keine Stimme', public.vote_question((SELECT id FROM public.audience_questions WHERE device = 'geraet-b'), 'geraet-c'), 'not_found');

SELECT pg_temp.login('orga@ses.test');
UPDATE public.audience_questions SET status = 'sichtbar';
SELECT pg_temp.server();
SELECT pg_temp.ok('Nach Freigabe: alle sehen beide', (SELECT jsonb_array_length(public.get_question_round((SELECT code FROM r), 'geraet-c') -> 'questions')::text), '2');
SELECT pg_temp.ok('Zustimmen', public.vote_question((SELECT id FROM public.audience_questions WHERE device = 'geraet-b'), 'geraet-c'), 'voted');
SELECT pg_temp.ok('Zweimal zustimmen zählt nicht', public.vote_question((SELECT id FROM public.audience_questions WHERE device = 'geraet-b'), 'geraet-c'), 'already');
SELECT pg_temp.ok('Meiste Stimmen zuerst', (SELECT public.get_question_round((SELECT code FROM r), 'geraet-c') #>> '{questions,0,votes}'), '1');

SELECT pg_temp.login('orga@ses.test');
UPDATE public.question_rounds SET open = false;
SELECT pg_temp.server();
SELECT pg_temp.ok('Geschlossene Runde nimmt nichts an', public.ask_question((SELECT code FROM r), 'Noch eine', NULL, 'geraet-d'), 'closed');
SELECT pg_temp.ok('Unbekannter Code', public.ask_question('ZZZZZ', 'Frage', NULL, 'x'), 'not_found');

SELECT pg_temp.login('helfer@ses.test');
SELECT pg_temp.ok('Helfer sieht keine Fragen', (SELECT count(*)::text FROM public.audience_questions), '0');
SELECT pg_temp.login('orga@ses.test');
DO $$ BEGIN
  PERFORM public.ask_question('X', 'Frage', NULL, 'x');
  RAISE EXCEPTION 'FEHLER direkt';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  Öffentliche Funktionen nur serverseitig';
END $$;

ROLLBACK;
