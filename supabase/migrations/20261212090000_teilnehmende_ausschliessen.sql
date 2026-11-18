-- Teilnehmende ausschließen und löschen (Wunsch Yusuf 18.11.2026), auf der Seite der Person im Team-Bereich.
--
-- Ausschließen (Admin und Vorstand): sofort abgemeldet, keine Anmeldung mehr (login_allowed prüft active), aus allen
-- kommenden Modulen abgemeldet (samt Zimmer, Übernachtung, Gruppe; Nachrücken von der Warteliste wie beim Abmelden),
-- keine Rundmails mehr (broadcast_recipients prüft active), Ticket und persönliche Links werden ungültig. Daten und
-- Verlauf bleiben. Wieder aufnehmen stellt nur den Zugang her; abgesagte Module bleiben abgesagt.
--
-- Löschen (nur Admin): ein Admin allein, sofort, nach Rückfrage – Entscheidung Yusuf 18.11.2026, abweichend vom
-- Vier-Augen-Beschluss vom 25.10.2026, der weiter für Löschanträge der Personen selbst gilt (execute_deletion).
-- Beide Wege löschen bzw. anonymisieren genau dasselbe: gemeinsamer Kern anonymize_participant().

-- ---------------------------------------------------------------------------
-- Gemeinsamer Kern: löschen und anonymisieren (bisher in execute_deletion)
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.anonymize_participant(p_participant_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  p public.participants%ROWTYPE;
  zahlen jsonb;
  konto_geloescht boolean := false;
  lebenslauf text;
BEGIN
  SELECT * INTO p FROM public.participants WHERE id = p_participant_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
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

  -- Löschanträge und Freigaben zur Person tragen keinen Namen mehr (Vorschau mit Name, E-Mail, Grund fällt weg)
  UPDATE public.deletion_requests SET reason = '' WHERE participant_id = p.id;
  UPDATE public.approvals
     SET summary = 'Person löschen: Gelöschte Person (' || upper(left(p.id::text, 4)) || ')', decision_note = NULL,
         payload = jsonb_build_object('antrag', payload -> 'antrag', 'zahlen', zahlen)
   WHERE action = 'person_loeschen'
     AND payload ->> 'antrag' IN (SELECT id::text FROM public.deletion_requests WHERE participant_id = p.id);

  RETURN jsonb_build_object('zahlen', zahlen, 'photo_path', p.photo_path, 'cv_path', lebenslauf, 'konto_geloescht', konto_geloescht);
END $$;

-- ---------------------------------------------------------------------------
-- Löschantrag der Person ausführen (Vier-Augen) – wie bisher, jetzt mit dem gemeinsamen Kern
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.execute_deletion(p_approval_id uuid, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  f public.approvals%ROWTYPE;
  d public.deletion_requests%ROWTYPE;
  k jsonb;
  zahlen jsonb;
  konto_geloescht boolean;
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

  k := public.anonymize_participant(d.participant_id);
  IF k IS NULL THEN RETURN jsonb_build_object('result', 'not_found'); END IF;
  zahlen := k -> 'zahlen';
  konto_geloescht := (k ->> 'konto_geloescht')::boolean;

  UPDATE public.deletion_requests SET status = 'erledigt', decided_by = auth.uid(), decided_at = now(),
         decision_note = nullif(left(trim(p_note), 1000), ''), result = zahlen || jsonb_build_object('konto_geloescht', konto_geloescht)
   WHERE id = d.id;
  UPDATE public.approvals SET status = 'ausgefuehrt', executed_at = now(),
         result = jsonb_build_object('konto_geloescht', konto_geloescht) WHERE id = f.id;
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'approval_executed', 'approval', f.id, jsonb_build_object('action', f.action));
  INSERT INTO public.audit_log (actor_id, target_participant_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), d.participant_id, 'participant_anonymized', 'deletion_request', d.id, zahlen || jsonb_build_object('freigabe', f.id, 'freigegeben_von', f.decided_by));
  RETURN jsonb_build_object('result', 'ok', 'photo_path', k ->> 'photo_path', 'cv_path', k ->> 'cv_path', 'konto_geloescht', konto_geloescht);
END $$;

-- ---------------------------------------------------------------------------
-- Sofort löschen durch einen Admin (ohne Antrag der Person, ohne zweite Person)
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.delete_participant_now(p_participant_id uuid, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  p public.participants%ROWTYPE;
  k jsonb;
  zahlen jsonb;
  konto_geloescht boolean;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'admin_required'; END IF;
  SELECT * INTO p FROM public.participants WHERE id = p_participant_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('result', 'not_found'); END IF;
  IF p.user_id IS NOT NULL AND p.user_id = auth.uid() THEN RETURN jsonb_build_object('result', 'self'); END IF;
  IF p.email IS NULL AND p.first_name = 'Gelöschte' AND p.last_name LIKE 'Person (%)' THEN
    RETURN jsonb_build_object('result', 'already_deleted');
  END IF;

  k := public.anonymize_participant(p.id);
  zahlen := k -> 'zahlen';
  konto_geloescht := (k ->> 'konto_geloescht')::boolean;

  -- Offene Löschanträge der Person sind damit erledigt, offene Freigaben dazu ebenfalls
  UPDATE public.approvals SET status = 'ausgefuehrt', executed_at = now(),
         result = jsonb_build_object('konto_geloescht', konto_geloescht, 'direkt', true)
   WHERE action = 'person_loeschen' AND status IN ('offen', 'freigegeben')
     AND payload ->> 'antrag' IN (SELECT id::text FROM public.deletion_requests WHERE participant_id = p.id AND status = 'offen');
  UPDATE public.deletion_requests SET status = 'erledigt', decided_by = auth.uid(), decided_at = now(),
         decision_note = nullif(left(trim(p_note), 1000), ''),
         result = zahlen || jsonb_build_object('konto_geloescht', konto_geloescht, 'direkt', true)
   WHERE participant_id = p.id AND status = 'offen';

  INSERT INTO public.audit_log (actor_id, target_participant_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), p.id, 'participant_deleted_by_admin', 'participant', p.id,
          zahlen || jsonb_build_object('konto_geloescht', konto_geloescht, 'notiz', nullif(left(trim(p_note), 1000), '')));
  RETURN jsonb_build_object('result', 'ok', 'photo_path', k ->> 'photo_path', 'cv_path', k ->> 'cv_path', 'konto_geloescht', konto_geloescht);
