-- SES-Organisation: Geschlecht (für Zimmerplan und Gruppen, Entscheidung 26.10.2026) und vollständige Bewerbungsdaten.
--
--   participants.gender  = 'w' | 'm' | NULL; sichtbar für das Team (über die bestehenden Regeln) und die Person selbst
--   applications.details = weitere Angaben aus dem Bewerbungsformular (Ausbildung, Beruf, Sprachniveaus, Ehrenamt,
--                          Fähigkeiten, Mitarbeit im Team, Anmerkungen), als jsonb
--   applications.gender / age / imported_from = Angaben aus dem Formular-Export, Herkunft des Datensatzes

ALTER TABLE public.participants ADD COLUMN gender text CHECK (gender IS NULL OR gender IN ('w', 'm'));

ALTER TABLE public.applications
  ADD COLUMN gender        text CHECK (gender IS NULL OR gender IN ('w', 'm')),
  ADD COLUMN age           integer CHECK (age IS NULL OR age BETWEEN 10 AND 99),
  ADD COLUMN details       jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN imported_from text;

-- Zimmerplan: Geschlecht neben dem Namen
DROP FUNCTION public.get_stay_overview(uuid);
CREATE FUNCTION public.get_stay_overview(p_module_id uuid)
RETURNS TABLE (participant_id uuid, name text, gender text, registration_status public.registration_status, nights date[],
               arrival_at timestamptz, arrival_by text, departure_at timestamptz, room_wish text, notes text,
               room_id uuid, room_label text, answered boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.id, public.display_name(p), p.gender, r.status, coalesce(s.nights, '{}'), s.arrival_at, s.arrival_by, s.departure_at,
         coalesce(s.room_wish, ''), coalesce(s.notes, ''), ro.id, ro.label, s.registration_id IS NOT NULL
    FROM public.registrations r
    JOIN public.participants p ON p.id = r.participant_id
    LEFT JOIN public.stay_requests s ON s.registration_id = r.id
    LEFT JOIN public.room_assignments ra ON ra.participant_id = p.id
      AND ra.hotel_id IN (SELECT h.id FROM public.hotels h WHERE h.module_id = p_module_id)
    LEFT JOIN public.rooms ro ON ro.id = ra.room_id
   WHERE r.module_id = p_module_id AND r.status IN ('confirmed', 'waitlist') AND public.has_orga_access()
   ORDER BY p.last_name, p.first_name
$$;
REVOKE ALL ON FUNCTION public.get_stay_overview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_stay_overview(uuid) TO authenticated;

-- Gruppen-Einteilung: Geschlecht als zusätzliche Angabe
DROP FUNCTION public.get_grouping_candidates(uuid);
CREATE FUNCTION public.get_grouping_candidates(p_module_id uuid)
RETURNS TABLE (participant_id uuid, name text, country text, branch text, gender text, group_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.id, public.display_name(p), p.country, p.branch, p.gender, gm.group_id
    FROM public.registrations r
    JOIN public.participants p ON p.id = r.participant_id
    LEFT JOIN public.group_members gm ON gm.module_id = r.module_id AND gm.participant_id = p.id
   WHERE r.module_id = p_module_id AND r.status = 'confirmed' AND public.has_orga_access()
   ORDER BY p.last_name, p.first_name
$$;
REVOKE ALL ON FUNCTION public.get_grouping_candidates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_grouping_candidates(uuid) TO authenticated;
