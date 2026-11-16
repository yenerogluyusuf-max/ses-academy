-- „Beitrag einreichen“ (Wunsch Yusuf 16.11.2026): Teilnehmende reichen ihre Artikel, Reden, Videos … selbst in
-- „Mein Bereich“ ein, mit Einwilligung zur Veröffentlichung. Das Team prüft (Freigabe durch den Islamrat als Träger,
-- siehe STIMMEN_LEITFADEN.md) und schaltet frei; erst dann erscheint der Beitrag unter /stimmen/.
--
-- status:  erfasst            = vom Team eingetragen (bisheriger Weg, z. B. aus der Recherche)
--          eingereicht        = von der Person selbst eingereicht, wartet auf Prüfung
--          veroeffentlicht    = freigegeben, steht auf der Website
--          nicht_uebernommen  = geprüft, nicht veröffentlicht (Rückmeldung an die Person in review_note)
-- Zurückziehen löscht die eigene Einreichung (zugleich Widerruf der Einwilligung).

ALTER TABLE public.contributions
  ADD COLUMN status       text NOT NULL DEFAULT 'erfasst'
                          CHECK (status IN ('erfasst', 'eingereicht', 'veroeffentlicht', 'nicht_uebernommen')),
  ADD COLUMN summary      text CHECK (summary IS NULL OR length(summary) <= 8000),
  ADD COLUMN language     text CHECK (language IS NULL OR language IN ('de', 'tr', 'en', 'fr', 'nl')),
  ADD COLUMN country      text CHECK (country IS NULL OR country IN ('de', 'fr', 'at', 'nl', 'be', 'ch', 'andere')),
  ADD COLUMN author_name  text CHECK (author_name IS NULL OR length(author_name) <= 120),
  ADD COLUMN city         text CHECK (city IS NULL OR length(city) <= 80),
  ADD COLUMN consent_at   timestamptz,
  ADD COLUMN submitted_at timestamptz,
  ADD COLUMN reviewed_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN reviewed_at  timestamptz,
  ADD COLUMN review_note  text CHECK (review_note IS NULL OR length(review_note) <= 1000);

-- Veröffentlichen nur mit Einwilligung (bei selbst eingereichten Beiträgen) und Adresse auf der Website
ALTER TABLE public.contributions ADD CONSTRAINT contributions_veroeffentlicht_check
  CHECK (status <> 'veroeffentlicht' OR (website_slug IS NOT NULL AND (submitted_at IS NULL OR consent_at IS NOT NULL)));

CREATE UNIQUE INDEX contributions_website_slug_idx ON public.contributions (website_slug) WHERE website_slug IS NOT NULL;
CREATE INDEX contributions_status_idx ON public.contributions (status);

