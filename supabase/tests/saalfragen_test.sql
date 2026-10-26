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
SELECT pg_temp.ok('Frage stellen', public.ask_question((SELECT lower(code) FROM r), 'Wie sieht Europa 2030 aus?', 'Amina', 'geraet-a', 'ip-geraet-a'), 'saved');
SELECT pg_temp.ok('Zu schnell hintereinander', public.ask_question((SELECT code FROM r), 'Zweite Frage', NULL, 'geraet-a', 'ip-geraet-a'), 'too_fast');
SELECT pg_temp.ok('Andere Person', public.ask_question((SELECT code FROM r), 'Was bedeutet Demokratie für Minderheiten?', NULL, 'geraet-b', 'ip-geraet-b'), 'saved');
SELECT pg_temp.ok('Moderiert: andere sehen neue Fragen nicht', (SELECT jsonb_array_length(public.get_question_round((SELECT code FROM r), 'geraet-c') -> 'questions')::text), '0');
SELECT pg_temp.ok('Eigene Frage sieht man sofort', (SELECT jsonb_array_length(public.get_question_round((SELECT code FROM r), 'geraet-a') -> 'questions')::text), '1');
SELECT pg_temp.ok('Unfreigegebene Frage: keine Stimme', public.vote_question((SELECT id FROM public.audience_questions WHERE device = 'geraet-b'), 'geraet-c', 'ip-geraet-c'), 'not_found');

SELECT pg_temp.login('orga@ses.test');
UPDATE public.audience_questions SET status = 'sichtbar';
SELECT pg_temp.server();
SELECT pg_temp.ok('Nach Freigabe: alle sehen beide', (SELECT jsonb_array_length(public.get_question_round((SELECT code FROM r), 'geraet-c') -> 'questions')::text), '2');
SELECT pg_temp.ok('Zustimmen', public.vote_question((SELECT id FROM public.audience_questions WHERE device = 'geraet-b'), 'geraet-c', 'ip-geraet-c'), 'voted');
SELECT pg_temp.ok('Zweimal zustimmen zählt nicht', public.vote_question((SELECT id FROM public.audience_questions WHERE device = 'geraet-b'), 'geraet-c', 'ip-geraet-c'), 'already');
SELECT pg_temp.ok('Meiste Stimmen zuerst', (SELECT public.get_question_round((SELECT code FROM r), 'geraet-c') #>> '{questions,0,votes}'), '1');

-- Spamschutz je IP-Adresse: neue Kennungen helfen nicht
SELECT pg_temp.ok('Ohne Gerätekennung nichts', public.ask_question((SELECT code FROM r), 'Ohne Kennung?', NULL, '', 'ip-z'), 'device');
SELECT pg_temp.ok('Ohne IP nichts', public.ask_question((SELECT code FROM r), 'Ohne IP?', NULL, 'geraet-ohne-ip', ''), 'too_fast');
DO $$ DECLARE i int; q uuid := (SELECT id FROM public.audience_questions WHERE device = 'geraet-b'); BEGIN
  FOR i IN 1..30 LOOP PERFORM public.vote_question(q, 'skript-' || i, 'ip-skript'); END LOOP;
END $$;
SELECT pg_temp.ok('31. Stimme derselben IP in einer Minute wird abgelehnt', public.vote_question((SELECT id FROM public.audience_questions WHERE device = 'geraet-b'), 'skript-31', 'ip-skript'), 'too_fast');
SELECT pg_temp.ok('Andere IP darf weiter', public.vote_question((SELECT id FROM public.audience_questions WHERE device = 'geraet-b'), 'geraet-e', 'ip-geraet-e'), 'voted');
DO $$ DECLARE i int; BEGIN
  FOR i IN 1..10 LOOP PERFORM public.ask_question((SELECT code FROM r), 'Skriptfrage ' || i, NULL, 'skriptfrage-' || i, 'ip-fragen'); END LOOP;
END $$;
SELECT pg_temp.ok('11. Frage derselben IP in einer Minute wird abgelehnt', public.ask_question((SELECT code FROM r), 'Noch eine Skriptfrage', NULL, 'skriptfrage-11', 'ip-fragen'), 'too_fast');
DO $$ DECLARE i int; q uuid := (SELECT id FROM public.audience_questions WHERE device = 'geraet-a'); BEGIN
  FOR i IN 1..20 LOOP PERFORM public.vote_question(q, 'nat-' || i, 'ip-nat'); END LOOP;
END $$;
SELECT pg_temp.ok('21. Stimme derselben IP für dieselbe Frage wird abgelehnt', public.vote_question((SELECT id FROM public.audience_questions WHERE device = 'geraet-a'), 'nat-21', 'ip-nat'), 'limit');
INSERT INTO public.audience_questions (round_id, text, device, ip_hash, status, created_at)
  SELECT (SELECT id FROM r), 'Alte Frage ' || i, 'alt-' || i, 'ip-runde', 'neu', now() - interval '1 hour' FROM generate_series(1, 15) i;
SELECT pg_temp.ok('16. Frage derselben IP in der Runde wird abgelehnt', public.ask_question((SELECT code FROM r), 'Neue Frage', NULL, 'alt-neu', 'ip-runde'), 'limit');
SELECT pg_temp.ok('question_rate nicht direkt lesbar', (SELECT has_table_privilege('authenticated', 'public.question_rate', 'SELECT')::text), 'false');

SELECT pg_temp.login('orga@ses.test');
UPDATE public.question_rounds SET open = false;
SELECT pg_temp.server();
SELECT pg_temp.ok('Geschlossene Runde nimmt nichts an', public.ask_question((SELECT code FROM r), 'Noch eine', NULL, 'geraet-d', 'ip-geraet-d'), 'closed');
SELECT pg_temp.ok('Unbekannter Code', public.ask_question('ZZZZZ', 'Frage', NULL, 'x', 'ip-x'), 'not_found');

SELECT pg_temp.login('helfer@ses.test');
SELECT pg_temp.ok('Helfer sieht keine Fragen', (SELECT count(*)::text FROM public.audience_questions), '0');
SELECT pg_temp.login('orga@ses.test');
DO $$ BEGIN
  PERFORM public.ask_question('X', 'Frage', NULL, 'x', 'ip-x');
  RAISE EXCEPTION 'FEHLER direkt';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  Öffentliche Funktionen nur serverseitig';
END $$;

ROLLBACK;
