-- Übersetzungen für die Info-Mail (12.11.2026): Teilnehmende aus Frankreich bekommen sie auf Französisch, die mit
-- Profilsprache Türkisch auf Türkisch – auch Modultitel und Programmpunkte. Form:
--   program_items.i18n = {"tr": {"title": "…"}, "fr": {"title": "…"}}
--   modules.i18n       = {"tr": {"title": "…", "subtitle": "…"}, "fr": {…}}
-- Fehlt eine Sprache oder ein Feld, gilt der deutsche Text (title, subtitle). Pflege vorerst per SQL.

ALTER TABLE public.program_items ADD COLUMN i18n jsonb NOT NULL DEFAULT '{}'::jsonb
  CONSTRAINT program_items_i18n_objekt CHECK (jsonb_typeof(i18n) = 'object');
ALTER TABLE public.modules ADD COLUMN i18n jsonb NOT NULL DEFAULT '{}'::jsonb
  CONSTRAINT modules_i18n_objekt CHECK (jsonb_typeof(i18n) = 'object');
