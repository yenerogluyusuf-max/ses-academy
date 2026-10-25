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

-- Regieplan Samstag 14.11.2026 (nur wenn für den Tag noch nichts eingetragen ist)
INSERT INTO public.program_items (module_day_id, starts_at, ends_at, title, room, responsible)
SELECT d.id, (d.day + p.von::time) AT TIME ZONE 'Europe/Berlin', (d.day + p.bis::time) AT TIME ZONE 'Europe/Berlin', p.titel, NULL, p.wer
  FROM public.module_days d
  JOIN public.modules mo ON mo.id = d.module_id AND mo.slug = 'demokratie'
 CROSS JOIN (VALUES
    ('10:00', '11:00', 'Ankunft und Registrierung', 'Einlass-Team'),
    ('11:00', '11:05', 'Eröffnende Koranrezitation', NULL),
    ('11:05', '11:15', 'Begrüßung und Programmvorstellung', 'Moderation'),
    ('11:15', '11:20', 'Grußwort Burhan Kesici', NULL),
    ('11:20', '11:55', 'Vortrag Ruprecht Polenz', NULL),
    ('11:55', '12:30', 'Vortrag Shada Islam', NULL),
    ('12:30', '13:30', 'Podiumsdiskussion: Die Zukunft der Demokratien in Europa', 'Moderation'),
    ('13:30', '14:30', 'Mittagessen und Mittagsgebet', NULL),
    ('14:30', '16:00', 'Ländergruppen I: Das politische System Deutschlands, Frankreichs und Österreichs', NULL),
    ('16:00', '16:30', 'Kaffeepause und Nachmittagsgebet', NULL),
    ('16:30', '18:00', 'Ländergruppen II: Besonderheiten und aktuelle Herausforderungen', NULL),
    ('18:00', '19:00', 'Abendessen, Abend- und Nachtgebet', NULL),
    ('19:00', '20:00', 'Diskussion Eğri-Doğru', NULL)) AS p(von, bis, titel, wer)
 WHERE d.day = '2026-11-14'
   AND NOT EXISTS (SELECT 1 FROM public.program_items x WHERE x.module_day_id = d.id);

COMMIT;
