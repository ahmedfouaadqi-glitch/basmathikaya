DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid WHERE t.typname = 'order_status' AND e.enumlabel = 'pending_review') THEN
    ALTER TYPE public.order_status ADD VALUE 'pending_review';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid WHERE t.typname = 'order_status' AND e.enumlabel = 'rejected') THEN
    ALTER TYPE public.order_status ADD VALUE 'rejected';
  END IF;
END$$;