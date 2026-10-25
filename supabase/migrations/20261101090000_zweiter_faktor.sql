-- SES-Organisation, Phase 2: ein Login für alle, zweiter Faktor fürs Team.
--
-- Entscheidung vom 25.10.2026: Teammitglieder melden sich wie alle mit E-Mail und Code an, zusätzlich mit einer
-- Authenticator-App (TOTP), weil sie Telefonnummern und Bewertungen von über 160 Personen sehen.
-- Die Pflicht schaltet ein Admin ein (settings.zweiter_faktor). Ab dann gelten Teamrechte nur in Sitzungen mit
-- zweitem Faktor (JWT-Claim aal = aal2), auch bei direkten Datenbankabfragen.

CREATE TABLE public.settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION public.mfa_required()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT (value #>> '{}')::boolean FROM public.settings WHERE key = 'zweiter_faktor'), false)
$$;

CREATE OR REPLACE FUNCTION public.current_staff_role()
RETURNS public.staff_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT role FROM public.staff_members
   WHERE user_id = auth.uid()
     AND (valid_from IS NULL OR valid_from <= now())
     AND (valid_until IS NULL OR valid_until > now())
     AND (NOT public.mfa_required() OR coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2')
$$;

-- Darf diese Adresse einen Login-Code bekommen? Aktive Teilnehmende oder Teamkonten. Nur serverseitig aufrufbar,
-- die Login-Seite antwortet immer gleich (keine Auskunft, welche Adressen es gibt).
CREATE FUNCTION public.login_allowed(p_email text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.participants WHERE email = public.normalize_email(p_email) AND active) THEN 'participant'
    WHEN EXISTS (SELECT 1 FROM public.staff_members s JOIN auth.users u ON u.id = s.user_id
                  WHERE lower(u.email) = public.normalize_email(p_email)
                    AND (s.valid_until IS NULL OR s.valid_until > now())) THEN 'staff'
  END
$$;

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
-- Lesen über die Teamrolle wäre bei eingeschalteter Pflicht ein Zirkel (aal1 sieht nichts); deshalb alle Angemeldeten
CREATE POLICY settings_read  ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY settings_admin ON public.settings FOR ALL TO authenticated
  USING (public.current_staff_role() = 'admin') WITH CHECK (public.current_staff_role() = 'admin');
REVOKE ALL ON public.settings FROM anon;

REVOKE ALL ON FUNCTION public.mfa_required(), public.login_allowed(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mfa_required() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.login_allowed(text) TO service_role;
