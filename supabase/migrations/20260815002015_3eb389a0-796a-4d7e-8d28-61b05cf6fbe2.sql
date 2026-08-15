-- Separate public story galleries for children and adults.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS gallery_category TEXT NOT NULL DEFAULT 'general';

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_gallery_category_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_gallery_category_check
  CHECK (gallery_category IN ('kids', 'adults', 'general'));

-- Preserve existing content-mode intent for rows created before this migration.
UPDATE public.orders
SET gallery_category = CASE
  WHEN content_mode = 'adult' THEN 'adults'
  WHEN content_mode = 'family' THEN 'kids'
  ELSE 'general'
END
WHERE gallery_category = 'general';

CREATE INDEX IF NOT EXISTS idx_orders_gallery_category_public
  ON public.orders(gallery_category, is_public, gallery_featured, created_at DESC);

COMMENT ON COLUMN public.orders.gallery_category IS 'Public gallery placement: kids, adults, or general; changed by an administrator.';