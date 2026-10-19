-- GODSON MARKETPLACE — Migration 009 : fermeture de conversation par l'acheteur
-- L'acheteur peut fermer (supprimer) la conversation qu'il a ouverte ;
-- les messages tombent en cascade. Le vendeur ne supprime pas la
-- conversation de l'acheteur (le produit reste accessible).
-- Idempotent : réexécutable sans erreur.

drop policy if exists conversations_delete on public.conversations;
create policy conversations_delete on public.conversations for delete
  using (buyer_id = auth.uid());
