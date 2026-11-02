-- GODSON MARKETPLACE — Migration 014 :
-- 1. Nom d'utilisateur unique (@username) modifiable tous les 30 jours
-- 2. Photo de profil (bucket public `avatars` + RLS propriétaire)
-- 3. Recherche directe d'utilisateur par nom d'utilisateur ou ID (UUID / ID court)
-- 4. Abonnements (`follows`) + notifications temps réel (`user_notifications`) à chaque nouvelle annonce

-- ============================================================
-- 1. PROFILES : username + délai de 30 jours
-- ============================================================
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists username_updated_at timestamptz;

-- Backfill des profils existants sans username (username_updated_at reste NULL
-- pour autoriser 1 premier choix personnalisé immédiat avant verrouillage 30 j)
update public.profiles
set username = left(
  regexp_replace(
    public.normalize_text(coalesce(nullif(pseudonym, ''), nullif(display_name, ''), 'membre')),
    '[^a-z0-9_.-]+',
    '',
    'g'
  ),
  18
) || '_' || substr(replace(id::text, '-', ''), 1, 4)
where username is null or btrim(username) = '';

-- Garantir au moins 3 caractères si le nom ne contenait pas de caractères ASCII
update public.profiles
set username = 'u_' || substr(replace(id::text, '-', ''), 1, 8)
where char_length(coalesce(username, '')) < 3;

create unique index if not exists profiles_username_lower_uidx
  on public.profiles (lower(username))
  where username is not null;

create or replace function public.enforce_profile_username_rules() returns trigger
language plpgsql set search_path = public as $$
declare
  v_base text;
  v_days int;
begin
  if tg_op = 'INSERT' then
    if new.username is null or btrim(new.username) = '' then
      v_base := left(
        regexp_replace(
          public.normalize_text(coalesce(nullif(new.pseudonym, ''), nullif(new.display_name, ''), 'membre')),
          '[^a-z0-9_.-]+',
          '',
          'g'
        ),
        18
      );
      if char_length(v_base) < 2 then
        v_base := 'membre';
      end if;
      new.username := v_base || '_' || substr(replace(new.id::text, '-', ''), 1, 4);
      new.username_updated_at := null;
    else
      new.username := regexp_replace(lower(btrim(new.username)), '^@+', '');
    end if;
    return new;
  end if;

  -- UPDATE
  if new.username is distinct from old.username then
    new.username := nullif(regexp_replace(lower(btrim(coalesce(new.username, ''))), '^@+', ''), '');
    if new.username is null then
      raise exception 'NOM_UTILISATEUR_REQUIS: Le nom d''utilisateur ne peut pas être vide.';
    end if;
    if new.username !~ '^[a-z0-9_.-]{3,24}$' then
      raise exception 'NOM_UTILISATEUR_INVALIDE: Utilisez 3 à 24 caractères (lettres sans accent, chiffres, point, tiret ou underscore).';
    end if;
    if old.username is not null
       and old.username_updated_at is not null
       and old.username_updated_at > (now() - interval '30 days')
       and not public.is_admin()
    then
      v_days := greatest(
        1,
        ceil(extract(epoch from ((old.username_updated_at + interval '30 days') - now())) / 86400.0)::int
      );
      raise exception 'DELAI_30_JOURS: Changement autorisé tous les 30 jours. Prochain changement possible dans % jour(s).', v_days;
    end if;
    new.username_updated_at := now();
  end if;

  return new;
end $$;

drop trigger if exists profiles_username_rules on public.profiles;
create trigger profiles_username_rules
  before insert or update on public.profiles
  for each row execute function public.enforce_profile_username_rules();

-- ============================================================
-- 2. BUCKET `avatars` (photos de profil publiques, écriture propriétaire)
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('avatars', 'avatars', true, 5242880)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists avatars_owner_insert on storage.objects;
create policy avatars_owner_insert on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_owner_update on storage.objects;
create policy avatars_owner_update on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_owner_delete on storage.objects;
create policy avatars_owner_delete on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (select public.is_admin())
    )
  );

-- ============================================================
-- 3. ABONNEMENTS (`follows`) & NOTIFICATIONS (`user_notifications`)
-- ============================================================
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  constraint follows_no_self check (follower_id <> followed_id)
);

