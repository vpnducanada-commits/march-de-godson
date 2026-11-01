-- GODSON Marketplace only: Gemini moderation before public activation.
-- Does not alter any LTS object.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS moderation_suspended_until timestamptz;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS moderation_message text,
  ADD COLUMN IF NOT EXISTS moderation_checked_at timestamptz;

CREATE TABLE IF NOT EXISTS public.listing_moderation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  outcome text NOT NULL CHECK (outcome IN ('approved', 'retake', 'violation')),
  violation_type text,
  confidence numeric(5,4) NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
  model text NOT NULL DEFAULT 'gemini-3.8-flash',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listing_moderation_user_time_idx
  ON public.listing_moderation_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS listing_moderation_listing_time_idx
  ON public.listing_moderation_events (listing_id, created_at DESC);

ALTER TABLE public.listing_moderation_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS listing_moderation_admin_select ON public.listing_moderation_events;
CREATE POLICY listing_moderation_admin_select
  ON public.listing_moderation_events FOR SELECT
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.is_account_moderation_blocked(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((
    SELECT p.is_banned OR p.moderation_suspended_until > now()
    FROM public.profiles p
    WHERE p.id = p_user_id
  ), false);
$$;
REVOKE ALL ON FUNCTION public.is_account_moderation_blocked(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_account_moderation_blocked(uuid) TO authenticated, service_role;

-- New listings must be pending; no browser client may make an item public directly.
DROP POLICY IF EXISTS listings_insert ON public.listings;
CREATE POLICY listings_insert ON public.listings FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND seller_id = auth.uid()
    AND status = 'pending'
    AND NOT public.is_account_moderation_blocked(auth.uid())
  );

DROP POLICY IF EXISTS listings_update ON public.listings;
CREATE POLICY listings_update ON public.listings FOR UPDATE
  USING (
    (seller_id = auth.uid() AND NOT public.is_account_moderation_blocked(auth.uid()))
    OR public.is_admin()
  )
  WITH CHECK (
    (seller_id = auth.uid() AND status <> 'active' AND NOT public.is_account_moderation_blocked(auth.uid()))
    OR public.is_admin()
  );

-- Prevent temporarily suspended users from sending new marketplace messages.
DROP POLICY IF EXISTS messages_insert ON public.messages;
CREATE POLICY messages_insert ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND NOT public.is_account_moderation_blocked(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
    )
  );

-- Signal/report creation is also disabled during an active suspension.
DROP POLICY IF EXISTS reports_insert ON public.reports;
CREATE POLICY reports_insert ON public.reports FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND reporter_id = auth.uid()
    AND status = 'open'
    AND NOT public.is_account_moderation_blocked(auth.uid())
  );

CREATE OR REPLACE FUNCTION public.apply_gemini_listing_moderation(
  p_listing_id uuid,
  p_user_id uuid,
  p_outcome text,
  p_violation_type text DEFAULT NULL,
  p_confidence numeric DEFAULT 0,
  p_model text DEFAULT 'gemini-3.8-flash',
  p_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_listing public.listings%ROWTYPE;
  v_strikes integer := 0;
  v_action text := 'none';
  v_safe_message text;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;
  IF p_outcome NOT IN ('approved', 'retake', 'violation') THEN
    RAISE EXCEPTION 'invalid_moderation_outcome' USING ERRCODE = '22023';
  END IF;
  IF p_confidence < 0 OR p_confidence > 1 THEN
    RAISE EXCEPTION 'invalid_confidence' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_listing FROM public.listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND OR v_listing.seller_id <> p_user_id THEN
    RAISE EXCEPTION 'listing_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_listing.status <> 'pending' THEN
    RAISE EXCEPTION 'listing_not_pending' USING ERRCODE = '55000';
  END IF;

  v_safe_message := left(COALESCE(NULLIF(btrim(p_message), ''), 'Annonce bloquée par le contrôle automatique.'), 500);

  INSERT INTO public.listing_moderation_events
    (listing_id, user_id, outcome, violation_type, confidence, model)
  VALUES
    (p_listing_id, p_user_id, p_outcome, left(p_violation_type, 80), p_confidence, left(p_model, 80));

  IF p_outcome = 'approved' THEN
    UPDATE public.listings
      SET status = 'active', moderation_message = NULL, moderation_checked_at = now(), updated_at = now()
      WHERE id = p_listing_id;
    RETURN jsonb_build_object('outcome', 'approved', 'action', 'published', 'strikes', 0);
  ELSIF p_outcome = 'retake' THEN
    UPDATE public.listings
      SET status = 'refused', moderation_message = v_safe_message, moderation_checked_at = now(), updated_at = now()
      WHERE id = p_listing_id;
    RETURN jsonb_build_object('outcome', 'retake', 'action', 'retake_requested', 'strikes', 0, 'message', v_safe_message);
  ELSE
    SELECT count(*)::integer INTO v_strikes
      FROM public.listing_moderation_events
      WHERE user_id = p_user_id
        AND outcome = 'violation'
        AND created_at >= now() - interval '90 days';

    IF v_strikes = 1 THEN
      v_action := 'warning';
      v_safe_message := 'Publication retirée. Avertissement : le contenu enfreint les règles de la plateforme.';
    ELSIF v_strikes = 2 THEN
      v_action := 'suspension_7_days';
      UPDATE public.profiles SET moderation_suspended_until = now() + interval '7 days' WHERE id = p_user_id;
      v_safe_message := 'Publication retirée. Compte suspendu pendant 7 jours après une récidive.';
    ELSE
      v_action := 'permanent_ban';
      UPDATE public.profiles SET is_banned = true, moderation_suspended_until = NULL WHERE id = p_user_id;
      v_safe_message := 'Publication retirée. Compte banni définitivement après des infractions répétées.';
    END IF;

    UPDATE public.listings
      SET status = 'refused', moderation_message = v_safe_message, moderation_checked_at = now(), updated_at = now()
      WHERE id = p_listing_id;
    RETURN jsonb_build_object('outcome', 'violation', 'action', v_action, 'strikes', v_strikes, 'message', v_safe_message);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_gemini_listing_moderation(uuid, uuid, text, text, numeric, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_gemini_listing_moderation(uuid, uuid, text, text, numeric, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
