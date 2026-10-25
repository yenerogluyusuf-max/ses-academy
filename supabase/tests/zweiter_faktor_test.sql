-- Tests für Migration 20261101090000_zweiter_faktor.sql: zweiter Faktor als Pflicht fürs Team, Login-Freigabe.
\set ON_ERROR_STOP 1
BEGIN;

CREATE FUNCTION pg_temp.login(p_email text, p_aal text DEFAULT 'aal1') RETURNS void LANGUAGE plpgsql AS $$
DECLARE uid uuid;
BEGIN
  RESET ROLE;
  SELECT id INTO uid FROM auth.users WHERE email = p_email;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'email', p_email, 'aal', p_aal,
    'amr', json_build_array(json_build_object('method', 'otp', 'timestamp', 0)))::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
END $$;

CREATE FUNCTION pg_temp.ok(label text, actual text, expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'FEHLER %: erwartet %, bekommen %', label, expected, actual; END IF;
  RAISE NOTICE 'ok  %', label;
END $$;

-- 1) Ohne Pflicht: Teamrechte auch mit einem Faktor
SELECT pg_temp.login('vorstand@ses.test');
SELECT pg_temp.ok('Ohne Pflicht: Vorstand hat Zugriff mit aal1', public.has_full_access()::text, 'true');
SELECT pg_temp.ok('Pflicht ist aus', public.mfa_required()::text, 'false');

-- 2) Nur Admin schaltet ein
DO $$ BEGIN
  INSERT INTO public.settings (key, value) VALUES ('zweiter_faktor', 'true');
  RAISE EXCEPTION 'FEHLER Vorstand darf die Pflicht nicht einschalten';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  Vorstand kann die Pflicht nicht einschalten';
END $$;
SELECT pg_temp.login('admin@ses.test', 'aal2');
INSERT INTO public.settings (key, value) VALUES ('zweiter_faktor', 'true');
SELECT pg_temp.ok('Admin hat die Pflicht eingeschaltet', public.mfa_required()::text, 'true');

-- 3) Mit Pflicht: Teamrechte nur mit aal2
SELECT pg_temp.login('vorstand@ses.test', 'aal1');
SELECT pg_temp.ok('Pflicht, aal1: kein Zugriff', public.has_full_access()::text, 'false');
SELECT pg_temp.ok('Pflicht, aal1: keine Personen', (SELECT count(*)::text FROM public.participants), '0');
SELECT pg_temp.ok('Pflicht, aal1: Einstellung lesbar (Weiterleitung zur Einrichtung)', public.mfa_required()::text, 'true');
SELECT pg_temp.login('vorstand@ses.test', 'aal2');
SELECT pg_temp.ok('Pflicht, aal2: Zugriff', public.has_full_access()::text, 'true');
SELECT pg_temp.ok('Pflicht, aal2: Personen sichtbar', (SELECT (count(*) > 0)::text FROM public.participants), 'true');

-- 4) Login-Freigabe (serverseitig)
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET LOCAL ROLE service_role;
SELECT pg_temp.ok('Teilnehmerin bekommt einen Code', public.login_allowed('Amina@Example.test '), 'participant');
SELECT pg_temp.ok('Teamkonto bekommt einen Code', public.login_allowed('orga@ses.test'), 'staff');
SELECT pg_temp.ok('Unbekannte Adresse: nichts', coalesce(public.login_allowed('fremd@example.test'), '-'), '-');

ROLLBACK;
