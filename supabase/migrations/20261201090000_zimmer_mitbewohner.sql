-- Zimmer in „Mein Bereich“ mit Zimmerpartner:innen (Wunsch 11.11.2026, Modul 14./15.11.).
-- Wie bisher nur nach Freigabe durch das Team (hotels.rooms_visible) und nur das eigene Zimmer. Neu: Bettenzahl
-- (für „Einzelzimmer“/„Doppelzimmer“) und die Namen der anderen im selben Zimmer – nur Namen, keine Kontaktdaten.

DROP FUNCTION public.get_my_rooms();
CREATE FUNCTION public.get_my_rooms()
RETURNS TABLE (module_id uuid, hotel_name text, hotel_address text, room_label text, capacity integer, mates text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT h.module_id, h.name, h.address, ro.label, ro.capacity,
         coalesce((SELECT array_agg(public.display_name(pb) ORDER BY pb.first_name, pb.last_name)
                     FROM public.room_assignments b
                     JOIN public.participants pb ON pb.id = b.participant_id
                    WHERE b.room_id = ra.room_id AND b.participant_id <> ra.participant_id), '{}')
    FROM public.room_assignments ra
    JOIN public.rooms ro ON ro.id = ra.room_id
    JOIN public.hotels h ON h.id = ra.hotel_id
   WHERE ra.participant_id = public.my_participant_id() AND h.rooms_visible
$$;

REVOKE ALL ON FUNCTION public.get_my_rooms() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_rooms() TO authenticated;
