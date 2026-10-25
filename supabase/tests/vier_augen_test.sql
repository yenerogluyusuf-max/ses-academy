-- Tests für Migration 20261103090000_vier_augen_nachrichten.sql: Vier-Augen-Prinzip, Empfänger einer Nachricht.
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

CREATE TEMP TABLE konten AS SELECT email, id FROM auth.users;
GRANT SELECT ON konten TO authenticated;

-- 1) Vorstand stellt einen Antrag, darf ihn nicht selbst freigeben
SELECT pg_temp.login('vorstand@ses.test');
DO $$ BEGIN
  INSERT INTO public.approvals (action, summary, payload) VALUES ('nachricht', 'harmlos', '{}');
  RAISE EXCEPTION 'FEHLER direktes Anlegen';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  Anträge nicht direkt anlegbar (Beschreibung baut die Datenbank)';
END $$;
SELECT public.create_approval('nachricht', '{"betreff":"Hallo","text":"Test","filter":{}}');
SELECT pg_temp.ok('Beschreibung aus dem Inhalt gebaut', (SELECT summary FROM public.approvals), 'Nachricht „Hallo“ an 5 Personen (alle aktiven mit E-Mail)');
CREATE TEMP TABLE a AS SELECT id FROM public.approvals;
GRANT SELECT ON a TO authenticated;
SELECT pg_temp.ok('Eigenen Antrag nicht freigeben', public.decide_approval((SELECT id FROM a), true), 'own_request');
SELECT pg_temp.ok('Vor Freigabe nicht ausführbar', public.claim_approval((SELECT id FROM a), 'nachricht') ->> 'result', 'offen');
DO $$ BEGIN
  UPDATE public.approvals SET status = 'freigegeben';
  RAISE EXCEPTION 'FEHLER direkte Änderung';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  Status lässt sich nicht direkt ändern';
END $$;

-- 2) Orga (kein Vollzugriff) sieht und entscheidet nichts
SELECT pg_temp.login('orga@ses.test');
SELECT pg_temp.ok('Orga sieht keine Anträge', (SELECT count(*)::text FROM public.approvals), '0');
DO $$ BEGIN
  PERFORM public.decide_approval((SELECT id FROM a), true);
  RAISE EXCEPTION 'FEHLER Orga entscheidet';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  Orga kann nicht freigeben';
END $$;

-- 3) Admin gibt frei, nur die anfragende Person führt aus, nur einmal
SELECT pg_temp.login('admin@ses.test');
SELECT pg_temp.ok('Admin gibt frei', public.decide_approval((SELECT id FROM a), true, 'passt'), 'approved');
SELECT pg_temp.ok('Zweite Entscheidung nicht möglich', public.decide_approval((SELECT id FROM a), false), 'already_decided');
SELECT pg_temp.ok('Admin kann fremden Antrag nicht ausführen', public.claim_approval((SELECT id FROM a), 'nachricht') ->> 'result', 'not_requester');
SELECT pg_temp.login('vorstand@ses.test');
SELECT pg_temp.ok('Falsche Aktion', public.claim_approval((SELECT id FROM a), 'export') ->> 'result', 'not_found');
SELECT pg_temp.ok('Anfragende Person führt aus und bekommt den Inhalt', public.claim_approval((SELECT id FROM a), 'nachricht') #>> '{payload,betreff}', 'Hallo');
SELECT pg_temp.ok('Kein zweites Ausführen', public.claim_approval((SELECT id FROM a), 'nachricht') ->> 'result', 'ausgefuehrt');
SELECT public.record_approval_result((SELECT id FROM a), '{"gesendet": 3}');
SELECT pg_temp.ok('Ergebnis nachgetragen', (SELECT result ->> 'gesendet' FROM public.approvals), '3');

-- 4) Team-Zugang nur durch Admin freigeben; Freigabe verfällt nach 24 Stunden
SELECT public.create_approval('team_zugang', '{"art":"neu","email":"Neu@Example.test","name":"Neue Person","rolle":"orga_team"}');
SELECT pg_temp.ok('Team-Antrag: Beschreibung mit E-Mail und Rolle', (SELECT summary FROM public.approvals WHERE action = 'team_zugang'), 'Neuer Team-Zugang: Neue Person <neu@example.test> als Orga-Team, unbefristet');
SELECT pg_temp.login('admin@ses.test');
SELECT public.create_approval('export', '{"filter":{}}');
SELECT pg_temp.login('vorstand@ses.test');
SELECT pg_temp.ok('Vorstand darf Team-Zugang eines Admins nicht freigeben',
  public.decide_approval((SELECT id FROM public.approvals WHERE action = 'export'), true), 'approved');
RESET ROLE;
UPDATE public.approvals SET decided_at = now() - interval '25 hours' WHERE action = 'export';
SELECT pg_temp.login('admin@ses.test');
SELECT pg_temp.ok('Freigabe nach 24 Stunden abgelaufen', public.claim_approval((SELECT id FROM public.approvals WHERE action = 'export'), 'export') ->> 'result', 'expired');
SELECT pg_temp.ok('Admin gibt Team-Zugang frei', public.decide_approval((SELECT id FROM public.approvals WHERE action = 'team_zugang'), true), 'approved');

