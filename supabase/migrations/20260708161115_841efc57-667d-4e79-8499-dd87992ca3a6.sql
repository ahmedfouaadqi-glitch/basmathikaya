-- ============================================================
-- Stage 0: Infrastructure migration for Basmat Hekaya (fixed)
-- ============================================================

-- 1) ai_models_config
CREATE TABLE public.ai_models_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_type TEXT NOT NULL,
  model_id TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  enabled BOOLEAN NOT NULL DEFAULT true,
  timeout_ms INTEGER NOT NULL DEFAULT 60000,
  max_retries INTEGER NOT NULL DEFAULT 2,
  backoff_base_ms INTEGER NOT NULL DEFAULT 500,
  temperature NUMERIC,
  top_p NUMERIC,
  top_k INTEGER,
  max_tokens INTEGER,
  safety_level TEXT,
  prompt_version TEXT NOT NULL DEFAULT 'v1',
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT,
  UNIQUE (task_type, model_id)
);
GRANT ALL ON public.ai_models_config TO service_role;
ALTER TABLE public.ai_models_config ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_ai_models_config_task ON public.ai_models_config(task_type, priority) WHERE enabled = true;
CREATE TRIGGER tr_ai_models_config_updated BEFORE UPDATE ON public.ai_models_config
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) ai_model_events
CREATE TABLE public.ai_model_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_type TEXT NOT NULL,
  model_id TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT,
  latency_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd NUMERIC(12,6),
  order_id UUID,
  user_id UUID,
  prompt_version TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.ai_model_events TO service_role;
ALTER TABLE public.ai_model_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_ai_events_task_created ON public.ai_model_events(task_type, created_at DESC);
CREATE INDEX idx_ai_events_model_status ON public.ai_model_events(model_id, status, created_at DESC);
CREATE INDEX idx_ai_events_order ON public.ai_model_events(order_id) WHERE order_id IS NOT NULL;

-- 3) ai_model_health
CREATE TABLE public.ai_model_health (
  task_type TEXT NOT NULL,
  model_id TEXT NOT NULL,
  is_healthy BOOLEAN NOT NULL DEFAULT true,
  circuit_state TEXT NOT NULL DEFAULT 'closed',
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  failure_rate_1h NUMERIC(5,4) NOT NULL DEFAULT 0,
  avg_latency_1h_ms INTEGER,
  opened_at TIMESTAMPTZ,
  next_probe_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_type, model_id)
);
GRANT ALL ON public.ai_model_health TO service_role;
ALTER TABLE public.ai_model_health ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER tr_ai_model_health_updated BEFORE UPDATE ON public.ai_model_health
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4) feature_flags
CREATE TABLE public.feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  rollout_percent INTEGER NOT NULL DEFAULT 0 CHECK (rollout_percent BETWEEN 0 AND 100),
  audience TEXT NOT NULL DEFAULT 'all',
  user_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  description TEXT,
  notes TEXT,
  owner TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.feature_flags TO service_role;
GRANT SELECT ON public.feature_flags TO anon, authenticated;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feature_flags public read" ON public.feature_flags FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER tr_feature_flags_updated BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5) emergency_controls (single row)
CREATE TABLE public.emergency_controls (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  ai_all_paused BOOLEAN NOT NULL DEFAULT false,
  ai_image_paused BOOLEAN NOT NULL DEFAULT false,
  ai_text_paused BOOLEAN NOT NULL DEFAULT false,
  qa_paused BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  paused_by TEXT,
  paused_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.emergency_controls TO service_role;
ALTER TABLE public.emergency_controls ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER tr_emergency_controls_updated BEFORE UPDATE ON public.emergency_controls
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
INSERT INTO public.emergency_controls (id) VALUES (true) ON CONFLICT DO NOTHING;

-- 6) audit_log
CREATE TABLE public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_type TEXT NOT NULL DEFAULT 'admin',
  actor_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  before JSONB,
  after JSONB,
  diff JSONB,
  ip TEXT,
  user_agent TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_audit_log_created ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_log_target ON public.audit_log(target_type, target_id);
