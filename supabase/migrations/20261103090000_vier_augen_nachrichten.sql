-- SES-Organisation, Phase 3 (Teil 2): Vier-Augen-Prinzip und Nachrichten an alle.
--
-- Entscheidung vom 25.10.2026: Nachricht an alle, Export aller Daten, Löschen von Personen und Vergabe von
-- Team-Abzeichen bestätigt eine zweite Person. Jede solche Aktion beginnt als Antrag (approvals); eine andere Person
-- mit Vollzugriff gibt ihn frei oder lehnt ab; danach führt die anfragende Person ihn innerhalb von 24 Stunden aus.
-- Team-Zugänge darf nur ein Admin freigeben (Admins: Yusuf, Bünyamin Kalem, Murat Gümüş).

CREATE TABLE public.approvals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action       text NOT NULL CHECK (action IN ('nachricht', 'export', 'team_zugang', 'person_loeschen')),
  summary      text NOT NULL,                          -- lesbare Beschreibung für die zweite Person
  payload      jsonb NOT NULL DEFAULT '{}',            -- was ausgeführt wird (Betreff/Text/Empfänger, Filter, Konto …)
  status       text NOT NULL DEFAULT 'offen' CHECK (status IN ('offen', 'freigegeben', 'abgelehnt', 'ausgefuehrt')),
  requested_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_by   uuid REFERENCES auth.users(id),
  decided_at   timestamptz,
  decision_note text,
  executed_at  timestamptz,
  result       jsonb,                                  -- z. B. Anzahl verschickter Mails
  CHECK (decided_by IS NULL OR decided_by <> requested_by)
);
CREATE INDEX approvals_status_idx ON public.approvals (status, requested_at DESC);

-- Freigeben oder ablehnen: nicht der eigene Antrag; Team-Zugang nur durch Admin
CREATE FUNCTION public.decide_approval(p_id uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.approvals%ROWTYPE;
BEGIN
  IF NOT public.has_full_access() THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'full_access_required'; END IF;
  SELECT * INTO a FROM public.approvals WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF a.status <> 'offen' THEN RETURN 'already_decided'; END IF;
  IF a.requested_by = auth.uid() THEN RETURN 'own_request'; END IF;
  IF a.action = 'team_zugang' AND public.current_staff_role() <> 'admin' THEN RETURN 'admin_required'; END IF;
  UPDATE public.approvals SET status = CASE WHEN p_approve THEN 'freigegeben' ELSE 'abgelehnt' END,
         decided_by = auth.uid(), decided_at = now(), decision_note = nullif(trim(p_note), '')
   WHERE id = p_id;
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), CASE WHEN p_approve THEN 'approval_granted' ELSE 'approval_rejected' END, 'approval', p_id, jsonb_build_object('action', a.action));
  RETURN CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END;
END $$;

-- Ausführen: nur die anfragende Person, nur freigegeben, nur innerhalb von 24 Stunden nach der Freigabe, nur einmal.
-- Liefert den Inhalt zurück; die eigentliche Ausführung (Mails, Export, Konto) macht der Server.
CREATE FUNCTION public.claim_approval(p_id uuid, p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.approvals%ROWTYPE;
BEGIN
  IF NOT public.has_full_access() THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'full_access_required'; END IF;
  SELECT * INTO a FROM public.approvals WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR a.action <> p_action OR a.action = 'team_zugang' THEN RETURN jsonb_build_object('result', 'not_found'); END IF;
  IF a.requested_by <> auth.uid() THEN RETURN jsonb_build_object('result', 'not_requester'); END IF;
  IF a.status <> 'freigegeben' THEN RETURN jsonb_build_object('result', a.status); END IF;
  IF a.decided_at < now() - interval '24 hours' THEN RETURN jsonb_build_object('result', 'expired'); END IF;
  UPDATE public.approvals SET status = 'ausgefuehrt', executed_at = now() WHERE id = p_id;
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'approval_executed', 'approval', p_id, jsonb_build_object('action', a.action));
  RETURN jsonb_build_object('result', 'ok', 'payload', a.payload);
END $$;

