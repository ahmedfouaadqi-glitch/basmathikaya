
# خطة موحدة: مشغّل موسيقى + أصوات واجهة + توليد فيديو (Beta) + تكلفة للأدمن

---

## الجزء الأول: مشغّل الموسيقى + أصوات الواجهة

### أ. جدول `audio_library` — يديره الأدمن
```
id | kind ('music' | 'sfx') | slot -- للـ sfx: click/success/error/notify/nav
| title_ar | file_path (storage) | duration_sec | volume_default (0-1)
| is_active | display_order | created_at | updated_at
```
- Storage bucket جديد: `audio-library` (public read).
- GRANT: `SELECT` لـ `anon` + `authenticated`، كتابة للأدمن فقط.

### ب. `audio_settings` (feature flags)
- `music_player_enabled` (bool, default true)
- `ui_sfx_enabled` (bool, default true)
- `music_source` ('library' | 'promo_video_audio', default 'library')

### ج. الخادم
- `src/lib/audio.functions.ts`:
  - `listActiveMusic()` — قائمة عامة (anon).
  - `listActiveSfx()` — قائمة عامة، تُخزّن في localStorage بعد أول جلب.
- `src/lib/audio-admin.functions.ts`:
  - `crudAudioItem(...)` — رفع/حذف/تفعيل، مع رفع الملف إلى Storage.
  - `reorderAudio(...)`.

### د. الواجهة
- **`src/components/MiniMusicPlayer.tsx`**:
  - عائم في زاوية أسفل يمين كل الصفحات (behind sonner toaster).
  - أيقونة موسيقى → يفتح لوحة صغيرة (Play/Pause، Next/Prev، Volume، اسم المقطع).
  - **مكتوم افتراضياً**؛ يحفظ التفضيل في `localStorage['bh_music']`.
  - إذا `music_source='promo_video_audio'` → يعيد استخدام مسارات `brandIntroVideos` كصوت.
- **`src/lib/sfx.ts`** (مكتبة عميل خفيفة):
  - `preloadSfx()` عند البدء.
  - `playSfx(slot)` — يشغّل الصوت المناسب، محكوم بـ `bh_sfx_muted` في localStorage.
  - Hook `useSfxOnClick()` يُلحق تلقائياً بأزرار `data-sfx` أو تُستدعى يدوياً.
- **إدماج نقاط الأصوات**:
  - `click` — أزرار CTA رئيسية (create, submit, publish).
  - `success` — Toast success + إتمام طلب.
  - `error` — Toast error + رفض طلب.
  - `notify` — عند وصول إشعار جديد.
  - `nav` — التنقّل بين الصفحات (اختياري، خفيف).
- **زر Mute موحّد** في الهيدر بجانب أيقونة المستخدم.

### هـ. الأدمن
- **`/admin/audio`** — صفحة واحدة:
  - تبويب "موسيقى الخلفية" — رفع MP3، عنوان، ترتيب، مدة، تفعيل.
  - تبويب "أصوات الواجهة" — 5 خانات ثابتة (click/success/error/notify/nav)، رفع/استبدال.
  - تبويب "الإعدادات" — تبديل `music_source`، تفعيل/تعطيل الميزة كاملة.
- إضافة الرابط في `src/routes/admin.tsx`.

---

## الجزء الثاني: نظام توليد الفيديوهات (Beta) + عرض التكلفة للأدمن

### 1) قاعدة البيانات

#### `video_products` — أنواع الفيديو (يديره الأدمن)
```
id | slug | name_ar | description_ar
| duration_sec | segments_count | resolution
| includes_tts | includes_music
| price_iqd | price_credits_estimate | is_active | display_order
```
يُبذر بستة أنواع: Teaser 10s، Story Reel 30s، Cartoon 60s، Anime 60s، Manga 60s، Music Video 45s.

#### `video_orders`
```
id | order_number | user_id | source_order_id (FK → orders, اختياري)
| product_id | status
  ('pending_review','approved','rejected','generating','ready','delivered','failed')
| storyboard_json | prompt_config_json | segments_json
| final_playlist_path | preview_thumb_path | duration_sec_actual
| price_iqd_paid
| ai_credits_used  -- إجمالي الكريدت المستهلك (يظهر للأدمن)
| ai_cost_breakdown_json  -- تفصيل الكلفة لكل مقطع/tts/music
| admin_note | rejection_reason | reviewed_by | reviewed_at
| is_public | public_title | show_author | public_author_name
| created_at | updated_at
```

