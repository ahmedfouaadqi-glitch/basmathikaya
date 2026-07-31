ALTER TABLE public.users ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email text;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON public.users (lower(email)) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.email_otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_otp_codes_email_created_idx ON public.email_otp_codes (email, created_at DESC);
ALTER TABLE public.email_otp_codes ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.email_otp_codes TO service_role;