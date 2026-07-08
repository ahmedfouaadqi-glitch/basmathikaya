## الخطة النهائية الموحّدة — مرجع التنفيذ الكامل

تدمج جميع الجولات السابقة (الأمان + التكلفة + جودة AI + الأداء + UX + الأدمن + التسويق) مع المتطلبات العشرة الجديدة. تُنفَّذ بالتسلسل من المرحلة 0 حتى 8 بدون توقّف بين المراحل.

---

### مرحلة 0 — البنية التحتية (Migration واحد كبير)

جداول جديدة (كلها مع `GRANT` صحيح + RLS + `service_role` كامل):

- **`ai_models_config`** — كتالوج نماذج قابل للتحرير من الأدمن
  `id, task_type, model_id, priority, enabled, timeout_ms, max_retries, backoff_base_ms, temperature, top_p, top_k, max_tokens, safety_level, prompt_version, params JSONB, updated_at, updated_by`
  Seed: كل مهمة (`story`, `polish`, `image_analysis`, `image_gen`, `image_gen_cover`, `character_sheet`, `story_qa`, `image_qa`) بـ 2-3 نماذج مرتّبة.
- **`ai_model_events`** — سجل كل محاولة
  `id, task_type, model_id, attempt, status ('success'|'failed'|'timeout'|'rate_limit'|'quota'|'unavailable'|'circuit_open'), error_code, error_message, latency_ms, input_tokens, output_tokens, cost_usd, order_id, user_id, prompt_version, created_at` + indexes.
- **`ai_model_health`** — snapshot لكل (model, task)
  `is_healthy, circuit_state ('closed'|'open'|'half_open'), consecutive_failures, failure_rate_1h, avg_latency_1h_ms, opened_at, next_probe_at, last_success_at, last_failure_at`
- **`feature_flags`**
  `key TEXT PK, enabled BOOL, rollout_percent INT, audience ('all'|'admins'|'new_users'|'user_list'), user_ids UUID[], description, notes, owner, created_by, created_at, updated_at`
  Seed: `character_sheet, story_qa, image_qa, batch_generation, polish_pass, prompt_cache, character_analysis_cache, lazy_pdf, family_library, share_system, referral, gallery, anniversary_reminder, notifications, seasonal_templates, background_jobs`
- **`emergency_controls`** — صف واحد + سجل تاريخ في audit_log
  `ai_all_paused, ai_image_paused, ai_text_paused, qa_paused, reason, paused_by, paused_at`
- **`audit_log`**
  `id, actor_type ('admin'|'user'|'system'), actor_id, action, target_type, target_id, before JSONB, after JSONB, diff JSONB, ip, user_agent, created_at`
- **`rate_limits`** — للحماية من الاستنزاف
- **`download_events`** — تتبع تحميل PDF
- **`family_members`** — مكتبة العائلة
  `id, user_id, role ('father'|'mother'|'child'|'sibling'|'grandfather'|'grandmother'|'friend'|'pet'|'other'), display_name, nickname, age, gender, character_dna JSONB, character_sheet_url, source_photo_path, is_favorite BOOL, is_archived BOOL, times_used INT, last_used_at, created_at, updated_at`
- **`share_platforms`** — كتالوج المنصات
  `id, key, label_ar, label_en, icon, url_template, needs_download BOOL, card_type ('square'|'story'|'landscape'|'og'), enabled, sort_order`
  Seed: WhatsApp, Facebook, Messenger, X, Telegram, LinkedIn, Instagram (needs_download), TikTok (needs_download), Snapchat (needs_download), Copy Link, Download.
- **`share_cards`** — الكاردات المُولَّدة لكل طلب
  `order_id, card_type, url, width, height, generated_at` (PK: order_id + card_type)
- **`share_events`** — تحليلات مشاركة
  `id, order_id, user_id, share_token, platform_key, ip, ua, created_at`
