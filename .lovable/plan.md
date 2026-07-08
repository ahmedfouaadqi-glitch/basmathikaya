## Stage 8: Referrals, Public Gallery, and Marketing Tools

بعد اكتمال المراحل 1-7، ننتقل للمرحلة 8 التي تركز على أدوات النمو والتسويق.

### 1) نظام الإحالات (Referrals)
- **جدول جديد `referrals`**: `id`, `referrer_user_id`, `referred_user_id`, `code`, `status` (pending/completed/rewarded), `reward_amount`, `created_at`, `completed_at`
- **جدول `referral_rewards`**: تتبع المكافآت المصروفة (رصيد/كوبونات)
- **حقل `referral_code`** في `users` (يُولَّد تلقائياً عند التسجيل)
- **دوال server**:
  - `getMyReferralStats` — إحصائيات المستخدم (عدد الإحالات، المكافآت)
  - `generateReferralLink` — رابط مشاركة بالكود
  - `redeemReferralOnSignup` — عند تسجيل مستخدم جديد بكود
  - `completeReferralOnFirstOrder` — منح المكافأة عند أول طلب مكتمل
- **صفحة `/referrals`**: لوحة المستخدم مع الرابط، الإحصائيات، سجل الإحالات
- **إضافة حقل كود الإحالة** في صفحة التسجيل `/auth`

### 2) المعرض العام (Public Gallery)
- **صفحة `/gallery`** عامة (بدون auth) — SSR
- تعرض القصص التي تم مشاركتها علناً (`orders.is_public = true` أو عبر `share_events`)
- بطاقات بالصورة، اسم البطل، الثيم، رابط للـ `/s/$token`
- فلترة حسب الثيم/العمر
- **جدول `orders`**: إضافة عمود `is_public boolean default false` و `gallery_featured boolean`
- إعداد في صفحة `/my-orders` للسماح للمستخدم بجعل قصته عامة
- إدارة في `/admin/gallery` للترشيح والإخفاء

### 3) صفحات تسويقية
- **`/how-it-works`** — شرح مصور بالخطوات
- **`/pricing`** — عرض الباقات من `pricing_settings` + مقارنة
- **`/testimonials`** — شهادات من `site_content` أو جدول جديد `testimonials`
- **`/faq`** — أسئلة شائعة من `site_content`
- تحديث الصفحة الرئيسية `/` لتشمل روابط لهذه الصفحات + قسم من المعرض

### 4) SEO & Meta
- head() فريد لكل صفحة (title, description, og:image)
- `/gallery` و `/s/$token` تستخدم صور القصص كـ og:image
- إضافة `sitemap.xml` عبر server route `/api/public/sitemap.xml`
- `robots.txt` عبر server route

### 5) تحليلات التسويق
- **صفحة `/admin/referrals`** — إحصائيات الإحالات، أفضل المروجين، تكلفة الاكتساب
- **صفحة `/admin/gallery`** — إدارة القصص العامة، ترشيح المميّزة
- تتبع مصدر الزيارة (utm params) في `download_events` أو جدول جديد `visit_events`

### ملفات جديدة (تقريباً 15-18):
- Migration واحدة: `referrals`, `referral_rewards`, `testimonials`, تعديلات على `users` و `orders`
- `src/lib/referrals.functions.ts`, `src/lib/gallery.functions.ts`, `src/lib/marketing.functions.ts`
- Routes: `referrals.tsx`, `gallery.tsx`, `how-it-works.tsx`, `pricing.tsx`, `testimonials.tsx`, `faq.tsx`
- Admin: `admin.referrals.tsx`, `admin.gallery.tsx`
- Server routes: `api/public/sitemap.xml.ts`, `api/public/robots.txt.ts`
- تحديثات: `auth.tsx` (كود إحالة)، `my-orders.tsx` (زر جعل عامة)، `index.tsx` (روابط تسويقية)، `admin.tsx` (nav)

### مبادئ:
- تراجعية آمنة: الحقول الجديدة كلها optional مع defaults
- RLS صارم: `referrals` يقرأها المالك فقط، `gallery` عام للقراءة إن `is_public=true`
- audit_log لكل عملية إدارية

### التحقق:
- `bunx tsgo --noEmit`
- اختبار تسجيل بكود إحالة → أول طلب → صرف المكافأة
- تحميل `/gallery` كضيف
- تحقق `og:image` عبر Playwright على `/s/$token` و `/gallery`

هل أبدأ التنفيذ الكامل، أم تريد جزءاً محدداً فقط (مثلاً: الإحالات والمعرض فقط دون الصفحات التسويقية)؟