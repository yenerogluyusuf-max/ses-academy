-- Zimmercode (Türcode) je Zimmer (Wunsch 12.11.2026, Modul 14./15.11.): Das Hotel gibt die Codes am Anreisetag gegen
-- 12–13 Uhr aus; das Team trägt sie ein, Teilnehmende sehen ihren Code in „Mein Bereich“ und auf der Ticket-Seite.
-- Lesen wie bisher: rooms nur für das Orga-Team (rooms_orga); Teilnehmende nur das eigene Zimmer über get_my_rooms,
-- und nur nach Freigabe (hotels.rooms_visible).

ALTER TABLE public.rooms ADD COLUMN access_code text
  CHECK (access_code IS NULL OR (length(trim(access_code)) > 0 AND length(access_code) <= 40));

DROP FUNCTION public.get_my_rooms();
CREATE FUNCTION public.get_my_rooms()
RETURNS TABLE (module_id uuid, hotel_name text, hotel_address text, room_label text, capacity integer, mates text[], access_code text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT h.module_id, h.name, h.address, ro.label, ro.capacity,
         coalesce((SELECT array_agg(public.display_name(pb) ORDER BY pb.first_name, pb.last_name)
                     FROM public.room_assignments b
                     JOIN public.participants pb ON pb.id = b.participant_id
                    WHERE b.room_id = ra.room_id AND b.participant_id <> ra.participant_id), '{}'),
         ro.access_code
    FROM public.room_assignments ra
    JOIN public.rooms ro ON ro.id = ra.room_id
    JOIN public.hotels h ON h.id = ra.hotel_id
   WHERE ra.participant_id = public.my_participant_id() AND h.rooms_visible
$$;

REVOKE ALL ON FUNCTION public.get_my_rooms() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_rooms() TO authenticated;
