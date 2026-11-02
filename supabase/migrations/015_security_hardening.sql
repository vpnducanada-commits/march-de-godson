-- ============================================================================
-- GODSON MARKETPLACE — Migration 015 : Durcissement complet de sécurité
-- ============================================================================
-- Corrige l'ensemble des vecteurs d'escalade de privilèges, contournement de
-- suspension, falsification de messages/annonces/avis, abus de stockage,
-- énumération wildcard et isolation inter-applications sur le projet Supabase.
-- Idempotent : réexécutable sans erreur.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) Fonctions utilitaires : épinglage systématique de search_path = public
-- ----------------------------------------------------------------------------
create or replace function public.normalize_text(t text)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select translate(lower(coalesce(t, '')),
    'àâäéèêëïîôöùûüçñœ',
    'aaaeeeeiioouuucne')
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function public.update_last_seen()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.last_seen = now();
  return new;
end $$;

-- Indique si l'exécution courante provient du backend privilégié (migration SQL / service_role)
-- ou d'un administrateur non suspendu.
create or replace function public.is_privileged_actor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.role(), '') not in ('authenticated', 'anon')
      or public.is_admin()
$$;

revoke execute on function public.is_privileged_actor() from public;
grant execute on function public.is_privileged_actor() to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 1) PROFILES : anti-escalade de rôle, anti-auto-débannissement & validation URL
-- ----------------------------------------------------------------------------
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (
    (id = auth.uid() and not is_banned)
    or public.is_admin()
  )
  with check (
    (id = auth.uid() and not is_banned and (role = 'user' or public.is_admin()))
    or public.is_admin()
  );

create or replace function public.enforce_profile_security_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if not public.is_privileged_actor() then
      new.role := 'user';
      new.is_banned := false;
      new.is_demo := false;
    end if;
  elsif tg_op = 'UPDATE' then
    if not public.is_privileged_actor() then
      if new.id is distinct from old.id
         or new.role is distinct from old.role
         or new.is_banned is distinct from old.is_banned
         or new.is_demo is distinct from old.is_demo
         or new.created_at is distinct from old.created_at
      then
        raise exception 'ACTION_INTERDITE: Modification non autorisée de champs protégés du profil.';
      end if;
    end if;
  end if;

  -- Validation stricte de avatar_url (bloque javascript:, data:, et domaines tiers)
  if new.avatar_url is not null and btrim(new.avatar_url) = '' then
    new.avatar_url := null;
  end if;
  if new.avatar_url is not null then
    if new.avatar_url !~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/avatars/[0-9a-fA-F-]+/[a-zA-Z0-9._-]+$'
       and not (new.is_demo and new.avatar_url like '/demo/%')
    then
      raise exception 'AVATAR_INVALIDE: URL de photo de profil non autorisée.';
    end if;
  end if;

  -- Validation des bornes géographiques et longueurs de champs boutique
  if new.shop_lat is not null and (new.shop_lat < -90 or new.shop_lat > 90) then
    raise exception 'COORDONNEES_INVALIDES: Latitude hors limites.';
  end if;
  if new.shop_lng is not null and (new.shop_lng < -180 or new.shop_lng > 180) then
    raise exception 'COORDONNEES_INVALIDES: Longitude hors limites.';
  end if;
  if char_length(coalesce(new.shop_label, '')) > 120 then
    raise exception 'LIBELLE_TROP_LONG: 120 caractères maximum.';
  end if;
  if char_length(coalesce(new.city, '')) > 80 then
    raise exception 'VILLE_TROP_LONGUE: 80 caractères maximum.';
  end if;

  return new;
end $$;

drop trigger if exists profiles_security_guard on public.profiles;
create trigger profiles_security_guard
  before insert or update on public.profiles
  for each row execute function public.enforce_profile_security_columns();

