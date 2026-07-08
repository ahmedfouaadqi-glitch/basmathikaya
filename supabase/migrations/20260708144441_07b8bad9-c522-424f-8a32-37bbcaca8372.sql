
ALTER TABLE public.preview_templates
  ADD COLUMN IF NOT EXISTS season_start DATE,
  ADD COLUMN IF NOT EXISTS season_end DATE;

ALTER TABLE public.pricing_settings
  ADD COLUMN IF NOT EXISTS pdf_image_quality INTEGER,
  ADD COLUMN IF NOT EXISTS pdf_max_width INTEGER;

ALTER TABLE public.order_characters
  ADD COLUMN IF NOT EXISTS character_sheet_url TEXT;
