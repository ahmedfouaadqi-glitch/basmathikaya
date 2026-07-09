ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS age_bucket text,
  ADD COLUMN IF NOT EXISTS journey_type text,
  ADD COLUMN IF NOT EXISTS photo_age_estimate int,
  ADD COLUMN IF NOT EXISTS photo_age_confidence numeric,
  ADD COLUMN IF NOT EXISTS age_verification_status text DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS requires_admin_review boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_review_note text,
  ADD COLUMN IF NOT EXISTS admin_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS content_flags jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS identity_verification_status text DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS identity_document_path text;

CREATE TABLE IF NOT EXISTS public.content_screening_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  category text NOT NULL,
  flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  decision text NOT NULL,
  reason text,
  model_used text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.content_screening_log TO authenticated;
GRANT ALL ON public.content_screening_log TO service_role;

ALTER TABLE public.content_screening_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "screening_log_owner_read" ON public.content_screening_log
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = content_screening_log.order_id
      AND o.user_id = auth.uid()
  ));

INSERT INTO public.feature_flags (key, enabled, description)
VALUES
  ('adult_stories_enabled', true, 'السماح بقصص للبالغين مع مراجعة إدارية إلزامية'),
  ('intimate_content_enabled', false, 'السماح بمحتوى شخصي حساس بعد توثيق العمر')
ON CONFLICT (key) DO NOTHING;