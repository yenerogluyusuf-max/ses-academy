-- SES-Organisation, Phase 3 (Teil 1): Referentenpool mit Gästeblatt, Aufgaben mit Checklisten-Vorlage,
-- Gruppen und Räume je Modul. Dazu: Sitzungen eines Kontos beenden (zweiter Faktor zurückgesetzt).
--
--   speakers          = Referentenpool (Person, Funktion, Kurzprofil, Kontakt, Themen)
--   module_speakers   = Einladung je Modul mit Status und Gästeblatt (Anreise, Abholung, Betreuung, Technik, Folien)
--   checklist_templates / tasks = Aufgaben; beim Anlegen der Checkliste entstehen aus der Vorlage Aufgaben mit Fristen.
--                       Aufgaben können auch zu einer Sitzung gehören (meeting_id, Teil 2) oder frei sein.
--   module_groups / group_members = Gruppen (Ländergruppen, GT/KGT) mit Raum und Leitung, Anwesenheit je Gruppe

-- ---------------------------------------------------------------------------
-- Sitzungen beenden (nur serverseitig)
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.end_user_sessions(p_user_id uuid)
RETURNS integer LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
  WITH weg AS (DELETE FROM auth.sessions WHERE user_id = p_user_id RETURNING 1) SELECT count(*)::int FROM weg
$$;
REVOKE ALL ON FUNCTION public.end_user_sessions(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.end_user_sessions(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Referentenpool und Gästeblatt
-- ---------------------------------------------------------------------------
CREATE TABLE public.speakers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL CHECK (length(trim(name)) > 0),
  affiliation text NOT NULL DEFAULT '',     -- z. B. „Politikwissenschaftler, Universität Münster“
  bio         text NOT NULL DEFAULT '',     -- Kurzprofil für Programm und Website
  email       text,
  phone       text,
  website     text,
  topics      text[] NOT NULL DEFAULT '{}',
  languages   text[] NOT NULL DEFAULT '{}',
  notes       text NOT NULL DEFAULT '',     -- intern: Honorarvorstellung, frühere Erfahrungen, Kontaktweg
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER speakers_touch BEFORE UPDATE ON public.speakers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TYPE public.speaker_status AS ENUM ('idee', 'angefragt', 'zugesagt', 'abgesagt', 'bestaetigt');

CREATE TABLE public.module_speakers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id       uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  speaker_id      uuid NOT NULL REFERENCES public.speakers(id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'vortrag'
                  CHECK (role IN ('vortrag', 'podium', 'laendergruppe', 'workshop', 'grusswort', 'moderation', 'diskussion')),
  topic           text NOT NULL DEFAULT '',
  status          public.speaker_status NOT NULL DEFAULT 'idee',
  status_at       timestamptz NOT NULL DEFAULT now(),
  program_item_id uuid REFERENCES public.program_items(id) ON DELETE SET NULL,
  -- Gästeblatt
  host_name       text,                     -- Betreuung vor Ort aus dem Team
  arrival_at      timestamptz,
  arrival_info    text NOT NULL DEFAULT '', -- Zug/Flug, Abholung von wo
  departure_at    timestamptz,
  hotel_info      text NOT NULL DEFAULT '',
  tech_needs      text NOT NULL DEFAULT '', -- Beamer, Mikrofon, Laptop, Übersetzung
  slides_received boolean NOT NULL DEFAULT false,
  bio_received    boolean NOT NULL DEFAULT false,
  fee             numeric(8, 2),            -- Honorar
  travel_costs    numeric(8, 2),
  notes           text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_id, speaker_id, role)
);
CREATE INDEX module_speakers_module_idx ON public.module_speakers (module_id);

CREATE FUNCTION public.module_speakers_status_at() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN NEW.status_at := now(); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER module_speakers_status BEFORE UPDATE ON public.module_speakers FOR EACH ROW EXECUTE FUNCTION public.module_speakers_status_at();

-- ---------------------------------------------------------------------------
-- Aufgaben und Checklisten-Vorlage
-- ---------------------------------------------------------------------------
-- Frist relativ zum Modul: days_offset Tage vor dem ersten Tag (anchor 'start') bzw. nach dem letzten Tag ('end')
CREATE TABLE public.checklist_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL CHECK (length(trim(title)) > 0),
  anchor      text NOT NULL DEFAULT 'start' CHECK (anchor IN ('start', 'end')),
  days_offset integer NOT NULL CHECK (days_offset BETWEEN 0 AND 365),
  commission  text,
  position    integer NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true
);

