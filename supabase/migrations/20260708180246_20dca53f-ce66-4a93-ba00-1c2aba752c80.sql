ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS show_author boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_author_name text;