-- ----------------------------------------------------------------------------
-- 2) LISTINGS & LISTING_IMAGES : anti-sponsoring gratuit, anti-bypass modération
--    et anti-contournement du quota de 20 annonces
-- ----------------------------------------------------------------------------
drop policy if exists listings_update on public.listings;
create policy listings_update on public.listings for update
  using (
    (
      seller_id = auth.uid()
      and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_banned)
    )
    or public.is_admin()
  )
  with check (
    (
      seller_id = auth.uid()
      and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_banned)
    )
    or public.is_admin()
  );

drop policy if exists listing_images_write on public.listing_images;
create policy listing_images_write on public.listing_images for all
  using (
    exists (
      select 1 from public.listings l
      join public.profiles p on p.id = l.seller_id
      where l.id = listing_images.listing_id
        and ((l.seller_id = auth.uid() and not p.is_banned) or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.listings l
      join public.profiles p on p.id = l.seller_id
      where l.id = listing_images.listing_id
        and ((l.seller_id = auth.uid() and not p.is_banned) or public.is_admin())
    )
  );

create or replace function public.enforce_listing_security()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_in_renew boolean := coalesce(current_setting('app.in_renew_listing', true), '') = '1';
begin
  if not public.is_privileged_actor() then
    if tg_op = 'INSERT' then
      new.seller_id := auth.uid();
      new.is_sponsored := false;
      new.is_demo := false;
      if new.status = 'refused' then
        raise exception 'STATUT_INVALIDE: Statut réservé à la modération.';
      end if;
      new.expires_at := least(
        coalesce(new.expires_at, now() + interval '90 days'),
        now() + interval '91 days'
      );
    elsif tg_op = 'UPDATE' then
      if new.seller_id is distinct from old.seller_id
         or new.is_sponsored is distinct from old.is_sponsored
         or new.is_demo is distinct from old.is_demo
         or new.created_at is distinct from old.created_at
      then
        raise exception 'ACTION_INTERDITE: Modification non autorisée de champs protégés de l''annonce.';
      end if;

      -- Une annonce refusée par la modération ne peut pas être republiée par le vendeur
      if old.status = 'refused' and new.status <> 'refused' then
        raise exception 'ANNONCE_REFUSEE: Seule la modération peut réactiver une annonce refusée.';
      end if;

      -- Prolongation d'expiration réservée à la RPC officielle renew_listing
      if new.expires_at is distinct from old.expires_at and not v_in_renew then
        raise exception 'ACTION_INTERDITE: Utilisez la fonction de reprise officielle pour prolonger une annonce.';
      end if;
    end if;
  end if;

  -- Validation stricte des médias vidéo et coordonnées GPS
  if new.video_url is not null and btrim(new.video_url) = '' then
    new.video_url := null;
  end if;
  if new.video_path is not null and btrim(new.video_path) = '' then
    new.video_path := null;
  end if;
  if new.video_path is not null and (position('..' in new.video_path) > 0 or new.video_path !~ '^[0-9a-fA-F-]+/[a-zA-Z0-9._-]+$') then
    raise exception 'CHEMIN_VIDEO_INVALIDE: Chemin de stockage vidéo non autorisé.';
  end if;
  if new.video_url is not null and new.video_url !~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/listing-videos/[0-9a-fA-F-]+/[a-zA-Z0-9._-]+$' then
    raise exception 'URL_VIDEO_INVALIDE: URL vidéo externe non autorisée.';
  end if;
  if new.latitude is not null and (new.latitude < -90 or new.latitude > 90) then
    raise exception 'COORDONNEES_INVALIDES: Latitude invalide.';
  end if;
  if new.longitude is not null and (new.longitude < -180 or new.longitude > 180) then
    raise exception 'COORDONNEES_INVALIDES: Longitude invalide.';
  end if;
  if char_length(coalesce(new.location_label, '')) > 140 then
    raise exception 'LIEU_TROP_LONG: 140 caractères maximum.';
  end if;

  return new;
end $$;

drop trigger if exists listings_security_guard on public.listings;
create trigger listings_security_guard
  before insert or update on public.listings
  for each row execute function public.enforce_listing_security();

-- Quota 20 annonces : appliqué à l'insertion ET lors d'un passage en active/pending
create or replace function public.enforce_listing_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if new.status in ('active', 'pending')
     and (tg_op = 'INSERT' or old.status not in ('active', 'pending'))
  then
    select count(*) into v_count
    from public.listings
    where seller_id = new.seller_id
      and status in ('active', 'pending')
      and (tg_op = 'INSERT' or id <> new.id);
    if v_count >= 20 then
      raise exception 'QUOTA_DEPASSE : 20 annonces actives maximum par compte.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists listings_quota on public.listings;
create trigger listings_quota
  before insert or update of status on public.listings
  for each row execute function public.enforce_listing_quota();

-- Mise à jour de renew_listing pour poser le drapeau transactionnel app.in_renew_listing
create or replace function public.renew_listing(p_listing_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expires timestamptz;
begin
  if exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_banned) then
    raise exception 'COMPTE_SUSPENDU';
  end if;

  if not exists (
    select 1 from public.listings l
    where l.id = p_listing_id
      and (l.seller_id = auth.uid() or public.is_admin())
  ) then
    raise exception 'ANONCE_INTROUVABLE';
  end if;

  if not exists (
    select 1 from public.listings l
    where l.id = p_listing_id and l.status = 'active'
  ) then
    raise exception 'ANONCE_NON_REPRENABLE';
  end if;

  perform set_config('app.in_renew_listing', '1', true);

  update public.listings
  set expires_at = now() + interval '90 days'
  where id = p_listing_id
  returning expires_at into v_expires;

  return v_expires;
end $$;

revoke execute on function public.renew_listing(uuid) from public, anon;
grant execute on function public.renew_listing(uuid) to authenticated;

-- Garde sur listing_images : max 6 images et chemin strictement confiné au vendeur
create or replace function public.enforce_listing_images_security()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller uuid;
  v_count int;
begin
  select seller_id into v_seller from public.listings where id = new.listing_id;
  if v_seller is null then
    raise exception 'ANNONCE_INTROUVABLE';
  end if;

  if new.storage_path is not null then
    if position('..' in new.storage_path) > 0
       or new.storage_path !~ '^[0-9a-fA-F-]+/[a-zA-Z0-9._-]+$'
    then
      raise exception 'CHEMIN_IMAGE_INVALIDE';
    end if;
    if not public.is_privileged_actor()
       and split_part(new.storage_path, '/', 1) <> v_seller::text
    then
      raise exception 'CHEMIN_IMAGE_INTERDIT';
    end if;
  end if;

  if tg_op = 'INSERT' then
    select count(*) into v_count from public.listing_images where listing_id = new.listing_id;
    if v_count >= 6 then
      raise exception 'LIMITE_IMAGES: Maximum 6 images par annonce.';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists listing_images_security_guard on public.listing_images;
create trigger listing_images_security_guard
  before insert or update on public.listing_images
  for each row execute function public.enforce_listing_images_security();

-- ----------------------------------------------------------------------------
-- 3) CONVERSATIONS & MESSAGES : immutabilité du corps, anti-usurpation vendeur
--    et anti-flood messagerie
-- ----------------------------------------------------------------------------
drop policy if exists conversations_insert on public.conversations;
create policy conversations_insert on public.conversations for insert
  with check (
    buyer_id = auth.uid()
    and seller_id <> auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and not p.is_banned
    )
    and exists (
      select 1 from public.listings l
      where l.id = conversations.listing_id
        and l.seller_id = conversations.seller_id
        and l.status = 'active'
        and l.expires_at > now()
    )
  );