CREATE TABLE public.tasks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL CHECK (length(trim(title)) > 0),
  module_id     uuid REFERENCES public.modules(id) ON DELETE CASCADE,
  template_id   uuid REFERENCES public.checklist_templates(id) ON DELETE SET NULL,
  due_date      date,
  commission    text,
  assignee_user uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assignee_name text,
  notes         text NOT NULL DEFAULT '',
  done_at       timestamptz,
  done_by       uuid REFERENCES auth.users(id),
  created_by    uuid REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_id, template_id)
);
CREATE INDEX tasks_due_idx ON public.tasks (due_date) WHERE done_at IS NULL;
CREATE INDEX tasks_assignee_idx ON public.tasks (assignee_user) WHERE done_at IS NULL;

-- Vorlage aus dem Gesamtplan („Vor und nach dem Event“); das Team passt sie einmal an
INSERT INTO public.checklist_templates (title, anchor, days_offset, commission, position) VALUES
  ('Programm festlegen',                                  'start', 56, 'Müfredat',          10),
  ('Referentinnen und Referenten anfragen',               'start', 56, 'Müfredat',          20),
  ('Saal reservieren',                                    'start', 42, 'Organisation',      30),
  ('Hotel reservieren (Kontingent, Stornofrist notieren)', 'start', 42, 'Organisation',      40),
  ('Anmeldung mit Übernachtung öffnen',                   'start', 28, 'Katılımcı Takip',   50),
  ('Zimmer verteilen und buchen',                         'start', 14, 'Organisation',      60),
  ('Gruppen einteilen',                                   'start', 14, 'Müfredat',          70),
  ('Rollenplan für den Eventtag erstellen',               'start', 10, 'Organisation',      80),
  ('Tickets an alle senden',                              'start',  7, 'Katılımcı Takip',   90),
  ('Programm und Anreise an alle senden',                 'start',  7, 'Katılımcı Takip',  100),
  ('Namensschilder drucken',                              'start',  7, 'Organisation',     110),
  ('Probe-Einlass mit zwei Handys',                       'start',  7, 'Organisation',     120),
  ('Gästeblätter vollständig (Anreise, Technik, Folien)', 'start',  5, 'Müfredat',         130),
  ('Feedback-Umfrage verschicken',                        'end',    0, 'Katılımcı Takip',  140),
  ('Dankesmails an Gäste',                                'end',    3, 'Müfredat',         150),
  ('Nachbesprechung im Team',                             'end',    7, 'Organisation',     160),
  ('Rückblick veröffentlichen',                           'end',    7, 'PR',               170),
  ('Rechnungen prüfen (Hotel, Saal, Reisekosten)',        'end',    7, 'Organisation',     180);

