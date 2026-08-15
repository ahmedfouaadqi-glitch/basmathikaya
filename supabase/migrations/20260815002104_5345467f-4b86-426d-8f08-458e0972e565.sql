-- Freeze the user-provided character reference at order creation.
ALTER TABLE public.order_characters
  ADD COLUMN IF NOT EXISTS reference_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS reference_locked_at timestamptz;

-- Enable the existing cost-reduction caches for all users.
UPDATE public.feature_flags
SET enabled = true, rollout_percent = 100, audience = 'all'
WHERE key IN (
  'prompt_cache',
  'character_analysis_cache',
  'cache_story_qa',
  'cache_image_qa',
  'cache_character_analysis',
  'cache_image_gen'
);

COMMENT ON COLUMN public.order_characters.reference_snapshot IS 'Immutable-at-creation snapshot of the user description/photo reference used for generation.';
COMMENT ON COLUMN public.order_characters.reference_locked_at IS 'Timestamp at which the reference snapshot was captured.';