
## نظرة عامة على الطلب

كل النقاط الثمانية قابلة للتنفيذ ضمن نفس البنية الحالية (TanStack Start + Lovable Cloud + Supabase + الجداول الموجودة). لا حاجة لتغيير المنطق العام للموقع ولا البنية التحتية. سيبقى نفس تدفق الدفع (WhatsApp → تأكيد الادارة → توليد الصور).

بخصوص ملاحظتك حول أن صفحة التأكيد ما تزال تُظهر «الأسعار السابقة» وبطاقة الفيديو رغم تغبيشها: نعم مؤكدة. السبب أن `/preview/$orderId` يستخدم `useQuery(["pricing-public"])` بنفس المفتاح لكن مع `staleTime: 60_000` ولا يُبطَل عند تحديث الأسعار من الإدارة، وأيضاً لا يمرّر `qualityTier` و`characterCount` الحقيقيَّين إلى `computeTierAmount` — سنُصلح ذلك بحيث تُقرأ من الطلب نفسه ويُبطَل الكاش تلقائياً بعد أي حفظ في الإدارة.

---

## 1) الصور المرجعية (منع «صورة داخل صورة»)

- تعديل `analyzeCharacterPhoto` (في `src/lib/orders.functions.ts`) ليُضاف إلى الوصف: الجنس التقريبي + الفئة العمرية (طفل/بالغ) بشكل صريح، وإلزام الاختيار.
- في `adminConfirmPaymentAndGenerate` تعديل `likenessTag` و`style` وبناء الـ`prompt` بحيث تُضاف قواعد سلبية صريحة قبل وصف المشهد:
  > "Use the reference photo ONLY to preserve facial features, hair, skin tone and body build. The final image MUST be a single full-scene storybook illustration. Absolutely NO: original photo, photo-in-photo, thumbnails, side panels, picture-in-picture, framed reference, before/after comparison, collage, polaroid, or any inset image. Never show the reference photo or any cropped part of it. Only the illustrated scene."
- إضافة النص العربي المطلوب حرفياً كذيل للـ prompt.
- إبقاء تمرير `referenceImages` لنماذج Gemini كما هو (فقط للتوجيه)، بدون تغيير على استدعاء الـ AI Gateway.

## 2) نص الزر

- في `src/routes/create.tsx` تغيير الزر من «اصنع معاينة» إلى «اصنع حكايتي» عبر مفاتيح i18n (`form_submit`) في `src/lib/i18n.tsx` — بدون تغيير في المنطق.

## 3) صفحة تأكيد قبل التوليد + 4) شاشة تحميل + 5) منع الاستهلاك المكرر

- في `create.tsx`: عند الضغط، بدل الاستدعاء المباشر لـ `createOrderDraft`، يفتح `<Dialog>` (shadcn) بعنوان «تأكيد إنشاء الحكاية» ونص التأكيد وزرَّي «نعم، اصنع حكايتي» / «رجوع للتعديل». الاستدعاء يحصل فقط بعد التأكيد.
- تعطيل الزر أثناء `submitting` وإظهار رسالة «جاري إنشاء الحكاية، يرجى الانتظار...» — لا استدعاءات مكرّرة (يوجد `submitting` مسبقاً، سنشدّه بحارس `if (submitting) return`).
- في `preview.$orderId.tsx`: استبدال `LoadingCard` البسيط بشاشة تحميل احترافية تحتوي شعار «بصمة حكاية» + شريط تقدّم (`<Progress>` من shadcn، قيمة تصاعدية زمنية) + رسائل متغيّرة كل ~3 ثوانٍ: «نكتب أحداث القصة…» → «نصمم الشخصيات…» → «نرسم المشاهد…» → «نراجع الحكاية…».
- الحماية من الاستدعاء المزدوج لتوليد النص عبر `useRef` بديلاً عن `useState(genStarted)` (React 18 StrictMode يشغل الـ effect مرتين).

## 6) «طلباتي» + إعادة تحميل مدفوع

- الصفحة `my-orders.tsx` تعمل حالياً وتُظهر طلبات المستخدم المرتبطة برقم هاتفه (`myOrders` تفلتر بـ `user_id`).
- إضافة زر «إعادة تحميل مدفوع» لكل طلب `delivered` أو `paid` بحيث ينشئ سجلاً في جدول جديد `redownload_requests` وينقل الحالة إلى `redownload_pending`.
- الإدارة (شاشة الطلبات) ترى الطلب مع سعر إعادة التحميل الذي حدّدته في `pricing_settings` (حقل جديد `redownload_iqd_pdf/printed/video`)، وتضغط «تأكيد الدفع» → يفتح تحميل PDF للمستخدم مثل الحالة الاعتيادية (بنفس زر التحميل الحالي).

## 7) صلاحيات إدارة أوسع للعملاء والطلبات

