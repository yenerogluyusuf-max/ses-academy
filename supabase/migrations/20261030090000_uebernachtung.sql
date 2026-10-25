-- SES-Organisation, Phase 2: Anmeldung mit Übernachtung, Hotel und Zimmerplan.
--
--   modules.stay_form_open  = Teilnehmende geben in „Mein Bereich“ Nächte, Anreise und Zimmerwunsch an
--   stay_requests           = Angaben je Anmeldung (welche Nächte, Anreise, Zimmerwunsch, Hinweise)
--   hotels                  = Hotel je Modul mit Kontingent, Preis und Stornofrist
--   rooms / room_assignments = Zimmerplan: Zimmer im Hotel, wer in welchem Zimmer schläft
-- Eine Nacht wird über ihr Datum angegeben (Nacht vom 18. auf den 19.12. = 2026-12-18).

ALTER TABLE public.modules ADD COLUMN stay_form_open boolean NOT NULL DEFAULT false;

CREATE TABLE public.stay_requests (
  registration_id uuid PRIMARY KEY REFERENCES public.registrations(id) ON DELETE CASCADE,
  nights          date[] NOT NULL DEFAULT '{}',
  arrival_at      timestamptz,
  arrival_by      text CHECK (arrival_by IS NULL OR arrival_by IN ('bahn', 'auto', 'flug', 'bus', 'andere')),
  departure_at    timestamptz,
  room_wish       text NOT NULL DEFAULT '' CHECK (length(room_wish) <= 300),
  notes           text NOT NULL DEFAULT '' CHECK (length(notes) <= 1000),   -- z. B. Ernährung, Gesundheit (nur Team)
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER stay_requests_touch BEFORE UPDATE ON public.stay_requests FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.hotels (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id             uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  name                  text NOT NULL CHECK (length(trim(name)) > 0),
  address               text,
  contact               text,                  -- Ansprechpartner, Telefon, Mail im Hotel
  quota_rooms           integer CHECK (quota_rooms IS NULL OR quota_rooms >= 0),
  price_per_night       numeric(8, 2) CHECK (price_per_night IS NULL OR price_per_night >= 0),
  cancellation_deadline date,
  notes                 text NOT NULL DEFAULT '',
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX hotels_module_idx ON public.hotels (module_id);

CREATE TABLE public.rooms (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  label    text NOT NULL CHECK (length(trim(label)) > 0),   -- Zimmernummer oder Name
  capacity integer NOT NULL CHECK (capacity BETWEEN 1 AND 12),
  section  text,                                           -- z. B. Flur oder Bereich, frei vom Team vergeben
  UNIQUE (hotel_id, label)
);

CREATE TABLE public.room_assignments (
  room_id        uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  hotel_id       uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,   -- je Hotel nur ein Zimmer pro Person
  PRIMARY KEY (room_id, participant_id),
  UNIQUE (hotel_id, participant_id)
);

-- Zimmer nicht überbelegen; hotel_id passend zum Zimmer setzen
CREATE FUNCTION public.room_assignments_check() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE r public.rooms%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.rooms WHERE id = NEW.room_id FOR UPDATE;
  NEW.hotel_id := r.hotel_id;
  IF (SELECT count(*) FROM public.room_assignments WHERE room_id = NEW.room_id AND participant_id <> NEW.participant_id) >= r.capacity THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'room_full';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER room_assignments_check BEFORE INSERT OR UPDATE ON public.room_assignments
  FOR EACH ROW EXECUTE FUNCTION public.room_assignments_check();

-- Angaben der angemeldeten Person für ein Modul speichern. Nur bei offener Abfrage, nur Nächte rund um die Modultage.
CREATE FUNCTION public.save_my_stay(p_module_id uuid, p_nights date[], p_arrival_at timestamptz, p_arrival_by text,
                                    p_departure_at timestamptz, p_room_wish text, p_notes text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  reg uuid;
  erste date;
  letzte date;
  saubere date[];
BEGIN
  SELECT r.id INTO reg FROM public.registrations r
    JOIN public.participants p ON p.id = r.participant_id
   WHERE r.module_id = p_module_id AND p.user_id = auth.uid() AND r.status IN ('confirmed', 'waitlist', 'pending');
  IF reg IS NULL THEN RETURN 'not_registered'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.modules WHERE id = p_module_id AND stay_form_open) THEN RETURN 'closed'; END IF;
  SELECT min(day), max(day) INTO erste, letzte FROM public.module_days WHERE module_id = p_module_id;
  -- erlaubt: Nacht vor dem ersten Tag bis Nacht vor dem letzten Tag
  SELECT coalesce(array_agg(DISTINCT n ORDER BY n), '{}') INTO saubere
    FROM unnest(coalesce(p_nights, '{}')) n WHERE n BETWEEN erste - 1 AND letzte - 1;
  INSERT INTO public.stay_requests (registration_id, nights, arrival_at, arrival_by, departure_at, room_wish, notes)
  VALUES (reg, saubere, p_arrival_at, nullif(p_arrival_by, ''), p_departure_at, left(coalesce(trim(p_room_wish), ''), 300), left(coalesce(trim(p_notes), ''), 1000))
  ON CONFLICT (registration_id) DO UPDATE SET nights = excluded.nights, arrival_at = excluded.arrival_at, arrival_by = excluded.arrival_by,
    departure_at = excluded.departure_at, room_wish = excluded.room_wish, notes = excluded.notes;
  RETURN 'saved';
END $$;

-- Zimmerliste fürs Hotel und Überblick fürs Team: je Person Nächte, Anreise, Zimmer
CREATE FUNCTION public.get_stay_overview(p_module_id uuid)
RETURNS TABLE (participant_id uuid, name text, registration_status public.registration_status, nights date[],
               arrival_at timestamptz, arrival_by text, departure_at timestamptz, room_wish text, notes text,
               room_id uuid, room_label text, answered boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.id, public.display_name(p), r.status, coalesce(s.nights, '{}'), s.arrival_at, s.arrival_by, s.departure_at,
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

-- Eigenes Zimmer für „Mein Bereich“: Hotel, Adresse, Zimmer je Modul (ohne Mitbewohnende)
CREATE FUNCTION public.get_my_rooms()
RETURNS TABLE (module_id uuid, hotel_name text, hotel_address text, room_label text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT h.module_id, h.name, h.address, ro.label
    FROM public.room_assignments ra
    JOIN public.rooms ro ON ro.id = ra.room_id
    JOIN public.hotels h ON h.id = ra.hotel_id
   WHERE ra.participant_id = public.my_participant_id()
$$;

-- ---------------------------------------------------------------------------
-- Zeilenschutz
-- ---------------------------------------------------------------------------
ALTER TABLE public.stay_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotels           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY stay_orga ON public.stay_requests FOR ALL TO authenticated USING (public.has_orga_access()) WITH CHECK (public.has_orga_access());
CREATE POLICY stay_self ON public.stay_requests FOR SELECT TO authenticated
  USING (registration_id IN (SELECT r.id FROM public.registrations r WHERE r.participant_id = public.my_participant_id()));
CREATE POLICY hotels_orga  ON public.hotels FOR ALL TO authenticated USING (public.has_orga_access()) WITH CHECK (public.has_orga_access());
CREATE POLICY rooms_orga   ON public.rooms FOR ALL TO authenticated USING (public.has_orga_access()) WITH CHECK (public.has_orga_access());
CREATE POLICY room_ass_orga ON public.room_assignments FOR ALL TO authenticated USING (public.has_orga_access()) WITH CHECK (public.has_orga_access());

REVOKE ALL ON public.stay_requests, public.hotels, public.rooms, public.room_assignments FROM anon;
REVOKE ALL ON FUNCTION public.save_my_stay(uuid, date[], timestamptz, text, timestamptz, text, text), public.get_stay_overview(uuid),
  public.get_my_rooms() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_my_stay(uuid, date[], timestamptz, text, timestamptz, text, text), public.get_stay_overview(uuid),
  public.get_my_rooms() TO authenticated;

-- ---------------------------------------------------------------------------
-- Nachbesserung Selbst-Abgabe (20261029090000): Speicherpfad streng prüfen und nur Dateien annehmen,
-- die wirklich im Speicher „abgaben“ liegen; die Größe kommt aus dem Speicher, nicht vom Aufrufer.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_own_assignment(p_assignment_id uuid, p_link text DEFAULT NULL, p_storage_path text DEFAULT NULL,
                                                        p_file_name text DEFAULT NULL, p_size_bytes bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  p public.participants%ROWTYPE;
  a public.assignments%ROWTYPE;
  sid uuid;
  groesse bigint;
  link text := nullif(trim(p_link), '');
BEGIN
  SELECT * INTO p FROM public.participants WHERE user_id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('result', 'no_participant'); END IF;
  SELECT * INTO a FROM public.assignments WHERE id = p_assignment_id AND cohort_id = p.cohort_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('result', 'not_found'); END IF;
  IF link IS NULL AND p_storage_path IS NULL THEN RETURN jsonb_build_object('result', 'empty'); END IF;
  IF link IS NOT NULL AND link !~* '^https?://' THEN RETURN jsonb_build_object('result', 'invalid_link'); END IF;
  IF p_storage_path IS NOT NULL THEN
    -- genau so, wie der Server den Pfad anlegt: <aufgabe>/<person>/<zeit>-<name>, ohne Unterordner
    IF p_storage_path !~ ('^' || a.id::text || '/' || p.id::text || '/[0-9]+-[A-Za-z0-9._-]{1,120}$') OR p_storage_path LIKE '%..%' THEN
      RETURN jsonb_build_object('result', 'invalid_path');
    END IF;
    SELECT (o.metadata ->> 'size')::bigint INTO groesse FROM storage.objects o WHERE o.bucket_id = 'abgaben' AND o.name = p_storage_path;
    IF NOT FOUND THEN RETURN jsonb_build_object('result', 'invalid_path'); END IF;
  END IF;

  INSERT INTO public.submissions (assignment_id, label, file_name, link, submitted_on, submitted_at, source, storage_path, size_bytes)
  VALUES (a.id, public.display_name(p), nullif(left(trim(p_file_name), 200), ''), left(link, 1000),
          (now() AT TIME ZONE 'Europe/Berlin')::date, now(), 'self', p_storage_path, groesse)
  RETURNING id INTO sid;
  INSERT INTO public.submission_participants (submission_id, participant_id) VALUES (sid, p.id);
  INSERT INTO public.audit_log (actor_id, target_participant_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), p.id, 'submission_self', 'submission', sid, jsonb_build_object('assignment', a.number));
  RETURN jsonb_build_object('result', 'saved', 'submission_id', sid,
    'status', CASE WHEN a.due_at IS NULL OR now() <= a.due_at THEN 'puenktlich' ELSE 'verspaetet' END);
END $$;
