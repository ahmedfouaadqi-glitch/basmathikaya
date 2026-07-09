
-- 1) video_products
CREATE TABLE public.video_products (
  id text PRIMARY KEY,
  name_ar text NOT NULL,
  name_en text,
  description_ar text,
  duration_sec int NOT NULL DEFAULT 10,
  price_iqd int NOT NULL DEFAULT 0,
  daily_cap int NOT NULL DEFAULT 5,
  enabled boolean NOT NULL DEFAULT false,
  display_order int NOT NULL DEFAULT 0,
  cover_image_url text,
  sample_video_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.video_products TO anon, authenticated;
GRANT ALL ON public.video_products TO service_role;
ALTER TABLE public.video_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "video_products readable if enabled" ON public.video_products
  FOR SELECT USING (enabled = true);
CREATE TRIGGER trg_video_products_updated BEFORE UPDATE ON public.video_products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed the six product types (all disabled by default)
INSERT INTO public.video_products (id, name_ar, description_ar, duration_sec, price_iqd, daily_cap, display_order) VALUES
  ('teaser',      'تيزر ترويجي',       'مقطع قصير 10 ثوانٍ مستوحى من غلاف القصة',        10, 15000, 20, 1),
  ('story_reel',  'ريل القصة',         '5 مقاطع × 5 ثوانٍ، صوت وترجمة نصية',              30, 45000, 10, 2),
  ('cartoon',     'فيلم كارتوني قصير', 'أنيميشن كامل لكل صفحة، 60-90 ثانية',              75, 90000,  5, 3),
  ('anime',       'فيلم أنمي قصير',    'بأسلوب أنمي، 60-90 ثانية',                        75, 90000,  5, 4),
  ('manga',       'فيلم مانجا قصير',   'بأسلوب مانجا أبيض/أسود، 60-90 ثانية',             75, 80000,  5, 5),
  ('music_video', 'فيديو-أغنية',       'مقاطع مبنية بإيقاع أغنية مع موسيقى مولّدة',       45, 60000,  8, 6);

-- 2) video_orders
CREATE TABLE public.video_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES public.video_products(id),
  status text NOT NULL DEFAULT 'pending_review',
  storyboard jsonb,
  segments jsonb,
  final_url text,
  poster_url text,
  duration_sec int,
  price_iqd int NOT NULL DEFAULT 0,
  ai_credits_used numeric NOT NULL DEFAULT 0,
  ai_cost_iqd int NOT NULL DEFAULT 0,
  is_public boolean NOT NULL DEFAULT false,
  share_token text UNIQUE,
  admin_note text,
  rejection_reason text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  completed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.video_orders TO authenticated;
GRANT ALL ON public.video_orders TO service_role;
ALTER TABLE public.video_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own video orders" ON public.video_orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert own video orders" ON public.video_orders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "public video orders by token" ON public.video_orders
  FOR SELECT TO anon USING (is_public = true AND status = 'ready' AND share_token IS NOT NULL);
CREATE INDEX idx_video_orders_user ON public.video_orders (user_id, created_at DESC);
CREATE INDEX idx_video_orders_status ON public.video_orders (status, created_at DESC);
CREATE INDEX idx_video_orders_share_token ON public.video_orders (share_token) WHERE share_token IS NOT NULL;
CREATE TRIGGER trg_video_orders_updated BEFORE UPDATE ON public.video_orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) video_daily_stats
CREATE TABLE public.video_daily_stats (
  day date PRIMARY KEY,
  count int NOT NULL DEFAULT 0,
  total_credits numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.video_daily_stats TO authenticated;
GRANT ALL ON public.video_daily_stats TO service_role;
ALTER TABLE public.video_daily_stats ENABLE ROW LEVEL SECURITY;

-- 4) feature flags
INSERT INTO public.feature_flags (key, enabled, description) VALUES
  ('video_generation_enabled', false, 'تفعيل نظام توليد الفيديو (Beta)')
ON CONFLICT (key) DO NOTHING;