CREATE INDEX idx_audit_log_action ON public.audit_log(action);

-- 7) rate_limits
CREATE TABLE public.rate_limits (
  bucket TEXT NOT NULL,
  identifier TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket, identifier, window_start)
);
GRANT ALL ON public.rate_limits TO service_role;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_rate_limits_cleanup ON public.rate_limits(window_start);

-- 8) download_events
CREATE TABLE public.download_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID,
  ip TEXT,
  user_agent TEXT,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.download_events TO service_role;
ALTER TABLE public.download_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_download_events_order ON public.download_events(order_id, created_at DESC);

-- 9) business_config
CREATE TABLE public.business_config (
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT,
  PRIMARY KEY (category, key)
);
GRANT ALL ON public.business_config TO service_role;
GRANT SELECT ON public.business_config TO anon, authenticated;
ALTER TABLE public.business_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "business_config public read" ON public.business_config FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER tr_business_config_updated BEFORE UPDATE ON public.business_config
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 10) background_jobs
CREATE TABLE public.background_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 100,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  last_error TEXT,
  order_id UUID,
  user_id UUID,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.background_jobs TO service_role;
ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_jobs_pending ON public.background_jobs(status, priority, next_run_at) WHERE status = 'pending';
CREATE INDEX idx_jobs_order ON public.background_jobs(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_jobs_kind_created ON public.background_jobs(kind, created_at DESC);
CREATE TRIGGER tr_background_jobs_updated BEFORE UPDATE ON public.background_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 11) share_platforms
CREATE TABLE public.share_platforms (
  key TEXT PRIMARY KEY,
  label_ar TEXT NOT NULL,
  label_en TEXT NOT NULL,
  icon TEXT,
  url_template TEXT,
  needs_download BOOLEAN NOT NULL DEFAULT false,
  card_type TEXT NOT NULL DEFAULT 'landscape',
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 100,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.share_platforms TO service_role;
GRANT SELECT ON public.share_platforms TO anon, authenticated;
ALTER TABLE public.share_platforms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "share_platforms public read" ON public.share_platforms
  FOR SELECT TO anon, authenticated USING (enabled = true);
CREATE TRIGGER tr_share_platforms_updated BEFORE UPDATE ON public.share_platforms
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 12) share_cards
CREATE TABLE public.share_cards (
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  card_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (order_id, card_type)
);
GRANT ALL ON public.share_cards TO service_role;
ALTER TABLE public.share_cards ENABLE ROW LEVEL SECURITY;

-- 13) share_events
CREATE TABLE public.share_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  user_id UUID,
  share_token TEXT,
  platform_key TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.share_events TO service_role;
GRANT INSERT ON public.share_events TO anon, authenticated;
ALTER TABLE public.share_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "share_events insert" ON public.share_events
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE INDEX idx_share_events_order ON public.share_events(order_id, created_at DESC);
CREATE INDEX idx_share_events_platform ON public.share_events(platform_key, created_at DESC);

-- 14) family_members
CREATE TABLE public.family_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'other',
  display_name TEXT NOT NULL,
  nickname TEXT,
  age INTEGER,
  gender TEXT,
  character_dna JSONB,
  character_sheet_url TEXT,
  source_photo_path TEXT,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  times_used INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_members TO authenticated;
GRANT ALL ON public.family_members TO service_role;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_family_members_user ON public.family_members(user_id, is_archived, is_favorite);
CREATE POLICY "family own read" ON public.family_members
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "family own insert" ON public.family_members
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "family own update" ON public.family_members
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "family own delete" ON public.family_members
  FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER tr_family_members_updated BEFORE UPDATE ON public.family_members
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 15) orders additive columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS pdf_generation_status TEXT,
  ADD COLUMN IF NOT EXISTS batch_meta JSONB;

ALTER TABLE public.order_characters
  ADD COLUMN IF NOT EXISTS family_member_id UUID;