- **`business_config`** — إعدادات النظام العامة (key/value JSONB)
  Seed للفئات: `payments, printing, upload_limits, link_expiry, pdf, ai, share, notifications, storage, backup, system`
  الأسعار تبقى في `pricing_settings` كما هي — `business_config` تضيف طبقة إعدادات جديدة فقط ولا تلمس منطق الدفع.
- **`background_jobs`** — Queue خاصة بالمشروع
  `id, kind ('generate_story'|'generate_pdf'|'generate_share_cards'|'send_notification'|'backup'|...), payload JSONB, status ('pending'|'running'|'succeeded'|'failed'|'dead'), priority INT, attempts, max_attempts, next_run_at, started_at, finished_at, last_error, order_id, user_id, created_at` + indexes on `(status, next_run_at)` and `(order_id)`.

أعمدة إضافية nullable على جداول قائمة:
- `orders.share_token UNIQUE`, `orders.character_sheet_url`, `orders.pdf_generation_status`, `orders.batch_meta JSONB`
- `order_characters.family_member_id UUID` (nullable — لا يكسر شيئاً)

Indexes مفقودة: `orders(status, created_at DESC)`, `generation_events(order_id, created_at)`, `coupons(active, expires_at)`, `background_jobs(status, next_run_at)`.

---

### مرحلة 1 — النواة (Core Libraries)

كل شيء server-only. لا كسر لأي API قائم.

- **`src/lib/ai/orchestrator.server.ts`** — `runAITask({ task, payload, orderId, userId })`:
  1. يفحص `emergency_controls` → fail-open إن مُوقف.
  2. يقرأ نماذج المهمة من `ai_models_config`، مرتبة `priority ASC`، مفلترة `enabled=true` ومفلترة بـ `circuit_state != 'open' OR next_probe_at <= now()`.
  3. لكل نموذج: `AbortController` بـ `timeout_ms`، ثم `max_retries` مع `exponential backoff` (`backoff_base_ms * 2^attempt` مع jitter).
  4. تصنيف الأخطاء: `429 → rate_limit`, `402/quota → quota`, `503/500/408 → unavailable/timeout`. `4xx غير قابل للاسترداد → لا retry، انتقال فوري.`
  5. **Circuit Breaker**: 5 فشل متتالٍ → `open` لمدة 60s → `half_open` (probe واحد) → `closed` عند النجاح.
  6. عند النجاح على نموذج غير الأول: يُبقى ترتيب الأولوية كما هو (auto-recovery يحدث عبر circuit breaker).
  7. يسجّل كل محاولة في `ai_model_events` + يحدث `ai_model_health`.
  8. يعيد `{ result, model_used, attempts, total_latency_ms, total_cost_usd, degraded: boolean }`.
- **`src/lib/feature-flags.server.ts`** — `isFeatureEnabled(key, { userId })` مع cache 60s + hash ثابت من userId لتحديد فئة الطرح.
- **`src/lib/audit.server.ts`** — `logAudit({ action, target_type, target_id, before, after })` يحسب diff تلقائياً + يلتقط IP/UA من `getRequest()`.
- **`src/lib/rate-limit.server.ts`** — token bucket بسيط على `rate_limits`.
- **`src/lib/jobs/queue.server.ts`** — API واحد: `enqueue(kind, payload, { priority, orderId })` + `runNext()` + worker loop خفيف يستدعى عبر cron كل دقيقة على `/api/public/hooks/jobs-tick` (يعالج حتى 10 مهام بحد أقصى 25s لتفادي حدود Worker). المهام الفاشلة تعاد بـ backoff، والحد الأقصى → `dead` + إشعار للأدمن.
- **`src/lib/business-config.server.ts`** — `getConfig(category)` مع cache 60s.
- استبدال كل استدعاءات `callChat`/`callImage` المباشرة في `story-qa.server.ts` / `image-qa.server.ts` / `orders.functions.ts` بـ `runAITask(...)`. المسار القديم يبقى كـ fallback داخل orchestrator نفسه.

