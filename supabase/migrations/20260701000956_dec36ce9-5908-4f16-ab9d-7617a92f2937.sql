
ALTER TABLE public.seasonal_themes
  ADD COLUMN IF NOT EXISTS meaning_ar text,
  ADD COLUMN IF NOT EXISTS meaning_en text,
  ADD COLUMN IF NOT EXISTS palette jsonb,
  ADD COLUMN IF NOT EXISTS frame_style text,
  ADD COLUMN IF NOT EXISTS motifs jsonb,
  ADD COLUMN IF NOT EXISTS header_title_ar text,
  ADD COLUMN IF NOT EXISTS header_title_en text,
  ADD COLUMN IF NOT EXISTS header_size text DEFAULT 'md';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS character_dna jsonb,
  ADD COLUMN IF NOT EXISTS art_style_lock text,
  ADD COLUMN IF NOT EXISTS disclaimer_accepted_at timestamptz;

ALTER TABLE public.pricing_settings
  ADD COLUMN IF NOT EXISTS quality_premium_multiplier numeric NOT NULL DEFAULT 2.0;

CREATE TABLE IF NOT EXISTS public.promo_videos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  url text NOT NULL,
  title text,
  sort_order integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  muted_default boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.promo_videos TO anon, authenticated;
GRANT ALL ON public.promo_videos TO service_role;

ALTER TABLE public.promo_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promo_videos read enabled" ON public.promo_videos;
CREATE POLICY "promo_videos read enabled" ON public.promo_videos
  FOR SELECT TO anon, authenticated
  USING (enabled = true);

DROP TRIGGER IF EXISTS trg_promo_videos_updated_at ON public.promo_videos;
CREATE TRIGGER trg_promo_videos_updated_at
  BEFORE UPDATE ON public.promo_videos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