- إضافة أعمدة على `users`: `status` (`active` | `suspended` | `banned`)، ملء تلقائي.
- server fns جديدة (كلها خلف `gate()`): `adminDeleteUser`, `adminSuspendUser`, `adminBanUser`, `adminDeleteOrder`, `adminRejectOrder({orderId, reason})`.
- `adminRejectOrder` يضبط `status='cancelled'` مع `rejection_reason` و`rejected_at`، ويظهر للمستخدم في `my-orders` كإشعار «تم الرفض: <السبب>».
- في `admin.users.tsx` أعمدة إجراءات (تعليق/حظر/حذف). في `admin.orders.$id.tsx` أزرار حذف/رفض مع نافذة إدخال السبب.
- عند تسجيل الدخول (`user-session`) نتحقق من `status`؛ الحساب المحظور لا يستطيع إنشاء طلب.

## 8) الكوبونات + تسعير الأجواء

- جدول جديد `coupons`: `code, discount_type (percent|fixed), discount_value, max_uses, uses_count, valid_from, valid_to, applies_to (new|all), active`.
- جدول `coupon_redemptions` لربط الاستخدام بالمستخدم/الطلب.
- server fns: `adminListCoupons/adminUpsertCoupon/adminDeleteCoupon` + مسار `admin.coupons.tsx`.
- في `create.tsx` حقل «كود خصم» اختياري؛ التحقق `validateCoupon` عند الإرسال، ويُخصم من `amount_iqd` عند `confirmTierAndPrepareWhatsapp`.
- تسعير الأجواء: إضافة إلى `pricing_settings` حقلين: `free_moods_count` (افتراضي 1) و `mood_extra_iqd` (السعر لكل جو إضافي فوق الحد المجاني). تعديل `computeTierAmount` لتقبل `moodCount` وإضافة `Math.max(0, moods - free) * mood_extra_iqd`. يظهر السعر تحت شبكة الأجواء ويتحدث لحظياً في `create.tsx` و`preview`.

## إصلاح صفحة التأكيد (المشكلة التي أشرت إليها الآن)

- في `preview.$orderId.tsx`: قراءة `image_quality_tier` و`character_count` الفعليَّين من الطلب (نضيفهما إلى `getOrderPublic`) وتمريرهما إلى `computeTierAmount` بدلاً من `1` و`standard` الثابتَين.
- إخفاء بطاقة «فيديو» تماماً عندما `video_tier_enabled=false` (بدل التغبيش) — أو الإبقاء عليها مغبَّشة بلا سعر مضلِّل: سنعرض السعر فقط عند التفعيل، ونضع «قريباً» بدلاً منه عند الإيقاف.
- إبطال الكاش تلقائياً: كل mutation إدارية تعدّل الأسعار/الثيمات/الفيديوهات/الأجواء تستدعي `queryClient.invalidateQueries({ queryKey: ["pricing-public"] })` (وما يشابهها). كذلك تخفيض `staleTime` إلى `0` مع الإبقاء على `refetchOnWindowFocus` ليأخذ المستخدم آخر الأسعار عند العودة للصفحة.
- إضافة `refetchInterval` معتدل (60s) على `pricing-public` في صفحة المعاينة تحسّباً لتحديث السعر أثناء تصفح المستخدم.

## هجرات قاعدة البيانات (Supabase)

1. `ALTER TABLE users ADD status text DEFAULT 'active' CHECK (...)`.
2. `ALTER TABLE orders ADD rejection_reason text, rejected_at timestamptz, redownload_status text`.
3. `ALTER TABLE pricing_settings ADD free_moods_count int DEFAULT 1, mood_extra_iqd int DEFAULT 0, redownload_iqd_pdf/printed/video int DEFAULT 0`.
4. إنشاء `coupons` + `coupon_redemptions` + `redownload_requests` مع `GRANT` صحيحة و`RLS` مغلقة (كل الوصول عبر server fns).

## ملفات تُلمس

- `src/routes/create.tsx` (زر، حوار التأكيد، كوبون، منع تكرار، مبلغ الجو)
- `src/routes/preview.$orderId.tsx` (شاشة تحميل، سعر صحيح، إخفاء/إبطال الكاش)
- `src/routes/my-orders.tsx` (زر إعادة تحميل + إشعار الرفض)
- `src/routes/admin.users.tsx` (تعليق/حظر/حذف)
- `src/routes/admin.orders.$id.tsx` (رفض/حذف/سبب/تأكيد إعادة التحميل)
- `src/routes/admin.settings.tsx` (حقول الكوبون والأجواء وإعادة التحميل)
- ملف جديد `src/routes/admin.coupons.tsx`
- `src/lib/orders.functions.ts` (prompt سلبي، fns الإدارة الجديدة، إبطال الكاش عبر revalidation)
- `src/lib/pricing.ts` (moods pricing)
- `src/lib/i18n.tsx` (نصوص جديدة)
- هجرات SQL جديدة.

## غير المتأثر

- منطق التوليد نفسه (Gemini/AI Gateway) والـ style lock والـ art DNA يبقى.
- تدفق WhatsApp وتأكيد الإدارة يبقى.
- بنية المصادقة (OTP بالهاتف) والثيمات والفيديوهات الترويجية تبقى كما هي.
