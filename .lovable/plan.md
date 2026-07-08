# خطة التحسينات المتوافقة مع النظام الحالي

كل التحسينات إضافية بحتة. لا تغيير على:
- منطق الأسعار / الدفع / الكوبونات / الصلاحيات / سير العمل.
- الجداول الحالية أو الأعمدة الحالية أو الـ RLS الحالية.
- الـ APIs / server functions / routes الموجودة (توقيعاتها تبقى كما هي).
- شكل الطلب أو صفحة المعاينة الحالية `preview.$orderId` — تبقى تعمل كما هي.

الإضافات كلها Backward Compatible: جداول جديدة + أعمدة اختيارية + شاشات إدارة جديدة + خطوات جديدة داخل نفس الدوال (خلف flags).

---

## 1) نظام النماذج المُدار من الإدارة (بدون توكن)

### قاعدة البيانات (جدول جديد فقط — لا تعديل على الحالي)
جدول `preview_templates` مع GRANT + RLS:
```
id, name, language (ar|en|ku), story_type, moods text[],
cover_image_path, page_images text[], title, pages jsonb (نص كل صفحة),
reflective_question, page_count, orientation, frame_style, palette jsonb,
active bool, hidden bool, seasonal_start date null, seasonal_end date null,
priority int, created_at, updated_at
```
- `GRANT SELECT ON public.preview_templates TO anon, authenticated` (للعرض العام).
- `GRANT ALL TO service_role` (للإدارة عبر `supabaseAdmin`).
- RLS: `SELECT` مسموح للجميع بشرط `active = true AND hidden = false AND (seasonal window matches OR seasonal_* IS NULL)`؛ الـ writes ممنوعة عبر RLS ويتم كل الإدارة من `createServerFn` بصلاحية admin.
- Bucket جديد اختياري `preview-templates` (public read) لصور القوالب، أو إعادة استخدام `story-covers` مع مسار خاص `templates/`.

### الإدارة — صفحة جديدة
- `/admin/templates` (route جديد `admin.templates.tsx`) لا يتأثر بها أي route حالي.
- CRUD كامل: إنشاء / تعديل / حذف / تفعيل / إخفاء / رفع صور الغلاف والصفحات / تحديد نافذة موسمية.
- Server functions جديدة: `adminListTemplates`, `adminCreateTemplate`, `adminUpdateTemplate`, `adminDeleteTemplate`, `adminSetTemplateActive` (كلها خلف `gate()` الحالي).
- رابط للصفحة الجديدة في `admin.index.tsx` فقط (إضافة سطر).

### الاستخدام في الواجهة
- server function عامّة جديدة: `listPublicPreviewTemplates({ language, moods?, storyType? })` تُرجع القوالب المتطابقة مع الاحترام لنافذة الموسم.
- في `create.tsx`، زر "معاينة نموذج مجاني" الحالي يبقى، لكنه يستدعي أولاً `listPublicPreviewTemplates`:
  - إن وجد قالب مناسب → يفتح المعاينة على أساس القالب الفعلي (صور حقيقية + نصوص جاهزة).
  - إن لم يوجد → يعود لسلوك `buildSampleStory` الحالي (fallback — لا كسر).
- صفر استدعاءات AI. صفر توكن.

---

## 2) Story QA (بعد إنشاء نص القصة)

خطوة جديدة داخل `generateFullStory` بعد `runChat` وقبل حفظ الصفحات — بدون تغيير التوقيع.

- دالة داخلية `runStoryQA(plan, pageCount, language, moods)` تُشغّل مرّة واحدة بنموذج نصّي رخيص (`google/gemini-2.5-flash`) بـ `response_format: json_object`:
  - تكرار الجُمل / الفقرات.
  - ترابط الصفحات.
  - توافق النهاية مع البداية.
  - ملاءمة اللغة لعمر البطل الرئيسي.
  - عدم وجود انتقالات مفاجئة.
  - مطابقة عدد الصفحات المطلوب.
