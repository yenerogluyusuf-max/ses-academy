-- Einlass-Zähler mit Rückmeldung (Hinweis Yusuf 12.11.2026: „0 von 180“ war irreführend, zugesagt hatten 108).
-- Nutzt ein Modul die Rückmeldung (registrations.rsvp), gilt als erwartet: bestätigt UND zugesagt, dazu jede:r schon
-- Eingecheckte (auch ohne Rückmeldung). Ohne Rückmeldung und noch nicht da: eigene Zahl. Abgesagt zählt zu
-- „entschuldigt oder abgemeldet“. Module ohne Rückmeldung zählen wie bisher alle Bestätigten.

CREATE OR REPLACE FUNCTION public.get_day_counts(p_module_day_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH zeilen AS (
    SELECT r.status, r.rsvp, a.id AS anwesend
      FROM public.module_days d
      JOIN public.registrations r ON r.module_id = d.module_id
      LEFT JOIN public.attendances a ON a.registration_id = r.id AND a.module_day_id = d.id
     WHERE d.id = p_module_day_id
  ), art AS (
    SELECT bool_or(rsvp IS NOT NULL) AS mit_rueckmeldung FROM zeilen
  )
  SELECT CASE WHEN public.has_checkin_access((SELECT d0.module_id FROM public.module_days d0 WHERE d0.id = p_module_day_id)) THEN jsonb_build_object(
    'checked_in', count(z.anwesend),
    'expected', CASE WHEN art.mit_rueckmeldung
      THEN count(*) FILTER (WHERE z.status = 'confirmed' AND (z.rsvp = 'zugesagt' OR z.anwesend IS NOT NULL))
      ELSE count(*) FILTER (WHERE z.status = 'confirmed') END,
    'no_reply', CASE WHEN art.mit_rueckmeldung
      THEN count(*) FILTER (WHERE z.status = 'confirmed' AND z.rsvp IS NULL AND z.anwesend IS NULL) ELSE 0 END,
    'waitlist', count(*) FILTER (WHERE z.status = 'waitlist'),
    'excused', count(*) FILTER (WHERE z.status IN ('excused', 'cancelled')
                                   OR (z.status = 'confirmed' AND z.rsvp = 'abgesagt' AND z.anwesend IS NULL)))
  END
    FROM zeilen z, art
   GROUP BY art.mit_rueckmeldung
$$;