#### `video_daily_stats`
```
day | videos_generated | credits_used | cost_estimate_iqd
```

- RLS: `video_orders` مقيّد بـ `auth.uid() = user_id` + سياسة أدمن عبر `has_role`.
- `video_products` قراءة عامة، كتابة أدمن.
- بذر `feature_flags`: `video_generation_enabled=false`, `video_daily_cap=20`.

### 2) توليد الصوت والموسيقى للفيديو
- **TTS للراوي**: `openai/gpt-4o-mini-tts` عبر Lovable AI Gateway.
- **موسيقى خلفية**: عبر **ElevenLabs Music** (`standard_connectors--connect elevenlabs`) بمقدار 30-60 ثانية حسب طول الفيديو.
- **مؤثرات صوتية اختيارية للفيديو**: ElevenLabs Sound Effects.

### 3) توليد الفيديو
- `videogen` (Lovable) لكل مشهد: 5-10 ثوانٍ، بـ `starting_frame` = صورة صفحة القصة، مع تثبيت `art_style_lock` من نمط القصة.
- **قيد Cloudflare Workers**: لا `ffmpeg` — نُخزّن المقاطع منفصلة + track صوتي + subtitles JSON، ويعرضها **مشغّل مخصص** (`VideoPlayer.tsx`) كـ playlist متتابعة.

### 4) الخادم
- `src/lib/videos.functions.ts` (المستخدم):
  - `listVideoProducts()`, `createVideoOrder(...)`, `getMyVideoOrders()`, `getVideoOrder(id)`, `publishVideoToGallery(...)`.
  - تحقق العلم + السقف اليومي + ملكية `source_order_id` + حالته `delivered`.
- `src/lib/videos-admin.functions.ts` (أدمن):
  - `listAllVideoOrders(filter)`, `reviewVideoOrder({id, action, note})`, `crudVideoProduct(...)`, `getVideoStats(range)`, `adminRetryVideoGeneration(id)`.
- `src/lib/videos/generator.server.ts` (خلفي):
  - `buildStoryboard(orderPages)` — مشهد لكل صفحة.
  - `generateVideoForOrder(id)` — يستدعي `videogen` + TTS + ElevenLabs Music، يجمّع playlist، يحدّث `ai_credits_used` و `ai_cost_breakdown_json`، يحدّث الحالة، يرسل إشعاراً.
- تعديل `src/lib/jobs/runners.server.ts` لإضافة runner `video_generation`.

### 5) الواجهة — المستخدم
- **`/videos`** — كتالوج الأنواع الستة.
- **`/videos/order/$sourceOrderId`** — نموذج طلب فيديو من قصة مُسلَّمة (عرض storyboard مقترح + تأكيد).
- **`/videos/my`** — طلباتي، مع الحالة.
- **`/videos/watch/$id`** — المشغّل (مالك الطلب فقط).
- **`/v/$token`** — صفحة المشاركة العامة (بعد النشر).
- تحديث `/my-orders` — زر "🎬 حوّلها إلى فيديو".
- تحديث `/gallery` — تبويب "فيديوهات".

### 6) الواجهة — الأدمن (مع عرض التكلفة)
- **`/admin/videos`** — قائمة الطلبات مع أعمدة:
  - رقم الطلب، المستخدم، النوع، الحالة، **`ai_credits_used`**، **الكلفة التقديرية بالدينار**، **السعر المدفوع**، **الهامش الصافي**.
  - أزرار: معاينة storyboard، موافقة/رفض، مشاهدة الفيديو النهائي، إعادة توليد.
- **`/admin/video-products`** — CRUD للأنواع والأسعار.
- **`/admin/video-stats`** — لوحة إحصائيات:
  - إجمالي الكريدت اليومي/الأسبوعي/الشهري.
  - الكلفة الإجمالية بالدينار.
  - إيرادات vs كلفة (الهامش الصافي).
  - عدد الطلبات بحالة (pending/generating/ready).
  - رسم بياني بالاستخدام اليومي vs السقف.

