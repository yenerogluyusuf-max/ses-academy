-- Tests für Migration 20261102090000_modulwerkzeuge.sql: Checkliste, Referentenpool, Gruppen, Sitzungen beenden.
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
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok  %', label;
END $$;

INSERT INTO auth.users (instance_id, id, aud, role, email, email_confirmed_at, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'amina@example.test', now(), now(), now());
UPDATE public.participants SET user_id = (SELECT id FROM auth.users WHERE email = 'amina@example.test') WHERE email = 'amina@example.test';
CREATE TEMP TABLE t AS SELECT
  (SELECT id FROM public.modules WHERE slug = 'demokratie') AS demo,
  (SELECT d.id FROM public.module_days d JOIN public.modules m ON m.id = d.module_id WHERE m.slug = 'skills-workshop' ORDER BY d.starts_at LIMIT 1) AS skills_tag,
  (SELECT id FROM public.modules WHERE slug = 'skills-workshop') AS skills,
  (SELECT id FROM public.participants WHERE email = 'amina@example.test') AS amina,
  (SELECT id FROM public.participants WHERE email = 'yusuf@example.test') AS yusuf;
GRANT SELECT ON t TO authenticated;

-- 1) Checkliste aus der Vorlage
SELECT pg_temp.login('helfer@ses.test');
SELECT pg_temp.verboten('Helfer kann keine Checkliste anlegen', 'SELECT public.create_module_checklist((SELECT demo FROM t))');
SELECT pg_temp.login('orga@ses.test');
SELECT pg_temp.ok('Orga legt die Checkliste an (18 Aufgaben)', public.create_module_checklist((SELECT demo FROM t))::text, '18');
SELECT pg_temp.ok('Zweiter Aufruf legt nichts doppelt an', public.create_module_checklist((SELECT demo FROM t))::text, '0');
SELECT pg_temp.ok('Frist „Programm festlegen“: 8 Wochen vor dem 14.11.', (SELECT due_date::text FROM public.tasks WHERE title = 'Programm festlegen'), '2026-09-19');
SELECT pg_temp.ok('Frist „Dankesmails“: 3 Tage nach dem 15.11.', (SELECT due_date::text FROM public.tasks WHERE title = 'Dankesmails an Gäste'), '2026-11-18');
UPDATE public.tasks SET done_at = now(), done_by = auth.uid() WHERE title = 'Saal reservieren';
SELECT pg_temp.ok('Aufgabe erledigt', (SELECT count(*)::text FROM public.tasks WHERE done_at IS NOT NULL), '1');

-- 2) Referentenpool und Gästeblatt
INSERT INTO public.speakers (name, affiliation, topics) VALUES ('Test Referentin', 'Universität Test', '{Demokratie,Europa}');
INSERT INTO public.module_speakers (module_id, speaker_id, role, topic, status)
SELECT demo, (SELECT id FROM public.speakers WHERE name = 'Test Referentin'), 'vortrag', 'Europa', 'angefragt' FROM t;
UPDATE public.module_speakers SET status = 'zugesagt', arrival_info = 'ICE 10:12 Köln Messe/Deutz', tech_needs = 'Beamer, HDMI';
SELECT pg_temp.ok('Gästeblatt gespeichert', (SELECT status || ' / ' || arrival_info FROM public.module_speakers), 'zugesagt / ICE 10:12 Köln Messe/Deutz');
SELECT pg_temp.login('helfer@ses.test');
SELECT pg_temp.ok('Helfer sieht den Referentenpool nicht', (SELECT count(*)::text FROM public.speakers), '0');

-- 3) Gruppen
SELECT pg_temp.login('orga@ses.test');
INSERT INTO public.module_groups (module_id, name, room, leader) SELECT skills, 'Deutschland', 'Raum 1', 'Leitung D' FROM t;
INSERT INTO public.module_groups (module_id, name, room) SELECT skills, 'Frankreich', 'Raum 2' FROM t;
INSERT INTO public.group_members (group_id, participant_id)
SELECT g.id, (SELECT amina FROM t) FROM public.module_groups g WHERE g.name = 'Deutschland';
INSERT INTO public.group_members (group_id, participant_id)
SELECT g.id, (SELECT yusuf FROM t) FROM public.module_groups g WHERE g.name = 'Frankreich';
DO $$ BEGIN
  INSERT INTO public.group_members (group_id, participant_id)
  SELECT g.id, (SELECT amina FROM t) FROM public.module_groups g WHERE g.name = 'Frankreich';
  RAISE EXCEPTION 'FEHLER doppelt';
EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'ok  Je Modul nur eine Gruppe pro Person';
END $$;
SELECT pg_temp.ok('Anwesenheit je Gruppe (beide waren am Skills-Workshop da)',
  (SELECT string_agg(group_name || ':' || split_part(name, ' ', 1) || '=' || checked_in, ',' ORDER BY group_name) FROM public.get_group_attendance((SELECT skills_tag FROM t))),
  'Deutschland:Amina=true,Frankreich:Yusuf=true');
SELECT pg_temp.login('helfer@ses.test');
SELECT pg_temp.ok('Helfer sieht Gruppen und Räume', (SELECT count(*)::text FROM public.module_groups), '2');
SELECT pg_temp.ok('Helfer sieht keine Gruppenmitglieder', (SELECT count(*)::text FROM public.group_members), '0');
SELECT pg_temp.ok('Helfer bekommt keine Anwesenheit je Gruppe (Land, GT/KGT)', (SELECT count(*)::text FROM public.get_group_attendance((SELECT skills_tag FROM t))), '0');
SELECT pg_temp.login('amina@example.test');
SELECT pg_temp.ok('Amina sieht nur ihre Gruppe', (SELECT string_agg(name || ' ' || room, ',') FROM public.module_groups), 'Deutschland Raum 1');

SELECT pg_temp.login('orga@ses.test');
SELECT pg_temp.ok('Orga sieht Kandidaten mit Land/Gruppe ohne Kontaktdaten',
  (SELECT count(*)::text FROM public.get_grouping_candidates((SELECT skills FROM t)) WHERE group_id IS NOT NULL), '2');
SELECT pg_temp.ok('Orga sieht Teammitglieder für Zuständigkeiten (ohne Helfer)',
  (SELECT string_agg(display_name, ',' ORDER BY display_name) FROM public.get_team_members()), 'Admin Test,Orga Test,Vorstand Test');
SELECT pg_temp.login('helfer@ses.test');
SELECT pg_temp.ok('Helfer sieht keine Kandidaten', (SELECT count(*)::text FROM public.get_grouping_candidates((SELECT skills FROM t))), '0');

-- 4) Sitzungen beenden nur serverseitig
SELECT pg_temp.login('orga@ses.test');
SELECT pg_temp.verboten('Teamkonto kann keine Sitzungen anderer beenden', 'SELECT public.end_user_sessions(gen_random_uuid())');

ROLLBACK;
