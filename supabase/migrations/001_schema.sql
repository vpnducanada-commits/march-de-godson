-- GODSON MARKETPLACE — Migration 001 : schéma principal
-- Tables, index, triggers, RLS, stockage.
-- Idempotent : réexécutable sans erreur.

create extension if not exists pg_trgm;

-- ============================================================
-- PROFILES (rattachés à auth.users)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(coalesce(display_name, '')) <= 60),
  pseudonym text check (char_length(coalesce(pseudonym, '')) <= 30),
  avatar_url text,
  city text,
  account_type text not null default 'particulier'
    check (account_type in ('particulier', 'commercant', 'professionnel', 'entreprise')),
  role text not null default 'user' check (role in ('user', 'admin')),
  is_banned boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- CATEGORIES (hiérarchiques : parent_id)
-- ============================================================
create table if not exists public.categories (
  id serial primary key,
  parent_id integer references public.categories(id) on delete cascade,
  slug text not null unique,
  name text not null check (char_length(name) between 2 and 60),
  icon text,
  sort_order integer not null default 0,
  status text not null default 'active' check (status in ('active', 'disabled'))
);

-- ============================================================
-- LOCALITIES (catalogue extensible)
-- ============================================================
create table if not exists public.localities (
  id serial primary key,
  slug text not null unique,
  name text not null check (char_length(name) between 2 and 60),
  province text,
  sort_order integer not null default 0
);

-- ============================================================
-- LISTINGS (annonces)
-- ============================================================
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  category_id integer not null references public.categories(id) on delete restrict,
  title text not null check (char_length(title) between 5 and 120),
  slug text not null unique,
  description text not null check (char_length(description) between 10 and 5000),
  price bigint check (price is null or price >= 0),
  negotiable boolean not null default false,
  currency text not null default 'XAF',
  city_id integer references public.localities(id) on delete set null,
  area text check (char_length(coalesce(area, '')) <= 120),
  condition text check (condition is null or condition in ('neuf', 'comme_neuf', 'bon_etat', 'a_renover')),
  seller_type text not null default 'particulier'
    check (seller_type in ('particulier', 'commercant', 'professionnel', 'entreprise')),
  contact_phone text check (char_length(coalesce(contact_phone, '')) <= 20),
  contact_whatsapp text check (char_length(coalesce(contact_whatsapp, '')) <= 20),
  is_demo boolean not null default false,
  is_sponsored boolean not null default false,
  status text not null default 'active' check (status in ('draft', 'pending', 'active', 'refused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Normalisation des accents (même logique que le client JS)
create or replace function public.normalize_text(t text) returns text
language sql immutable parallel safe as
$$
  select translate(lower(coalesce(t, '')),
    'àâäéèêëïîôöùûüçñœ',
    'aaaeeeeiioouuucne')
$$;

-- Colonne de recherche (titre + description), insensible aux accents
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'listings' and column_name = 'search_text'
  ) then
    alter table public.listings add column search_text text
      generated always as (
        public.normalize_text(coalesce(title, '') || ' ' || coalesce(description, ''))
      ) stored;
  end if;
end $$;

create index if not exists listings_search_text_idx on public.listings using gin (search_text gin_trgm_ops);
create index if not exists listings_category_idx on public.listings(category_id);
create index if not exists listings_city_idx on public.listings(city_id);
create index if not exists listings_status_created_idx on public.listings(status, created_at desc);
create index if not exists listings_seller_idx on public.listings(seller_id);
create index if not exists listings_price_idx on public.listings(price);

-- ============================================================
-- LISTING_IMAGES
-- ============================================================
create table if not exists public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  storage_path text,
  position integer not null default 0
);
create index if not exists listing_images_listing_idx on public.listing_images(listing_id, position);

-- ============================================================
-- FAVORITES
-- ============================================================
create table if not exists public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index if not exists favorites_listing_idx on public.favorites(listing_id);

