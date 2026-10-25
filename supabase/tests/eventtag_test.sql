-- Tests für Phase 1 (Migration 20261027090000_eventtag.sql): Regieplan, Rollenplan, Ticket-Status,
-- Entfernen der Notiz-Spalte. Voraussetzung: frische Datenbank mit seed.sql; alles in einer Transaktion.
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

CREATE FUNCTION pg_temp.ok(label text, actual text, expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'FEHLER %: erwartet %, bekommen %', label, expected, actual; END IF;
  RAISE NOTICE 'ok  %', label;
END $$;

CREATE FUNCTION pg_temp.verboten(label text, sql text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE sql;
  RAISE EXCEPTION 'FEHLER %: hätte abgelehnt werden müssen', label;
EXCEPTION WHEN insufficient_privilege OR check_violation THEN
  RAISE NOTICE 'ok  %', label;
END $$;

-- Setup als Superuser: Amina bekommt ein Login-Konto, der erste Tag von Demokratie ist der Testtag.
INSERT INTO auth.users (instance_id, id, aud, role, email, email_confirmed_at, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'amina@example.test', now(), now(), now());
UPDATE public.participants SET user_id = (SELECT id FROM auth.users WHERE email = 'amina@example.test') WHERE email = 'amina@example.test';

CREATE TEMP TABLE t AS
SELECT m.id AS modul, (SELECT d.id FROM public.module_days d WHERE d.module_id = m.id ORDER BY d.starts_at LIMIT 1) AS tag,
       (SELECT d.starts_at FROM public.module_days d WHERE d.module_id = m.id ORDER BY d.starts_at LIMIT 1) AS beginn
  FROM public.modules m WHERE m.slug = 'demokratie';
GRANT SELECT ON t TO authenticated;

-- 1) Notiz-Spalte ist weg
SELECT pg_temp.ok('participants hat keine Notiz-Spalte mehr',
  (SELECT count(*)::text FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'participants' AND column_name = 'notes'), '0');

-- 2) Regieplan: Orga-Team legt an und ändert den Status
SELECT pg_temp.login('orga@ses.test');
INSERT INTO public.program_items (module_day_id, starts_at, ends_at, title, room, responsible)
SELECT tag, beginn + interval '1 hour', beginn + interval '75 minutes', 'Begrüßung', 'Saal', 'Moderation' FROM t;
INSERT INTO public.program_items (module_day_id, starts_at, title)
SELECT tag, beginn + interval '90 minutes', 'Vortrag' FROM t;
UPDATE public.program_items SET status = 'laeuft' WHERE title = 'Begrüßung';
SELECT pg_temp.ok('Orga: zwei Programmpunkte angelegt', (SELECT count(*)::text FROM public.program_items), '2');
SELECT pg_temp.ok('Orga: Status geändert', (SELECT status::text FROM public.program_items WHERE title = 'Begrüßung'), 'laeuft');
SELECT pg_temp.verboten('Ende vor Beginn wird abgelehnt',
  $q$INSERT INTO public.program_items (module_day_id, starts_at, ends_at, title)
     SELECT tag, beginn, beginn - interval '1 minute', 'Falsch' FROM t$q$);

-- 3) Rollenplan: Orga-Team trägt Einsätze ein
INSERT INTO public.duty_assignments (module_day_id, person_name, phone, task, is_lead)
SELECT tag, 'Test Leitung', '+49 170 0000000', 'Entscheidet vor Ort', true FROM t;
INSERT INTO public.duty_assignments (module_day_id, person_name, task)
SELECT tag, 'Test Einlass', 'Einlass Tür 1' FROM t;
SELECT pg_temp.ok('Orga: zwei Einsätze', (SELECT count(*)::text FROM public.duty_assignments), '2');

-- 4) Einlass-Helfer: sieht den Regieplan, nicht den Rollenplan, darf nichts ändern
SELECT pg_temp.login('helfer@ses.test');
SELECT pg_temp.ok('Helfer sieht den Regieplan', (SELECT count(*)::text FROM public.program_items), '2');
SELECT pg_temp.ok('Helfer sieht keine Telefonnummern (Rollenplan)', (SELECT count(*)::text FROM public.duty_assignments), '0');
CREATE TEMP TABLE upd_helfer AS WITH u AS (UPDATE public.program_items SET status = 'erledigt' RETURNING 1) SELECT count(*) AS n FROM u;
SELECT pg_temp.ok('Helfer kann den Status nicht ändern', (SELECT n::text FROM upd_helfer), '0');
SELECT pg_temp.verboten('Helfer kann keinen Programmpunkt anlegen',
  $q$INSERT INTO public.program_items (module_day_id, starts_at, title) SELECT tag, beginn, 'Helfer' FROM t$q$);

-- 5) Teilnehmende sehen weder Regie- noch Rollenplan
SELECT pg_temp.login('amina@example.test');
SELECT pg_temp.ok('Amina sieht keinen Regieplan', (SELECT count(*)::text FROM public.program_items), '0');
SELECT pg_temp.ok('Amina sieht keinen Rollenplan', (SELECT count(*)::text FROM public.duty_assignments), '0');
SELECT pg_temp.ok('Amina bekommt keinen Ticket-Status', (SELECT count(*)::text FROM public.get_ticket_status((SELECT modul FROM t))), '0');

-- 6) Ticket-Status: Vorstand sieht alle Angemeldeten, Versuche aus email_log zählen ab p_since
RESET ROLE;
INSERT INTO public.email_log (participant_id, kind, recipient, status, error, created_at)
SELECT id, 'ticket', email, 'sent', NULL, now() - interval '1 hour' FROM public.participants WHERE email = 'amina@example.test'
UNION ALL
SELECT id, 'ticket', email, 'failed', 'Mailserver nicht erreichbar', now() - interval '10 minutes' FROM public.participants WHERE email = 'leila@example.test'
UNION ALL
SELECT id, 'ticket', email, 'sent', NULL, now() - interval '90 days' FROM public.participants WHERE email = 'yusuf@example.test';
SELECT pg_temp.login('vorstand@ses.test');
CREATE TEMP TABLE ts AS SELECT x.* FROM public.get_ticket_status((SELECT modul FROM t), now() - interval '30 days') x;
SELECT pg_temp.ok('Vorstand: drei Angemeldete für Demokratie', (SELECT count(*)::text FROM ts), '3');
SELECT pg_temp.ok('Amina: gesendet', (SELECT ticket_status FROM ts WHERE email = 'amina@example.test'), 'gesendet');
SELECT pg_temp.ok('Leila: fehlgeschlagen mit Fehlertext', (SELECT ticket_status || ': ' || last_error FROM ts WHERE email = 'leila@example.test'),
  'fehlgeschlagen: Mailserver nicht erreichbar');
SELECT pg_temp.ok('Yusuf: Ticket vor 90 Tagen zählt nicht für diese Runde', (SELECT ticket_status FROM ts WHERE email = 'yusuf@example.test'), 'offen');

SELECT pg_temp.login('orga@ses.test');
SELECT pg_temp.ok('Orga bekommt keinen Ticket-Status (Kontaktdaten)', (SELECT count(*)::text FROM public.get_ticket_status((SELECT modul FROM t))), '0');

ROLLBACK;
