
-- Extend users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_credit_iqd integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_referral_code ON public.users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON public.users(referred_by_user_id);

-- Extend orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gallery_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_title text;

CREATE INDEX IF NOT EXISTS idx_orders_public ON public.orders(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_orders_featured ON public.orders(gallery_featured) WHERE gallery_featured = true;

-- referrals table
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referred_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  code text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reward_amount_iqd integer NOT NULL DEFAULT 0,
  first_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  rewarded_at timestamp with time zone,
  UNIQUE (referred_user_id)
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);

GRANT SELECT, INSERT, UPDATE ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referrals_owner_read" ON public.referrals FOR SELECT TO authenticated
  USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);

-- referral_rewards table
CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referral_id uuid REFERENCES public.referrals(id) ON DELETE SET NULL,
  amount_iqd integer NOT NULL,
  reason text NOT NULL,
  applied_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_user ON public.referral_rewards(user_id);

GRANT SELECT ON public.referral_rewards TO authenticated;
GRANT ALL ON public.referral_rewards TO service_role;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referral_rewards_owner_read" ON public.referral_rewards FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- testimonials table
CREATE TABLE IF NOT EXISTS public.testimonials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_name text NOT NULL,
  author_city text,
  content text NOT NULL,
  rating integer NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  avatar_url text,
  published boolean NOT NULL DEFAULT false,
  featured boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.testimonials TO anon;
GRANT SELECT ON public.testimonials TO authenticated;
GRANT ALL ON public.testimonials TO service_role;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "testimonials_public_read" ON public.testimonials FOR SELECT TO anon
  USING (published = true);
CREATE POLICY "testimonials_auth_read" ON public.testimonials FOR SELECT TO authenticated
  USING (published = true);

CREATE TRIGGER testimonials_touch BEFORE UPDATE ON public.testimonials
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- visit_events table (utm tracking)
CREATE TABLE IF NOT EXISTS public.visit_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id text,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  path text NOT NULL,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  referral_code text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_visit_events_created ON public.visit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visit_events_utm_source ON public.visit_events(utm_source);
CREATE INDEX IF NOT EXISTS idx_visit_events_referral ON public.visit_events(referral_code);

GRANT INSERT ON public.visit_events TO anon;
GRANT INSERT ON public.visit_events TO authenticated;
GRANT ALL ON public.visit_events TO service_role;
ALTER TABLE public.visit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visit_events_public_insert" ON public.visit_events FOR INSERT TO anon
  WITH CHECK (true);
CREATE POLICY "visit_events_auth_insert" ON public.visit_events FOR INSERT TO authenticated
  WITH CHECK (true);

-- Public read policy for orders that owners marked public (Gallery)
DROP POLICY IF EXISTS "orders_public_gallery_read" ON public.orders;
CREATE POLICY "orders_public_gallery_read" ON public.orders FOR SELECT TO anon
  USING (is_public = true AND status = 'delivered');
CREATE POLICY "orders_public_gallery_read_auth" ON public.orders FOR SELECT TO authenticated
  USING (is_public = true AND status = 'delivered');

GRANT SELECT ON public.orders TO anon;

-- Referral code generator function
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_code text;
  attempts int := 0;
BEGIN
  LOOP
    new_code := upper(substring(md5(gen_random_uuid()::text) FROM 1 FOR 8));
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE referral_code = new_code) THEN
      RETURN new_code;
    END IF;
    attempts := attempts + 1;
    IF attempts > 10 THEN
      RETURN new_code || substring(md5(random()::text) FROM 1 FOR 4);
    END IF;
  END LOOP;
END;
$$;
