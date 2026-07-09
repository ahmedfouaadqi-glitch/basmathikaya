-- 1) Feature flags (disabled by default; safe rollout)
INSERT INTO public.feature_flags (key, enabled, description)
VALUES
  ('quality_tier_v2', false, 'Route image/text tasks through v2 tiered model presets based on age bucket'),
  ('cache_image_gen', false, 'Cache generated images by prompt+style+DNA hash to avoid re-billing repeats'),
  ('polish_conditional', false, 'Skip polish stage for young children (age_bucket child_0_8) to save tokens'),
  ('prompt_v2', false, 'Use prompt v2 with age-bucket-aware tone and Inner Child guidance')
ON CONFLICT (key) DO NOTHING;

-- 2) Model config: story text (tiered)
INSERT INTO public.ai_models_config
  (task_type, model_id, priority, enabled, timeout_ms, max_retries, backoff_base_ms, temperature, top_p, max_tokens, prompt_version, params)
VALUES
  ('story', 'google/gemini-3.1-pro-preview', 5,  true, 60000, 1, 1200, 0.85, 0.9, 8192, 'v2', '{}'::jsonb),
  ('story', 'openai/gpt-5.4',                10, true, 60000, 1, 1500, 0.9,  0.9, 8192, 'v2', '{}'::jsonb),
  ('story', 'google/gemini-3.5-flash',       15, true, 45000, 1, 1000, 0.85, 0.9, 8192, 'v2', '{}'::jsonb),
  ('story', 'google/gemini-3-flash-preview', 20, true, 45000, 1, 1000, 0.85, 0.9, 8192, 'v2', '{}'::jsonb)
ON CONFLICT DO NOTHING;

-- 3) Model config: polish text
INSERT INTO public.ai_models_config
  (task_type, model_id, priority, enabled, timeout_ms, max_retries, backoff_base_ms, temperature, top_p, max_tokens, prompt_version, params)
VALUES
  ('polish', 'google/gemini-3.5-flash',       5,  true, 45000, 1, 1000, 0.7, 0.9, 6144, 'v2', '{}'::jsonb),
  ('polish', 'google/gemini-3-flash-preview', 10, true, 45000, 1, 1000, 0.7, 0.9, 6144, 'v2', '{}'::jsonb)
ON CONFLICT DO NOTHING;

-- 4) Model config: cover image (highest quality)
INSERT INTO public.ai_models_config
  (task_type, model_id, priority, enabled, timeout_ms, max_retries, backoff_base_ms, prompt_version, params)
VALUES
  ('image_gen_cover', 'google/gemini-3-pro-image',      5,  true, 90000, 1, 2000, 'v2', '{"size":"1536x1024"}'::jsonb),
  ('image_gen_cover', 'google/gemini-3.1-flash-image',  10, true, 60000, 1, 1500, 'v2', '{"size":"1536x1024"}'::jsonb),
  ('image_gen_cover', 'google/gemini-2.5-flash-image',  15, true, 60000, 1, 1500, 'v2', '{"size":"1536x1024"}'::jsonb)
ON CONFLICT DO NOTHING;

-- 5) Model config: interior pages (fast + cheap primary, fallbacks)
INSERT INTO public.ai_models_config
  (task_type, model_id, priority, enabled, timeout_ms, max_retries, backoff_base_ms, prompt_version, params)
VALUES
  ('image_gen', 'google/gemini-3.1-flash-image',  5,  true, 60000, 1, 1500, 'v2', '{"size":"1024x1024"}'::jsonb),
  ('image_gen', 'google/gemini-2.5-flash-image',  10, true, 60000, 1, 1500, 'v2', '{"size":"1024x1024"}'::jsonb),
  ('image_gen', 'openai/gpt-image-1-mini',        20, true, 60000, 1, 1500, 'v2', '{"size":"1024x1024","quality":"low"}'::jsonb)
ON CONFLICT DO NOTHING;

-- 6) Model config: character sheet + image QA + story QA (cheap models)
INSERT INTO public.ai_models_config
  (task_type, model_id, priority, enabled, timeout_ms, max_retries, backoff_base_ms, prompt_version, params)
VALUES
  ('character_sheet', 'google/gemini-3.1-flash-image',  5, true, 45000, 1, 1000, 'v1', '{}'::jsonb),
  ('image_analysis',  'google/gemini-3.1-flash-lite',   5, true, 30000, 1, 1000, 'v1', '{}'::jsonb),
  ('image_qa',        'google/gemini-3.1-flash-lite',   5, true, 20000, 0, 800,  'v1', '{}'::jsonb),
  ('story_qa',        'google/gemini-3.1-flash-lite',   5, true, 20000, 0, 800,  'v1', '{}'::jsonb)
ON CONFLICT DO NOTHING;

-- 7) Harden art style prompts with quality boilerplate (append if not already present)
UPDATE public.art_styles
SET prompt_fragment = prompt_fragment ||
  E'\n\nQUALITY LOCK: cinematic lighting, balanced composition, coherent color palette, sharp focal subject, expressive but anatomically correct hands and faces, painterly texture, no text/letters/watermarks embedded in the illustration, no photo-in-photo, no reference sheet, single full-scene frame.'
WHERE prompt_fragment IS NOT NULL
  AND position('QUALITY LOCK' in prompt_fragment) = 0;
