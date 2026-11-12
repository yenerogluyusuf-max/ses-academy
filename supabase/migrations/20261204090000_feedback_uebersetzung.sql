-- Feedback für alle Sprachen (Wunsch Yusuf 12.11.2026): Fragen haben Übersetzungen wie die Programmpunkte,
-- {"tr": {"prompt": "…"}, "fr": {"prompt": "…"}}; fehlt eine, gilt der deutsche Text. Die Standardfragen
-- bekommen Türkisch und Französisch gleich beim Anlegen mit.

ALTER TABLE public.feedback_questions ADD COLUMN i18n jsonb NOT NULL DEFAULT '{}'::jsonb
  CONSTRAINT feedback_questions_i18n_objekt CHECK (jsonb_typeof(i18n) = 'object');

CREATE OR REPLACE FUNCTION public.create_feedback_survey(p_module_id uuid, p_opens_at timestamptz, p_closes_at timestamptz)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE sid uuid;
BEGIN
  IF NOT public.has_full_access() THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'full_access_required'; END IF;
  INSERT INTO public.feedback_surveys (module_id, opens_at, closes_at) VALUES (p_module_id, p_opens_at, p_closes_at)
  RETURNING id INTO sid;
  INSERT INTO public.feedback_questions (survey_id, position, kind, prompt, i18n) VALUES
    (sid, 1, 'skala', 'Wie zufrieden bist du insgesamt mit dem Modul?',
      '{"tr": {"prompt": "Modülden genel olarak ne kadar memnun kaldın?"}, "fr": {"prompt": "Dans l’ensemble, quel est ton niveau de satisfaction concernant le module ?"}}'),
    (sid, 2, 'skala', 'Wie gut waren die Vorträge und Referierenden?',
      '{"tr": {"prompt": "Konferanslar ve konuşmacılar ne kadar iyiydi?"}, "fr": {"prompt": "Comment as-tu trouvé les conférences et les intervenants ?"}}'),
    (sid, 3, 'skala', 'Wie hilfreich waren die Ländergruppen bzw. Workshops?',
      '{"tr": {"prompt": "Ülke grupları ve atölyeler ne kadar faydalıydı?"}, "fr": {"prompt": "Dans quelle mesure les groupes par pays et les ateliers t’ont-ils été utiles ?"}}'),
    (sid, 4, 'skala', 'Wie gut war die Organisation (Ablauf, Zeitplan, Kommunikation)?',
      '{"tr": {"prompt": "Organizasyon (akış, zaman planı, iletişim) ne kadar iyiydi?"}, "fr": {"prompt": "Comment as-tu trouvé l’organisation (déroulement, horaires, communication) ?"}}'),
    (sid, 5, 'skala', 'Wie zufrieden warst du mit Verpflegung und Unterkunft?',
      '{"tr": {"prompt": "Yemek ve konaklamadan ne kadar memnun kaldın?"}, "fr": {"prompt": "Quel est ton niveau de satisfaction concernant les repas et l’hébergement ?"}}'),
    (sid, 6, 'text',  'Was hat dir besonders gefallen?',
      '{"tr": {"prompt": "En çok neyi beğendin?"}, "fr": {"prompt": "Qu’est-ce qui t’a particulièrement plu ?"}}'),
    (sid, 7, 'text',  'Was sollen wir beim nächsten Modul besser machen?',
      '{"tr": {"prompt": "Bir sonraki modülde neyi daha iyi yapmalıyız?"}, "fr": {"prompt": "Que devrions-nous améliorer pour le prochain module ?"}}');
  RETURN sid;
END $$;
