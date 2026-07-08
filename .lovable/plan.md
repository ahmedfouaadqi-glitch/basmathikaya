
## 1) الطلب #20 عالق على خطأ الحصة (403 credit_limit_reached)

**السبب:** حالياً بعد فشل توليد الصور تُخزَّن `images_status='failed'` و`images_error` على الطلب، وشاشة تفاصيل الطلب تعرض رسالة الخطأ فقط. زر "إعادة توليد" الموجود يعمل لصفحة واحدة، ولا يوجد زر لإعادة توليد كامل الصور، فتبقى رسالة الخطأ ثابتة حتى بعد زيادة رصيد الحصة.

**الإصلاح:**
- إضافة `adminRetryImageGeneration({ orderId })` في `src/lib/orders.functions.ts`:
  - يمسح `images_error=null` ويضع `images_status='generating'`.
  - يعيد تشغيل نفس منطق توليد الصور من `adminConfirmPaymentAndGenerate` (نستخرجه إلى دالة داخلية `runImageGenerationForOrder`).
- في `src/routes/admin.orders.$id.tsx` ضمن بلوك `images_status === "failed"`:
  - رسالة عربية أوضح إذا احتوى الخطأ على `credit_limit`/`403`.
  - زر جديد "إعادة توليد كامل الصور" يستدعي الدالة أعلاه ثم `invalidateQueries`.

## 2) الضغط على قصة في المعرض لا يعرضها

**السبب:** `/s/$token` تعرض بطاقة تسويقية فقط (غلاف + CTA "اطلب مثلها"). لا قارئ لصفحات القصة.

**الإصلاح:**
- إضافة `getPublicStory({ token })` في `src/lib/share.functions.ts` تُعيد صفحات القصة الكاملة بروابط موقّتة عندما يكون الطلب `is_public=true` و`status='delivered'`.
- تحديث `src/routes/s.$token.tsx` ليعرض:
  - غلاف + عنوان + (اختياريّاً) "بواسطة: {اسم}".
  - قارئ صفحات (كل صفحة صورة + نص) بترتيب رأسي.
  - CTA "اطلب مثلها" في الأسفل.
  - إن لم يكن الطلب عاماً تُعرض البطاقة التسويقية الحالية كما هي.

## 3) خيار ذكر اسم مُنشئ القصة عند النشر في المعرض

**قاعدة البيانات (migration جديدة):**
```sql
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS show_author boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_author_name text;
```

**الخادم:** توسيع `setOrderPublic` لقبول `showAuthor: boolean` و`publicAuthorName?: string` (لو فارغاً والـ checkbox مفعّل يُخذ `users.full_name` افتراضياً). تضمين الحقلين في `listPublicGallery` و`getPublicStory` و`listGalleryAdmin`.

**واجهة `my-orders`:** تحويل زر "اجعلها عامة" الحالي إلى حوار صغير عند النشر يسأل:
1. عنوان عام (اختياري).
2. checkbox: "أظهر اسمي كمؤلف".
3. حقل اسم اختياري يظهر عند تفعيل الـ checkbox (افتراضي: الاسم الكامل).

**العرض:** إظهار "بواسطة: {name}" فقط عند `show_author && public_author_name` في `gallery.tsx` و`s.$token.tsx` و`admin.gallery.tsx`.

## 4) اتجاه PDF ثابت على "عمودي" حتى عند اختيار "أفقي"

**السبب:** `downloadPdf` في `src/routes/admin.orders.$id.tsx` (سطر 94) لا يمرّر `orientation` ولا `reflectiveQuestion` إلى `buildAndDownloadStoryPdf`، فتُستخدم القيمة الافتراضية `portrait`. `src/routes/preview.$orderId.tsx` يمرّرهما بشكل صحيح.

**الإصلاح:** إضافة السطرين إلى استدعاء الأدمن (`getStoryProgress` يُعيدهما أصلاً):
```ts
orientation: p.pdf_orientation ?? "portrait",
reflectiveQuestion: p.reflective_question ?? null,
```
اختبار بصري: طلب أفقي جديد → تأكيد الدفع → تنزيل PDF من الأدمن → يفتح A4 landscape.

## 5) إعادة التحميل + إعادة الإنشاء بخيارات جديدة

الحالي في `src/lib/orders.functions.ts`:
- `requestRedownload` (طلب إعادة تحميل مدفوع لنفس القصة) — ✓ موجود ومعروض في `my-orders`.
- `reorderExisting` — ينسخ الطلب لكن يسمح بتعديل `quality` و`coupon_code` فقط، ويثبّت اللغة على `"ar"`. لا يسمح بتعديل الشخصيات/الأمزجة/عدد الصفحات/الاتجاه/التعليمات.

**الإصلاح:**
- **إعادة التحميل:** إبقاء المسار الحالي (`requestRedownload`) كما هو، والتأكد من ظهور زر "إعادة تحميل" بوضوح لكل طلب `delivered` في `src/routes/my-orders.tsx` (نص وأيقونة موحّدين).
- **إعادة الإنشاء بخيارات جديدة:** التحوّل من نسخ مباشر إلى تعبئة نموذج `/create`:
  - إضافة `getOrderPrefill({ orderId })` في `src/lib/orders.functions.ts` تُعيد الشخصيات، الأمزجة، التعليمات، اللغة، عدد الصفحات، الاتجاه، جودة الصور، مستوى الطلب — للمستخدم صاحب الطلب فقط.
  - في `src/routes/my-orders.tsx`: زر "إعادة الإنشاء بخيارات جديدة" ينقل إلى `/create?from=<orderId>`.
  - في `src/routes/create.tsx`: قراءة `from` من الـ search params؛ عند وجودها، استدعاء `getOrderPrefill` وتعبئة كل الحقول (الشخصيات + الأمزجة + الصفحات + الاتجاه + الجودة + اللغة + التعليمات) قبل عرض النموذج. المستخدم يعدّل ما يشاء ثم يرسل كطلب جديد عبر نفس مسار `createOrderDraft` (تسعير جديد، رقم طلب جديد، دفع جديد).
  - إزالة/تجاوز الحوار الحالي `reorderOpen` في `my-orders` (أو إبقاؤه كاختصار "أعد إرسال بنفس الإعدادات مع تغيير الجودة فقط" ثانوي).

## ملفات ستُعدَّل/تُنشأ
- `src/lib/orders.functions.ts` — `runImageGenerationForOrder` + `adminRetryImageGeneration` + `getOrderPrefill`.
- `src/routes/admin.orders.$id.tsx` — زر إعادة توليد كامل + رسالة 403 + تمرير `orientation`/`reflectiveQuestion`.
- `src/lib/share.functions.ts` — `getPublicStory`.
- `src/routes/s.$token.tsx` — قارئ قصة كامل للطلبات العامة.
- `src/lib/gallery.functions.ts` — حقول المؤلف.
- `src/routes/my-orders.tsx` — حوار نشر بخيار اسم المؤلف + زر "إعادة إنشاء بخيارات جديدة" ينقل إلى `/create?from=...`.
- `src/routes/create.tsx` — قراءة `?from=` وتعبئة النموذج.
- `src/routes/gallery.tsx` و`src/routes/admin.gallery.tsx` — عرض اسم المؤلف.
- migration SQL جديدة لعمودَي `show_author` و`public_author_name`.

## خارج النطاق
- تعديل حدود حصة Lovable AI Gateway (تُدار من إعدادات مساحة العمل).
- إعادة تصميم بصري للمعرض.