-- 4b) Team-Rollen nur über freigegebene Anträge, auch direkt in der Datenbank
DO $$ BEGIN
  UPDATE public.staff_members SET role = 'admin' WHERE user_id = (SELECT id FROM konten WHERE email = 'orga@ses.test');
  RAISE EXCEPTION 'FEHLER direktes Hochstufen';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  Admin kann nicht direkt hochstufen';
END $$;
DO $$ BEGIN
  INSERT INTO public.staff_members (user_id, role, display_name) VALUES (gen_random_uuid(), 'admin', 'x');
  RAISE EXCEPTION 'FEHLER direktes Anlegen';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  Admin kann kein Teamkonto direkt anlegen';
END $$;
UPDATE public.staff_members SET role = 'checkin_helper' WHERE user_id = (SELECT id FROM konten WHERE email = 'orga@ses.test');
SELECT pg_temp.ok('Herabstufen geht direkt', (SELECT role::text FROM public.staff_members WHERE user_id = (SELECT id FROM konten WHERE email = 'orga@ses.test')), 'checkin_helper');
SELECT public.create_approval('team_zugang', jsonb_build_object('art', 'rolle', 'user_id', (SELECT id FROM konten WHERE email = 'orga@ses.test'), 'rolle', 'orga_team'));
-- ein anderer Admin muss freigeben: zweiten Admin für den Test anlegen (als Superuser, wie bei der Einrichtung)
RESET ROLE;
INSERT INTO public.staff_members (user_id, role, display_name) SELECT id, 'admin', 'Zweiter Admin' FROM auth.users WHERE email = 'vorstand@ses.test'
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
SELECT pg_temp.login('vorstand@ses.test');
SELECT pg_temp.ok('Zweiter Admin gibt Hochstufung frei', public.decide_approval((SELECT id FROM public.approvals WHERE summary LIKE 'Orga Test: Rolle%'), true), 'approved');
SELECT pg_temp.login('admin@ses.test');
SELECT pg_temp.ok('Antragsteller führt Hochstufung aus', public.execute_team_approval((SELECT id FROM public.approvals WHERE summary LIKE 'Orga Test: Rolle%')), 'ok');
SELECT pg_temp.ok('Rolle wieder Orga-Team', (SELECT role::text FROM public.staff_members WHERE user_id = (SELECT id FROM konten WHERE email = 'orga@ses.test')), 'orga_team');
-- Zeitraum: einschränken direkt, ausweiten nur mit Freigabe
UPDATE public.staff_members SET valid_from = now() - interval '1 hour', valid_until = now() + interval '1 day' WHERE user_id = (SELECT id FROM konten WHERE email = 'helfer@ses.test');
SELECT pg_temp.ok('Befristen geht direkt', (SELECT (valid_until IS NOT NULL)::text FROM public.staff_members WHERE user_id = (SELECT id FROM konten WHERE email = 'helfer@ses.test')), 'true');
DO $$ BEGIN
  UPDATE public.staff_members SET valid_from = NULL, valid_until = NULL WHERE user_id = (SELECT id FROM konten WHERE email = 'helfer@ses.test');
  RAISE EXCEPTION 'FEHLER ausweiten';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  Befristung aufheben nur mit Freigabe';
END $$;
SELECT public.create_approval('team_zugang', jsonb_build_object('art', 'zeitraum', 'user_id', (SELECT id FROM konten WHERE email = 'helfer@ses.test'), 'modul', NULL));
SELECT pg_temp.ok('Antrag beschreibt das Ausweiten', (SELECT summary FROM public.approvals WHERE payload ->> 'art' = 'zeitraum'), 'Helfer Test (Einlass-Helfer:in): Zugang unbefristet machen');
SELECT pg_temp.ok('claim_approval nimmt keine Team-Anträge', public.claim_approval((SELECT id FROM public.approvals WHERE action = 'team_zugang' AND status = 'freigegeben' LIMIT 1), 'team_zugang') ->> 'result', 'not_found');

-- 5) Empfänger
RESET ROLE;
UPDATE public.participants SET region_id = (SELECT id FROM public.regions WHERE name = 'Köln') WHERE email = 'amina@example.test';
SELECT pg_temp.login('vorstand@ses.test');
SELECT pg_temp.ok('Ohne Filter: alle aktiven mit E-Mail', (SELECT count(*)::text FROM public.broadcast_recipients('{}')), (SELECT count(*)::text FROM public.participants WHERE active AND email IS NOT NULL));
SELECT pg_temp.ok('Filter Generation', (SELECT count(*)::text FROM public.broadcast_recipients(jsonb_build_object('cohort_id', (SELECT id FROM public.cohorts WHERE is_current)))), '3');
SELECT pg_temp.ok('Filter Region Köln', (SELECT string_agg(first_name, ',') FROM public.broadcast_recipients(jsonb_build_object('region_id', (SELECT id FROM public.regions WHERE name = 'Köln')))), 'Amina');
SELECT pg_temp.ok('Filter Modul (bestätigt angemeldet)', (SELECT count(*)::text FROM public.broadcast_recipients(jsonb_build_object('module_id', (SELECT id FROM public.modules WHERE slug = 'demokratie')))), '3');
SELECT pg_temp.login('orga@ses.test');
SELECT pg_temp.ok('Orga bekommt keine Empfänger', (SELECT count(*)::text FROM public.broadcast_recipients('{}')), '0');

ROLLBACK;