drop policy if exists conversations_delete on public.conversations;
create policy conversations_delete on public.conversations for delete
  using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and not p.is_banned
    )
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );

-- Seul le DESTINATAIRE (sender_id <> auth.uid()) peut marquer un message comme lu
drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages for update
  using (
    read_at is null
    and sender_id <> auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  )
  with check (
    read_at is not null
    and sender_id <> auth.uid()
  );

create or replace function public.enforce_messages_security()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent int;
begin
  if tg_op = 'INSERT' then
    -- Anti-flood : maximum 20 messages par minute et par expéditeur
    select count(*) into v_recent
    from public.messages
    where sender_id = new.sender_id
      and created_at > (now() - interval '1 minute');
    if v_recent >= 20 then
      raise exception 'TROP_DE_MESSAGES: Ralentissez un instant avant d''envoyer d''autres messages.';
    end if;
    new.read_at := null;
    return new;
  elsif tg_op = 'UPDATE' then
    if not public.is_privileged_actor() then
      if new.id is distinct from old.id
         or new.conversation_id is distinct from old.conversation_id
         or new.sender_id is distinct from old.sender_id
         or new.body is distinct from old.body
         or new.created_at is distinct from old.created_at
      then
        raise exception 'MESSAGE_IMMUABLE: Le contenu d''un message envoyé ne peut pas être modifié.';
      end if;
    end if;
    return new;
  end if;
  return new;
