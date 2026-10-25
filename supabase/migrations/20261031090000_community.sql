-- SES-Organisation, Phase 2: Community-Grundlage.
--
--   staff_members.valid_from/valid_until = Teamzugang auf Zeit (z. B. „Helfer · Modul 4“ nur an den Modultagen)
--   memberships  = Mitgliedschaften einer Person: Rolle (Teilnehmende, Sorumlu, Team, Helfer, Referent, Alumni),
--                  Generation, Kommission, gültig von/bis. Daraus entstehen die Abzeichen am Profil.
--   participants.share_contact / photo_path / photo_consent_at = Profil: Kontaktdaten für andere Mitglieder
--                  (nur mit Zustimmung), Foto, Einwilligung für Fotos auf der Website
-- Generationen sind die bisherigen Jahrgänge (cohorts).

-- ---------------------------------------------------------------------------
-- Teamzugang auf Zeit
-- ---------------------------------------------------------------------------
ALTER TABLE public.staff_members
  ADD COLUMN valid_from  timestamptz,
  ADD COLUMN valid_until timestamptz,
  ADD COLUMN label       text,          -- z. B. „Helfer · Demokratie in Europa“
  ADD CONSTRAINT staff_validity CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until > valid_from);

-- Rolle nur innerhalb der Gültigkeit; alle Rechteprüfungen (has_*_access, RLS) laufen hierüber
CREATE OR REPLACE FUNCTION public.current_staff_role()
RETURNS public.staff_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT role FROM public.staff_members
   WHERE user_id = auth.uid()
     AND (valid_from IS NULL OR valid_from <= now())
     AND (valid_until IS NULL OR valid_until > now())
$$;

-- ---------------------------------------------------------------------------
-- Mitgliedschaften und Abzeichen
-- ---------------------------------------------------------------------------
CREATE TYPE public.membership_role AS ENUM ('teilnehmende', 'sorumlu', 'team', 'helfer', 'referent', 'alumni');

CREATE TABLE public.memberships (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  cohort_id      uuid REFERENCES public.cohorts(id) ON DELETE SET NULL,
  role           public.membership_role NOT NULL,
  commission     text,                  -- bei Team: Kommission (Müfredat, PR, Katılımcı Takip, Organisation …)
  module_id      uuid REFERENCES public.modules(id) ON DELETE SET NULL,   -- bei Referent/Helfer: welches Modul
  valid_from     date NOT NULL DEFAULT (now() AT TIME ZONE 'Europe/Berlin')::date,
  valid_until    date,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until IS NULL OR valid_until >= valid_from)
);
CREATE INDEX memberships_participant_idx ON public.memberships (participant_id);
CREATE UNIQUE INDEX memberships_unique ON public.memberships
  (participant_id, role, coalesce(cohort_id, '00000000-0000-0000-0000-000000000000'), coalesce(module_id, '00000000-0000-0000-0000-000000000000'));

-- Bestehende Daten übernehmen: wer einem Jahrgang angehört, ist Teilnehmende dieser Generation
INSERT INTO public.memberships (participant_id, cohort_id, role, valid_from)
SELECT p.id, p.cohort_id, 'teilnehmende', make_date(c.year, 4, 1)
  FROM public.participants p JOIN public.cohorts c ON c.id = p.cohort_id
 WHERE p.affiliation_status = 'academy_student'
ON CONFLICT DO NOTHING;
INSERT INTO public.memberships (participant_id, cohort_id, role, valid_from)
SELECT p.id, p.cohort_id, 'alumni', (now() AT TIME ZONE 'Europe/Berlin')::date
  FROM public.participants p WHERE p.affiliation_status = 'alumni'
ON CONFLICT DO NOTHING;

-- Neue oder geänderte Personen: Jahrgang + academy_student ergibt die Mitgliedschaft automatisch
-- (Annahme einer Bewerbung, Import, Pflege im Team-Bereich), alumni ebenso.
CREATE FUNCTION public.participants_membership() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.cohort_id IS NOT NULL AND NEW.affiliation_status IN ('academy_student', 'alumni') THEN
    INSERT INTO public.memberships (participant_id, cohort_id, role)
    VALUES (NEW.id, NEW.cohort_id, CASE WHEN NEW.affiliation_status = 'alumni' THEN 'alumni' ELSE 'teilnehmende' END::public.membership_role)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER participants_membership AFTER INSERT OR UPDATE OF cohort_id, affiliation_status ON public.participants
  FOR EACH ROW EXECUTE FUNCTION public.participants_membership();

