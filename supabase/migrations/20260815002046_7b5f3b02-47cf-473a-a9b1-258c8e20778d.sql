-- OpenRouter model presets. The provider is selected by the server gateway.
-- Keep the current task taxonomy so the orchestrator and admin model page remain compatible.
INSERT INTO public.ai_models_config
  (task_type, model_id, priority, enabled, timeout_ms, max_retries, backoff_base_ms, temperature, top_p, max_tokens, prompt_version, params, notes)
VALUES
  ('story', 'google/gemma-4-31b-it:free', 1, true, 120000, 1, 1200, 0.85, 0.9, 8192, 'v3-openrouter', '{}'::jsonb, 'OpenRouter primary multilingual story model'),
  ('polish', 'google/gemma-4-31b-it:free', 1, true, 90000, 1, 1000, 0.7, 0.9, 6144, 'v3-openrouter', '{}'::jsonb, 'OpenRouter primary text polish model'),
  ('story_qa', 'google/gemma-4-31b-it:free', 1, true, 60000, 1, 800, 0.2, 0.9, 4096, 'v3-openrouter', '{}'::jsonb, 'OpenRouter primary story QA model'),
  ('image_analysis', 'google/gemma-4-31b-it:free', 1, true, 60000, 1, 800, 0.2, 0.9, 4096, 'v3-openrouter', '{}'::jsonb, 'OpenRouter primary multimodal analysis model'),
  ('image_qa', 'google/gemma-4-31b-it:free', 1, true, 60000, 1, 800, 0.2, 0.9, 4096, 'v3-openrouter', '{}'::jsonb, 'OpenRouter primary image QA model'),
  ('image_gen_cover', 'google/gemini-3.1-flash-image', 1, true, 120000, 1, 1500, NULL, NULL, NULL, 'v3-openrouter', '{"size":"1536x1024"}'::jsonb, 'OpenRouter image generation primary'),
  ('image_gen', 'google/gemini-3.1-flash-image', 1, true, 120000, 1, 1500, NULL, NULL, NULL, 'v3-openrouter', '{"size":"1024x1024"}'::jsonb, 'OpenRouter image generation primary'),
  ('character_sheet', 'google/gemini-3.1-flash-image', 1, true, 120000, 1, 1500, NULL, NULL, NULL, 'v3-openrouter', '{}'::jsonb, 'OpenRouter character sheet primary')
ON CONFLICT (task_type, model_id) DO UPDATE SET
  priority = EXCLUDED.priority,
  enabled = EXCLUDED.enabled,
  timeout_ms = EXCLUDED.timeout_ms,
  prompt_version = EXCLUDED.prompt_version,
  params = EXCLUDED.params,
  notes = EXCLUDED.notes;

INSERT INTO public.ai_model_health (task_type, model_id)
SELECT task_type, model_id FROM public.ai_models_config
WHERE prompt_version = 'v3-openrouter'
ON CONFLICT (task_type, model_id) DO NOTHING;