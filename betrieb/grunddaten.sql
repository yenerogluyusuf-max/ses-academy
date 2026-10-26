-- Grunddaten für den Betrieb: 1. Generation, Module mit Terminen wie auf der Website (src/i18n/daten.ts),
-- Regieplan für Samstag 14.11.2026 aus der Tagesordnung (Stand 14.10.2026).
-- Lässt sich mehrfach einspielen; vorhandene Einträge bleiben unverändert. Aufruf: ./ses.sh grunddaten
BEGIN;

INSERT INTO public.cohorts (name, year, is_current)
SELECT '1. Generation', 2026, true
 WHERE NOT EXISTS (SELECT 1 FROM public.cohorts WHERE is_current);

-- Module (Slugs wie in der Adresse der Website). Vergangene Module ohne genaue Uhrzeiten: 10 bis 18 Uhr.
INSERT INTO public.modules (slug, title, kind, location, status, cohort_id)
SELECT m.slug, m.title, m.kind::public.module_kind, m.ort, 'published', (SELECT id FROM public.cohorts WHERE is_current)
  FROM (VALUES
    ('auftakt',         'Auftakt',                 'auftakt',      'Colonia-Allee 3, 51067 Köln'),
    ('verfassungen',    'Verfassungen',            'seminar',      'Colonia-Allee 3, 51067 Köln'),
    ('skills-workshop', 'Skills-Workshop',         'workshop',     'Colonia-Allee 3, 51067 Köln'),
    ('demokratie',      'Demokratie in Europa',    'seminar',      'Colonia-Allee 3, 51067 Köln'),
    ('winter-school',   'Winter School',           'winterschool', NULL)) AS m(slug, title, kind, ort)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.module_days (module_id, day, starts_at, ends_at, label)
SELECT mo.id, t.tag::date,
       (t.tag::date + t.von::time) AT TIME ZONE 'Europe/Berlin',
       (t.tag::date + t.bis::time) AT TIME ZONE 'Europe/Berlin',
       t.label
  FROM (VALUES
    ('auftakt',         '2026-04-11', '10:00', '18:00', NULL),
    ('auftakt',         '2026-04-12', '10:00', '18:00', NULL),
    ('verfassungen',    '2026-06-13', '10:00', '18:00', NULL),
    ('verfassungen',    '2026-06-14', '10:00', '18:00', NULL),
    ('skills-workshop', '2026-09-12', '10:00', '18:00', NULL),
    ('skills-workshop', '2026-09-13', '10:00', '18:00', NULL),
    ('demokratie',      '2026-11-14', '10:00', '20:00', 'Tag 1'),
    ('demokratie',      '2026-11-15', '08:00', '14:00', 'Tag 2'),
    ('winter-school',   '2026-12-18', '10:00', '18:00', NULL),
    ('winter-school',   '2026-12-19', '10:00', '18:00', NULL),
    ('winter-school',   '2026-12-20', '10:00', '18:00', NULL),
    ('winter-school',   '2026-12-21', '10:00', '18:00', NULL),
    ('winter-school',   '2026-12-22', '10:00', '18:00', NULL),
    ('winter-school',   '2026-12-23', '10:00', '18:00', NULL)) AS t(slug, tag, von, bis, label)
  JOIN public.modules mo ON mo.slug = t.slug
ON CONFLICT (module_id, day) DO NOTHING;