- تُرجع `{ ok, failing_pages: [n], reason }`.
- إن فشل: إعادة توليد النص فقط عبر `runChat` مرة واحدة إضافية بـ seed جديد (لا نمس الطلب ولا الصور ولا الدفع).
- سقف محاولات: 1 إعادة كحد أقصى لتفادي أي تكلفة زائدة.
- تُسجّل كل خطوة في `generation_events` بـ `step="story_qa"` (نفس الجدول والدالة `logEvent` الحاليتين).
- عمود اختياري جديد على `orders`: `story_qa_report jsonb null` (إضافة بدون كسر).

---

## 3) Image QA (بعد كل صورة)

خطوة جديدة داخل `adminConfirmPaymentAndGenerate` بعد كل `generateOneImage` — بدون تغيير التوقيع.

- دالة داخلية `runImageQA({ imagePath, expectedPrompt, characterDNA, language })`:
  - تنزيل الصورة كـ data URL (نفس النمط الحالي في `photoToDataUrl`).
  - استدعاء `callChat` برؤية (`google/gemini-2.5-flash`) بـ prompt يفحص:
    ثبات الشخصية / الملابس / الشعر / البشرة، تشوّه الأطراف، وجود نصوص أو إطار داخل الصورة، قصّ الشخصية، توافق الصورة مع نص الصفحة.
  - يرجع `{ ok, issues: [...] }`.
- إن فشل: إعادة توليد **الصورة فقط** (مرة واحدة كحد أقصى لكل صفحة) عبر `generateOneImage` مع تعزيز الـ negatives الموجودة أصلاً.
- تُسجّل في `generation_events` بـ `step="image_qa_pageN"` — القيم تدخل تلقائياً في `order_costs_v` الحالي.
- عمود اختياري جديد على `story_pages`: `qa_report jsonb null`, `qa_retries int default 0` (إضافة بدون كسر).

---

## 4) تحسين الـ PDF (تناسق portrait / landscape)

تعديلات محصورة داخل `src/lib/pdf-client.ts` (لا تغيير على التوقيع أو الـ assets):

- إزالة القيم الثابتة `height:430px` و `height:560px` واستبدالها بنِسَب من `PAGE_H`:
  - غلاف portrait: `Math.round(PAGE_H * 0.55)`.
  - غلاف landscape: `Math.round(PAGE_H * 0.72)` مع تخطيط عمودَين (صورة + عنوان جنب بعض).
  - صفحة portrait: `Math.round(PAGE_H * 0.42)`.
  - صفحة landscape: صورة يسار + نص يمين بنسبة 45/55 (مع `dir` صحيح).
- إطار الغلاف: 4px يبقى، لكن `border-radius` يتقلّص في landscape لـ 14px.
- إطار الصفحة: 3px يبقى، مع padding أفقي أعرض في landscape (`64px` بدل `44px`).
- الشريط الذهبي السفلي والعلوي: نسبة من `PAGE_H` بدل px ثابتة.
- الهوامش وأماكن النص: تعتمد `dir` و`orientation`.
- تمرير `orientation` إلى prompts الصور موجود أصلاً — يبقى كما هو (يمنع القص).
- كل ذلك بلا تغيير على `StoryPdfAssets` type أو على callers.

---

## 5) دعم اللغة الكردية — تكميل ما ينقص

اللغة الكردية موجودة أصلاً في `i18n.tsx` + `orders.functions.ts` + `pdf-client.ts` + `create.tsx`. المطلوب سدّ الفجوات فقط:

- **PDF thanks/certificate**: إضافة فرع `isKu` (حالياً يستخدم فرع Arabic كـ fallback فقط للاتجاه). ترجمة سورانية للنصوص الثابتة (`thanks`, `note`, `certTitle`, `certLine`, `questionTitle`, `signature`, `disclaimerTitle`, `pageLabel`, `brand`, `tag`).
- **لوحة الإدارة**: مراجعة سريعة لكل `admin.*.tsx` لتفعيل التبديل الكامل للـ dir/lang (بدون تغيير المحتوى الوظيفي).
- **صفحة الطلبات (`my-orders.tsx`) و `preview.$orderId.tsx`**: إضافة مفاتيح i18n الناقصة بالكردية.
- **قوالب المعاينة (البند 1)**: عمود `language` يدعم `ku` أصلاً في التصميم.
- **generateFullStory**: فرع `isKu` موجود مسبقاً — لا تعديل.

---

## 6) Character Profile ثابت

بدلاً من الاعتماد على نص حرّ في `visual_brief`، إضافة عمود منظّم:
- على `order_characters`: عمود جديد اختياري `character_profile jsonb null` بحقول:
  ```
  { gender, age_group, skin_tone, hair_color, hair_style, eye_color,
    face_shape, body_build, clothing, distinctive_features, locked: true }
  ```
- في `analyzeCharacterPhoto`: طلب الإخراج بصيغة JSON إضافة لسطر `visual_brief` النصّي الحالي (نُبقي `visual_brief` كما هو للتوافق العكسي). في حال فشل الـ JSON نُبقي على السلوك الحالي فقط.
- بناء `dnaLines` في `adminConfirmPaymentAndGenerate` يستخدم `character_profile` إن وُجد، وإلا يعود إلى `visual_brief` الحالي (fallback كامل).
- لا يستهلك توكن إضافي: نفس الاستدعاء الواحد الحالي، فقط prompt أوضح يطلب سطراً JSON نهائياً.

---

## 7) الحفاظ على المعمارية

- لا تعديل على: `pricing.ts`, `admin.settings.tsx` (الأسعار), الدفع, الكوبونات (`admin.coupons.tsx`), الصلاحيات (`admin-session.server.ts`), إدارة الطلبات (`admin.orders.$id.tsx`), قاعدة البيانات باستثناء الإضافات المذكورة أعلاه.
- كل السطور الحالية في `create.tsx`, `preview.$orderId.tsx`, `orders.functions.ts`, `pdf-client.ts` تعمل كما هي؛ التغيير الوحيد هو إضافات لا تُبطل أي مسار.

---

## ملفات الترحيل الجديدة

- migration 1: `preview_templates` (جدول + GRANT + RLS + trigger updated_at).
- migration 2: `orders.story_qa_report jsonb null` + `story_pages.qa_report jsonb null` + `story_pages.qa_retries int default 0` + `order_characters.character_profile jsonb null`.
- storage: bucket `preview-templates` (اختياري — يمكن استخدام مسار داخل `story-covers`).

## ملفات الكود

جديدة:
- `src/lib/preview-templates.functions.ts` (public list + admin CRUD).
- `src/routes/admin.templates.tsx`.
- `src/lib/story-qa.server.ts` (helper يُستدعى من داخل handler).
- `src/lib/image-qa.server.ts`.

تعديلات موضعية:
- `src/lib/orders.functions.ts`: استدعاء `runStoryQA` داخل `generateFullStory`، استدعاء `runImageQA` داخل `adminConfirmPaymentAndGenerate` بعد كل صورة، بناء `dnaLines` من `character_profile` إن وُجد، توسيع `analyzeCharacterPhoto` لإرجاع JSON إضافةً للنص.
- `src/lib/pdf-client.ts`: نِسَب مبنية على `PAGE_H` + فرع `isKu` للنصوص الثابتة + تخطيط landscape عمودَين.
- `src/lib/i18n.tsx`: مفاتيح ناقصة بالكردية.
- `src/routes/create.tsx`: ربط زر المعاينة بـ `listPublicPreviewTemplates` مع fallback على `buildSampleStory`.
- `src/routes/admin.index.tsx`: رابط "قوالب المعاينة".