-- ---------------------------------------------------------------------------
-- Einreichen: nur für die angemeldete Person selbst, immer als „eingereicht“
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.submit_own_contribution(
  p_kind text, p_title text, p_url text, p_outlet text, p_published_on date, p_summary text,
  p_language text, p_country text, p_city text, p_full_name boolean, p_consent boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  p public.participants%ROWTYPE;
  cid uuid;
  titel text := nullif(trim(p_title), '');
  link text := nullif(trim(p_url), '');
  text_ text := nullif(trim(p_summary), '');
BEGIN
  SELECT * INTO p FROM public.participants WHERE user_id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('result', 'no_participant'); END IF;
  IF p_consent IS NOT TRUE THEN RETURN jsonb_build_object('result', 'consent'); END IF;
  IF p_kind NOT IN ('kommentar', 'video', 'grafik', 'podcast', 'rede', 'artikel') THEN RETURN jsonb_build_object('result', 'invalid'); END IF;
  IF titel IS NULL OR length(titel) > 200 THEN RETURN jsonb_build_object('result', 'title'); END IF;
  IF link IS NULL AND p_kind <> 'kommentar' THEN RETURN jsonb_build_object('result', 'link'); END IF;
  IF link IS NOT NULL AND (link !~* '^https?://[^ ]+$' OR length(link) > 1000) THEN RETURN jsonb_build_object('result', 'link'); END IF;
  IF text_ IS NULL OR length(text_) < 40 OR length(text_) > 8000 THEN RETURN jsonb_build_object('result', 'text'); END IF;
  IF p_language NOT IN ('de', 'tr', 'en', 'fr', 'nl') OR p_country NOT IN ('de', 'fr', 'at', 'nl', 'be', 'ch', 'andere') THEN
    RETURN jsonb_build_object('result', 'invalid');
  END IF;
  IF p_published_on IS NOT NULL AND p_published_on > (now() AT TIME ZONE 'Europe/Berlin')::date + 1 THEN
    RETURN jsonb_build_object('result', 'date');
  END IF;
  -- Schutz vor Massen-Einreichungen: höchstens fünf warten gleichzeitig
  IF (SELECT count(*) FROM public.contributions c WHERE c.participant_id = p.id AND c.status = 'eingereicht') >= 5 THEN
    RETURN jsonb_build_object('result', 'too_many');
  END IF;

  INSERT INTO public.contributions (participant_id, kind, title, url, outlet, published_on, summary, language, country,
                                    author_name, city, status, consent_at, submitted_at)
  VALUES (p.id, p_kind, titel, link, nullif(left(trim(p_outlet), 120), ''), p_published_on, text_, p_language, p_country,
          CASE WHEN p_full_name THEN public.display_name(p)
               ELSE trim(p.first_name) || ' ' || upper(left(trim(p.last_name), 1)) || '.' END,
          nullif(left(trim(p_city), 80), ''), 'eingereicht', now(), now())
  RETURNING id INTO cid;
  INSERT INTO public.audit_log (actor_id, target_participant_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), p.id, 'contribution_self', 'contribution', cid, jsonb_build_object('kind', p_kind));
  RETURN jsonb_build_object('result', 'saved', 'id', cid);
END $$;

-- Zurückziehen = Widerruf: die eigene Einreichung verschwindet ganz (auch von der Website)
CREATE FUNCTION public.withdraw_own_contribution(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  me uuid := public.my_participant_id();
  slug text;
BEGIN
  IF me IS NULL THEN RETURN jsonb_build_object('result', 'no_participant'); END IF;
  DELETE FROM public.contributions c
   WHERE c.id = p_id AND c.participant_id = me AND c.submitted_at IS NOT NULL
  RETURNING c.website_slug INTO slug;
  IF NOT FOUND THEN RETURN jsonb_build_object('result', 'not_found'); END IF;
  INSERT INTO public.audit_log (actor_id, target_participant_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), me, 'contribution_withdrawn', 'contribution', p_id, '{}'::jsonb);
  RETURN jsonb_build_object('result', 'withdrawn', 'slug', slug);
END $$;

-- Für die öffentliche Seite /stimmen/: nur freigegebene Beiträge, nur die Angaben, die dort stehen
CREATE FUNCTION public.public_stimmen()
RETURNS TABLE (slug text, kind text, title text, url text, outlet text, published_on date, summary text,
               language text, country text, author_name text, city text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT c.website_slug, c.kind, c.title, c.url, c.outlet, c.published_on, c.summary,
         c.language, c.country, c.author_name, c.city, c.created_at
    FROM public.contributions c
   WHERE c.status = 'veroeffentlicht' AND c.website_slug IS NOT NULL AND c.summary IS NOT NULL
   ORDER BY coalesce(c.published_on, c.created_at::date) DESC
$$;

REVOKE ALL ON FUNCTION public.submit_own_contribution(text, text, text, text, date, text, text, text, text, boolean, boolean),
  public.withdraw_own_contribution(uuid), public.public_stimmen() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_own_contribution(text, text, text, text, date, text, text, text, text, boolean, boolean),
  public.withdraw_own_contribution(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_stimmen() TO anon, authenticated;