### 7) عرض التكلفة للأدمن على القصص أيضاً
- تحديث جدول `orders`: إضافة عمود `ai_credits_used` + `ai_cost_breakdown_json` (لو غير موجود).
- تحديث `runImageGenerationForOrder` و `runStoryGeneration` لتراكم استهلاك الكريدت.
- تحديث `/admin/orders.$id` لعرض:
  - كلفة توليد النص + عدد الصور × كلفتها + إجمالي.
  - السعر المدفوع.
  - الهامش الصافي.
- تحديث `/admin/analytics` لعرض الهامش الإجمالي.

### 8) الحماية
- علم kill switch (`video_generation_enabled`).
- سقف يومي عام يُفحص في `createVideoOrder` وفي الـ runner.
- **موافقة الأدمن إلزامية** قبل استهلاك أي كريدت.
- رفض تلقائي + استرداد إن فشل التوليد 3 مرات.
- `audit_log` لكل create/approve/reject/generate/publish.
- معالجة خطأ 402 → إيقاف الميزة + إشعار أدمن.

---

## الملفات (تلخيص)

**Migrations:**
1. `audio_library` + storage bucket + GRANTs + policies + feature flags.
2. `video_products` + `video_orders` + `video_daily_stats` + GRANTs + policies + بذر + إضافة `ai_credits_used`/`ai_cost_breakdown_json` لجدول `orders`.

**جديد:**
- `src/components/MiniMusicPlayer.tsx`, `src/components/VideoPlayer.tsx`, `src/components/SfxProvider.tsx`
- `src/lib/sfx.ts`
- `src/lib/audio.functions.ts`, `src/lib/audio-admin.functions.ts`
- `src/lib/videos.functions.ts`, `src/lib/videos-admin.functions.ts`
- `src/lib/videos/generator.server.ts`, `src/lib/videos/storyboard.ts`, `src/lib/videos/playlist.ts`
- `src/lib/elevenlabs.server.ts` (بعد ربط الموصل)
- `src/routes/videos.tsx`, `videos.order.$sourceOrderId.tsx`, `videos.my.tsx`, `videos.watch.$id.tsx`, `v.$token.tsx`
- `src/routes/admin.audio.tsx`, `admin.videos.tsx` (استبدال الفارغ)، `admin.video-products.tsx`, `admin.video-stats.tsx`

**تعديل:**
- `src/routes/__root.tsx` (إدماج `MiniMusicPlayer` + `SfxProvider` + زر mute في الهيدر)
- `src/routes/admin.tsx` (روابط: صوت، فيديوهات، أنواع فيديو، إحصائيات فيديو)
- `src/routes/my-orders.tsx` (زر التحويل إلى فيديو)
- `src/routes/gallery.tsx` (تبويب فيديوهات)
- `src/routes/admin.orders.$id.tsx` (عرض الكلفة والهامش)
- `src/routes/admin.analytics.tsx` (الهامش الإجمالي)
- `src/lib/jobs/runners.server.ts` (runner + تراكم الكريدت)
- `src/lib/ai/orchestrator.server.ts` (إرجاع credits_used مع كل استدعاء)

---

## قبل الموافقة — خطوات إعداد ستُطلب منك بعد الموافقة
1. ربط موصل **ElevenLabs** (لإنتاج الموسيقى الأصلية للفيديو) — سأطلب الموافقة ثم أستدعي `standard_connectors--connect`.
2. رفع ملفات صوتية بدائية للأصوات الأربعة (click/success/error/notify) — أو سأولّدها عبر ElevenLabs SFX عند التنفيذ.

## ترتيب التنفيذ المقترح
- **Sprint A**: مشغّل الموسيقى + أصوات الواجهة + `/admin/audio` (سريع، أثر مباشر).
- **Sprint B**: عرض تكلفة القصص للأدمن + الهامش الصافي.
- **Sprint C**: نظام الفيديو الكامل (Beta، مطفأ افتراضياً).

هل أبدأ بالسبرنت A، أم تريدني أُنفّذ الثلاثة تباعاً في هذه الجلسة؟
