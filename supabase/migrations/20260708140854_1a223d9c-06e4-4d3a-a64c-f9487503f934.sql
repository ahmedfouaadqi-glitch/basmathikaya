
-- 1) preview_templates
CREATE TABLE public.preview_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  language text NOT NULL DEFAULT 'ar' CHECK (language IN ('ar','en','ku')),
  story_type text,
  moods text[] NOT NULL DEFAULT '{}',
  cover_image_path text,
  page_images text[] NOT NULL DEFAULT '{}',
  title text NOT NULL,
  pages jsonb NOT NULL DEFAULT '[]'::jsonb,
  reflective_question text,
  page_count int NOT NULL DEFAULT 5,
  orientation text NOT NULL DEFAULT 'portrait' CHECK (orientation IN ('portrait','landscape')),
  frame_style text,
  palette jsonb,
  active boolean NOT NULL DEFAULT true,
  hidden boolean NOT NULL DEFAULT false,
  seasonal_start date,
  seasonal_end date,
  priority int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.preview_templates TO anon, authenticated;
GRANT ALL ON public.preview_templates TO service_role;

ALTER TABLE public.preview_templates ENABLE ROW LEVEL SECURITY;

-- Public read policy: only visible templates in their seasonal window.
CREATE POLICY "public read visible preview templates"
ON public.preview_templates FOR SELECT
TO anon, authenticated
USING (
  active = true
  AND hidden = false
  AND (seasonal_start IS NULL OR seasonal_start <= CURRENT_DATE)
  AND (seasonal_end   IS NULL OR seasonal_end   >= CURRENT_DATE)
);

CREATE TRIGGER preview_templates_touch_updated_at
BEFORE UPDATE ON public.preview_templates
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX preview_templates_lookup_idx
  ON public.preview_templates (language, active, hidden, priority DESC);

-- 2) QA + character profile columns (all nullable, additive)
ALTER TABLE public.orders            ADD COLUMN IF NOT EXISTS story_qa_report jsonb;
ALTER TABLE public.story_pages       ADD COLUMN IF NOT EXISTS qa_report jsonb;
ALTER TABLE public.story_pages       ADD COLUMN IF NOT EXISTS qa_retries int NOT NULL DEFAULT 0;
ALTER TABLE public.order_characters  ADD COLUMN IF NOT EXISTS character_profile jsonb;