create index if not exists follows_followed_idx on public.follows (followed_id);
create index if not exists follows_follower_idx on public.follows (follower_id);

alter table public.follows enable row level security;

drop policy if exists follows_select on public.follows;
create policy follows_select on public.follows for select using (true);

drop policy if exists follows_insert on public.follows;
create policy follows_insert on public.follows for insert
  with check (auth.uid() is not null and follower_id = auth.uid() and followed_id <> auth.uid());

drop policy if exists follows_delete on public.follows;
create policy follows_delete on public.follows for delete
  using (follower_id = auth.uid());

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete cascade,
  kind text not null default 'new_listing',
  title text not null,
  body text not null default '',
  link text not null default '/',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_user_idx
  on public.user_notifications (user_id, created_at desc);

alter table public.user_notifications enable row level security;

drop policy if exists user_notifications_select on public.user_notifications;
create policy user_notifications_select on public.user_notifications for select
  using (user_id = auth.uid());

drop policy if exists user_notifications_update on public.user_notifications;
create policy user_notifications_update on public.user_notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists user_notifications_delete on public.user_notifications;
create policy user_notifications_delete on public.user_notifications for delete
  using (user_id = auth.uid());

-- Trigger : chaque nouvelle annonce active notifie automatiquement tous les abonnés du vendeur
create or replace function public.notify_followers_on_listing() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_seller_name text;
begin
  if (tg_op = 'INSERT' and new.status = 'active')
     or (tg_op = 'UPDATE' and old.status is distinct from 'active' and new.status = 'active')
  then
    select coalesce(nullif(display_name, ''), '@' || username, 'Un vendeur suivi')
      into v_seller_name
      from public.profiles
     where id = new.seller_id;

    insert into public.user_notifications (user_id, actor_id, listing_id, kind, title, body, link)
    select
      f.follower_id,
      new.seller_id,
      new.id,
      'new_listing',
      coalesce(v_seller_name, 'Un vendeur suivi') || ' a publié une annonce',
      new.title,
      '/annonce/' || new.slug
    from public.follows f
    where f.followed_id = new.seller_id
      and f.follower_id <> new.seller_id;
  end if;
  return new;
end $$;

drop trigger if exists listings_notify_followers on public.listings;
create trigger listings_notify_followers
  after insert or update of status on public.listings
  for each row execute function public.notify_followers_on_listing();

-- Activer Supabase Realtime sur user_notifications
do $$
begin
  alter publication supabase_realtime add table public.user_notifications;
exception when duplicate_object then
  null;
end $$;

-- ============================================================
-- 4. RPC `search_users` : recherche directe par username, nom ou ID
-- ============================================================
create or replace function public.search_users(p_query text, p_limit int default 12)
returns table (
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
language sql stable security definer set search_path = public as $$
  with q as (
    select
      regexp_replace(lower(btrim(coalesce(p_query, ''))), '^[@#]+', '') as raw,
      public.normalize_text(regexp_replace(lower(btrim(coalesce(p_query, ''))), '^[@#]+', '')) as norm
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
    (select count(*) from public.listings l where l.seller_id = p.id and l.status = 'active' and (l.expires_at is null or l.expires_at > now())) as listings_count
  from public.profiles p, q
  where not p.is_banned
    and q.raw <> ''
    and (
      lower(p.id::text) = q.raw
      or lower(replace(p.id::text, '-', '')) like q.raw || '%'
      or lower(p.id::text) like q.raw || '%'
      or lower(coalesce(p.username, '')) like '%' || q.raw || '%'
      or public.normalize_text(coalesce(p.display_name, '')) like '%' || q.norm || '%'
      or public.normalize_text(coalesce(p.pseudonym, '')) like '%' || q.norm || '%'
    )
  order by
    case
      when lower(p.id::text) = q.raw or lower(coalesce(p.username, '')) = q.raw then 0
      when lower(replace(p.id::text, '-', '')) like q.raw || '%' or lower(coalesce(p.username, '')) like q.raw || '%' then 1
      else 2
    end,
    p.created_at desc
  limit greatest(1, least(coalesce(p_limit, 12), 30));
$$;

grant execute on function public.search_users(text, int) to anon, authenticated;

notify pgrst, 'reload schema';
notify pgrst, 'reload config';
