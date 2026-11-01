-- Re-enable mandatory Gemini enforcement after the Gemini-aware frontend is promoted.
-- GODSON Marketplace only; no LTS objects are touched.
DROP POLICY IF EXISTS listings_insert ON public.listings;
CREATE POLICY listings_insert ON public.listings FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND seller_id = auth.uid() AND status = 'pending'
  AND NOT public.is_account_moderation_blocked(auth.uid())
);
DROP POLICY IF EXISTS listings_update ON public.listings;
CREATE POLICY listings_update ON public.listings FOR UPDATE USING (
  (seller_id = auth.uid() AND NOT public.is_account_moderation_blocked(auth.uid())) OR public.is_admin()
) WITH CHECK (
  (seller_id = auth.uid() AND status <> 'active' AND NOT public.is_account_moderation_blocked(auth.uid())) OR public.is_admin()
);
DROP POLICY IF EXISTS messages_insert ON public.messages;
CREATE POLICY messages_insert ON public.messages FOR INSERT WITH CHECK (
  sender_id = auth.uid() AND NOT public.is_account_moderation_blocked(auth.uid())
  AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid()))
);
DROP POLICY IF EXISTS reports_insert ON public.reports;
CREATE POLICY reports_insert ON public.reports FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND reporter_id = auth.uid() AND status = 'open'
  AND NOT public.is_account_moderation_blocked(auth.uid())
);
NOTIFY pgrst, 'reload schema';
