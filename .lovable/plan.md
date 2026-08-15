# تطبيق ترحيلات المستودع (المعرض + تثبيت المراجع والكاشات) ثم النشر

## الوضع الحالي (تم التحقق)
- كود المستودع مُزامَن فعلاً: ملفات `gallery.functions.ts` و`admin.gallery.tsx` و`orders.functions.ts` تستخدم `gallery_category` و`reference_snapshot` بالفعل.
- قاعدة البيانات متأخرة عن الكود: أعمدة `orders.content_mode`، `orders.gallery_category`، و`order_characters.reference_snapshot` غير موجودة حتى الآن.
- مفاتيح الكاش موجودة في `feature_flags` لكن `rollout_percent = 0`، أي معطّلة عملياً رغم `enabled = true`.
- ملفات الترحيل الأربعة موجودة في `supabase/migrations/` ولم تُطبَّق بعد.

## ما سيُنفَّذ
1. تطبيق `20260814000000_content_modes_and_ai_routing.sql` أولاً — ترحيل المعرض يعتمد على عمود `content_mode` الذي يضيفه هذا الملف، وبدونه يفشل.
2. تطبيق `20260815000000_gallery_categories.sql` — إضافة `gallery_category` (kids / adults / general) مع فهرس وترحيل القيم القديمة.
3. تطبيق `20260815000001_openrouter_models.sql` — إعدادات نماذج OpenRouter كما هي في المستودع بلا تعديل.
4. تطبيق `20260816000000_lock_references_enable_caches.sql` — إضافة `reference_snapshot` و`reference_locked_at`، وتفعيل الكاشات الست بنسبة 100%.
5. التحقق بعد الترحيل: فحص وجود الأعمدة، وأن مفاتيح الكاش أصبحت `rollout_percent = 100`، وتشغيل فحص البناء.
6. اختبار سريع لصفحة `/gallery` (تبويبا الصغار/الكبار + تأكيد العمر) وصفحة `/admin/gallery` (تغيير التصنيف).
7. عرض زر النشر وانتظار موافقتك الصريحة قبل النشر.

## ملاحظات
- ستُطبَّق ملفات SQL كما هي حرفياً من المستودع دون إعادة كتابة.
- لا متغيرات بيئة جديدة، ولا تعديل على منطق موافقة الإدارة للمحتوى البالغين، ولا على مسار OpenRouter أو منطق المعارض.
- كل ترحيل يظهر لك كبطاقة موافقة منفصلة قبل تنفيذه.