end $$;

drop trigger if exists messages_security_guard on public.messages;
create trigger messages_security_guard
  before insert or update on public.messages
  for each row execute function public.enforce_messages_security();

-- ----------------------------------------------------------------------------
-- 4) REVIEWS, REPORTS, FOLLOWS & USER_NOTIFICATIONS
-- ----------------------------------------------------------------------------
-- Avis : 1 seul avis par couple (auteur, vendeur) + longueur minimale + non-banni
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.reviews'::regclass and conname = 'reviews_unique_author_seller'
  ) then
    alter table public.reviews
      add constraint reviews_unique_author_seller unique (seller_id, author_id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.reviews'::regclass and conname = 'reviews_comment_min_check'
  ) then
    alter table public.reviews
      add constraint reviews_comment_min_check check (char_length(btrim(comment)) >= 10);
  end if;
end $$;

drop policy if exists reviews_insert on public.reviews;
create policy reviews_insert on public.reviews for insert
  with check (
    auth.uid() is not null
    and author_id = auth.uid()
    and seller_id <> auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and not p.is_banned)
  );

-- Signalements : non-banni, motif borné, pas de doublon ouvert par le même auteur
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.reports'::regclass and conname = 'reports_reason_length_check'
  ) then
    alter table public.reports
      add constraint reports_reason_length_check check (char_length(btrim(reason)) between 3 and 160);
  end if;
end $$;

create unique index if not exists reports_open_unique_idx
  on public.reports (reporter_id, listing_id)
  where status = 'open' and listing_id is not null;

drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert
  with check (
    auth.uid() is not null
    and reporter_id = auth.uid()
    and status = 'open'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and not p.is_banned)
  );

-- Abonnements vendeurs : interdit aux comptes suspendus
drop policy if exists follows_insert on public.follows;
create policy follows_insert on public.follows for insert
  with check (
    auth.uid() is not null
    and follower_id = auth.uid()
    and followed_id <> auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and not p.is_banned)
  );

-- Notifications : empêcher un utilisateur de réécrire le titre/lien de sa notification
create or replace function public.enforce_notification_immutability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and not public.is_privileged_actor() then
    if new.id is distinct from old.id
       or new.user_id is distinct from old.user_id
       or new.actor_id is distinct from old.actor_id
       or new.listing_id is distinct from old.listing_id
       or new.kind is distinct from old.kind
       or new.title is distinct from old.title
       or new.body is distinct from old.body
       or new.link is distinct from old.link
       or new.created_at is distinct from old.created_at
    then
      raise exception 'NOTIFICATION_IMMUABLE';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists user_notifications_guard on public.user_notifications;
create trigger user_notifications_guard
  before update on public.user_notifications
  for each row execute function public.enforce_notification_immutability();

