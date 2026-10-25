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
  IF NOT FOUND OR a.action <> p_action THEN RETURN jsonb_build_object('result', 'not_found'); END IF;
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
CREATE POLICY approvals_insert ON public.approvals FOR INSERT TO authenticated
  WITH CHECK (public.has_full_access() AND requested_by = auth.uid() AND status = 'offen' AND decided_by IS NULL);
-- Änderungen nur über decide_approval / claim_approval / record_approval_result
REVOKE ALL ON public.approvals FROM anon;
REVOKE UPDATE, DELETE ON public.approvals FROM authenticated;

REVOKE ALL ON FUNCTION public.decide_approval(uuid, boolean, text), public.claim_approval(uuid, text),
  public.record_approval_result(uuid, jsonb), public.broadcast_recipients(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_approval(uuid, boolean, text), public.claim_approval(uuid, text),
  public.record_approval_result(uuid, jsonb), public.broadcast_recipients(jsonb) TO authenticated;
