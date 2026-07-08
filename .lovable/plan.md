# خطة المتابعة — المراحل 2 إلى 8

Stage 0 و Stage 1 (البنية التحتية + مكتبات السيرفر) اكتملا. التالي:

## Stage 2 — الأمان (P0)
- ربط `orchestrator` بمسارات AI الحالية (`story-qa`, `image-qa`, `orders.functions.ts`, توليد القصة، تحليل الصور) مع الإبقاء على المسار القديم كـ fallback خلف feature flag `use_orchestrator`.
- تفعيل `rate-limit.server.ts` على: توليد القصة (3/يوم/طلب)، QA (10/ساعة/جلسة)، تسجيل الدخول، طلبات إعادة التحميل.
- `requireUserSession()` على كل server function حساسة غير محمية حالياً.
- ربط `emergency_controls` (kill switch) في `runAITask`.
- تسجيل `audit_log` على كل تعديل admin (أسعار، كوبونات، صلاحيات، feature flags).

## Stage 3 — تقليل التكلفة
- تفعيل `prompt_cache` + `character_analysis_cache` خلف flags.
- Batch generation للنصوص (قصة كاملة في نداء واحد بدل صفحة/صفحة) خلف flag `batch_story_generation`.
- Character Sheet مرة واحدة لكل طلب وإعادة استخدامه في كل الصور.
- Lazy PDF: توليد PDF عند أول تحميل فقط، وتخزينه.

## Stage 4 — الخلفية (Background Jobs)
- تحويل `generate_story`, `generate_share_cards`, `generate_pdf`, `send_notification` إلى jobs في `background_jobs`.
- ربط `pg_cron` كل دقيقة بـ `/api/public/hooks/jobs-tick` باستخدام `apikey` (anon key).
- واجهة تقدم في صفحة الطلب (polling كل 3ث).

## Stage 5 — Family Library
- صفحة `/family` (CRUD + مفضلة/أرشيف + إحصائيات).
- dropdown "اختر من عائلتي" في wizard الطلب.
- ربط `family_member_id` تلقائياً في `order_characters` وزيادة `times_used`.

## Stage 6 — Social Sharing
- توليد 4 بطاقات لكل طلب (1080×1080, 1080×1920, 1200×630, OG) عبر Satori + resvg خلف job.
- تخزين في `story-covers/share/{share_token}/{aspect}.jpg`.
- مكون `<ShareSheet>` يقرأ من `share_platforms` (Facebook, Instagram, TikTok, X, Telegram, Snapchat, Messenger, LinkedIn, نسخ رابط، تحميل).
- صفحة عامة `/s/{share_token}` مع OG tags وبدون بيانات حساسة.
- تسجيل كل مشاركة في `share_events`.

## Stage 7 — لوحة الإدارة المحسّنة
صفحات جديدة تحت `/admin/`:
- `ai-config` — سحب لإعادة ترتيب النماذج لكل مهمة.
- `health` — بطاقات صحة لكل نموذج، auto-refresh 15s، آخر 20 خطأ.
- `emergency` — 4 مفاتيح إيقاف + Bulk Restart.
- `feature-flags` — toggle + rollout% + audience + user_ids.
- `audit` — عارض diff.
- `business-config` — tabs ديناميكية.
- `family-library` — إحصائيات الاستخدام.
- `share-platforms` — إدارة كتالوج المنصات.
- `jobs` — طابور الخلفية + retry.
- `costs` — يومي/شهري لكل نموذج.

## Stage 8 — التسويق والاحتفاظ
- نظام إحالة (referral).
- معرض قصص عامة (opt-in).
- تذكير ذكرى سنوية.
- علامة مائية في PDF (مجاني vs مدفوع).

## المبادئ الملتزم بها في كل مرحلة
- Backward Compatible 100%، Fail-Open، لا تغيير API/دفع/أسعار.
- كل ميزة جديدة خلف feature flag افتراضي OFF.
- كل migration جديد يحمل GRANTs + RLS.
- لا حذف بيانات، فقط nullable columns وجداول جديدة.

## المخرجات لكل مرحلة
تقرير مختصر: الملفات المتغيرة + migrations + الإعدادات الجديدة + flags تحتاج تفعيل من `/admin/feature-flags`.

---

**البدء بـ Stage 2 مباشرة عند الموافقة**، ثم المتابعة بلا توقف حتى Stage 8 ما لم تظهر مشكلة تمنع الاستمرار.
