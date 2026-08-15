-- Content modes and real-person consent gates.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS content_mode TEXT NOT NULL DEFAULT 'family',
  ADD COLUMN IF NOT EXISTS adult_content_level TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS real_person_declared BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_status TEXT NOT NULL DEFAULT 'not_required';

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_content_mode_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_content_mode_check
  CHECK (content_mode IN ('family', 'adult'));

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_adult_content_level_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_adult_content_level_check
  CHECK (adult_content_level IN ('none', 'romantic', 'suggestive', 'explicit'));

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_consent_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_consent_status_check
  CHECK (consent_status IN ('not_required', 'awaiting_admin_contact', 'consent_requested', 'consent_documents_pending', 'consent_approved', 'revoked', 'expired'));

CREATE INDEX IF NOT EXISTS idx_orders_content_mode ON public.orders(content_mode, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_consent_status ON public.orders(consent_status) WHERE real_person_declared = true;

COMMENT ON COLUMN public.orders.content_mode IS 'family or adult; enforced server-side before AI generation';
COMMENT ON COLUMN public.orders.adult_content_level IS 'none, romantic, suggestive, or explicit';
COMMENT ON COLUMN public.orders.real_person_declared IS 'User declared that at least one referenced character is a real person';
COMMENT ON COLUMN public.orders.consent_status IS 'Administrative consent state for declared real persons';