-- 16) performance indexes
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON public.orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_events_order_created ON public.generation_events(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coupons_active_valid_to ON public.coupons(active, valid_to);

-- 17) Seed feature flags
INSERT INTO public.feature_flags (key, enabled, description) VALUES
  ('character_sheet', false, 'توليد Character Sheet HQ وإعادة استخدامه'),
  ('story_qa', false, 'فحص جودة القصة قبل التوليد النهائي'),
  ('image_qa', false, 'فحص جودة الصور قبل التسليم'),
  ('batch_generation', false, 'توليد القصة بنداء دفعة واحدة'),
  ('polish_pass', false, 'تمرير Polish للاحترافي'),
  ('prompt_cache', false, 'تخزين مؤقت لنتائج البرومبت'),
  ('character_analysis_cache', false, 'تخزين مؤقت لتحليل الصورة'),
  ('lazy_pdf', false, 'توليد PDF عند الطلب فقط'),
  ('family_library', false, 'مكتبة العائلة'),
  ('share_system', false, 'نظام المشاركة الاحترافي'),
  ('referral', false, 'نظام الإحالة'),
  ('gallery', false, 'المعرض العام'),
  ('anniversary_reminder', false, 'تذكيرات الذكرى'),
  ('notifications', false, 'مركز الإشعارات'),
  ('seasonal_templates', false, 'قوالب موسمية'),
  ('background_jobs', false, 'تنفيذ العمليات كمهام خلفية')
ON CONFLICT (key) DO NOTHING;

-- 18) Seed share_platforms
INSERT INTO public.share_platforms (key, label_ar, label_en, icon, url_template, needs_download, card_type, sort_order) VALUES
  ('whatsapp', 'واتساب', 'WhatsApp', 'message-circle', 'https://wa.me/?text={TEXT}%20{URL}', false, 'landscape', 10),
  ('facebook', 'فيسبوك', 'Facebook', 'facebook', 'https://www.facebook.com/sharer/sharer.php?u={URL}', false, 'landscape', 20),
  ('messenger', 'ماسنجر', 'Messenger', 'send', 'fb-messenger://share/?link={URL}', false, 'landscape', 30),
  ('x', 'إكس', 'X', 'twitter', 'https://twitter.com/intent/tweet?text={TEXT}&url={URL}', false, 'landscape', 40),
  ('telegram', 'تلغرام', 'Telegram', 'send', 'https://t.me/share/url?url={URL}&text={TEXT}', false, 'landscape', 50),
  ('linkedin', 'لينكدإن', 'LinkedIn', 'linkedin', 'https://www.linkedin.com/sharing/share-offsite/?url={URL}', false, 'landscape', 60),
  ('instagram', 'إنستغرام', 'Instagram', 'instagram', NULL, true, 'story', 70),
  ('tiktok', 'تيك توك', 'TikTok', 'video', NULL, true, 'story', 80),
  ('snapchat', 'سناب شات', 'Snapchat', 'ghost', NULL, true, 'story', 90),
  ('copy_link', 'نسخ الرابط', 'Copy link', 'link', NULL, false, 'landscape', 200),
  ('download', 'تحميل الصورة', 'Download image', 'download', NULL, true, 'square', 210)
ON CONFLICT (key) DO NOTHING;

