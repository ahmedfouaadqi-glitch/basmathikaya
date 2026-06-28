
ALTER TABLE public.order_characters ADD COLUMN IF NOT EXISTS photo_path text;

CREATE TABLE IF NOT EXISTS public.seasonal_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date,
  end_date date,
  accent_color text,
  banner_text_ar text,
  banner_text_en text,
  banner_url text,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.seasonal_themes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seasonal_themes TO authenticated;
GRANT ALL ON public.seasonal_themes TO service_role;

ALTER TABLE public.seasonal_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "themes public read active"
  ON public.seasonal_themes FOR SELECT
  USING (active = true);

CREATE TRIGGER touch_seasonal_themes
  BEFORE UPDATE ON public.seasonal_themes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
