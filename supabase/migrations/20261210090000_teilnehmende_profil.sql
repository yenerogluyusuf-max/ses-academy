-- Profil der Teilnehmenden für das Team (Umbau 16.11.2026, Wunsch Yusuf: „wer was kann, wofür verantwortlich ist,
-- wer worin gut ist“ – alles zur Person an einer Stelle, dazu Lebenslauf).
-- Liegt bewusst NICHT in participants: Teilnehmende dürfen ihre eigene participants-Zeile lesen (participants_self),
-- Einschätzungen des Teams sollen sie nicht sehen. Lesen und schreiben nur Admin/Vorstand (wie participant_notes).

CREATE TABLE public.participant_profiles (
  participant_id uuid PRIMARY KEY REFERENCES public.participants(id) ON DELETE CASCADE,
  skills     text[] NOT NULL DEFAULT '{}' CHECK (cardinality(skills) <= 30),   -- kann gut: Moderation, Social Media …
  tasks      text[] NOT NULL DEFAULT '{}' CHECK (cardinality(tasks) <= 30),    -- verantwortlich für: Einlass, Gruppe 3 …
  assessment text   NOT NULL DEFAULT '' CHECK (length(assessment) <= 4000),    -- Einschätzung des Teams (intern)
  cv_path    text,                                                             -- Lebenslauf im Speicher „lebenslaeufe“
  cv_name    text CHECK (cv_name IS NULL OR length(cv_name) <= 200),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE TRIGGER participant_profiles_touch BEFORE UPDATE ON public.participant_profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
ALTER TABLE public.participant_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_full ON public.participant_profiles FOR ALL TO authenticated
  USING (public.has_full_access()) WITH CHECK (public.has_full_access());
REVOKE ALL ON public.participant_profiles FROM anon;

-- Lebensläufe: privat, nur über den Server (Admin-Schlüssel nach Rollenprüfung)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('lebenslaeufe', 'lebenslaeufe', false, 10485760,
        ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO NOTHING;

-- Löschen einer Person entfernt auch das Profil; der Pfad des Lebenslaufs kommt zurück, damit der Server die Datei löscht.
-- Sonst unverändert gegenüber 20261130090000_loeschung_personendaten.sql.
CREATE OR REPLACE FUNCTION public.execute_deletion(p_approval_id uuid, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  f public.approvals%ROWTYPE;
  d public.deletion_requests%ROWTYPE;
  p public.participants%ROWTYPE;
  zahlen jsonb;
  konto_geloescht boolean := false;
  lebenslauf text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'admin_required'; END IF;
  SELECT * INTO f FROM public.approvals WHERE id = p_approval_id AND action = 'person_loeschen' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('result', 'not_found'); END IF;
  IF f.requested_by <> auth.uid() THEN RETURN jsonb_build_object('result', 'not_requester'); END IF;
  IF f.status <> 'freigegeben' THEN RETURN jsonb_build_object('result', f.status); END IF;
  IF f.decided_by IS NULL OR f.decided_by = f.requested_by THEN RETURN jsonb_build_object('result', 'own_request'); END IF;
  IF f.decided_at < now() - interval '24 hours' THEN RETURN jsonb_build_object('result', 'expired'); END IF;
  SELECT * INTO d FROM public.deletion_requests WHERE id = (f.payload ->> 'antrag')::uuid FOR UPDATE;
  IF NOT FOUND OR d.participant_id IS NULL THEN RETURN jsonb_build_object('result', 'not_found'); END IF;
  IF d.status <> 'offen' THEN RETURN jsonb_build_object('result', d.status); END IF;
  SELECT * INTO p FROM public.participants WHERE id = d.participant_id FOR UPDATE;
  zahlen := public.deletion_counts(p.id);

  -- löschen
  SELECT cv_path INTO lebenslauf FROM public.participant_profiles WHERE participant_id = p.id;
  DELETE FROM public.participant_profiles WHERE participant_id = p.id;
  DELETE FROM public.contact_log WHERE participant_id = p.id;
  DELETE FROM public.participant_notes WHERE participant_id = p.id;
  DELETE FROM public.stay_requests s USING public.registrations r WHERE r.id = s.registration_id AND r.participant_id = p.id;
  DELETE FROM public.room_assignments WHERE participant_id = p.id;
  DELETE FROM public.room_wish_overrides WHERE participant_id = p.id OR wished_id = p.id;
  DELETE FROM public.contributions WHERE participant_id = p.id;
  DELETE FROM public.engagements WHERE participant_id = p.id;
  DELETE FROM public.applications a WHERE a.participant_id = p.id OR (p.email IS NOT NULL AND a.email = p.email);
  UPDATE public.email_log SET recipient = 'gelöscht', error = NULL WHERE participant_id = p.id;

  -- anonymisieren: Anwesenheiten, Hausaufgaben, Feedback, Gruppen und Mitgliedschaften bleiben für die Auswertung
  UPDATE public.submissions s SET label = replace(s.label, public.display_name(p), 'Gelöschte Person')
    FROM public.submission_participants sp WHERE sp.submission_id = s.id AND sp.participant_id = p.id;
  UPDATE public.participants SET
    first_name = 'Gelöschte', last_name = 'Person (' || upper(left(p.id::text, 4)) || ')',
    email = NULL, phone = NULL, gender = NULL, photo_path = NULL, photo_consent_at = NULL, share_contact = false,
    directory_opt_out = true, active = false, user_id = NULL,
    checkin_token = gen_random_uuid(), link_token = gen_random_uuid()
   WHERE id = p.id;

  IF p.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.staff_members WHERE user_id = p.user_id) THEN
    UPDATE public.audit_log SET actor_id = NULL WHERE actor_id = p.user_id;
    UPDATE public.email_log SET triggered_by = NULL WHERE triggered_by = p.user_id;
    DELETE FROM auth.users WHERE id = p.user_id;
    konto_geloescht := true;
  END IF;

  UPDATE public.deletion_requests SET status = 'erledigt', decided_by = auth.uid(), decided_at = now(),
         decision_note = nullif(left(trim(p_note), 1000), ''), result = zahlen || jsonb_build_object('konto_geloescht', konto_geloescht)
   WHERE id = d.id;
  UPDATE public.approvals SET status = 'ausgefuehrt', executed_at = now(),
         result = jsonb_build_object('konto_geloescht', konto_geloescht) WHERE id = f.id;
  UPDATE public.approvals
     SET summary = 'Person löschen: Gelöschte Person (' || upper(left(p.id::text, 4)) || ')',
         payload = jsonb_build_object('antrag', d.id, 'zahlen', zahlen),
         decision_note = NULL
   WHERE action = 'person_loeschen' AND payload ->> 'antrag' = d.id::text;
  UPDATE public.deletion_requests SET reason = '' WHERE id = d.id;
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'approval_executed', 'approval', f.id, jsonb_build_object('action', f.action));
  INSERT INTO public.audit_log (actor_id, target_participant_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), p.id, 'participant_anonymized', 'deletion_request', d.id, zahlen || jsonb_build_object('freigabe', f.id, 'freigegeben_von', f.decided_by));
  RETURN jsonb_build_object('result', 'ok', 'photo_path', p.photo_path, 'cv_path', lebenslauf, 'konto_geloescht', konto_geloescht);
END $$;
