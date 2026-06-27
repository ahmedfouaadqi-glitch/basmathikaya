
-- 1) story_pages table
CREATE TABLE public.story_pages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  page_number integer NOT NULL,
  text text,
  image_path text,
  image_prompt text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (order_id, page_number)
);
GRANT ALL ON public.story_pages TO service_role;
ALTER TABLE public.story_pages ENABLE ROW LEVEL SECURITY;
-- No public policies; service-role only via server functions.

CREATE TRIGGER trg_story_pages_touch
BEFORE UPDATE ON public.story_pages
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) orders new columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS page_count integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS pdf_path text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS character_brief text;

-- 3) pricing_settings new columns
ALTER TABLE public.pricing_settings
  ADD COLUMN IF NOT EXISTS per_page_iqd_pdf integer NOT NULL DEFAULT 400,
  ADD COLUMN IF NOT EXISTS per_page_iqd_printed integer NOT NULL DEFAULT 1200,
  ADD COLUMN IF NOT EXISTS per_page_iqd_video integer NOT NULL DEFAULT 2500;