-- Regieplan Modul 4 nach der Tagesordnung: Samstag laut Stand 21.10.2026, Sonntag laut Entwurf 08.10.2026
-- (je Tag nur, wenn dort noch nichts eingetragen ist)
INSERT INTO public.program_items (module_day_id, starts_at, ends_at, title, room, responsible, note)
SELECT d.id, (d.day + p.von::time) AT TIME ZONE 'Europe/Berlin', (d.day + p.bis::time) AT TIME ZONE 'Europe/Berlin', p.titel, NULL, p.wer, coalesce(p.notiz, '')
  FROM public.module_days d
  JOIN public.modules mo ON mo.id = d.module_id AND mo.slug = 'demokratie'
  JOIN (VALUES
    ('2026-11-14', '10:00', '11:00', 'Ankunft und Registrierung', 'Einlass-Team', NULL),
    ('2026-11-14', '11:00', '11:05', 'Eröffnende Koranrezitation', NULL, NULL),
    ('2026-11-14', '11:05', '11:15', 'Begrüßung und Programmvorstellung', 'Moderation', NULL),
    ('2026-11-14', '11:15', '11:30', 'Grußworte', NULL, 'Burhan Kesici · Vorsitzender des Islamrats; Furkan Kahraman · Vorsitzender der Jugendorganisation der IGMG'),
    ('2026-11-14', '11:30', '12:00', 'Vortrag Ruprecht Polenz', 'Ruprecht Polenz', 'ehemaliger Generalsekretär der CDU'),
    ('2026-11-14', '12:00', '12:30', 'Vortrag Shada Islam', 'Shada Islam', 'EU-Analystin und Kommentatorin, Brüssel'),
    ('2026-11-14', '12:30', '13:30', 'Podiumsdiskussion: Die Zukunft der Demokratien in Europa', 'Moderation', 'Ruprecht Polenz, Shada Islam und Prof. Dr. Klaus Schubert · anschließend Fragen der Teilnehmenden'),
    ('2026-11-14', '13:30', '14:30', 'Mittagessen und Mittagsgebet', NULL, NULL),
    ('2026-11-14', '14:30', '16:00', 'Ländergruppen I: Das politische System Deutschlands, Frankreichs und Österreichs', NULL, 'Deutschland: Prof. Dr. Klaus Schubert · Frankreich: Ebubekir Tavacı · Österreich: Dr. Nadim Mazarweh'),
    ('2026-11-14', '16:00', '16:30', 'Kaffeepause und Nachmittagsgebet', NULL, NULL),
    ('2026-11-14', '16:30', '18:00', 'Ländergruppen II: Besonderheiten und aktuelle Herausforderungen', NULL, 'Fortsetzung in denselben Gruppen'),
    ('2026-11-14', '18:00', '19:00', 'Abendessen, Abend- und Nachtgebet', NULL, NULL),
    ('2026-11-14', '19:00', '20:00', 'Diskussion Eğri-Doğru', 'Dr. Mehmet Daimagüler', 'Rechtsanwalt und Publizist'),
    ('2026-11-15', '08:00', '09:00', 'Frühstück', NULL, NULL),
    ('2026-11-15', '09:00', '09:10', 'Begrüßung und Tagesüberblick', 'Moderation', NULL),
    ('2026-11-15', '09:10', '10:00', 'Wege demokratischer Teilhabe', NULL, 'Beteiligungsmechanismen in demokratischen Systemen · demokratische Antworten auf ausgrenzende Rhetorik'),
    ('2026-11-15', '10:00', '11:30', 'Workshop: Eine demokratische Antwort entwerfen', NULL, 'Fallsimulation in Ländergruppen · Gegenkommunikation, Bündnisse, Wahlbeteiligung'),
    ('2026-11-15', '11:30', '11:45', 'Kaffeepause', NULL, NULL),
    ('2026-11-15', '11:45', '13:00', 'Präsentation der Ergebnisse und gemeinsame Auswertung', NULL, 'Plenum'),
    ('2026-11-15', '13:00', '13:30', 'Feedback und Abschlussrunde', NULL, 'Was habe ich gelernt?'),
    ('2026-11-15', '13:30', '14:30', 'Mittagsgebet und Mittagessen', NULL, NULL)) AS p(tag, von, bis, titel, wer, notiz)
    ON d.day = p.tag::date
 WHERE NOT EXISTS (SELECT 1 FROM public.program_items x WHERE x.module_day_id = d.id);

COMMIT;
