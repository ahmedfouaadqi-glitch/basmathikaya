
## الهدف
المعاينة الحالية مجرد فقرة افتتاحية + غلاف. سنحوّلها إلى **قصة كاملة متعددة الصفحات**، كل صفحة فيها نص + صورة معبّرة، مع إمكانية اختيار عدد الصفحات (الافتراضي 5)، وتسعير يزداد مع زيادة الصفحات، ورابط تحميل PDF يصل للعميل، وعرض كامل للصفحات داخل لوحة الإدارة.

## 1) قاعدة البيانات (هجرة واحدة)
- جدول جديد `story_pages`:
  - `order_id` (FK), `page_number` (int), `text` (text), `image_path` (text)، فهرس فريد `(order_id, page_number)`، RLS مغلق، GRANT للـ `service_role`.
- إضافة أعمدة:
  - `orders.page_count int not null default 5`
  - `orders.pdf_path text` (مسار PDF داخل bucket جديد)
  - `generations.full_story text` موجود مسبقًا، نُبقيه ونستخدمه لتخزين JSON الصفحات (نسخة احتياطية للنص).
- جدول `pricing_settings`: نضيف
  - `per_page_iqd_pdf`, `per_page_iqd_printed`, `per_page_iqd_video` (سعر كل صفحة إضافية فوق 5).
- bucket تخزين خاص جديد: `story-pdfs` (private).
- bucket صور الصفحات: نعيد استخدام `story-covers` بمسار فرعي `pages/<orderId>/<n>.png`.

## 2) تدفّق التوليد (server function `generatePreview` → `generateFullStory`)
- المدخلات: `orderId` + `page_count` (يُقرأ من `orders.page_count`).
- الخطوة A — نص القصة الكامل (نموذج نص واحد منظَّم JSON):
  - `google/gemini-3-flash-preview` مع `response_format: json_object`.
  - يُعيد: `title`, `cover_prompt`, `pages: [{ text, image_prompt }]` بعدد `page_count`.
  - حفظ النص لكل صفحة في `story_pages` + النص الكامل في `generations.full_story`.
- الخطوة B — الغلاف (مثل الحالي) باستخدام `cover_prompt`.
- الخطوة C — صور الصفحات بالتوازي (محدودة 3 بنفس الوقت) عبر `google/gemini-3.1-flash-image` باستخدام `image_prompt` لكل صفحة + وصف ثابت للشخصية لضمان الاتساق البصري؛ رفعها إلى `story-covers/pages/<orderId>/<n>.png`، وتحديث `story_pages.image_path`.
- كل خطوة تُسجَّل في `generation_events` (كما هو) لاحتساب التكلفة لحظيًا.

## 3) توليد ملف PDF
- بعد اكتمال الصفحات: server function `buildStoryPdf(orderId)`:
  - استخدام `pdf-lib` (متوافق مع Cloudflare Worker، بدون اعتماد Node-only).
  - صفحة غلاف + صفحات بتخطيط: صورة في الأعلى + النص في الأسفل، دعم RTL للعربية باستخدام خط مدمج `Tajawal` (تحميل bytes من الـ asset).
  - رفع الملف إلى `story-pdfs/<orderId>.pdf` وحفظ `orders.pdf_path`.
- server function `getStoryPdfUrl(orderId)` يُعيد signed URL صالحًا 24 ساعة (يستخدمه العميل والإدارة).

## 4) واجهة العميل
- **`/create`**: إضافة محدد عدد الصفحات (5 / 8 / 12 — أو slider 4–16) مع عرض السعر التقديري الحي لكل باقة. يُرسل `page_count` ضمن `createOrderDraft`.
- **`/preview/$orderId`**:
  - يعرض الغلاف + الفقرة الأولى أثناء التوليد، ثم يبدأ بعرض الصفحات تباعًا (polling كل 3 ثوانٍ على endpoint جديد `getStoryProgress`).
  - بعد اختيار الباقة وتأكيد واتساب: يظهر زر **"تحميل PDF"** يفتح `getStoryPdfUrl`.
  - رابط PDF يُدرج تلقائيًا داخل نص رسالة واتساب المُعدّ مسبقًا.
- العرض في الواجهة يظل بعلامة مائية حتى يتم الدفع/التأكيد (نُبقي class `watermark-overlay` الحالي).

## 5) لوحة الإدارة
- في `admin.orders.$id.tsx`:
  - قسم جديد **"صفحات القصة"**: شبكة لكل صفحة (صورة + نص + رقم الصفحة).
  - زر **"تحميل PDF"** يستدعي `getStoryPdfUrl`.
  - زر **"إعادة توليد الصفحة"** لكل صفحة (server fn `regeneratePage(orderId, page_number)`) — يفيد لإصلاح صورة سيئة.
- في `admin.settings.tsx`: إضافة حقول `per_page_iqd_*` ضمن نموذج التسعير.
- في `admin.tsx` (القائمة): إضافة عمود `page_count`.

## 6) التسعير الديناميكي
- الصيغة: `amount_iqd = tier_base_iqd + max(0, page_count - 5) * per_page_iqd_<tier>`
- يُحتسب في:
  - الواجهة (`/create` و `/preview`) للعرض اللحظي.
  - `confirmTierAndPrepareWhatsapp` كمصدر الحقيقة قبل تخزين `orders.amount_iqd`.

## 7) ملاحظات تقنية
- `pdf-lib` نقي JS — متوافق مع Worker. تحميل ملف الخط مرة واحدة عبر `import font from "@fontsource/tajawal/files/tajawal-arabic-400-normal.woff"` ثم تحويله إلى ttf bytes (سنستخدم نسخة ttf من الحزمة).
- تعزيز اتساق الشخصية: نُولّد "بطاقة شخصية" نصية مرة واحدة من اسم/عمر/مزاج المستخدم وصورته (وصف بصري)، ونُدرجها في كل `image_prompt` لتجنّب اختلاف ملامح البطل بين الصفحات.
- التوليد المتوازي محدود (3) لتفادي rate-limit على AI Gateway.
- لا تغييرات على نظام الجلسة/المصادقة.

## التسليمات
- هجرة DB + bucket جديد.
- `src/lib/orders.functions.ts`: تعديل `createOrderDraft`، استبدال `generatePreview` بـ `generateFullStory` + `getStoryProgress` + `buildStoryPdf` + `getStoryPdfUrl` + `regeneratePage`.
- `src/lib/pdf.server.ts` جديد (بناء PDF).
- تعديل `create.tsx` و `preview.$orderId.tsx` و `admin.orders.$id.tsx` و `admin.settings.tsx` و `admin.tsx`.
- ترجمات i18n للمفاتيح الجديدة (عدد الصفحات، تحميل PDF، صفحات القصة…).
