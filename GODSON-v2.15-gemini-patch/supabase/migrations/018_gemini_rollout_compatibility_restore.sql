-- Restore compatibility with the currently promoted frontend while the Gemini-aware
-- frontend bundle is not yet promoted. New moderation schema and Edge Function remain
-- available, but enforcement is not live for the old client.
DROP POLICY IF EXISTS listings_insert ON public.listings;
CREATE POLICY listings_insert ON public.listings FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND seller_id = auth.uid()
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_banned)
);
DROP POLICY IF EXISTS listings_update ON public.listings;
CREATE POLICY listings_update ON public.listings FOR UPDATE USING (
  (seller_id = auth.uid() AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_banned)) OR public.is_admin()
) WITH CHECK (
  (seller_id = auth.uid() AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_banned)) OR public.is_admin()
);
DROP POLICY IF EXISTS messages_insert ON public.messages;
CREATE POLICY messages_insert ON public.messages FOR INSERT WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND NOT p.is_banned)
  AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid()))
);
DROP POLICY IF EXISTS reports_insert ON public.reports;
CREATE POLICY reports_insert ON public.reports FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND reporter_id = auth.uid() AND status = 'open'
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND NOT p.is_banned)
);
NOTIFY pgrst, 'reload schema';