---

### مرحلة 2 — الأمان (P0)

- `requireUserSession()` + فحص ملكية الطلب في: `generateFullStory`, `confirmTierAndPrepareWhatsapp`, `getOrder`, تحميل PDF.
- Rate limits: `10/hr/session` على AI، `3/day/order` على إعادة التوليد.
- Kill Switch يقرأ من `emergency_controls` (تلقائي عبر orchestrator).
- `getOrderPublic` يُقيَّد بـ `share_token` بدل UUID.
- كل تعديل أدمن يمرّ بـ `logAudit(before, after)` تلقائياً عبر wrapper موحّد.

---

### مرحلة 3 — Batch + Cache + Character Sheet HQ

- Batch text: طلب واحد لكل قصة عبر orchestrator (task = `story`) → -25% تكلفة.
- Polish pass للاحترافي عبر task = `polish` (خلف feature flag `polish_pass`).
- `prompt_cache` + `character_analysis_cache` (خلف feature flags).
- Character Sheet HQ يُولَّد مرة عبر task = `character_sheet` ويُخزَّن + يُعاد استخدامه في كل الصفحات كـ `referenceImages`.
- Cover reuse + Lazy PDF (خلف flags).

---

### مرحلة 4 — Background Jobs

- تحويل هذه العمليات إلى Jobs:
  `generate_story`, `generate_page_image`, `generate_share_cards`, `generate_pdf`, `send_notification`, `daily_backup_snapshot`.
- Endpoint إنشاء الطلب يعيد `orderId` فوراً + `job_id`، والواجهة تُبقي `polling` كل 2s على `getOrder` لعرض التقدم (progress bar حقيقي بدل انتظار blocking).
- API القديم يبقى يعمل: إن طُلبت العملية بـ `sync=true` تنفَّذ inline (backward compat).
- pg_cron كل دقيقة → `/api/public/hooks/jobs-tick` (يوقّع بـ `apikey` = anon key).

---

### مرحلة 5 — Family Library

- صفحة `/family` (تحت `requireUserSession`):
  - Grid بالشخصيات، فلاتر (favorite/archived/role)، ترتيب حسب `times_used` أو آخر استخدام.
  - Actions: Favorite, Archive, Duplicate, Delete, Reuse (يفتح `/create?family_member_id=…`).
  - إحصائيات: عدد مرات الاستخدام، آخر قصة.
- في wizard الإنشاء: dropdown "اختر من عائلتي" + خيار "إضافة شخصية جديدة".
- عند إنشاء طلب: `times_used++` تلقائياً + ربط `order_characters.family_member_id`.

---

### مرحلة 6 — Social Sharing System

- توليد 4 كاردات لكل طلب مكتمل عبر job `generate_share_cards`:
  - Square 1080×1080 (Instagram, Facebook)
  - Story 1080×1920 (TikTok, Snapchat, Stories)
  - Landscape 1200×630 (X, LinkedIn, OG)
  - OG 1200×630 (لصفحة `/s/{share_token}`)
- Rendering: Satori + SVG-to-PNG (Worker-safe) — لا `sharp`, لا `canvas`.
- Component `<ShareSheet orderId>` (mobile-first):
  - يقرأ `share_platforms` مرتّبة من DB.
  - يستخدم Web Share API إن `navigator.share` متاح (mobile) + fallback لأزرار مباشرة.
  - Instagram/TikTok/Snapchat: modal "حمّل الصورة، ثم افتح التطبيق" + زر تحميل + copy caption.
  - كل نقرة تسجَّل في `share_events`.
- صفحة `/s/{share_token}` (SSR + OG tags صحيحة):
  - تعرض الغلاف + الاسم الأول + CTA "أنشئ قصة مثلها" فقط. لا بيانات حساسة.