-- Abzeichen als Text, z. B. „SES · 1. Generation“, „Team · PR“, „Referent · Demokratie in Europa“
-- SECURITY DEFINER: Teilnehmende dürfen cohorts/modules nicht lesen, der Name gehört aber ins eigene Abzeichen.
-- Da die Funktion mit beliebigen Werten aufrufbar ist, gibt sie Modultitel nur für veröffentlichte Module heraus
-- (stehen ohnehin auf der Website) oder dem Team; Generationsnamen sind nicht vertraulich.
CREATE FUNCTION public.membership_badge(m public.memberships)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE m.role
    WHEN 'teilnehmende' THEN 'SES · ' || coalesce((SELECT name FROM public.cohorts WHERE id = m.cohort_id), 'Teilnehmende')
    WHEN 'alumni'       THEN 'Alumni · ' || coalesce((SELECT name FROM public.cohorts WHERE id = m.cohort_id), 'SES')
    WHEN 'sorumlu'      THEN 'Sorumlu · ' || coalesce((SELECT name FROM public.cohorts WHERE id = m.cohort_id), 'SES')
    WHEN 'team'         THEN 'Team' || coalesce(' · ' || m.commission, '')
    WHEN 'helfer'       THEN 'Helfer' || coalesce(' · ' || (SELECT title FROM public.modules WHERE id = m.module_id
                                                                AND (status = 'published' OR public.has_orga_access())), '')
    WHEN 'referent'     THEN 'Referent' || coalesce(' · ' || (SELECT title FROM public.modules WHERE id = m.module_id
                                                                AND (status = 'published' OR public.has_orga_access())), '')
  END
$$;

-- ---------------------------------------------------------------------------
-- Profil
-- ---------------------------------------------------------------------------
ALTER TABLE public.participants
  ADD COLUMN share_contact    boolean NOT NULL DEFAULT false,   -- E-Mail und Telefon für andere Mitglieder sichtbar
  ADD COLUMN photo_path       text,                             -- Profilfoto im Speicher „fotos“
  ADD COLUMN photo_consent_at timestamptz;                      -- Einwilligung: Fotos von Modulen auf der Website

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('fotos', 'fotos', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Eigene Angaben ändern (Telefon, Sprache, Sichtbarkeit, Einwilligung, Foto). Name, Region, Jahrgang pflegt das Team.
CREATE FUNCTION public.update_my_profile(p_phone text, p_language text, p_share_contact boolean,
                                         p_photo_consent boolean, p_photo_path text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pid uuid := public.my_participant_id();
BEGIN
  IF pid IS NULL THEN RETURN 'no_participant'; END IF;
  IF p_language IS NOT NULL AND p_language NOT IN ('de', 'tr', 'en', 'fr', 'nl') THEN RETURN 'invalid'; END IF;
  IF p_photo_path IS NOT NULL AND (p_photo_path !~ ('^' || pid::text || '/[0-9]+\.(jpg|png|webp)$')
      OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'fotos' AND name = p_photo_path)) THEN
    RETURN 'invalid';
  END IF;
  UPDATE public.participants SET
    phone = nullif(left(trim(p_phone), 40), ''),
    preferred_language = coalesce(p_language, preferred_language),
    share_contact = coalesce(p_share_contact, share_contact),
    photo_consent_at = CASE WHEN p_photo_consent THEN coalesce(photo_consent_at, now()) ELSE NULL END,
    photo_path = coalesce(p_photo_path, photo_path)
  WHERE id = pid;
  RETURN 'saved';
END $$;

-- Mitgliederverzeichnis für angemeldete Mitglieder und das Team: Name, Region, GT/KGT, Abzeichen, Foto;
-- E-Mail und Telefon nur, wenn die Person zugestimmt hat (Entscheidung 25.10.2026). Team sieht Kontaktdaten immer.
CREATE FUNCTION public.get_member_directory()
RETURNS TABLE (participant_id uuid, name text, region text, branch text, badges text[], has_photo boolean,
               email text, phone text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.id, public.display_name(p), r.name, p.branch,
         array_agg(public.membership_badge(m) ORDER BY m.valid_from DESC),
         p.photo_path IS NOT NULL,
         CASE WHEN p.share_contact OR public.has_full_access() THEN p.email END,
         CASE WHEN p.share_contact OR public.has_full_access() THEN p.phone END
    FROM public.participants p
    JOIN public.memberships m ON m.participant_id = p.id
     AND (m.valid_until IS NULL OR m.valid_until >= (now() AT TIME ZONE 'Europe/Berlin')::date)
    LEFT JOIN public.regions r ON r.id = p.region_id
   WHERE p.active
     AND (public.my_participant_id() IS NOT NULL OR public.has_orga_access())   -- Einlass-Helfer sehen nur den Einlass
   GROUP BY p.id, r.name
   ORDER BY p.last_name, p.first_name
$$;

-- E-Mail-Änderung (bestätigt über beide Adressen durch Supabase Auth) in die Personentabelle übernehmen
CREATE FUNCTION public.sync_participant_email() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email AND NEW.email IS NOT NULL THEN
    UPDATE public.participants SET email = lower(trim(NEW.email)) WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_participant_email AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_participant_email();

-- ---------------------------------------------------------------------------
-- Zeilenschutz
-- ---------------------------------------------------------------------------
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY memberships_orga_read  ON public.memberships FOR SELECT TO authenticated USING (public.has_orga_access());
CREATE POLICY memberships_full_write ON public.memberships FOR ALL TO authenticated USING (public.has_full_access()) WITH CHECK (public.has_full_access());
CREATE POLICY memberships_self       ON public.memberships FOR SELECT TO authenticated USING (participant_id = public.my_participant_id());
REVOKE ALL ON public.memberships FROM anon;

REVOKE ALL ON FUNCTION public.update_my_profile(text, text, boolean, boolean, text), public.get_member_directory(),
  public.membership_badge(public.memberships), public.sync_participant_email(), public.participants_membership() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_profile(text, text, boolean, boolean, text), public.get_member_directory(),
  public.membership_badge(public.memberships) TO authenticated;
