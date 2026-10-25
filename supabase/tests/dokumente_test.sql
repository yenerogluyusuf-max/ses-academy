-- Tests für Migration 20261104090000_dokumente_sitzungen.sql: Dokumente mit Versionen, Sitzungen, Gastzugang.
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

-- 1) Dokument mit zwei Versionen
SELECT pg_temp.login('orga@ses.test');
INSERT INTO public.documents (title, kind, commission, module_id, tags)
SELECT 'Referenten-Portfolio', 'material', 'Müfredat', id, '{Referenten,2026}' FROM public.modules WHERE slug = 'demokratie';
CREATE TEMP TABLE d AS SELECT id FROM public.documents;
GRANT SELECT ON d TO authenticated;
RESET ROLE;
INSERT INTO storage.objects (bucket_id, name, metadata)
SELECT 'dokumente', id || '/' || n || '-portfolio.pdf', jsonb_build_object('size', 1000 * n) FROM d, generate_series(1, 2) n;
SELECT pg_temp.login('orga@ses.test');
SELECT pg_temp.ok('Version 1', public.add_document_version((SELECT id FROM d), (SELECT id || '/1-portfolio.pdf' FROM d), 'portfolio.pdf', 'application/pdf')::text, '1');
SELECT pg_temp.ok('Version 2', public.add_document_version((SELECT id FROM d), (SELECT id || '/2-portfolio.pdf' FROM d), 'portfolio.pdf', 'application/pdf', 'korrigiert')::text, '2');
SELECT pg_temp.ok('Aktuelle Version am Dokument', (SELECT current_version::text FROM public.documents), '2');
SELECT pg_temp.ok('Größe aus dem Speicher', (SELECT size_bytes::text FROM public.document_versions WHERE version = 2), '2000');
DO $$ BEGIN
  PERFORM public.add_document_version((SELECT id FROM d), (SELECT id || '/9-fehlt.pdf' FROM d), 'x.pdf', 'application/pdf');
  RAISE EXCEPTION 'FEHLER ohne Datei';
EXCEPTION WHEN raise_exception THEN RAISE NOTICE 'ok  Version ohne Datei im Speicher abgelehnt';
END $$;
SELECT pg_temp.verboten('Versionen nicht direkt schreibbar',
  $q$INSERT INTO public.document_versions (document_id, version, storage_path, file_name) SELECT id, 9, 'x', 'x' FROM d$q$);
SELECT pg_temp.ok('Suche über Schlagwort', (SELECT count(*)::text FROM public.documents WHERE 'Referenten' = ANY(tags)), '1');

-- 2) Sitzung mit Beschluss und Aufgabe
INSERT INTO public.meetings (title, held_on, commission, protocol) VALUES ('Kommissionssitzung', '2026-10-20', 'Organisation', 'Besprochen: Modul 4');
INSERT INTO public.meeting_decisions (meeting_id, text) SELECT id, 'Hotel für Winter School bis 01.12. buchen' FROM public.meetings;
INSERT INTO public.tasks (title, meeting_id, due_date) SELECT 'Hotelangebote einholen', id, '2026-11-20' FROM public.meetings;
SELECT pg_temp.ok('Sitzung mit Beschluss und Aufgabe',
  (SELECT count(DISTINCT md.id) || '/' || count(DISTINCT t.id) FROM public.meetings m JOIN public.meeting_decisions md ON md.meeting_id = m.id JOIN public.tasks t ON t.meeting_id = m.id), '1/1');

SELECT pg_temp.login('helfer@ses.test');
SELECT pg_temp.ok('Helfer sieht keine Dokumente', (SELECT count(*)::text FROM public.documents), '0');
SELECT pg_temp.ok('Helfer sieht keine Sitzungen', (SELECT count(*)::text FROM public.meetings), '0');

-- 3) Gastzugang
SELECT pg_temp.login('orga@ses.test');
INSERT INTO public.speakers (name, bio) VALUES ('Test Gast', 'Kurzprofil');
INSERT INTO public.module_speakers (module_id, speaker_id, status, host_name, arrival_info)
SELECT m.id, s.id, 'zugesagt', 'Team Test', 'ICE 10:12' FROM public.modules m, public.speakers s WHERE m.slug = 'demokratie' AND s.name = 'Test Gast';
INSERT INTO public.program_items (module_day_id, starts_at, title)
SELECT d.id, d.starts_at + interval '1 hour', 'Vortrag Test Gast' FROM public.module_days d JOIN public.modules m ON m.id = d.module_id WHERE m.slug = 'demokratie' ORDER BY d.starts_at LIMIT 1;
SELECT pg_temp.verboten('Orga liest keine Gast-Links', 'SELECT access_token FROM public.module_speakers');
SELECT pg_temp.verboten('Teamkonto ruft die Gastseite nicht auf', 'SELECT public.get_guest_sheet(gen_random_uuid())');
RESET ROLE;
CREATE TEMP TABLE g AS SELECT access_token FROM public.module_speakers;
GRANT SELECT ON g TO service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET LOCAL ROLE service_role;
SELECT pg_temp.ok('Gastseite: Betreuung und Anreise', (SELECT public.get_guest_sheet((SELECT access_token FROM g)) ->> 'host') || ' / ' || (SELECT public.get_guest_sheet((SELECT access_token FROM g)) ->> 'arrival_info'), 'Team Test / ICE 10:12');
SELECT pg_temp.ok('Gastseite: Programm des Moduls', (SELECT jsonb_array_length(public.get_guest_sheet((SELECT access_token FROM g)) -> 'program')::text), '1');
RESET ROLE;
UPDATE public.module_speakers SET status = 'abgesagt';
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET LOCAL ROLE service_role;
SELECT pg_temp.ok('Abgesagt: Link zeigt nichts mehr', coalesce(public.get_guest_sheet((SELECT access_token FROM g))::text, '-'), '-');

ROLLBACK;