- إدارة كتالوج المنصات من `/admin/share-platforms` (add/edit/enable/reorder) — منصات جديدة بلا كود.

---

### مرحلة 7 — لوحة الإدارة الموسّعة

صفحات جديدة تحت `/admin/…` (Prefetch + Search + Pagination):

- **`/admin/ai-config`** — إدارة `ai_models_config`: drag-to-reorder، toggle، تحرير timeout/retry/temperature/prompt_version لكل مهمة. زر "test model" ينفّذ نداء اختبار حقيقي عبر orchestrator ويعرض النتيجة.
- **`/admin/health`** — Health Dashboard (auto-refresh 15s polling):
  - بطاقات لكل نموذج (✅/⚠️/❌ + circuit state + last_success + failure_rate + avg_latency).
  - Ping DB (`select 1`) + Storage (HEAD على ملف اختبار).
  - عدد الطلبات pending/running، متوسط زمن القصة/الصور/PDF.
  - تكلفة اليوم/الشهر + الإيرادات + عدد الأخطاء + آخر 20 خطأ + Uptime (منذ آخر نشر).
- **`/admin/emergency`** — 4 مفاتيح كبيرة + سبب اختياري + زر "إعادة تشغيل الكل". كل تبديل يذهب لـ audit_log.
- **`/admin/feature-flags`** — قائمة بكل flag مع toggle، slider نسبة الطرح، dropdown جمهور، قائمة user_ids، حقول notes/owner.
- **`/admin/audit`** — بحث + فلترة + diff viewer (before/after side-by-side).
- **`/admin/business-config`** — تبويبات لكل فئة (PDF, Uploads, Notifications, Share, Storage, Backup, System) مع نموذج ديناميكي مبني من schema JSON.
- **`/admin/family-library`** — إحصائيات (الأكثر استخداماً، عدد الأُسر، معدل إعادة الاستخدام).
- **`/admin/share-platforms`** — إدارة كتالوج المنصات.
- **`/admin/jobs`** — قائمة Jobs مع status/attempts/last_error + زر retry + زر kill.
- **`/admin/costs`** — تفاصيل التكلفة بالنموذج/المهمة/اليوم/الطلب.

---

### مرحلة 8 — التسويق + الاحتفاظ

- Referral system (خلف flag)
- Public gallery + milestones (خلف flags)
- Anniversary reminders عبر cron + job `send_notification` (خلف flag)
- Watermark خفيف على PDF (خلف flag)

---

### المبادئ (بلا استثناء)

- **Backward Compatible 100%**: أعمدة nullable فقط، لا تغيير APIs موجودة، لا تغيير أسعار/دفع/كوبونات.
- **Fail Open**: كل ميزة جديدة إذا فشلت → السلوك القديم.
- **Feature Flag على كل جديد** → إيقاف فوري بدون deploy.
- **Modular**: كل شيء داخل `src/lib/ai/…`, `src/lib/jobs/…`, `src/lib/share/…`, `src/lib/family/…`.
- **Documentation**: كل migration يُوثَّق في `.lovable/plan.md` بعد تطبيقه + README قصير لكل مجلد جديد.
- **Cost-conscious**: orchestrator يفضّل النماذج الأرخص أولاً حسب priority المُختار.

---

### ترتيب التنفيذ (لن أتوقف بين المراحل)

0. Migration الكبير + Seed → **يحتاج موافقتك مرة واحدة فقط**.
1. النواة (orchestrator, flags, audit, rate-limit, jobs, business-config).
2. الأمان (P0).
3. Batch + Cache + Character Sheet.
4. Background Jobs.
5. Family Library.
6. Social Sharing System.
7. لوحة الإدارة الموسّعة.
8. التسويق.

بعد كل مرحلة: تقرير قصير (منجز / ملفات / migration / إعدادات لوحة الإدارة الجديدة).

**بموافقتك أبدأ فوراً بمرحلة 0.**