-- Ergebnis nachtragen (z. B. „120 Mails verschickt, 2 fehlgeschlagen“); nur für eigene ausgeführte Anträge
CREATE FUNCTION public.record_approval_result(p_id uuid, p_result jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE public.approvals SET result = p_result
   WHERE id = p_id AND requested_by = auth.uid() AND status = 'ausgefuehrt' AND public.has_full_access()
$$;

-- ---------------------------------------------------------------------------
-- Empfänger einer Nachricht an alle
-- ---------------------------------------------------------------------------
-- Filter (alle optional, kombiniert mit UND): cohort_id, region_id, mentor_id, module_id (bestätigt angemeldet), group_id.
-- Nur aktive Personen mit E-Mail-Adresse.
CREATE FUNCTION public.broadcast_recipients(p_filter jsonb)
RETURNS TABLE (participant_id uuid, email text, first_name text, preferred_language text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.id, p.email, p.first_name, p.preferred_language
    FROM public.participants p
   WHERE public.has_full_access() AND p.active AND p.email IS NOT NULL
     AND (p_filter ->> 'cohort_id' IS NULL OR EXISTS (SELECT 1 FROM public.memberships m WHERE m.participant_id = p.id
            AND m.cohort_id = (p_filter ->> 'cohort_id')::uuid AND m.role IN ('teilnehmende', 'sorumlu')
            AND (m.valid_until IS NULL OR m.valid_until >= current_date)))
     AND (p_filter ->> 'region_id' IS NULL OR p.region_id = (p_filter ->> 'region_id')::int)
     AND (p_filter ->> 'mentor_id' IS NULL OR p.mentor_id = (p_filter ->> 'mentor_id')::uuid)
     AND (p_filter ->> 'module_id' IS NULL OR EXISTS (SELECT 1 FROM public.registrations r WHERE r.participant_id = p.id
            AND r.module_id = (p_filter ->> 'module_id')::uuid AND r.status = 'confirmed'))
     AND (p_filter ->> 'group_id' IS NULL OR EXISTS (SELECT 1 FROM public.group_members g WHERE g.participant_id = p.id
            AND g.group_id = (p_filter ->> 'group_id')::uuid))
   ORDER BY p.last_name, p.first_name
$$;

-- ---------------------------------------------------------------------------
-- Zeilenschutz
-- ---------------------------------------------------------------------------
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY approvals_read   ON public.approvals FOR SELECT TO authenticated USING (public.has_full_access());
-- Anlegen nur über create_approval (Beschreibung baut die Datenbank aus dem Inhalt), Änderungen nur über
-- decide_approval / claim_approval / execute_team_approval / record_approval_result
REVOKE ALL ON public.approvals FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.approvals FROM authenticated;

REVOKE ALL ON FUNCTION public.decide_approval(uuid, boolean, text), public.claim_approval(uuid, text),
  public.record_approval_result(uuid, jsonb), public.broadcast_recipients(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_approval(uuid, boolean, text), public.claim_approval(uuid, text),
  public.record_approval_result(uuid, jsonb), public.broadcast_recipients(jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- Anträge anlegen: Inhalt prüfen, Beschreibung selbst bauen (die zweite Person sieht, was wirklich ausgeführt wird)
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.staff_role_rank(r public.staff_role) RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE r WHEN 'checkin_helper' THEN 0 WHEN 'orga_team' THEN 1 WHEN 'vorstand' THEN 2 WHEN 'admin' THEN 3 END
$$;

CREATE FUNCTION public.staff_role_name(r public.staff_role) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE r WHEN 'checkin_helper' THEN 'Einlass-Helfer:in' WHEN 'orga_team' THEN 'Orga-Team' WHEN 'vorstand' THEN 'Vorstand' WHEN 'admin' THEN 'Admin' END
$$;

CREATE FUNCTION public.create_approval(p_action text, p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  beschreibung text;
  inhalt jsonb := coalesce(p_payload, '{}');
  anzahl integer;
  f jsonb;
  teile text[] := '{}';
  ziel public.staff_members%ROWTYPE;
  rolle public.staff_role;
  aid uuid;
BEGIN
  IF NOT public.has_full_access() THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'full_access_required'; END IF;
  IF p_action = 'nachricht' THEN
    IF coalesce(trim(inhalt ->> 'betreff'), '') = '' OR coalesce(trim(inhalt ->> 'text'), '') = '' THEN RAISE EXCEPTION 'invalid_payload'; END IF;
    f := coalesce(inhalt -> 'filter', '{}');
    SELECT count(*) INTO anzahl FROM public.broadcast_recipients(f);
    IF anzahl = 0 THEN RAISE EXCEPTION 'no_recipients'; END IF;
    IF f ? 'cohort_id' THEN teile := teile || ('Generation ' || coalesce((SELECT name FROM public.cohorts WHERE id = (f ->> 'cohort_id')::uuid), '?')); END IF;
    IF f ? 'region_id' THEN teile := teile || ('Region ' || coalesce((SELECT name FROM public.regions WHERE id = (f ->> 'region_id')::int), '?')); END IF;
    IF f ? 'mentor_id' THEN teile := teile || ('Sorumlu ' || coalesce((SELECT name FROM public.mentors WHERE id = (f ->> 'mentor_id')::uuid), '?')); END IF;
    IF f ? 'module_id' THEN teile := teile || ('angemeldet für ' || coalesce((SELECT title FROM public.modules WHERE id = (f ->> 'module_id')::uuid), '?')); END IF;
    IF f ? 'group_id' THEN teile := teile || ('Gruppe ' || coalesce((SELECT name FROM public.module_groups WHERE id = (f ->> 'group_id')::uuid), '?')); END IF;
    inhalt := jsonb_build_object('betreff', left(inhalt ->> 'betreff', 200), 'text', left(inhalt ->> 'text', 10000), 'filter', f, 'anzahl', anzahl);
    beschreibung := format('Nachricht „%s“ an %s Personen (%s)', inhalt ->> 'betreff', anzahl,
                           CASE WHEN cardinality(teile) = 0 THEN 'alle aktiven mit E-Mail' ELSE array_to_string(teile, ', ') END);
  ELSIF p_action = 'export' THEN
    inhalt := jsonb_build_object('filter', coalesce(inhalt -> 'filter', '{}'));
    beschreibung := 'Export der Auswertung als CSV mit Namen und E-Mail-Adressen aller Teilnehmenden';
  ELSIF p_action = 'team_zugang' AND inhalt ->> 'art' = 'neu' THEN
    rolle := (inhalt ->> 'rolle')::public.staff_role;
    IF coalesce(trim(inhalt ->> 'email'), '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR coalesce(trim(inhalt ->> 'name'), '') = '' THEN RAISE EXCEPTION 'invalid_payload'; END IF;
    inhalt := jsonb_build_object('art', 'neu', 'email', lower(trim(inhalt ->> 'email')), 'name', left(trim(inhalt ->> 'name'), 80),
                                 'rolle', rolle, 'modul', nullif(inhalt ->> 'modul', ''));
    beschreibung := format('Neuer Team-Zugang: %s <%s> als %s%s', inhalt ->> 'name', inhalt ->> 'email', public.staff_role_name(rolle),
      CASE WHEN inhalt ->> 'modul' IS NOT NULL THEN ', nur für ' || coalesce((SELECT title FROM public.modules WHERE id = (inhalt ->> 'modul')::uuid), '?') ELSE ', unbefristet' END);
  ELSIF p_action = 'team_zugang' AND inhalt ->> 'art' = 'rolle' THEN
    rolle := (inhalt ->> 'rolle')::public.staff_role;
    SELECT * INTO ziel FROM public.staff_members WHERE user_id = (inhalt ->> 'user_id')::uuid;
    IF NOT FOUND OR public.staff_role_rank(rolle) <= public.staff_role_rank(ziel.role) THEN RAISE EXCEPTION 'invalid_payload'; END IF;
    inhalt := jsonb_build_object('art', 'rolle', 'user_id', ziel.user_id, 'rolle', rolle);
    beschreibung := format('%s: Rolle von %s auf %s hochstufen', ziel.display_name, public.staff_role_name(ziel.role), public.staff_role_name(rolle));
  ELSE
    RAISE EXCEPTION 'invalid_action';
  END IF;
  INSERT INTO public.approvals (action, summary, payload, requested_by) VALUES (p_action, beschreibung, inhalt, auth.uid()) RETURNING id INTO aid;
  RETURN aid;
END $$;

-- ---------------------------------------------------------------------------
-- Team-Zugänge: nur über einen freigegebenen Antrag (auch bei direkten Datenbankzugriffen)
-- ---------------------------------------------------------------------------
-- Neue Teamkonten und Hochstufungen nur, wenn execute_team_approval sie in derselben Transaktion vornimmt.
-- Einrichtung (postgres, service_role für ./ses.sh admin) bleibt möglich; Herabstufen, Befristen, Entfernen jederzeit.
CREATE FUNCTION public.staff_members_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_setting('ses.team_freigabe', true) = 'ok' OR current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' OR public.staff_role_rank(NEW.role) > public.staff_role_rank(OLD.role) OR NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'team_approval_required';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER staff_members_guard BEFORE INSERT OR UPDATE ON public.staff_members
  FOR EACH ROW EXECUTE FUNCTION public.staff_members_guard();

-- Freigegebenen Team-Antrag ausführen. Bei „neu“ übergibt der Server das gerade angelegte Login-Konto; dessen
-- E-Mail-Adresse muss zum Antrag passen.
CREATE FUNCTION public.execute_team_approval(p_id uuid, p_new_user uuid DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  a public.approvals%ROWTYPE;
  von timestamptz; bis timestamptz; titel text;
BEGIN
  IF public.current_staff_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'admin_required'; END IF;
  SELECT * INTO a FROM public.approvals WHERE id = p_id AND action = 'team_zugang' FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF a.requested_by <> auth.uid() THEN RETURN 'not_requester'; END IF;
  IF a.status <> 'freigegeben' THEN RETURN a.status; END IF;
  IF a.decided_at < now() - interval '24 hours' THEN RETURN 'expired'; END IF;
  IF (SELECT role FROM public.staff_members WHERE user_id = a.decided_by) IS DISTINCT FROM 'admin' THEN RETURN 'admin_required'; END IF;

  PERFORM set_config('ses.team_freigabe', 'ok', true);
  IF a.payload ->> 'art' = 'rolle' THEN
    UPDATE public.staff_members SET role = (a.payload ->> 'rolle')::public.staff_role WHERE user_id = (a.payload ->> 'user_id')::uuid;
  ELSE
    IF p_new_user IS NULL OR (SELECT lower(email) FROM auth.users WHERE id = p_new_user) IS DISTINCT FROM a.payload ->> 'email' THEN
      PERFORM set_config('ses.team_freigabe', '', true);
      RETURN 'user_mismatch';
    END IF;
    IF a.payload ->> 'modul' IS NOT NULL THEN
      SELECT min(d.starts_at) - interval '4 hours', max(d.ends_at) + interval '6 hours', m.title INTO von, bis, titel
        FROM public.modules m JOIN public.module_days d ON d.module_id = m.id WHERE m.id = (a.payload ->> 'modul')::uuid GROUP BY m.title;
    END IF;
    INSERT INTO public.staff_members (user_id, role, display_name, valid_from, valid_until, label)
    VALUES (p_new_user, (a.payload ->> 'rolle')::public.staff_role, a.payload ->> 'name', von, bis,
            CASE WHEN titel IS NOT NULL THEN CASE WHEN a.payload ->> 'rolle' = 'checkin_helper' THEN 'Helfer' ELSE 'Team' END || ' · ' || titel END);
  END IF;
  PERFORM set_config('ses.team_freigabe', '', true);
  UPDATE public.approvals SET status = 'ausgefuehrt', executed_at = now() WHERE id = p_id;
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'approval_executed', 'approval', p_id, jsonb_build_object('action', a.action, 'art', a.payload ->> 'art'));
  RETURN 'ok';
END $$;

REVOKE ALL ON FUNCTION public.create_approval(text, jsonb), public.execute_team_approval(uuid, uuid),
  public.staff_members_guard(), public.staff_role_rank(public.staff_role), public.staff_role_name(public.staff_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_approval(text, jsonb), public.execute_team_approval(uuid, uuid),
  public.staff_role_rank(public.staff_role), public.staff_role_name(public.staff_role) TO authenticated;
