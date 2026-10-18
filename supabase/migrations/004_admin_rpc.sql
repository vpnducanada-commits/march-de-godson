-- GODSON MARKETPLACE — Migration 004 : RPC administration
-- Fonction SECURITY DEFINER avec autorisation interne (jamais de clé service dans le navigateur).
-- Un utilisateur non-admin reçoit une liste vide (aucune fuite de données).

create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  display_name text,
  account_type text,
  role text,
  is_banned boolean,
  is_demo boolean,
  created_at timestamptz,
  listings_count int
)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.id,
    u.email,
    p.display_name,
    p.account_type,
    p.role,
    p.is_banned,
    p.is_demo,
    p.created_at,
    (select count(*)::int from public.listings l where l.seller_id = p.id)
  from public.profiles p
  join auth.users u on u.id = p.id
  where exists (
    select 1 from public.profiles a
    where a.id = auth.uid() and a.role = 'admin' and not a.is_banned
  )
  order by p.created_at desc
  limit 500
$$;

revoke execute on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to anon, authenticated;
