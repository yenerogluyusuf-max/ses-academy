-- Tests für Migration 20261031090000_community.sql: Teamzugang auf Zeit, Mitgliedschaften, Profil, Verzeichnis.
\set ON_ERROR_STOP 1
BEGIN;

CREATE FUNCTION pg_temp.login(p_email text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE uid uuid;
BEGIN
  RESET ROLE;
  IF p_email IS NULL THEN
    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
    EXECUTE 'SET LOCAL ROLE anon';
    RETURN;
  END IF;
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

-- Setup: Amina und Yusuf mit Konto
INSERT INTO auth.users (instance_id, id, aud, role, email, email_confirmed_at, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'amina@example.test', now(), now(), now()),
       ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'yusuf@example.test', now(), now(), now());
UPDATE public.participants p SET user_id = u.id, phone = '+49 170 4444444' FROM auth.users u WHERE u.email = p.email AND p.email IN ('amina@example.test', 'yusuf@example.test');

-- 1) Teamzugang auf Zeit
SELECT pg_temp.login('helfer@ses.test');
SELECT pg_temp.ok('Helfer ohne Zeitraum: Zugang', public.has_checkin_access()::text, 'true');
RESET ROLE;
UPDATE public.staff_members SET valid_from = now() - interval '3 days', valid_until = now() - interval '1 day', label = 'Helfer · Test'
 WHERE user_id = (SELECT id FROM auth.users WHERE email = 'helfer@ses.test');
SELECT pg_temp.login('helfer@ses.test');
SELECT pg_temp.ok('Helfer nach Ablauf: kein Zugang', public.has_checkin_access()::text, 'false');
SELECT pg_temp.ok('Helfer nach Ablauf: kein Einlass', (SELECT count(*)::text FROM public.get_checkin_list((SELECT id FROM public.module_days LIMIT 1))), '0');
RESET ROLE;
UPDATE public.staff_members SET valid_from = now() + interval '1 day', valid_until = now() + interval '2 days'
 WHERE user_id = (SELECT id FROM auth.users WHERE email = 'helfer@ses.test');
SELECT pg_temp.login('helfer@ses.test');
SELECT pg_temp.ok('Helfer vor Beginn: kein Zugang', public.has_checkin_access()::text, 'false');
RESET ROLE;
UPDATE public.staff_members SET valid_from = now() - interval '1 hour', valid_until = now() + interval '1 hour'
 WHERE user_id = (SELECT id FROM auth.users WHERE email = 'helfer@ses.test');
SELECT pg_temp.login('helfer@ses.test');
SELECT pg_temp.ok('Helfer im Zeitraum: Zugang', public.has_checkin_access()::text, 'true');

-- 2) Mitgliedschaften: automatisch aus dem Jahrgang, Abzeichen
RESET ROLE;
SELECT pg_temp.ok('Drei Teilnehmende haben automatisch eine Mitgliedschaft', (SELECT count(*)::text FROM public.memberships WHERE role = 'teilnehmende'), '3');
INSERT INTO public.memberships (participant_id, role, commission)
SELECT id, 'team', 'PR' FROM public.participants WHERE email = 'yusuf@example.test';
SELECT pg_temp.ok('Abzeichen Team mit Kommission',
  (SELECT public.membership_badge(m) FROM public.memberships m WHERE role = 'team'), 'Team · PR');

-- 3) Profil ändern
SELECT pg_temp.login('amina@example.test');
SELECT pg_temp.ok('Amina ändert Telefon und Sprache', public.update_my_profile('+49 170 5555555', 'tr', false, true), 'saved');
SELECT pg_temp.ok('Gespeichert, Einwilligung mit Zeitpunkt',
  (SELECT phone || ' ' || preferred_language || ' ' || (photo_consent_at IS NOT NULL) FROM public.participants), '+49 170 5555555 tr true');
SELECT pg_temp.ok('Ungültige Sprache', public.update_my_profile(NULL, 'xx', false, false), 'invalid');
SELECT pg_temp.ok('Fremder Fotopfad', public.update_my_profile(NULL, 'de', false, false, 'jemand/1.jpg'), 'invalid');
SELECT pg_temp.ok('Amina sieht nur ihre Mitgliedschaft mit Generation', (SELECT count(*) || ' ' || max(public.membership_badge(m)) FROM public.memberships m), '1 SES · Jahrgang 2026');

-- 4) Verzeichnis: Kontaktdaten nur mit Zustimmung
CREATE TEMP TABLE v1 AS SELECT * FROM public.get_member_directory();
SELECT pg_temp.ok('Amina sieht drei Mitglieder', (SELECT count(*)::text FROM v1), '3');
SELECT pg_temp.ok('Yusuf ohne Zustimmung: keine Kontaktdaten', (SELECT coalesce(email, '-') || ' ' || coalesce(phone, '-') FROM v1 WHERE name LIKE 'Yusuf%'), '- -');
SELECT pg_temp.ok('Yusuf: beide Abzeichen', (SELECT array_length(badges, 1)::text FROM v1 WHERE name LIKE 'Yusuf%'), '2');
SELECT pg_temp.login('yusuf@example.test');
SELECT pg_temp.ok('Yusuf stimmt zu', public.update_my_profile('+49 170 4444444', 'nl', true, false), 'saved');
SELECT pg_temp.login('amina@example.test');
SELECT pg_temp.ok('Yusuf mit Zustimmung: Kontaktdaten sichtbar',
  (SELECT email || ' ' || phone FROM public.get_member_directory() WHERE name LIKE 'Yusuf%'), 'yusuf@example.test +49 170 4444444');
SELECT pg_temp.login('vorstand@ses.test');
SELECT pg_temp.ok('Vorstand sieht Kontaktdaten auch ohne Zustimmung',
  (SELECT coalesce(email, '-') FROM public.get_member_directory() WHERE name LIKE 'Leila%'), 'leila@example.test');
SELECT pg_temp.login('helfer@ses.test');
SELECT pg_temp.ok('Einlass-Helfer sieht kein Verzeichnis', (SELECT count(*)::text FROM public.get_member_directory()), '0');
SELECT pg_temp.login(NULL);
DO $$ BEGIN
  PERFORM * FROM public.get_member_directory();
  RAISE EXCEPTION 'FEHLER anon darf das Verzeichnis nicht lesen';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  Nicht angemeldet: kein Verzeichnis';
END $$;

-- 5) E-Mail-Änderung wird übernommen
RESET ROLE;
UPDATE auth.users SET email = 'Amina.Neu@Example.test' WHERE email = 'amina@example.test';
SELECT pg_temp.ok('Neue E-Mail in participants', (SELECT email FROM public.participants WHERE first_name = 'Amina'), 'amina.neu@example.test');

ROLLBACK;
