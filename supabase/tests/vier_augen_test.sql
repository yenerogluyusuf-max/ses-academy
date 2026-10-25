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

-- 1) Vorstand stellt einen Antrag, darf ihn nicht selbst freigeben
SELECT pg_temp.login('vorstand@ses.test');
INSERT INTO public.approvals (action, summary, payload) VALUES ('nachricht', 'Test an alle', '{"betreff":"Hallo"}');
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
INSERT INTO public.approvals (action, summary, payload) VALUES ('team_zugang', 'Neues Konto', '{}');
SELECT pg_temp.login('admin@ses.test');
INSERT INTO public.approvals (action, summary) VALUES ('export', 'Export');
SELECT pg_temp.login('vorstand@ses.test');
SELECT pg_temp.ok('Vorstand darf Team-Zugang eines Admins nicht freigeben',
  public.decide_approval((SELECT id FROM public.approvals WHERE action = 'export'), true), 'approved');
RESET ROLE;
UPDATE public.approvals SET decided_at = now() - interval '25 hours' WHERE action = 'export';
SELECT pg_temp.login('admin@ses.test');
SELECT pg_temp.ok('Freigabe nach 24 Stunden abgelaufen', public.claim_approval((SELECT id FROM public.approvals WHERE action = 'export'), 'export') ->> 'result', 'expired');
SELECT pg_temp.ok('Admin gibt Team-Zugang frei', public.decide_approval((SELECT id FROM public.approvals WHERE action = 'team_zugang'), true), 'approved');

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