-- ----------------------------------------------------------------------------
-- 5) RPC : durcissement des droits d'exécution et échappement wildcard LIKE
-- ----------------------------------------------------------------------------
revoke execute on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

create or replace function public.search_users(p_query text, p_limit integer default 12)
returns table(
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
language sql
stable
security definer
set search_path = public
as $$
  with cleaned as (
    select left(regexp_replace(lower(btrim(coalesce(p_query, ''))), '^[@#]+', ''), 64) as raw_in
  ),
  q as (
    select
      raw_in as raw,
      replace(replace(replace(raw_in, '\', '\\'), '%', '\%'), '_', '\_') as esc_raw,
      replace(replace(replace(public.normalize_text(raw_in), '\', '\\'), '%', '\%'), '_', '\_') as esc_norm
    from cleaned
  )
  select
    p.id,
    p.username,
    p.display_name,
    p.pseudonym,
    p.avatar_url,
    p.city,
    p.account_type,
    p.is_demo,
    p.created_at,
    (select count(*) from public.follows f where f.followed_id = p.id) as followers_count,
    (
      select count(*) from public.listings l
      where l.seller_id = p.id
        and l.status = 'active'
        and (l.expires_at is null or l.expires_at > now())
    ) as listings_count
  from public.profiles p, q
  where not p.is_banned
    and char_length(regexp_replace(q.raw, '[%\\_\s]+', '', 'g')) >= 2
    and (
      lower(p.id::text) = q.raw
      or lower(replace(p.id::text, '-', '')) like q.esc_raw || '%' escape '\'
      or lower(p.id::text) like q.esc_raw || '%' escape '\'
      or lower(coalesce(p.username, '')) like '%' || q.esc_raw || '%' escape '\'
      or public.normalize_text(coalesce(p.display_name, '')) like '%' || q.esc_norm || '%' escape '\'
      or public.normalize_text(coalesce(p.pseudonym, '')) like '%' || q.esc_norm || '%' escape '\'
    )
  order by
    case
      when lower(p.id::text) = q.raw or lower(coalesce(p.username, '')) = q.raw then 0
      when lower(replace(p.id::text, '-', '')) like q.esc_raw || '%' escape '\'
        or lower(coalesce(p.username, '')) like q.esc_raw || '%' escape '\' then 1
      else 2
    end,
    p.created_at desc
  limit greatest(1, least(coalesce(p_limit, 12), 30));
$$;

revoke execute on function public.search_users(text, integer) from public;
grant execute on function public.search_users(text, integer) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6) STOCKAGE SUPABASE : types MIME stricts (anti-SVG/HTML XSS) & politiques UPDATE
-- ----------------------------------------------------------------------------
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'avatars';

update storage.buckets
set file_size_limit = 6291456,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'listing-images';

update storage.buckets
set file_size_limit = 83886080,
    allowed_mime_types = array['video/mp4', 'video/webm', 'video/quicktime']
where id = 'listing-videos';

drop policy if exists avatars_owner_insert on storage.objects;
create policy avatars_owner_insert on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
    and position('..' in name) = 0
  );

drop policy if exists avatars_owner_update on storage.objects;
create policy avatars_owner_update on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
    and position('..' in name) = 0
  );

drop policy if exists listing_images_owner_insert on storage.objects;
create policy listing_images_owner_insert on storage.objects for insert
  with check (
    bucket_id = 'listing-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
    and position('..' in name) = 0
  );

drop policy if exists listing_videos_owner_insert on storage.objects;
create policy listing_videos_owner_insert on storage.objects for insert
  with check (
    bucket_id = 'listing-videos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
    and position('..' in name) = 0
  );

drop policy if exists listing_videos_owner_update on storage.objects;
create policy listing_videos_owner_update on storage.objects for update
  using (
    bucket_id = 'listing-videos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'listing-videos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
    and position('..' in name) = 0
  );

-- ----------------------------------------------------------------------------
-- 7) ISOLATION INTER-APPLICATIONS (`lts_*`) : empêcher les inscrits publics du
--    Marketplace d'accéder aux tables/fichiers internes LTS Digicard
-- ----------------------------------------------------------------------------
-- Enregistrer les comptes propriétaires existants comme membres actifs LTS
insert into public.lts_profiles (id, email, full_name, role, is_active)
select u.id, u.email, coalesce(u.raw_user_meta_data->>'name', ''), 'admin', true
from auth.users u
where u.email in (
  'vpnducanada@gmail.com',
  'gedeonokana06@gmail.com',
  'maguildebloodline@gmail.com',
  'admin@godson-market.example'
)
on conflict (id) do update
  set role = 'admin', is_active = true;

-- Ne jamais accepter `role` depuis raw_user_meta_data fourni par le navigateur
-- et garder is_active = false par défaut pour les inscrits publics du Marketplace
create or replace function public.lts_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.lts_profiles (id, email, full_name, role, is_active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'commercial',
    false
  )
  on conflict (id) do nothing;
  return new;
end $$;

create or replace function public.lts_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.lts_profiles
    where id = auth.uid() and role = 'admin' and coalesce(is_active, false) = true
  ) or public.is_admin()
$$;

create or replace function public.is_lts_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.lts_profiles
    where id = auth.uid() and coalesce(is_active, false) = true
  ) or public.is_admin()
$$;

create or replace function public.lts_prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_privileged_actor() and not public.lts_is_admin() then
    if old.role is distinct from new.role or old.is_active is distinct from new.is_active then
      raise exception 'Permission refusée : seul un administrateur peut modifier les rôles ou activations LTS.';
    end if;
  end if;
  return new;
end $$;

-- Remplacement des politiques "Allow all for authenticated (true)" sur lts_*
do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'lts_activity_logs',
    'lts_client_types',
    'lts_clients',
    'lts_facturier',
    'lts_facturier_lignes',
    'lts_order_items',
    'lts_order_status_history',
    'lts_orders',
    'lts_payments',
    'lts_portfolio',
    'lts_products',
    'lts_profiles',
    'lts_scans_history',
    'lts_settings',
    'lts_suivi_attente',
    'lts_suivi_livrees',
    'lts_suivi_production'
  ] loop
    if to_regclass('public.' || t) is not null then
      for p in
        select policyname from pg_policies
        where schemaname = 'public' and tablename = t
          and policyname like 'Allow all for authenticated%'
      loop
        execute format('drop policy if exists %I on public.%I', p.policyname, t);
      end loop;

      execute format('drop policy if exists lts_member_access on public.%I', t);
      execute format(
        'create policy lts_member_access on public.%I for all to authenticated using (public.is_lts_member()) with check (public.is_lts_member())',
        t
      );
    end if;
  end loop;
end $$;

-- Verrouiller les buckets LTS contre l'écriture/suppression/énumération par des inscrits tiers
drop policy if exists "Allow authenticated lts_attachments all" on storage.objects;
drop policy if exists "Allow authenticated to manage attachments" on storage.objects;
drop policy if exists "Public read lts_attachments" on storage.objects;
drop policy if exists "Allow authenticated to manage lts_public" on storage.objects;

drop policy if exists lts_attachments_member_all on storage.objects;
create policy lts_attachments_member_all on storage.objects for all to authenticated
  using (bucket_id = 'lts_attachments' and public.is_lts_member())
  with check (bucket_id = 'lts_attachments' and public.is_lts_member() and position('..' in name) = 0);

drop policy if exists lts_public_member_write on storage.objects;
create policy lts_public_member_write on storage.objects for all to authenticated
  using (bucket_id = 'lts_public' and public.is_lts_member())
  with check (bucket_id = 'lts_public' and public.is_lts_member() and position('..' in name) = 0);

notify pgrst, 'reload schema';