-- ============================================================
-- REPORTS (signalements)
-- ============================================================
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  listing_id uuid references public.listings(id) on delete cascade,
  target_user_id uuid references public.profiles(id) on delete cascade,
  reason text not null,
  details text check (char_length(coalesce(details, '')) <= 2000),
  status text not null default 'open' check (status in ('open', 'in_review', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);
create index if not exists reports_status_idx on public.reports(status, created_at desc);

-- ============================================================
-- ADMIN_AUDIT_LOGS
-- ============================================================
create table if not exists public.admin_audit_logs (
  id bigint generated always as identity primary key,
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  details jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_created_idx on public.admin_audit_logs(created_at desc);

-- ============================================================
-- TRIGGERS
-- ============================================================
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists listings_touch on public.listings;
create trigger listings_touch before update on public.listings
  for each row execute function public.touch_updated_at();
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Création automatique du profil à l'inscription
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, pseudonym, account_type)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(coalesce(new.email, 'anon'), '@', 1)),
    split_part(coalesce(new.email, 'anon'), '@', 1),
    'particulier'
  ) on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- RLS
-- ============================================================
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.localities enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.favorites enable row level security;
alter table public.reports enable row level security;
alter table public.admin_audit_logs enable row level security;

create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and not is_banned
  )
$$;

-- profiles : lecture publique (infos publiques uniquement), édition par le propriétaire
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (true);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and (role = 'user' or public.is_admin()));

-- categories : lecture publique (actives), écriture admin
drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories for select
  using (status = 'active' or public.is_admin());
drop policy if exists categories_admin on public.categories;
create policy categories_admin on public.categories for all
  using (public.is_admin()) with check (public.is_admin());

-- localities : lecture publique, écriture admin
drop policy if exists localities_select on public.localities;
create policy localities_select on public.localities for select using (true);
drop policy if exists localities_admin on public.localities;
create policy localities_admin on public.localities for all
  using (public.is_admin()) with check (public.is_admin());

-- listings : visibles si actives, ou si propriétaire, ou admin
drop policy if exists listings_select on public.listings;
create policy listings_select on public.listings for select
  using (status = 'active' or seller_id = auth.uid() or public.is_admin());
drop policy if exists listings_insert on public.listings;
create policy listings_insert on public.listings for insert
  with check (
    auth.uid() is not null
    and seller_id = auth.uid()
    and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_banned)
  );
drop policy if exists listings_update on public.listings;
create policy listings_update on public.listings for update
  using (seller_id = auth.uid() or public.is_admin())
  with check (seller_id = auth.uid() or public.is_admin());
drop policy if exists listings_delete on public.listings;
create policy listings_delete on public.listings for delete
  using (seller_id = auth.uid() or public.is_admin());

-- listing_images : lecture si l'annonce est visible ; écriture par le vendeur
drop policy if exists listing_images_select on public.listing_images;
create policy listing_images_select on public.listing_images for select
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id
        and (l.status = 'active' or l.seller_id = auth.uid() or public.is_admin())
    )
  );
drop policy if exists listing_images_write on public.listing_images;
create policy listing_images_write on public.listing_images for all
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and (l.seller_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and (l.seller_id = auth.uid() or public.is_admin())
    )
  );

-- favorites : strictement privées
drop policy if exists favorites_owner on public.favorites;
create policy favorites_owner on public.favorites for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- reports : création par un utilisateur authentifié, lecture par son auteur ou admin
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert
  with check (auth.uid() is not null and reporter_id = auth.uid());
drop policy if exists reports_select on public.reports;
create policy reports_select on public.reports for select
  using (reporter_id = auth.uid() or public.is_admin());
drop policy if exists reports_update on public.reports;
create policy reports_update on public.reports for update
  using (public.is_admin()) with check (public.is_admin());

-- admin_audit_logs : réservé aux admins
drop policy if exists audit_admin on public.admin_audit_logs;
create policy audit_admin on public.admin_audit_logs for all
  using (public.is_admin())
  with check (public.is_admin() and admin_id = auth.uid());

-- ============================================================
-- STOCKAGE : bucket listing-images
-- ============================================================
insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', false)
on conflict (id) do nothing;

drop policy if exists listing_images_public_read on storage.objects;
create policy listing_images_public_read on storage.objects for select
  using (bucket_id = 'listing-images');
drop policy if exists listing_images_owner_insert on storage.objects;
create policy listing_images_owner_insert on storage.objects for insert
  with check (
    bucket_id = 'listing-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists listing_images_owner_delete on storage.objects;
create policy listing_images_owner_delete on storage.objects for delete
  using (
    bucket_id = 'listing-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
