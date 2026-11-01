-- ============================================================================
-- Migration 016 : Correctifs de l'audit approfondi (périmètre exclusif GODSON Marketplace)
-- Aucune table, vue, bucket ni fonction LTS n'est modifiée.
-- ============================================================================

-- 1. Aligner la politique RLS de `listing_images` sur celle de `listings` :
--    les images d'une annonce expirée ne doivent plus être exposées au public,
--    tout en restant visibles pour le propriétaire (reprise 90j) et les admins.
DROP POLICY IF EXISTS listing_images_select ON public.listing_images;
CREATE POLICY listing_images_select ON public.listing_images
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.listings l
      WHERE l.id = listing_images.listing_id
        AND (
          (l.status = 'active' AND (l.expires_at IS NULL OR l.expires_at > now()))
          OR l.seller_id = auth.uid()
          OR public.is_admin()
        )
    )
  );

-- 2. Aligner `search_users` pour compter strictement les annonces actives non expirées
CREATE OR REPLACE FUNCTION public.search_users(p_query text, p_limit integer DEFAULT 12)
RETURNS TABLE(
  id uuid,
  username text,
  display_name text,
  pseudonym text,
  avatar_url text,
  city text,
  account_type text,
  is_demo boolean,
  created_at timestamptz,
  followers_count bigint,
  listings_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH cleaned AS (
    SELECT left(regexp_replace(lower(btrim(coalesce(p_query, ''))), '^[@#]+', ''), 64) AS raw_in
  ),
  q AS (
    SELECT
      raw_in AS raw,
      replace(replace(replace(raw_in, '\', '\\'), '%', '\%'), '_', '\_') AS esc_raw,
      replace(replace(replace(public.normalize_text(raw_in), '\', '\\'), '%', '\%'), '_', '\_') AS esc_norm
    FROM cleaned
  )
  SELECT
    p.id,
    p.username,
    p.display_name,
    p.pseudonym,
    p.avatar_url,
    p.city,
    p.account_type,
    p.is_demo,
    p.created_at,
    (SELECT count(*) FROM public.follows f WHERE f.followed_id = p.id) AS followers_count,
    (
      SELECT count(*) FROM public.listings l
      WHERE l.seller_id = p.id
        AND l.status = 'active'
        AND l.expires_at > now()
    ) AS listings_count
  FROM public.profiles p, q
  WHERE NOT p.is_banned
    AND char_length(regexp_replace(q.raw, '[%\\_\s]+', '', 'g')) >= 2
    AND (
      lower(p.id::text) = q.raw
      OR lower(replace(p.id::text, '-', '')) LIKE q.esc_raw || '%' ESCAPE '\'
      OR lower(p.id::text) LIKE q.esc_raw || '%' ESCAPE '\'
      OR lower(coalesce(p.username, '')) LIKE '%' || q.esc_raw || '%' ESCAPE '\'
      OR public.normalize_text(coalesce(p.display_name, '')) LIKE '%' || q.esc_norm || '%' ESCAPE '\'
      OR public.normalize_text(coalesce(p.pseudonym, '')) LIKE '%' || q.esc_norm || '%' ESCAPE '\'
    )
  ORDER BY
    CASE
      WHEN lower(p.id::text) = q.raw OR lower(coalesce(p.username, '')) = q.raw THEN 0
      WHEN lower(replace(p.id::text, '-', '')) LIKE q.esc_raw || '%' ESCAPE '\'
        OR lower(coalesce(p.username, '')) LIKE q.esc_raw || '%' ESCAPE '\' THEN 1
      ELSE 2
    END,
    p.created_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 12), 30));
$$;

-- 3. Durcir `profile_email_confirmed(uuid)` : ne répond que pour un profil
--    GODSON Marketplace existant et non suspendu (bloque tout sondage d'UUID externe).
CREATE OR REPLACE FUNCTION public.profile_email_confirmed(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = p_profile_id AND NOT p.is_banned
    ) THEN coalesce(
      (SELECT a.email_confirmed_at IS NOT NULL FROM auth.users a WHERE a.id = p_profile_id),
      false
    )
    ELSE false
  END;
$$;

-- 4. Révoquer l'exécution anonyme inutile sur les fonctions réservées aux sessions connectées
REVOKE EXECUTE ON FUNCTION public.unread_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unread_count() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_privileged_actor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_privileged_actor() TO authenticated, service_role;

-- 5. Contraintes d'intégrité `CHECK` supplémentaires sur les tables GODSON Marketplace
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_shop_label_check,
  ADD CONSTRAINT profiles_shop_label_check CHECK (char_length(COALESCE(shop_label, '')) <= 120),
  DROP CONSTRAINT IF EXISTS profiles_city_check,
  ADD CONSTRAINT profiles_city_check CHECK (char_length(COALESCE(city, '')) <= 80),
  DROP CONSTRAINT IF EXISTS profiles_avatar_url_check,
  ADD CONSTRAINT profiles_avatar_url_check CHECK (char_length(COALESCE(avatar_url, '')) <= 500),
  DROP CONSTRAINT IF EXISTS profiles_shop_coords_check,
  ADD CONSTRAINT profiles_shop_coords_check CHECK (
    (shop_lat IS NULL AND shop_lng IS NULL)
    OR (
      shop_lat IS NOT NULL AND shop_lng IS NOT NULL
      AND shop_lat <> 'NaN'::float8 AND shop_lng <> 'NaN'::float8
      AND shop_lat BETWEEN -90 AND 90
      AND shop_lng BETWEEN -180 AND 180
    )
  );

ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_location_label_check,
  ADD CONSTRAINT listings_location_label_check CHECK (char_length(COALESCE(location_label, '')) <= 120),
  DROP CONSTRAINT IF EXISTS listings_video_url_check,
  ADD CONSTRAINT listings_video_url_check CHECK (char_length(COALESCE(video_url, '')) <= 500),
  DROP CONSTRAINT IF EXISTS listings_video_path_check,
  ADD CONSTRAINT listings_video_path_check CHECK (char_length(COALESCE(video_path, '')) <= 260),
  DROP CONSTRAINT IF EXISTS listings_currency_check,
  ADD CONSTRAINT listings_currency_check CHECK (char_length(COALESCE(currency, '')) <= 8),
  DROP CONSTRAINT IF EXISTS listings_coords_check,
  ADD CONSTRAINT listings_coords_check CHECK (
    (latitude IS NULL AND longitude IS NULL)
    OR (
      latitude IS NOT NULL AND longitude IS NOT NULL
      AND latitude <> 'NaN'::float8 AND longitude <> 'NaN'::float8
      AND latitude BETWEEN -90 AND 90
      AND longitude BETWEEN -180 AND 180
    )
  );

ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_no_self_chat,
  ADD CONSTRAINT conversations_no_self_chat CHECK (buyer_id <> seller_id);

NOTIFY pgrst, 'reload schema';
