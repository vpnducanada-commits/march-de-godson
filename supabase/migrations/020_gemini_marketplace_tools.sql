-- GODSON Marketplace: quotas server-side for optional, user-triggered Gemini helpers.
-- No private-message text is processed by these features.
CREATE TABLE IF NOT EXISTS public.gemini_feature_usage (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_key text NOT NULL CHECK (char_length(actor_key) = 64),
  feature text NOT NULL CHECK (feature IN ('listing_assistant', 'search_assistant', 'admin_triage')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gemini_feature_usage_actor_window_idx
  ON public.gemini_feature_usage (actor_key, feature, created_at DESC);
CREATE INDEX IF NOT EXISTS gemini_feature_usage_created_idx
  ON public.gemini_feature_usage (created_at);

ALTER TABLE public.gemini_feature_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.gemini_feature_usage FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.gemini_feature_usage TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.gemini_feature_usage_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.consume_gemini_feature_quota(
  p_actor_key text,
  p_feature text,
  p_limit integer,
  p_window_hours integer DEFAULT 24
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_actor_key IS NULL OR char_length(p_actor_key) <> 64
     OR p_feature NOT IN ('listing_assistant', 'search_assistant', 'admin_triage')
     OR p_limit < 1 OR p_limit > 20
     OR p_window_hours < 1 OR p_window_hours > 168 THEN
    RAISE EXCEPTION 'invalid_quota_request' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_actor_key), hashtext(p_feature));
  DELETE FROM public.gemini_feature_usage WHERE created_at < now() - interval '14 days';

  SELECT count(*)::integer INTO v_count
  FROM public.gemini_feature_usage
  WHERE actor_key = p_actor_key
    AND feature = p_feature
    AND created_at >= now() - make_interval(hours => p_window_hours);

  IF v_count >= p_limit THEN
    RETURN false;
  END IF;

  INSERT INTO public.gemini_feature_usage (actor_key, feature) VALUES (p_actor_key, p_feature);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_gemini_feature_quota(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_gemini_feature_quota(text, text, integer, integer) TO service_role;

NOTIFY pgrst, 'reload schema';
