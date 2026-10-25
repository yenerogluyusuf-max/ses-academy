-- Tests für Migration 20261029090000_abgabe_selbst.sql: Selbst-Abgabe in „Mein Bereich“, Bewertungen intern.
\set ON_ERROR_STOP 1
BEGIN;

CREATE FUNCTION pg_temp.login(p_email text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE uid uuid;
BEGIN
  RESET ROLE;
  SELECT id INTO uid FROM auth.users WHERE email = p_email;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'email', p_email,
    'amr', json_build_array(json_build_object('method', 'otp', 'timestamp', 0)))::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
END $$;

CREATE FUNCTION pg_temp.ok(label text, actual text, expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'FEHLER %: erwartet %, bekommen %', label, expected, actual; END IF;
  RAISE NOTICE 'ok  %', label;
END $$;

-- Setup: Amina mit Konto; zwei Aufgaben (Frist vorbei / Frist in 7 Tagen); eine Aufgabe eines anderen Jahrgangs
INSERT INTO auth.users (instance_id, id, aud, role, email, email_confirmed_at, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'amina@example.test', now(), now(), now());
UPDATE public.participants SET user_id = (SELECT id FROM auth.users WHERE email = 'amina@example.test') WHERE email = 'amina@example.test';
INSERT INTO public.cohorts (name, year) VALUES ('Anderer Jahrgang', 2030);
INSERT INTO public.mentors (name, phone) VALUES ('Sorumlu Abgabe', '+49 170 3333333');
INSERT INTO public.assignments (cohort_id, number, title, due_date) VALUES
  ((SELECT id FROM public.cohorts WHERE is_current), 801, 'Frist vorbei', (now() AT TIME ZONE 'Europe/Berlin')::date - 3),
  ((SELECT id FROM public.cohorts WHERE is_current), 802, 'Frist offen',  (now() AT TIME ZONE 'Europe/Berlin')::date + 7),
  ((SELECT id FROM public.cohorts WHERE name = 'Anderer Jahrgang'), 801, 'Fremd', NULL);
CREATE TEMP TABLE t AS SELECT
  (SELECT id FROM public.assignments WHERE title = 'Frist vorbei') AS vorbei,
  (SELECT id FROM public.assignments WHERE title = 'Frist offen') AS offen,
  (SELECT id FROM public.assignments WHERE title = 'Fremd') AS fremd,
  (SELECT id FROM public.participants WHERE email = 'amina@example.test') AS amina;
GRANT SELECT ON t TO authenticated;
INSERT INTO storage.objects (bucket_id, name, metadata)
SELECT 'abgaben', vorbei || '/' || amina || '/' || n || '-rede.mp4', jsonb_build_object('size', 1000 * n) FROM t, generate_series(1, 2) n;

SELECT pg_temp.login('amina@example.test');
SELECT pg_temp.ok('Link-Abgabe vor der Frist: pünktlich',
  public.submit_own_assignment((SELECT offen FROM t), 'https://example.org/video', NULL, NULL, NULL) ->> 'status', 'puenktlich');
SELECT pg_temp.ok('Datei-Abgabe nach der Frist: verspätet',
  public.submit_own_assignment((SELECT vorbei FROM t), NULL, (SELECT vorbei || '/' || amina || '/1-rede.mp4' FROM t), 'rede.mp4', 1234) ->> 'status', 'verspaetet');
SELECT pg_temp.ok('Neue Version mit gleichem Dateinamen',
  public.submit_own_assignment((SELECT vorbei FROM t), NULL, (SELECT vorbei || '/' || amina || '/2-rede.mp4' FROM t), 'rede.mp4', 2345) ->> 'result', 'saved');
SELECT pg_temp.ok('Größe kommt aus dem Speicher, nicht vom Aufrufer',
  (SELECT size_bytes::text FROM public.submissions WHERE storage_path LIKE '%/1-rede.mp4'), '1000');
SELECT pg_temp.ok('Pfad ohne Datei im Speicher wird abgelehnt',
  public.submit_own_assignment((SELECT vorbei FROM t), NULL, (SELECT vorbei || '/' || amina || '/9-gibtsnicht.mp4' FROM t), 'x.mp4', 1) ->> 'result', 'invalid_path');
SELECT pg_temp.ok('Pfad mit Unterordner wird abgelehnt',
  public.submit_own_assignment((SELECT vorbei FROM t), NULL, (SELECT vorbei || '/' || amina || '/1-a/../../x.mp4' FROM t), 'x.mp4', 1) ->> 'result', 'invalid_path');
SELECT pg_temp.ok('Fremder Speicherpfad wird abgelehnt',
  public.submit_own_assignment((SELECT offen FROM t), NULL, (SELECT offen || '/' || gen_random_uuid() || '/x.mp4' FROM t), 'x.mp4', 1) ->> 'result', 'invalid_path');
SELECT pg_temp.ok('Aufgabe eines anderen Jahrgangs: nicht gefunden',
  public.submit_own_assignment((SELECT fremd FROM t), 'https://example.org', NULL, NULL, NULL) ->> 'result', 'not_found');
SELECT pg_temp.ok('Kein Link, keine Datei: leer',
  public.submit_own_assignment((SELECT offen FROM t), '  ', NULL, NULL, NULL) ->> 'result', 'empty');
SELECT pg_temp.ok('Link ohne http: ungültig',
  public.submit_own_assignment((SELECT offen FROM t), 'javascript:alert(1)', NULL, NULL, NULL) ->> 'result', 'invalid_link');
SELECT pg_temp.ok('Amina sieht ihre drei Abgaben', (SELECT count(*)::text FROM public.submissions WHERE source = 'self'), '3');

-- Team sieht die Abgaben im Hausaufgaben-Status
SELECT pg_temp.login('orga@ses.test');
SELECT pg_temp.ok('Status Frist vorbei: verspätet',
  (SELECT status FROM public.get_assignment_status((SELECT vorbei FROM t)) WHERE participant_id = (SELECT amina FROM t)), 'verspaetet');
SELECT pg_temp.ok('Status Frist offen: pünktlich',
  (SELECT status FROM public.get_assignment_status((SELECT offen FROM t)) WHERE participant_id = (SELECT amina FROM t)), 'puenktlich');

-- Sorumlu-Links sind für Teamkonten nicht lesbar, die übrigen Spalten schon
DO $$ BEGIN
  PERFORM access_token FROM public.mentors;
  RAISE EXCEPTION 'FEHLER Orga darf access_token nicht lesen';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  Orga liest keine Sorumlu-Links';
END $$;
SELECT pg_temp.ok('Orga liest Name und Telefon der Sorumlu', (SELECT name || ' ' || phone FROM public.mentors WHERE name = 'Sorumlu Abgabe'), 'Sorumlu Abgabe +49 170 3333333');

-- Nicht angemeldet: kein Zugriff
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;
DO $$ BEGIN
  PERFORM public.submit_own_assignment(gen_random_uuid(), 'https://x', NULL, NULL, NULL);
  RAISE EXCEPTION 'FEHLER anon darf nicht abgeben';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  Nicht angemeldet: keine Abgabe';
END $$;

ROLLBACK;
