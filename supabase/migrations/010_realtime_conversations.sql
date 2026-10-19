-- GODSON MARKETPLACE — Migration 010 : temps réel sur les conversations
-- La création d'une conversation (acheteur → vendeur) doit rafraîchir la liste
-- du vendeur en temps réel, même avant le premier message.
-- Idempotent : réexécutable sans erreur.

do $$
begin
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations') then
    raise notice 'conversations déjà dans supabase_realtime';
  else
    alter publication supabase_realtime add table public.conversations;
  end if;
end $$;
