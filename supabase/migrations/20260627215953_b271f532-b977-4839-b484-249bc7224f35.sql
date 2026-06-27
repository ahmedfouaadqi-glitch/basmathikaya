
-- =========================
-- ENUMS
-- =========================
CREATE TYPE public.order_tier AS ENUM ('pdf', 'printed', 'video');
CREATE TYPE public.order_status AS ENUM ('pending', 'paid', 'delivered', 'cancelled');
CREATE TYPE public.event_status AS ENUM ('success', 'error');

-- =========================
-- characters
-- =========================
CREATE TABLE public.characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  age int NOT NULL CHECK (age BETWEEN 1 AND 120),
  mood text NOT NULL,
  image_path text,
  language text NOT NULL DEFAULT 'ar',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.characters TO service_role;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
-- No policies = fully locked. Only service_role (server code) can access.

-- =========================
-- orders
-- =========================
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number bigserial NOT NULL UNIQUE,
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  customer_phone text NOT NULL,
  tier public.order_tier,
  amount_iqd int NOT NULL DEFAULT 0,
  status public.order_status NOT NULL DEFAULT 'pending',
  whatsapp_sent_at timestamptz,
  paid_at timestamptz,
  delivered_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.orders TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.orders_order_number_seq TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- =========================
-- generations
-- =========================
CREATE TABLE public.generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  first_paragraph text,
  cover_image_path text,
  full_story text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.generations TO service_role;
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

-- =========================
-- generation_events (real-time cost tracking)
-- =========================
CREATE TABLE public.generation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  tier text,
  step text NOT NULL,
  provider text NOT NULL DEFAULT 'lovable-ai',
  model text NOT NULL,
  operation text NOT NULL,
  aig_log_id text,
  aig_run_id text,
  input_tokens int DEFAULT 0,
  output_tokens int DEFAULT 0,
  total_tokens int DEFAULT 0,
  image_count int DEFAULT 0,
  cost_credits numeric(14,6) DEFAULT 0,
  cost_usd numeric(14,6) DEFAULT 0,
  cost_iqd numeric(14,2) DEFAULT 0,
  status public.event_status NOT NULL DEFAULT 'success',
  error_message text,
  duration_ms int DEFAULT 0,
  reconciled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_generation_events_order ON public.generation_events(order_id);
CREATE INDEX idx_generation_events_log ON public.generation_events(aig_log_id);
GRANT ALL ON public.generation_events TO service_role;
ALTER TABLE public.generation_events ENABLE ROW LEVEL SECURITY;

-- =========================
-- pricing_settings (singleton row)
-- =========================
CREATE TABLE public.pricing_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  usd_per_credit numeric(10,6) NOT NULL DEFAULT 0.10,
  iqd_per_usd numeric(10,2) NOT NULL DEFAULT 1310,
  tier_pdf_iqd int NOT NULL DEFAULT 3000,
  tier_printed_iqd int NOT NULL DEFAULT 10000,
  tier_video_iqd int NOT NULL DEFAULT 25000,
  print_cost_iqd int NOT NULL DEFAULT 0,
  shipping_cost_iqd int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.pricing_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
GRANT ALL ON public.pricing_settings TO service_role;
ALTER TABLE public.pricing_settings ENABLE ROW LEVEL SECURITY;

-- =========================
-- updated_at trigger
-- =========================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_generations_updated BEFORE UPDATE ON public.generations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_pricing_updated BEFORE UPDATE ON public.pricing_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================
-- order_costs_v view (aggregated costs + profit per order)
-- =========================
CREATE OR REPLACE VIEW public.order_costs_v AS
SELECT
  o.id AS order_id,
  o.order_number,
  o.tier,
  o.status,
  o.amount_iqd AS revenue_iqd,
  COALESCE(SUM(e.total_tokens), 0)::int AS total_tokens,
  COALESCE(SUM(e.image_count), 0)::int AS images_generated,
  COALESCE(SUM(e.cost_credits), 0)::numeric(14,6) AS cost_credits,
  COALESCE(SUM(e.cost_usd), 0)::numeric(14,6) AS cost_usd,
  COALESCE(SUM(e.cost_iqd), 0)::numeric(14,2) AS cost_iqd,
  (o.amount_iqd
    - COALESCE(SUM(e.cost_iqd), 0)
    - CASE WHEN o.tier = 'printed' THEN (SELECT print_cost_iqd + shipping_cost_iqd FROM public.pricing_settings WHERE id = 1) ELSE 0 END
  )::numeric(14,2) AS gross_profit_iqd,
  CASE WHEN o.amount_iqd > 0 THEN
    ROUND(
      ((o.amount_iqd - COALESCE(SUM(e.cost_iqd), 0)) / o.amount_iqd::numeric) * 100,
      2
    )
  ELSE 0 END AS margin_pct,
  o.created_at
FROM public.orders o
LEFT JOIN public.generation_events e ON e.order_id = o.id
GROUP BY o.id;

GRANT SELECT ON public.order_costs_v TO service_role;

-- =========================
-- Realtime publication
-- =========================
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.generation_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.generations;
