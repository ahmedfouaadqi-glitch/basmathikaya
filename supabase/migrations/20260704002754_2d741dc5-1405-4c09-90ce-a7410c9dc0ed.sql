CREATE TABLE public.admin_otp_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.admin_otp_codes TO service_role;

ALTER TABLE public.admin_otp_codes ENABLE ROW LEVEL SECURITY;

-- No policies: only service_role (which bypasses RLS) may access this table.

CREATE INDEX admin_otp_codes_phone_created_idx ON public.admin_otp_codes (phone, created_at DESC);
CREATE INDEX admin_otp_codes_ip_created_idx ON public.admin_otp_codes (ip, created_at DESC);

-- Also fix security finding: remove any authenticated-read policy on phone_bans.
DROP POLICY IF EXISTS "read phone_bans" ON public.phone_bans;
DROP POLICY IF EXISTS "Authenticated users can read phone_bans" ON public.phone_bans;
DROP POLICY IF EXISTS "phone_bans_authenticated_read" ON public.phone_bans;
