-- SES-Organisation, Phase 1: Werkzeuge für den Eventtag.
--
--   program_items   = Regieplan: Programmpunkte eines Modultags mit Zeit, Raum, Verantwortlichen und Status
--   duty_assignments = Rollenplan: wer an einem Modultag welche Aufgabe vor Ort hat, mit Telefonnummer
--
-- Außerdem: interne Notizen liegen nur noch in participant_notes. Die alte Spalte participants.notes
-- war über participants_self für die Person selbst lesbar.

-- ---------------------------------------------------------------------------
-- Interne Notizen aus participants übernehmen und die Spalte entfernen
-- ---------------------------------------------------------------------------
INSERT INTO public.participant_notes (participant_id, body)
SELECT id, notes FROM public.participants WHERE notes <> ''
ON CONFLICT (participant_id) DO UPDATE
  SET body = CASE WHEN public.participant_notes.body = '' THEN excluded.body
                  ELSE public.participant_notes.body || E'\n' || excluded.body END;
ALTER TABLE public.participants DROP COLUMN notes;

-- ---------------------------------------------------------------------------
-- Regieplan
-- ---------------------------------------------------------------------------
-- geplant → laeuft → erledigt; verschoben = neue Zeit eingetragen; entfaellt = findet nicht statt
CREATE TYPE public.program_item_status AS ENUM ('geplant', 'laeuft', 'erledigt', 'verschoben', 'entfaellt');

CREATE TABLE public.program_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_day_id uuid NOT NULL REFERENCES public.module_days(id) ON DELETE CASCADE,
  starts_at     timestamptz NOT NULL,
  ends_at       timestamptz,
  title         text NOT NULL CHECK (length(trim(title)) > 0),
  room          text,
  responsible   text,               -- Name, wie ihn das Team kennt; Personen-Verknüpfung folgt mit Phase 2
  note          text NOT NULL DEFAULT '',
  status        public.program_item_status NOT NULL DEFAULT 'geplant',
  updated_by    uuid REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX program_items_day_idx ON public.program_items (module_day_id, starts_at);
CREATE TRIGGER program_items_touch BEFORE UPDATE ON public.program_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Rollenplan
-- ---------------------------------------------------------------------------
CREATE TABLE public.duty_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_day_id uuid NOT NULL REFERENCES public.module_days(id) ON DELETE CASCADE,
  person_name   text NOT NULL CHECK (length(trim(person_name)) > 0),
  phone         text,
  task          text NOT NULL CHECK (length(trim(task)) > 0),
  starts_at     timestamptz,
  ends_at       timestamptz,
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,  -- gesetzt, wenn die Person ein Teamkonto hat
  is_lead       boolean NOT NULL DEFAULT false,                      -- entscheidet bei Problemen vor Ort
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX duty_assignments_day_idx ON public.duty_assignments (module_day_id, starts_at);

-- ---------------------------------------------------------------------------
-- Zeilenschutz
-- ---------------------------------------------------------------------------
-- Regieplan: alle im Team inkl. Einlass-Helfer lesen (enthält keine Kontaktdaten), Orga-Team pflegt.
-- Rollenplan: enthält Telefonnummern, deshalb erst ab Orga-Team.
ALTER TABLE public.program_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duty_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY program_items_read  ON public.program_items FOR SELECT TO authenticated USING (public.has_checkin_access());
CREATE POLICY program_items_write ON public.program_items FOR ALL TO authenticated
  USING (public.has_orga_access()) WITH CHECK (public.has_orga_access());
CREATE POLICY duty_read  ON public.duty_assignments FOR SELECT TO authenticated USING (public.has_orga_access());
CREATE POLICY duty_write ON public.duty_assignments FOR ALL TO authenticated
  USING (public.has_orga_access()) WITH CHECK (public.has_orga_access());

REVOKE ALL ON public.program_items, public.duty_assignments FROM anon;

-- ---------------------------------------------------------------------------
-- Ticket-Versand: wer hat für ein Modul noch kein Ticket bekommen?
-- ---------------------------------------------------------------------------
-- Eine Zeile je bestätigter oder wartender Anmeldung mit dem letzten Versuch aus email_log seit p_since.
-- Das Ticket gilt für alle Module; p_since grenzt auf die Versandrunde für dieses Modul ein.
-- ticket_status: 'gesendet' (letzter Versuch erfolgreich), 'fehlgeschlagen', 'keine_mail', 'offen'.
CREATE FUNCTION public.get_ticket_status(p_module_id uuid, p_since timestamptz DEFAULT '-infinity')
RETURNS TABLE (participant_id uuid, name text, email text, registration_status public.registration_status,
               ticket_status text, last_attempt_at timestamptz, last_error text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.id, public.display_name(p), p.email, r.status,
         CASE WHEN p.email IS NULL THEN 'keine_mail'
              WHEN l.status = 'sent' THEN 'gesendet'
              WHEN l.status = 'failed' THEN 'fehlgeschlagen'
              ELSE 'offen' END,
         l.created_at, l.error
    FROM public.registrations r
    JOIN public.participants p ON p.id = r.participant_id
    LEFT JOIN LATERAL (
      SELECT e.status, e.error, e.created_at FROM public.email_log e
       WHERE e.participant_id = p.id AND e.kind = 'ticket' AND e.created_at >= p_since
       ORDER BY e.created_at DESC LIMIT 1) l ON true
   WHERE r.module_id = p_module_id AND r.status IN ('confirmed', 'waitlist', 'pending')
     AND public.has_full_access()
   ORDER BY p.last_name, p.first_name
$$;

REVOKE ALL ON FUNCTION public.get_ticket_status(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ticket_status(uuid, timestamptz) TO authenticated;
