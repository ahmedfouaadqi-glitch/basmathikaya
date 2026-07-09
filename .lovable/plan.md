## المتابعة: Sprint B ثم Sprint C

بعد إنجاز Sprint A (الموسيقى وأصوات الواجهة)، أُكمل بالسبرنت B ثم C.

---

### Sprint B — عرض التكلفة والهامش للأدمن

الهدف: يرى الأدمن كم كلّف كل طلب (نص + صور) بالاعتماد الفعلي وبالدينار، ويحسب هامش الربح.

1. **Migration** — إضافة أعمدة تكلفة على `orders`:
   - `ai_credits_text` numeric — اعتمادات توليد النص.
   - `ai_credits_images` numeric — اعتمادات توليد الصور.
   - `ai_credits_total` — عمود محسوب (generated).
   - `ai_cost_iqd` numeric — التكلفة بالدينار (محسوبة من `pricing_settings.credit_to_iqd_rate`).

2. **تجميع التكلفة**:
   - تعديل `runTextGenerationForOrder` و `runImageGenerationForOrder` (في `src/lib/orders.functions.ts` / الملف الذي يستدعي AI Gateway) لقراءة `x-ratelimit-*` من الاستجابة أو `usage.total_credits`، وحفظها بشكل تراكمي.
   - نفس الشيء لأي `runVideoGenerationForOrder` قادم.

3. **إعداد سعر الاعتماد**:
   - إضافة `credit_to_iqd_rate` في `pricing_settings` (افتراضي مثلاً 200 د.ع/اعتماد قابل للتعديل).
   - صفحة `/admin/settings` تعرض الحقل.

4. **واجهة الأدمن**:
   - في `src/routes/admin.orders.$id.tsx` بلوك جديد "التكلفة والهامش" يعرض: اعتمادات النص، اعتمادات الصور، التكلفة بالدينار، سعر البيع، الهامش الصافي والنسبة.
   - في قائمة الطلبات `/admin/orders` عمود مختصر "تكلفة/ربح".

---

### Sprint C — نظام توليد الفيديو Beta (مع مراجعة أدمن وسقوف)

الهدف: كتالوج فيديوهات (6 أنواع)، طلب من قصة سابقة، مراجعة storyboard قبل التوليد، سقف يومي، ومشغّل خاص + مشاركة.

1. **Migration** — 3 جداول:
   - `video_products` (المنتجات الستة: teaser, story_reel, cartoon, anime, manga, music_video) — السعر، المدة، الحالة enabled، الأعمدة اللازمة لعرضها.
   - `video_orders` — user_id، story_order_id (مرجع للطلب الأصلي)، product_id، status (pending_review / approved / generating / ready / rejected / failed)، storyboard jsonb، segments jsonb، final_url، duration_sec، ai_credits_used، ai_cost_iqd، price_iqd، is_public، share_token.
   - `video_daily_stats` — التاريخ + العدّاد لسقف يومي عام.

2. **دوال الخادم** في `src/lib/videos.functions.ts` و `videos-admin.functions.ts`:
   - `listVideoProducts` / `createVideoOrder` / `getMyVideos` / `getVideo` — للمستخدم.
   - `adminListVideoOrders` / `adminApproveVideo` (يبدأ التوليد الفعلي بالخلفية) / `adminRejectVideo`.
   - Background job في `background_jobs` نوع `video_generation` يستخدم `videogen` + `openai/gpt-4o-mini-tts` + ElevenLabs Music.
   - فحص سقف يومي قبل الموافقة (يرفض إذا تجاوز).

3. **صفحات المستخدم**:
   - `/videos` — كتالوج الأنواع مع الأسعار.
   - `/videos/new?from=ORDER_ID` — نموذج طلب مربوط بقصة سابقة.
   - `/my-videos` — قائمة فيديوهاتي.
   - `/my-videos/$id` — مشغّل + زر نشر بالمعرض.
   - `/v/$token` — صفحة مشاركة عامة (بعد النشر فقط).

4. **صفحات الأدمن**:
   - `/admin/videos` (موجودة سابقاً كـ placeholder) → قائمة الطلبات المعلّقة + معاينة storyboard + موافقة/رفض.
   - `/admin/video-products` — إدارة المنتجات الستة (سعر، تفعيل، سقف يومي).
   - عرض `ai_credits_used` وتكلفة الدينار لكل فيديو.

5. **علم الميزة**: `video_generation_enabled` (افتراضياً off) وسقف يومي عام.

---

### ترتيب الاعتماد

أنفّذ بالترتيب: Migration Sprint B → أكواد التتبع والواجهة → Migration Sprint C → دوال الفيديو → صفحات المستخدم → صفحات الأدمن.

هل أبدأ التنفيذ؟