-- Checkliste eines Moduls aus der Vorlage anlegen (mehrfach aufrufbar: legt nur fehlende Aufgaben an)
CREATE FUNCTION public.create_module_checklist(p_module_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE erste date; letzte date; n integer;
BEGIN
  IF NOT public.has_orga_access() THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'orga_access_required'; END IF;
  SELECT min(day), max(day) INTO erste, letzte FROM public.module_days WHERE module_id = p_module_id;
  IF erste IS NULL THEN RETURN 0; END IF;
  WITH neu AS (
    INSERT INTO public.tasks (title, module_id, template_id, due_date, commission, created_by)
    SELECT t.title, p_module_id, t.id,
           CASE WHEN t.anchor = 'start' THEN erste - t.days_offset ELSE letzte + t.days_offset END,
           t.commission, auth.uid()
      FROM public.checklist_templates t WHERE t.active
    ON CONFLICT (module_id, template_id) DO NOTHING
    RETURNING 1)
  SELECT count(*) INTO n FROM neu;
  RETURN n;
END $$;

-- ---------------------------------------------------------------------------
-- Gruppen und Räume
-- ---------------------------------------------------------------------------
CREATE TABLE public.module_groups (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  name      text NOT NULL CHECK (length(trim(name)) > 0),
  room      text,
  leader    text,                 -- Leitung, z. B. Referent der Ländergruppe
  position  integer NOT NULL DEFAULT 0,
  UNIQUE (module_id, name)
);

CREATE TABLE public.group_members (
  group_id       uuid NOT NULL REFERENCES public.module_groups(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  module_id      uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,   -- je Modul eine Gruppe pro Person
  PRIMARY KEY (group_id, participant_id),
  UNIQUE (module_id, participant_id)
);

CREATE FUNCTION public.group_members_module() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.module_id := (SELECT module_id FROM public.module_groups WHERE id = NEW.group_id);
  RETURN NEW;
END $$;
CREATE TRIGGER group_members_module BEFORE INSERT OR UPDATE ON public.group_members FOR EACH ROW EXECUTE FUNCTION public.group_members_module();

-- Gruppen eines Modultags mit Anwesenheit: wer ist in welcher Gruppe und da
CREATE FUNCTION public.get_group_attendance(p_module_day_id uuid)
RETURNS TABLE (group_id uuid, group_name text, room text, leader text, participant_id uuid, name text, country text,
               branch text, checked_in boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT g.id, g.name, g.room, g.leader, p.id, public.display_name(p), p.country, p.branch, a.id IS NOT NULL
    FROM public.module_days d
    JOIN public.module_groups g ON g.module_id = d.module_id
    JOIN public.group_members gm ON gm.group_id = g.id
    JOIN public.participants p ON p.id = gm.participant_id
    LEFT JOIN public.registrations r ON r.module_id = d.module_id AND r.participant_id = p.id
    LEFT JOIN public.attendances a ON a.registration_id = r.id AND a.module_day_id = d.id
   WHERE d.id = p_module_day_id AND public.has_orga_access()   -- Helfer sehen Gruppen und Räume, aber nicht wer drin ist
   ORDER BY g.position, g.name, p.last_name, p.first_name
$$;

-- Bestätigte Angemeldete eines Moduls mit Land und GT/KGT für die Einteilung (ohne Kontaktdaten, ab Orga-Team)
CREATE FUNCTION public.get_grouping_candidates(p_module_id uuid)
RETURNS TABLE (participant_id uuid, name text, country text, branch text, group_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.id, public.display_name(p), p.country, p.branch, gm.group_id
    FROM public.registrations r
    JOIN public.participants p ON p.id = r.participant_id
    LEFT JOIN public.group_members gm ON gm.module_id = r.module_id AND gm.participant_id = p.id
   WHERE r.module_id = p_module_id AND r.status = 'confirmed' AND public.has_orga_access()
   ORDER BY p.last_name, p.first_name
$$;

-- Teammitglieder für Zuständigkeiten (Name, ohne Kontaktdaten), ab Orga-Team
CREATE FUNCTION public.get_team_members()
RETURNS TABLE (user_id uuid, display_name text, role public.staff_role)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.user_id, s.display_name, s.role FROM public.staff_members s
   WHERE public.has_orga_access() AND s.role <> 'checkin_helper'
     AND (s.valid_until IS NULL OR s.valid_until > now())
   ORDER BY s.display_name
$$;

-- ---------------------------------------------------------------------------
-- Zeilenschutz
-- ---------------------------------------------------------------------------
ALTER TABLE public.speakers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_speakers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_groups       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members       ENABLE ROW LEVEL SECURITY;

-- Entscheidung 25.10.2026: alle im Team haben alle Rechte im Teambereich. Einlass-Helfer sind kein Team in diesem Sinn.
CREATE POLICY speakers_orga         ON public.speakers            FOR ALL TO authenticated USING (public.has_orga_access()) WITH CHECK (public.has_orga_access());
CREATE POLICY module_speakers_orga  ON public.module_speakers     FOR ALL TO authenticated USING (public.has_orga_access()) WITH CHECK (public.has_orga_access());
CREATE POLICY templates_read        ON public.checklist_templates FOR SELECT TO authenticated USING (public.has_orga_access());
CREATE POLICY templates_full        ON public.checklist_templates FOR ALL TO authenticated USING (public.has_full_access()) WITH CHECK (public.has_full_access());
CREATE POLICY tasks_orga            ON public.tasks               FOR ALL TO authenticated USING (public.has_orga_access()) WITH CHECK (public.has_orga_access());
CREATE POLICY groups_read           ON public.module_groups       FOR SELECT TO authenticated USING (public.has_checkin_access());
CREATE POLICY groups_orga           ON public.module_groups       FOR ALL TO authenticated USING (public.has_orga_access()) WITH CHECK (public.has_orga_access());
CREATE POLICY group_members_orga    ON public.group_members       FOR ALL TO authenticated USING (public.has_orga_access()) WITH CHECK (public.has_orga_access());
-- Teilnehmende sehen ihre eigene Gruppe (Name, Raum) über die Mitgliedschaft
CREATE POLICY group_members_self    ON public.group_members       FOR SELECT TO authenticated USING (participant_id = public.my_participant_id());
CREATE POLICY groups_self           ON public.module_groups       FOR SELECT TO authenticated
  USING (id IN (SELECT gm.group_id FROM public.group_members gm WHERE gm.participant_id = public.my_participant_id()));

REVOKE ALL ON public.speakers, public.module_speakers, public.checklist_templates, public.tasks,
  public.module_groups, public.group_members FROM anon;
REVOKE ALL ON FUNCTION public.create_module_checklist(uuid), public.get_group_attendance(uuid),
  public.get_grouping_candidates(uuid), public.get_team_members() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_module_checklist(uuid), public.get_group_attendance(uuid),
  public.get_grouping_candidates(uuid), public.get_team_members() TO authenticated;
