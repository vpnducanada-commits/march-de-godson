-- GODSON MARKETPLACE — Migration 006 : expiration des annonces
-- Une annonce publiée est visible 90 jours, puis « expire » :
--   - masquée du catalogue public et des profils (politique RLS),
--   - toujours visible par son propriétaire (qui peut la reprendre),
--   - reprise = 90 jours supplémentaires, via la RPC renew_listing.
-- Idempotent : réexécutable sans erreur.

-- Colonne d'échéance (rétroactive : les annonces existantes vivent 90 jours de plus)
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'listings' and column_name = 'expires_at'
  ) then
    alter table public.listings add column expires_at timestamptz not null
      default now() + interval '90 days';
  end if;
end $$;

create index if not exists listings_expires_idx on public.listings (expires_at) where status = 'active';

-- Visibilité publique : active ET non expirée. Le propriétaire et les
-- admins conservent l'accès complet (suivi, reprise, modération).
drop policy if exists listings_select on public.listings;
create policy listings_select on public.listings for select
  using (
    (status = 'active' and expires_at > now())
    or seller_id = auth.uid()
    or public.is_admin()
  );

-- Reprise d'annonce : propriétaire ou admin, annonce active uniquement.
-- security definer : la lecture d'éligibilité se fait hors RLS, mais les
-- conditions ci-dessous (seller/admin + statut) sont strictes.
create or replace function public.renew_listing(p_listing_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expires timestamptz;
begin
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

  update public.listings
  set expires_at = now() + interval '90 days'
  where id = p_listing_id
  returning expires_at into v_expires;

  return v_expires;
end
$$;

revoke execute on function public.renew_listing(uuid) from public, anon;
grant execute on function public.renew_listing(uuid) to authenticated;
