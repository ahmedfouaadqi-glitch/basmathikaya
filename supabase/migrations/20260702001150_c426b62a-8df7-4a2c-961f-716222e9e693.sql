
-- 1) Users: status (active/suspended/banned) + admin notes
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_status_chk') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_status_chk CHECK (status IN ('active','suspended','banned'));
  END IF;
END $$;

-- 2) Orders: rejection reason + redownload status
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS redownload_status text,
  ADD COLUMN IF NOT EXISTS redownload_amount_iqd integer,
  ADD COLUMN IF NOT EXISTS redownload_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS redownload_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS coupon_discount_iqd integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mood_extra_iqd integer NOT NULL DEFAULT 0;

-- 3) Pricing settings: mood pricing + redownload pricing
ALTER TABLE public.pricing_settings
  ADD COLUMN IF NOT EXISTS free_moods_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS mood_extra_iqd integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS redownload_iqd_pdf integer NOT NULL DEFAULT 1500,
  ADD COLUMN IF NOT EXISTS redownload_iqd_printed integer NOT NULL DEFAULT 3000,
  ADD COLUMN IF NOT EXISTS redownload_iqd_video integer NOT NULL DEFAULT 5000;

-- 4) Coupons table
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL CHECK (discount_type IN ('percent','fixed')),
  discount_value numeric NOT NULL CHECK (discount_value > 0),
  max_uses integer,
  uses_count integer NOT NULL DEFAULT 0,
  valid_from timestamptz,
  valid_to timestamptz,
  applies_to text NOT NULL DEFAULT 'all' CHECK (applies_to IN ('all','new')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coupons_no_public" ON public.coupons;
CREATE POLICY "coupons_no_public" ON public.coupons FOR SELECT USING (false);
DROP TRIGGER IF EXISTS coupons_touch ON public.coupons;
CREATE TRIGGER coupons_touch BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5) Coupon redemptions
CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  discount_iqd integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.coupon_redemptions TO service_role;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coupon_redemptions_no_public" ON public.coupon_redemptions;
CREATE POLICY "coupon_redemptions_no_public" ON public.coupon_redemptions FOR SELECT USING (false);
CREATE INDEX IF NOT EXISTS coupon_redemptions_user_idx ON public.coupon_redemptions(user_id);

-- 6) Redownload requests
CREATE TABLE IF NOT EXISTS public.redownload_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount_iqd integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.redownload_requests TO service_role;
ALTER TABLE public.redownload_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "redownload_no_public" ON public.redownload_requests;
CREATE POLICY "redownload_no_public" ON public.redownload_requests FOR SELECT USING (false);
CREATE INDEX IF NOT EXISTS redownload_order_idx ON public.redownload_requests(order_id);
DROP TRIGGER IF EXISTS redownload_touch ON public.redownload_requests;
CREATE TRIGGER redownload_touch BEFORE UPDATE ON public.redownload_requests FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
