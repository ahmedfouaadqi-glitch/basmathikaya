## الهدف
جعل نص التنبيه (18+) في صفحة الإنشاء وصفحة سياسة المحتوى كاملةً قابلة للتعديل من لوحة الإدارة، بدل كونها ثابتة في الكود.

## الخطوات

### 1) قاعدة البيانات — Migration
جدول جديد `site_copy` لتخزين النصوص القابلة للتحرير:
- `key` (PK, نص): معرّف فريد (مثلاً `create.adult_notice`, `content_policy.page`).
- `title` (نص اختياري).
- `body_md` (نص طويل، Markdown مدعوم).
- `updated_at`, `updated_by`.
- GRANT: `SELECT` للجميع (anon + authenticated)، كل الصلاحيات لـ service_role.
- RLS: قراءة عامة، الكتابة عبر service_role فقط (من دوال الأدمن).
- بذر ابتدائي بقيمتين:
  - `create.adult_notice`: نص التنبيه الحالي.
  - `content_policy.page`: محتوى صفحة السياسة الحالي مقسّم لأقسام (safe / review / rejected / privacy) داخل حقل واحد Markdown، أو 4 مفاتيح منفصلة إذا فضّلت التقسيم — سأستخدم مفتاحاً واحداً `content_policy.page` بـ Markdown لتبسيط التحرير.

### 2) طبقة الوصول
`src/lib/site-copy.functions.ts`:
- `getSiteCopy({ key })` — عام، يقرأ نصاً واحداً.
- `getSiteCopyBulk({ keys })` — عام، يجلب عدة مفاتيح دفعة واحدة.
- `adminUpsertSiteCopy({ key, title, body_md })` — محمي بـ `requireAdmin`، مع تسجيل في `audit_log`.
- `adminListSiteCopy()` — يعرض كل المفاتيح للأدمن.

### 3) واجهة الأدمن
`src/routes/admin.site-copy.tsx`:
- قائمة بكل المفاتيح مع زر تعديل.
- محرر بسيط (textarea كبير) لـ `body_md` + عنوان.
- معاينة Markdown مباشرة.
- إضافته في القائمة الجانبية داخل `src/routes/admin.tsx`.

### 4) استهلاك النصوص في الواجهة العامة
- `src/routes/create.tsx`: بدل النص الثابت للتنبيه، استخدام `useQuery` مع `getSiteCopy({key:'create.adult_notice'})` وعرضه عبر مكوّن Markdown خفيف (`react-markdown` موجود أصلاً أو استخدام تحويل بسيط).
- `src/routes/content-policy.tsx`: تحويل الصفحة لقراءة `content_policy.page` من قاعدة البيانات وعرضه كـ Markdown، مع إبقاء التنسيق (أقسام ملوّنة) عبر اتفاقية بسيطة: نستخدم عناوين `## آمن` / `## مراجعة` / `## مرفوض` / `## خصوصية` ونلوّن كل قسم بناءً على العنوان، أو نحتفظ بإطار الصفحة ونضع محتوى Markdown داخل بطاقة واحدة قابلة للتحرير بالكامل.

### 5) SEO والأداء
- Loader يجلب النص عبر `queryClient.ensureQueryData` لتجنّب الوميض في SSR.
- كاش قصير (60 ثانية) على مستوى الاستعلام.

## نقطة قرار سريعة
هل تفضّل:
- **(أ)** مفتاح واحد لصفحة السياسة (`content_policy.page`) بـ Markdown حر — أبسط للأدمن، تنسيق أقل صرامة.
- **(ب)** أربعة مفاتيح منفصلة (`policy.safe`, `policy.review`, `policy.rejected`, `policy.privacy`) — يحافظ على البطاقات الملوّنة الحالية بدقة.

سأمضي بالخيار **(ب)** افتراضياً للحفاظ على التصميم الحالي، أخبرني إن أردت (أ).
