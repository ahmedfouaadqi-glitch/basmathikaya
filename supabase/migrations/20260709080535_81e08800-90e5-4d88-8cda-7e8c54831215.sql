
CREATE TABLE public.audio_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('music', 'sfx')),
  slot TEXT,
  title_ar TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT DEFAULT 'audio/mpeg',
  duration_sec NUMERIC(6,2),
  volume_default NUMERIC(3,2) NOT NULL DEFAULT 0.6 CHECK (volume_default >= 0 AND volume_default <= 1),
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sfx_needs_slot CHECK (kind <> 'sfx' OR slot IS NOT NULL)
);

CREATE INDEX audio_library_kind_active_idx ON public.audio_library (kind, is_active, display_order);
CREATE UNIQUE INDEX audio_library_sfx_slot_unique ON public.audio_library (slot) WHERE kind = 'sfx' AND is_active = true;

GRANT SELECT ON public.audio_library TO anon;
GRANT SELECT ON public.audio_library TO authenticated;
GRANT ALL ON public.audio_library TO service_role;

ALTER TABLE public.audio_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audio_library_public_read_active"
  ON public.audio_library FOR SELECT
  USING (is_active = true);

CREATE TRIGGER audio_library_touch_updated_at
  BEFORE UPDATE ON public.audio_library
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.feature_flags (key, enabled, description)
VALUES
  ('music_player_enabled', true, 'تفعيل مشغّل الموسيقى العائم في الموقع'),
  ('ui_sfx_enabled', true, 'تفعيل أصوات الواجهة (نقر، نجاح، خطأ، إشعار)'),
  ('music_source_promo_video', false, 'استخدام صوت فيديو الترويسة بدلاً من مكتبة الموسيقى')
ON CONFLICT (key) DO NOTHING;
