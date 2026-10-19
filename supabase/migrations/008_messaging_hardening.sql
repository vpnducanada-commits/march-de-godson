-- GODSON MARKETPLACE — Migration 008 : durcissement messagerie + compteur non-lus
-- 1) messages_insert : l'expéditeur doit être l'appelant (anti-usurpation d'identité)
-- 2) RPC unread_count (auth.uid() uniquement, aucun paramètre)
-- Idempotent : réexécutable sans erreur.

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );

create or replace function public.unread_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  where m.read_at is null
    and m.sender_id <> auth.uid()
    and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
$$;

revoke execute on function public.unread_count() from public;
grant execute on function public.unread_count() to authenticated;
