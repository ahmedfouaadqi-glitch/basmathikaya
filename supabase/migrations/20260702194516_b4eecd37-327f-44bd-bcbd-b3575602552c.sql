
-- 1) Expand coupons with pageCount/quality/tier constraints
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS min_pages int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS applies_quality text[] NOT NULL DEFAULT ARRAY['standard','premium']::text[],
  ADD COLUMN IF NOT EXISTS applies_tier text[] NOT NULL DEFAULT ARRAY['pdf','printed','video']::text[];

-- 2) Order lifecycle: pending_payment + tier picked at draft creation time + notice flag
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending_payment',
  ADD COLUMN IF NOT EXISTS payment_confirmed_notified_at timestamptz;

-- 3) Pricing: AI cost estimates + admin whatsapp number (used from admin.settings page)
ALTER TABLE public.pricing_settings
  ADD COLUMN IF NOT EXISTS ai_cost_estimate_standard numeric NOT NULL DEFAULT 0.05,
  ADD COLUMN IF NOT EXISTS ai_cost_estimate_premium numeric NOT NULL DEFAULT 0.15,
  ADD COLUMN IF NOT EXISTS whatsapp_admin_number text NOT NULL DEFAULT '9647733570130';

-- 4) Phone-based ban list (phone is the durable identity here)
CREATE TABLE IF NOT EXISTS public.phone_bans (
  phone text PRIMARY KEY,
  reason text,
  banned_at timestamptz NOT NULL DEFAULT now(),
  banned_by uuid
);
GRANT SELECT ON public.phone_bans TO authenticated;
GRANT ALL ON public.phone_bans TO service_role;
ALTER TABLE public.phone_bans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read phone_bans" ON public.phone_bans;
CREATE POLICY "read phone_bans" ON public.phone_bans FOR SELECT TO authenticated USING (true);

-- 5) In-app notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_id uuid,
  title text NOT NULL,
  body text,
  kind text NOT NULL DEFAULT 'info',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own notifications read" ON public.notifications;
CREATE POLICY "own notifications read" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "own notifications update" ON public.notifications;
CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications (user_id, created_at DESC);