END $$;

-- ---------------------------------------------------------------------------
-- Ausschließen und wieder aufnehmen
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.exclude_participant(p_participant_id uuid, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  p public.participants%ROWTYPE;
  r public.registrations%ROWTYPE;
  kommende uuid[];
  abgesagt int := 0;
  sitzungen int := 0;
  promoted uuid;
BEGIN
  IF NOT public.has_full_access() THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'full_access_required'; END IF;
  SELECT * INTO p FROM public.participants WHERE id = p_participant_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('result', 'not_found'); END IF;
  IF p.user_id IS NOT NULL AND p.user_id = auth.uid() THEN RETURN jsonb_build_object('result', 'self'); END IF;

  UPDATE public.participants SET active = false, checkin_token = gen_random_uuid(), link_token = gen_random_uuid()
   WHERE id = p.id;

  -- Kommende Module: der erste Termin liegt noch in der Zukunft
  kommende := ARRAY(SELECT d.module_id FROM public.module_days d GROUP BY d.module_id HAVING min(d.starts_at) > now());
  FOR r IN SELECT * FROM public.registrations
            WHERE participant_id = p.id AND module_id = ANY (kommende) AND status IN ('confirmed', 'pending', 'waitlist')
            ORDER BY created_at FOR UPDATE LOOP
    PERFORM 1 FROM public.modules WHERE id = r.module_id FOR NO KEY UPDATE;
    UPDATE public.registrations SET status = 'cancelled', rsvp = 'abgesagt', rsvp_at = now(), rsvp_source = 'team',
           status_changed_at = now() WHERE id = r.id;
    DELETE FROM public.stay_requests WHERE registration_id = r.id;
    promoted := NULL;
    IF r.status = 'confirmed' AND public.module_has_free_seat(r.module_id) THEN
      UPDATE public.registrations SET status = 'confirmed', status_changed_at = now()
       WHERE id = (SELECT id FROM public.registrations WHERE module_id = r.module_id AND status = 'waitlist'
                   ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
      RETURNING id INTO promoted;
    END IF;
    INSERT INTO public.audit_log (actor_id, target_participant_id, action, entity_type, entity_id, metadata)
    VALUES (auth.uid(), p.id, 'registration_withdrawn', 'registration', r.id,
            jsonb_build_object('status', 'cancelled', 'previous_status', r.status, 'via', 'ausschluss', 'promoted_registration_id', promoted));
    abgesagt := abgesagt + 1;
  END LOOP;
  DELETE FROM public.room_assignments ra USING public.hotels h
   WHERE ra.hotel_id = h.id AND ra.participant_id = p.id AND h.module_id = ANY (kommende);
  DELETE FROM public.group_members WHERE participant_id = p.id AND module_id = ANY (kommende);

  -- Sofort abmelden (ein Team-Konto derselben Person bleibt unberührt)
  IF p.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.staff_members WHERE user_id = p.user_id) THEN
    sitzungen := public.end_user_sessions(p.user_id);
    DELETE FROM auth.refresh_tokens WHERE user_id = p.user_id::text;
  END IF;

  INSERT INTO public.audit_log (actor_id, target_participant_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), p.id, 'participant_excluded', 'participant', p.id,
          jsonb_build_object('module_abgesagt', abgesagt, 'sitzungen_beendet', sitzungen, 'notiz', nullif(left(trim(p_note), 1000), '')));
  RETURN jsonb_build_object('result', 'ok', 'abgesagt', abgesagt, 'sitzungen', sitzungen);
END $$;

CREATE FUNCTION public.readmit_participant(p_participant_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.has_full_access() THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'full_access_required'; END IF;
  UPDATE public.participants SET active = true
   WHERE id = p_participant_id AND NOT active
     AND NOT (email IS NULL AND first_name = 'Gelöschte' AND last_name LIKE 'Person (%)');
  IF NOT FOUND THEN RETURN jsonb_build_object('result', 'not_found'); END IF;
  INSERT INTO public.audit_log (actor_id, target_participant_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), p_participant_id, 'participant_readmitted', 'participant', p_participant_id, '{}'::jsonb);
  RETURN jsonb_build_object('result', 'ok');
END $$;

REVOKE ALL ON FUNCTION public.anonymize_participant(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_participant_now(uuid, text), public.exclude_participant(uuid, text),
  public.readmit_participant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_participant_now(uuid, text), public.exclude_participant(uuid, text),
  public.readmit_participant(uuid) TO authenticated;