-- 19) Seed business_config
INSERT INTO public.business_config (category, key, value, description) VALUES
  ('pdf', 'watermark_enabled', 'false'::jsonb, 'تفعيل العلامة المائية'),
  ('pdf', 'watermark_text', '"بصمة حكاية"'::jsonb, 'نص العلامة المائية'),
  ('upload_limits', 'max_photo_mb', '8'::jsonb, 'الحد الأقصى لحجم الصورة'),
  ('upload_limits', 'allowed_mime', '["image/jpeg","image/png","image/webp"]'::jsonb, 'أنواع الصور المسموحة'),
  ('link_expiry', 'signed_url_hours', '24'::jsonb, 'مدة صلاحية الروابط الموقّعة'),
  ('link_expiry', 'share_token_days', '365'::jsonb, 'مدة صلاحية رابط المشاركة'),
  ('ai', 'max_daily_cost_usd', '50'::jsonb, 'الحد الأقصى للتكلفة اليومية'),
  ('ai', 'auto_pause_on_cap', 'true'::jsonb, 'إيقاف الذكاء الاصطناعي عند تجاوز الحد'),
  ('share', 'default_caption_ar', '"شاهد القصة التي أنشأتها لطفلي على بصمة حكاية 💫"'::jsonb, 'النص الافتراضي للمشاركة'),
  ('notifications', 'whatsapp_enabled', 'true'::jsonb, 'إشعارات واتساب'),
  ('storage', 'cleanup_drafts_days', '30'::jsonb, 'حذف المسودات بعد كذا يوم'),
  ('backup', 'daily_snapshot_enabled', 'false'::jsonb, 'نسخة احتياطية يومية'),
  ('system', 'maintenance_mode', 'false'::jsonb, 'وضع الصيانة'),
  ('system', 'maintenance_message_ar', '""'::jsonb, 'رسالة الصيانة')
ON CONFLICT (category, key) DO NOTHING;

-- 20) Seed ai_models_config
INSERT INTO public.ai_models_config (task_type, model_id, priority, enabled, timeout_ms, max_retries, temperature, prompt_version, notes) VALUES
  ('story', 'google/gemini-3.5-flash', 10, true, 90000, 2, 0.8, 'v1', 'Primary'),
  ('story', 'google/gemini-2.5-flash', 20, true, 90000, 2, 0.8, 'v1', 'Fallback'),
  ('story', 'google/gemini-2.5-pro', 30, true, 120000, 1, 0.8, 'v1', 'Last resort'),
  ('polish', 'google/gemini-2.5-flash', 10, true, 60000, 2, 0.6, 'v1', 'Polish'),
  ('polish', 'google/gemini-3.5-flash', 20, true, 60000, 2, 0.6, 'v1', 'Fallback'),
  ('image_analysis', 'google/gemini-2.5-flash', 10, true, 45000, 2, 0.2, 'v1', 'Analyze'),
  ('image_analysis', 'google/gemini-3.5-flash', 20, true, 45000, 2, 0.2, 'v1', 'Fallback'),
  ('image_gen', 'google/gemini-3.1-flash-image', 10, true, 90000, 1, NULL, 'v1', 'Nano Banana 2'),
  ('image_gen', 'google/gemini-2.5-flash-image', 20, true, 90000, 1, NULL, 'v1', 'Fallback'),
  ('image_gen', 'google/gemini-3-pro-image', 30, true, 120000, 1, NULL, 'v1', 'HQ'),
  ('image_gen_cover', 'google/gemini-3-pro-image', 10, true, 120000, 1, NULL, 'v1', 'HQ cover'),
  ('image_gen_cover', 'google/gemini-3.1-flash-image', 20, true, 90000, 1, NULL, 'v1', 'Fallback'),
  ('character_sheet', 'google/gemini-3-pro-image', 10, true, 120000, 1, NULL, 'v1', 'HQ sheet'),
  ('character_sheet', 'google/gemini-3.1-flash-image', 20, true, 90000, 1, NULL, 'v1', 'Fallback'),
  ('story_qa', 'google/gemini-2.5-flash', 10, true, 60000, 1, 0.2, 'v1', 'QA'),
  ('story_qa', 'google/gemini-3.5-flash', 20, true, 60000, 1, 0.2, 'v1', 'Fallback'),
  ('image_qa', 'google/gemini-2.5-flash', 10, true, 45000, 1, 0.2, 'v1', 'QA'),
  ('image_qa', 'google/gemini-3.5-flash', 20, true, 45000, 1, 0.2, 'v1', 'Fallback')
ON CONFLICT (task_type, model_id) DO NOTHING;

-- 21) Seed ai_model_health rows
INSERT INTO public.ai_model_health (task_type, model_id)
SELECT task_type, model_id FROM public.ai_models_config
ON CONFLICT (task_type, model_id) DO NOTHING;