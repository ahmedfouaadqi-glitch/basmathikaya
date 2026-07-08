# خطة تنفيذ المراحل المتبقية 3 → 8

Stage 2 اكتمل (Orchestrator موصول بـ QA خلف flag). التالي بدون توقف:

## Stage 3 — تقليل التكلفة (Cost)
- إضافة مكتبة `src/lib/ai/cache.server.ts`: قراءة/كتابة إلى جدولين جديدين `prompt_cache` و `character_analysis_cache` (يحتاج migration صغير) بمفتاح hash + TTL.
- ربط الكاش في `image-qa.server.ts` (نفس الصورة+DNA لا نعيد استدعاء)، وفي `story-qa.server.ts` (نفس المحتوى) — خلف flags `cache_image_qa` و `cache_story_qa` (افتراضياً OFF).
- Batch story generation: إضافة flag `batch_story_generation` — عند التفعيل تولّد `orders.functions.ts` القصة بنداء واحد لكل الصفحات بدل صفحة/صفحة (المسار الحالي محفوظ كما هو).
- Character Sheet once-per-order: التحقق من `orders.character_sheet_url`، إن وُجد يُعاد استخدامه في كل صور الطلب بدل توليده لكل صفحة.
- Lazy PDF: flag `lazy_pdf_generation` — تأجيل توليد PDF لأول تحميل بدل توليده مع كل طلب، وتخزينه في `story-pdfs`.

## Stage 4 — Background Jobs
- تحويل runners في `src/lib/jobs/runners.server.ts` إلى tasks حقيقية: `generate_share_cards`, `generate_pdf`, `send_notification` (المسارات الحالية تبقى للتوافق).
- ربط `pg_cron` (كل دقيقة) بـ `/api/public/hooks/jobs-tick` عبر `apikey` header (anon key) — migration منفصل بـ `supabase--insert` (لا يوضع في migration).
- Polling UI بسيط في صفحة الطلب: hook `useJobStatus(order_id)` يقرأ `background_jobs` كل 3s.

## Stage 5 — Family Library
- صفحة `/family` (محمية تحت `_authenticated`): CRUD + رفع صورة + عرض `times_used` + مفضلة/أرشيف.
- Dropdown "من عائلتي" في wizard إنشاء الطلب — قراءة `family_members` وحقن `family_member_id` في `order_characters` (nullable — لا يكسر السلوك الحالي).
- تحديث تلقائي لـ `times_used` و `last_used_at` عند اختيار عضو.

## Stage 6 — Social Sharing
- Job جديد `generate_share_cards` — يستخدم `satori` + `@resvg/resvg-wasm` لتوليد 4 مقاسات (1080×1080, 1080×1920, 1200×630, OG) وحفظها في `story-covers/share/{share_token}/`.
- Migration صغير: توليد `share_token` تلقائياً في trigger عند إتمام الطلب.
- مكوّن `<ShareSheet>` يقرأ من `share_platforms` (زر لكل منصة) + Web Share API fallback + نسخ رابط + تحميل.
- صفحة عامة `/s/$token` — SSR مع OG tags من `share_cards`، بدون أي بيانات حساسة.
- تسجيل كل مشاركة في `share_events`.

## Stage 7 — لوحة الإدارة المحسّنة
تحت `/admin/`:
- `ai-config` — قائمة النماذج لكل مهمة، سحب لإعادة الترتيب، toggle enabled، تعديل timeout/retries.
- `health` — بطاقات لكل نموذج مع circuit_state + failure rate + آخر 20 خطأ (auto-refresh 15s).
- `emergency` — 4 مفاتيح إيقاف + سبب + زر Bulk Restart (يصفّر consecutive_failures).
- `feature-flags` — toggle + rollout% + audience + user_ids list.
- `audit` — عارض `audit_log` بـ diff before/after.
- `jobs` — طابور `background_jobs` + retry.
- `costs` — تجميع من `ai_model_events` (يومي/شهري لكل نموذج).
- `family-library` — قراءة عامة للإحصائيات.
- `share-platforms` — CRUD لكتالوج المنصات.

كل صفحة تستخدم `requireAdminSession` + تسجّل تعديلاتها في `audit_log`.

## Stage 8 — التسويق والاحتفاظ
- Referral: جدول `referrals` (migration) + كود لكل مستخدم + مكافأة عند أول طلب مُحال.
- معرض قصص عامة: flag `public_gallery` + عمود `orders.is_public_opt_in` + صفحة `/gallery`.
- تذكير ذكرى سنوية: cron شهري يُنشئ notification للطلبات التي أتم عليها عام.
- علامة مائية PDF: للطلبات المجانية فقط، تُضاف في نفس PDF renderer.

## المبادئ الملتزم بها
- Backward Compatible 100% — كل ميزة خلف feature flag OFF افتراضياً.
- Fail-open — أي فشل يعود للمسار القديم.
- لا تغيير في: APIs، أسعار، منطق الدفع، صلاحيات، schema موجود (فقط nullable additions).
- كل migration جديد يحمل GRANTs + RLS.
- لا حذف بيانات.

## طريقة التنفيذ
سأنفّذ المراحل بالترتيب دفعة واحدة، وأتوقّف فقط إذا:
- ظهر خطأ يمنع الاستمرار.
- تجاوزت حجم آمن يستدعي جولة جديدة.

في نهاية كل مرحلة تقرير مختصر: ملفات + migrations + flags + إعدادات لوحة الإدارة.

## المخرج النهائي
- ~15-25 ملف جديد.
- 3-5 migrations صغيرة إضافية (share_token trigger, prompt_cache/character_analysis_cache, referrals).
- 1 pg_cron schedule (عبر `supabase--insert`).
- ~10 flags جديدة كلها OFF افتراضياً.
- 9 صفحات admin جديدة.

عند الموافقة أبدأ فوراً من Stage 3.
