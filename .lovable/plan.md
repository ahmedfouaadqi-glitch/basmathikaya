## الهدف
تحسينان كبيران دون كسر الطلبات الحالية:
1. إعادة تصميم PDF ليبدو كتاب أطفال احترافي.
2. إضافة اختيار "أسلوب الرسم" (واقعي/كرتوني + نمط فرعي) يُطبَّق ثابتاً على كل صور القصة، مع إدارة الأنماط من لوحة الإدارة.

---

## أولاً: إعادة تصميم PDF

الملف: `src/lib/pdf-client.ts` (537 سطراً — يستخدم pdf-lib في المتصفح).

### تغييرات التخطيط
- **صورة أكبر**: الصورة تشغل ~75% من ارتفاع الصفحة (بدل الحالي).
- **إزالة الإطار السميك** واستبداله بظل ناعم (soft drop shadow) وحواف دائرية خفيفة (rounded corners عبر رسم مقاطع).
- **صندوق النص**: مستطيل بخلفية `#FFF8EE` بشفافية 92% وحواف دائرية أسفل الصورة، بدون خط حاد.
- **هوامش موحّدة**: 36pt (عمودي) / 48pt (أفقي)، متساوية على كل الجهات.
- **رقم الصفحة**: أسفل الوسط، خط رفيع صغير `#8A7A5C`، مع زخرفة رمزية بسيطة (نقطة/شرطتان).
- **Spread mode للأفقي**: صفحتان متتاليتان تُصمَّمان كلوحة واحدة (نفس الخلفية الممتدة، رقم الصفحة أسفل خارجي).
- **الغلاف**: تصميم منفصل — العنوان بخط كبير مزخرف فوق الصورة الكاملة مع gradient overlay سفلي للقراءة.
- **دعم RTL/العربية**: يبقى كما هو (نفس آلية `arabicFont`).

### دعم الاتجاهين
- Portrait: صورة أعلى، نص أسفل.
- Landscape: صورة يمين (RTL: يسار)، نص في العمود المقابل، مع "spread" يمتد عبر الصفحتين.

### عدم الكسر
- توقيع `buildAndDownloadStoryPdf` يبقى كما هو.
- لا تغيير على مصادر الصور/النصوص، فقط منطق الرسم.

---

## ثانياً: نظام اختيار الأسلوب الفني

### 1) قاعدة البيانات (migration جديدة)

جدول جديد `art_styles`:
```
id uuid pk, slug text unique, category text ('realistic'|'cartoon'),
name_ar text, name_en text, prompt_fragment text,
is_default boolean, is_enabled boolean, sort_order int,
created_at, updated_at
```
GRANT SELECT للـ anon/authenticated، ALL للـ service_role.
RLS: SELECT عام للمفعّل فقط؛ كتابة للـ admin عبر `has_role`.

تعبئة seed بالأنماط المطلوبة:
- realistic → Realistic
- cartoon → Cartoon Classic, Anime, Manga, Pixar Style, Disney Style, Chibi, Watercolor, Storybook Illustration (افتراضي)

إضافة على `orders`:
- `art_style_category text` (nullable)
- `art_style_slug text` (nullable)

`art_style_lock` الحالي يبقى ويُعاد استخدامه كـ prompt المُجمَّد للطلب.

### 2) واجهة الإنشاء `src/routes/create.tsx`
بعد رفع الصورة وقبل الخطوة التالية:
- سؤال 1: بطاقتان (واقعي / كرتوني).
- إن كرتوني: سؤال 2 — شبكة بطاقات صغيرة بمعاينة اسم النمط (يمكن لاحقاً إضافة ثمبنيل).
- الاختيار يُخزَّن في state ويُرسَل مع `createOrder`.

### 3) الخادم `src/lib/orders.functions.ts`
- `createOrder` يقبل `artStyleCategory` و `artStyleSlug` (اختياريان — Backward compatible).
- `runImageGenerationForOrder`: عند أول توليد، يقرأ النمط من `art_styles` عبر `slug`، ويبني `art_style_lock` = `prompt_fragment` (بدلاً من الافتراضي المُشفَّر الحالي في السطر 1172).
- إن كان الطلب قديماً بلا `art_style_slug`: يُعامَل كـ `cartoon/storybook` (نفس السلوك الحالي) — لا كسر.
- الأسلوب يُطبَّق نفسه على: character sheet، DNA، cover، جميع الصفحات، إعادة التوليد، ومشاركة الشخصية في المكتبات (لأن الكل يمر عبر نفس `art_style_lock`).

### 4) لوحة الإدارة — مسار جديد `src/routes/admin.art-styles.tsx`
- جدول بأنماط `art_styles`.
- تفعيل/تعطيل، ترتيب (سحب أو أزرار سهم)، تعديل الاسم، تعديل `prompt_fragment`، تعيين افتراضي (واحد لكل category)، إضافة/حذف.
- server functions: `listArtStyles`, `upsertArtStyle`, `deleteArtStyle`, `setDefaultArtStyle` — كلها محمية بـ `requireSupabaseAuth` + فحص دور admin عبر `has_role`.
- إضافة رابط في `src/routes/admin.tsx` sidebar.

### 5) توافق خلفي
- طلبات بلا `art_style_slug` → تعمل تماماً كما هي.
- إعادة توليد صور طلب قديم → تستخدم `art_style_lock` الموجود.
- إن حُذف نمط من الإدارة، الطلبات المرتبطة لا تتأثر لأن الـ prompt محفوظ في `art_style_lock`.

---

## الملفات المتأثرة
- **جديد**: migration، `src/routes/admin.art-styles.tsx`، `src/lib/art-styles.functions.ts`.
- **معدَّل**: `src/lib/pdf-client.ts` (إعادة كتابة تخطيط الصفحة)، `src/routes/create.tsx` (خطوة اختيار الأسلوب)، `src/lib/orders.functions.ts` (تمرير + قراءة النمط)، `src/routes/admin.tsx` (رابط)، `src/integrations/supabase/types.ts` (يُجدَّد آلياً بعد migration).

---

## خطوات التنفيذ
1. migration (يحتاج موافقتك).
2. server functions للأنماط + admin UI.
3. تحديث `create.tsx` بخطوة الاختيار.
4. تحديث `runImageGenerationForOrder` لقراءة prompt النمط.
5. إعادة تصميم PDF layout (portrait + landscape + spread + cover).
6. اختبار طلب قديم (بلا نمط) وطلب جديد (بنمط مختار).

هل أبدأ التنفيذ؟