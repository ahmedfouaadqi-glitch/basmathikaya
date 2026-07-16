CREATE TABLE public.admin_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  ip text,
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_login_attempts_phone_idx ON public.admin_login_attempts (phone, created_at DESC);
CREATE INDEX admin_login_attempts_ip_idx ON public.admin_login_attempts (ip, created_at DESC);
GRANT ALL ON public.admin_login_attempts TO service_role;
ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;