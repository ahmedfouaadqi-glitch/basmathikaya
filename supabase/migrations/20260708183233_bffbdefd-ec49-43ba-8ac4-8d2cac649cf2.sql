
-- 1) Create art_styles table
CREATE TABLE public.art_styles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  category text NOT NULL CHECK (category IN ('realistic', 'cartoon')),
  name_ar text NOT NULL,
  name_en text NOT NULL,
  prompt_fragment text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  is_enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.art_styles TO anon, authenticated;
GRANT ALL ON public.art_styles TO service_role;

ALTER TABLE public.art_styles ENABLE ROW LEVEL SECURITY;

-- Anyone can read enabled styles (public UI needs them at order creation)
CREATE POLICY "public reads enabled art_styles"
  ON public.art_styles FOR SELECT
  USING (is_enabled = true);

-- Writes only via service_role (admin functions run server-side)
CREATE TRIGGER art_styles_touch_updated_at
  BEFORE UPDATE ON public.art_styles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) Add art_style columns to orders (backward compatible — nullable)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS art_style_category text,
  ADD COLUMN IF NOT EXISTS art_style_slug text;

-- 3) Seed default styles
INSERT INTO public.art_styles (slug, category, name_ar, name_en, prompt_fragment, is_default, sort_order) VALUES
  ('realistic', 'realistic', 'واقعي',
   'Realistic',
   'photo-realistic children book illustration, natural lighting, accurate anatomy and proportions, richly detailed textures, cinematic depth of field, warm and inviting palette, consistent style across the whole book, no letters or text in the illustration',
   true, 0),
  ('storybook', 'cartoon', 'رسم كتب أطفال',
   'Storybook Illustration',
   'warm classic children storybook illustration, soft watercolor washes, gentle gouache textures, consistent thick outlines, saturated but harmonious palette, cinematic depth, clean composition centered on the subject, no letters or text in the illustration',
   true, 10),
  ('cartoon-classic', 'cartoon', 'كرتون كلاسيكي',
   'Cartoon Classic',
   'classic 2D cartoon illustration for children, bold black outlines, flat vibrant colors, expressive faces, playful shapes, consistent character design, no letters or text in the illustration',
   false, 20),
  ('anime', 'cartoon', 'أنمي',
   'Anime',
   'anime illustration style, large expressive eyes, clean line art, cel-shaded coloring, soft gradients, dynamic composition, wholesome children-friendly tone, consistent character design, no letters or text in the illustration',
   false, 30),
  ('manga', 'cartoon', 'مانغا',
   'Manga',
   'manga illustration style, refined ink line art, screentone shading, expressive character faces, dynamic paneling composition, colored softly for a children book, consistent character design, no letters or text in the illustration',
   false, 40),
  ('pixar', 'cartoon', 'بيكسار',
   'Pixar Style',
   '3D animated feature film style similar to Pixar, soft global illumination, expressive cartoon proportions, subsurface skin shading, cinematic lens, warm palette, consistent character design across pages, no letters or text in the illustration',
   false, 50),
  ('disney', 'cartoon', 'ديزني',
   'Disney Style',
   '2D Disney animated feature style, soft painterly backgrounds, clean expressive character line, warm cinematic lighting, magical wholesome atmosphere, consistent character design, no letters or text in the illustration',
   false, 60),
  ('chibi', 'cartoon', 'تشيبي',
   'Chibi',
   'chibi cartoon style, tiny cute proportions, big head small body, huge sparkling eyes, pastel bright colors, soft outlines, playful child-friendly look, consistent character design, no letters or text in the illustration',
   false, 70),
  ('watercolor', 'cartoon', 'ألوان مائية',
   'Watercolor',
   'delicate hand-painted watercolor children book illustration, soft edges, translucent color washes, subtle paper texture, gentle warm palette, dreamy atmosphere, consistent character design, no letters or text in the illustration',
   false, 80)
ON CONFLICT (slug) DO NOTHING;
