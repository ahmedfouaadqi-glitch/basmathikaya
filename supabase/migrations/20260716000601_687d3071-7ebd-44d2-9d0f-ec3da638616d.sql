
-- Fix orders_public_gallery_column_exposure: remove broad SELECT policies on orders.
-- All public gallery/share reads go through server functions using the service role
-- client, which projects only safe columns.
DROP POLICY IF EXISTS "orders_public_gallery_read" ON public.orders;
DROP POLICY IF EXISTS "orders_public_gallery_read_auth" ON public.orders;

-- Fix video_orders_public_token_column_exposure: token-based public reads happen via
-- server functions with column projection; no direct table SELECT is needed for anon.
DROP POLICY IF EXISTS "public video orders by token" ON public.video_orders;

-- Fix feature_flags_public_user_ids_exposure: feature flags are only consumed by
-- server-side helpers using service role, so no public SELECT policy is needed.
DROP POLICY IF EXISTS "feature_flags public read" ON public.feature_flags;

-- Fix SUPA_rls_policy_always_true: replace WITH CHECK (true) INSERT policies with
-- constraints that prevent user_id spoofing.
DROP POLICY IF EXISTS "share_events insert" ON public.share_events;
CREATE POLICY "share_events insert" ON public.share_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "visit_events_public_insert" ON public.visit_events;
CREATE POLICY "visit_events_public_insert" ON public.visit_events
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);

DROP POLICY IF EXISTS "visit_events_auth_insert" ON public.visit_events;
CREATE POLICY "visit_events_auth_insert" ON public.visit_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
