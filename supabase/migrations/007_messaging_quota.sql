-- GODSON MARKETPLACE — Migration 007 : messagerie, quota, e-mail vérifié
-- 1) Messagerie acheteur ↔ vendeur (1 conversation par annonce + acheteur)
-- 2) Quota anti-spam : 20 annonces max (active + pending) par compte
-- 3) RPC publique « l'e-mail du profil est-il vérifié » (pour l'indicateur honnête)
-- Idempotent : réexécutable sans erreur.

-- ============================================================
-- CONVERSATIONS
-- ============================================================
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (listing_id, buyer_id)
);
create index if not exists conversations_buyer_idx on public.conversations (buyer_id, created_at desc);
create index if not exists conversations_seller_idx on public.conversations (seller_id, created_at desc);

-- ============================================================
-- MESSAGES
-- ============================================================
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);
create index if not exists messages_unread_idx on public.messages (read_at) where read_at is null;

-- ============================================================
-- RLS
-- ============================================================
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- conversations : lecture par les participants
drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations for select
  using (buyer_id = auth.uid() or seller_id = auth.uid());

-- création : uniquement l'ACHETEUR (jamais un vendeur qui s'auto-contacterait)
drop policy if exists conversations_insert on public.conversations;
create policy conversations_insert on public.conversations for insert
  with check (
    buyer_id = auth.uid()
    and seller_id <> auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and not p.is_banned)
  );

-- messages : lecture par les participants de la conversation
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );

-- envoi : par un participant (acheteur OU vendeur — les deux répondent)
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );

-- marquage lu : par un participant (on ne modifie que des messages non lus)
drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages for update
  using (
    read_at is null
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  )
  with check (read_at is not null);

-- ============================================================
-- TEMPS RÉEL (Supabase Realtime)
-- ============================================================
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.messages;
    exception when duplicate_object then
      null;
    end;
  end if;
end $$;

-- ============================================================
-- QUOTA ANTI-SPAM : 20 annonces (active + pending) max par compte
-- ============================================================
create or replace function public.enforce_listing_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.listings
  where seller_id = new.seller_id
    and status in ('active', 'pending');
  if v_count >= 20 then
    raise exception 'QUOTA_DEPASSE : 20 annonces actives maximum par compte.';
  end if;
  return new;
end
$$;

drop trigger if exists listings_quota on public.listings;
create trigger listings_quota
before insert on public.listings
for each row execute function public.enforce_listing_quota();

-- ============================================================
-- E-MAIL VÉRIFIÉ (indicateur honnête : confirmation Supabase réelle)
-- ============================================================
create or replace function public.profile_email_confirmed(p_profile_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select a.email_confirmed_at is not null from auth.users a where a.id = p_profile_id),
    false
  )
$$;

revoke execute on function public.profile_email_confirmed(uuid) from public;
grant execute on function public.profile_email_confirmed(uuid) to anon, authenticated;
