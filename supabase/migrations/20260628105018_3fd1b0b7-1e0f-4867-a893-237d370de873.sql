
-- ============ USERS ============
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text NOT NULL UNIQUE,
  marketing_consent boolean NOT NULL DEFAULT true,
  notes text,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.users TO service_role;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
-- No public policies: all access goes through server functions with admin client.
CREATE TRIGGER tr_users_updated BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ OTP CODES ============
CREATE TABLE public.otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_otp_phone ON public.otp_codes(phone, created_at DESC);
GRANT ALL ON public.otp_codes TO service_role;
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- ============ ORDER CHARACTERS (multi-character per order) ============
CREATE TABLE public.order_characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  name text NOT NULL,
  age int,
  role text NOT NULL DEFAULT 'protagonist',
  description text,
  is_primary boolean NOT NULL DEFAULT false,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_characters_order ON public.order_characters(order_id);
GRANT ALL ON public.order_characters TO service_role;
ALTER TABLE public.order_characters ENABLE ROW LEVEL SECURITY;

-- ============ ORDERS additive columns ============
ALTER TABLE public.orders
  ADD COLUMN user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN moods text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN custom_instructions text,
  ADD COLUMN payment_confirmed_at timestamptz,
  ADD COLUMN images_status text NOT NULL DEFAULT 'idle' CHECK (images_status IN ('idle','generating','ready','failed')),
  ADD COLUMN images_error text;

-- Make legacy character_id nullable so new orders can rely on order_characters only.
ALTER TABLE public.orders ALTER COLUMN character_id DROP NOT NULL;

CREATE INDEX idx_orders_user ON public.orders(user_id);

-- ============ PRICING: per-character costs ============
ALTER TABLE public.pricing_settings
  ADD COLUMN per_character_iqd_pdf int NOT NULL DEFAULT 1500,
  ADD COLUMN per_character_iqd_printed int NOT NULL DEFAULT 3000,
  ADD COLUMN per_character_iqd_video int NOT NULL DEFAULT 6000,
  ADD COLUMN max_characters int NOT NULL DEFAULT 5;
