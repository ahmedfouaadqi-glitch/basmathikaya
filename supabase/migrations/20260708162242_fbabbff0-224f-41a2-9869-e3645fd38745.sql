-- Stage 3: cost-reduction caches
CREATE TABLE IF NOT EXISTS public.prompt_cache (
  cache_key TEXT PRIMARY KEY,
  task_type TEXT NOT NULL,
  model_id TEXT NOT NULL,
  response JSONB NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  cost_saved_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_hit_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompt_cache TO authenticated;
GRANT ALL ON public.prompt_cache TO service_role;
ALTER TABLE public.prompt_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only prompt_cache" ON public.prompt_cache
  FOR ALL USING (false) WITH CHECK (false);
CREATE INDEX IF NOT EXISTS idx_prompt_cache_expires ON public.prompt_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_prompt_cache_task ON public.prompt_cache(task_type);

CREATE TABLE IF NOT EXISTS public.character_analysis_cache (
  cache_key TEXT PRIMARY KEY,
  image_hash TEXT NOT NULL,
  character_dna JSONB NOT NULL,
  model_id TEXT NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  cost_saved_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_hit_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_analysis_cache TO authenticated;
GRANT ALL ON public.character_analysis_cache TO service_role;
ALTER TABLE public.character_analysis_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only char_cache" ON public.character_analysis_cache
  FOR ALL USING (false) WITH CHECK (false);
CREATE INDEX IF NOT EXISTS idx_char_cache_expires ON public.character_analysis_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_char_cache_image ON public.character_analysis_cache(image_hash);

-- Seed feature flags for Stage 3 (all OFF by default)
INSERT INTO public.feature_flags (key, enabled, rollout_percent, audience, user_ids, description)
VALUES
  ('cache_story_qa', false, 0, 'all', '{}', 'Cache Story QA results by content hash'),
  ('cache_image_qa', false, 0, 'all', '{}', 'Cache Image QA results by (image_hash + DNA)'),
  ('cache_character_analysis', false, 0, 'all', '{}', 'Cache character DNA extraction per source photo'),
  ('batch_story_generation', false, 0, 'all', '{}', 'Generate full story in one call instead of page-by-page'),
  ('reuse_character_sheet', false, 0, 'all', '{}', 'Reuse character sheet across all pages of an order'),
  ('lazy_pdf_generation', false, 0, 'all', '{}', 'Defer PDF generation until first download')
ON CONFLICT (key) DO NOTHING;