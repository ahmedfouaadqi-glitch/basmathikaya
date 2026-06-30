
CREATE TABLE IF NOT EXISTS public.site_content (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_content TO anon, authenticated;
GRANT ALL ON public.site_content TO service_role;
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "site_content public read" ON public.site_content;
CREATE POLICY "site_content public read" ON public.site_content
  FOR SELECT TO anon, authenticated USING (true);

CREATE TRIGGER site_content_touch_updated_at
  BEFORE UPDATE ON public.site_content
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.pricing_settings
  ADD COLUMN IF NOT EXISTS image_tier_standard_extra_iqd int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_tier_premium_extra_iqd int NOT NULL DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS video_tier_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.seasonal_themes
  ADD COLUMN IF NOT EXISTS pattern text;
