CREATE TABLE public.admin_login_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_login_tokens_phone_created_idx ON public.admin_login_tokens(phone, created_at DESC);
CREATE INDEX admin_login_tokens_ip_created_idx ON public.admin_login_tokens(ip, created_at DESC);

GRANT ALL ON public.admin_login_tokens TO service_role;

ALTER TABLE public.admin_login_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_login_tokens_no_client_access"
  ON public.admin_login_tokens
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pdf_orientation text NOT NULL DEFAULT 'portrait',
  ADD COLUMN IF NOT EXISTS reflective_question text;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_pdf_orientation_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_pdf_orientation_check
  CHECK (pdf_orientation IN ('portrait','landscape'));