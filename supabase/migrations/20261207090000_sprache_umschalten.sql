-- Sprache umschalten (Wunsch 12.11.2026): sichtbarer Umschalter Deutsch/Türkçe/Français in „Mein Bereich“.
-- Ändert nur die Profilsprache der angemeldeten Person (wie update_my_profile, aber ohne die übrigen Felder),
-- damit auch Mails danach in dieser Sprache kommen. Ticket-Seite und Feedback (ohne Konto) schreiben serverseitig
-- über den Link aus der Mail (link_token), siehe src/lib/aktionen/sprache.ts.

CREATE FUNCTION public.set_my_language(p_language text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pid uuid := public.my_participant_id();
BEGIN
  IF pid IS NULL THEN RETURN 'no_participant'; END IF;
  IF p_language IS NULL OR p_language NOT IN ('de', 'tr', 'en', 'fr', 'nl') THEN RETURN 'invalid'; END IF;
  UPDATE public.participants SET preferred_language = p_language WHERE id = pid;
  RETURN 'saved';
END $$;

REVOKE ALL ON FUNCTION public.set_my_language(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_language(text) TO authenticated;
