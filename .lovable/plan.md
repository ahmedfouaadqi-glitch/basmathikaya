## المرحلة 1 — قفل الموقع على العربية وإخفاء (EN/KU) دون حذف

**السبب:** بعد فحص الكود:
- ملف `src/lib/i18n.tsx` يحتوي ~150 مفتاح مترجم، بينما هناك **20+ صفحة** فيها نصوص عربية مكتوبة مباشرة (hardcoded) بدون `t()` — من ضمنها: `faq.tsx`, `how-it-works.tsx`, `pricing.tsx`, `gallery.tsx`, `testimonials.tsx`, `referrals.tsx`, `s.$token.tsx`, `my-orders.tsx`, `preview.$orderId.tsx`, وكل صفحات `admin.*`.
- الكوردية (ku) في أغلب المفاتيح غير مترجمة وتقع على fallback عربي — فتظهر بالعربية داخل واجهة "كوردية"، وهذا غير احترافي.

**الحل:** إخفاء كامل للغتين الإنجليزية والكوردية من الواجهة، **مع الإبقاء على كل الكود والمفاتيح والبنية التحتية كما هي** لتفعيلها لاحقاً بترجمة كاملة.

**التغييرات:**
1. `src/routes/__root.tsx`: إخفاء `<LangSwitch>` بالكامل (desktop + mobile) — تعليق أو إزالة الاستدعاء فقط. المكوّن نفسه يبقى موجوداً في الملف.
2. `src/lib/i18n.tsx`:
   - `setLang()` تصبح no-op (تتجاهل أي محاولة تغيير لغة) — لكن التوقيع يبقى.
   - القيمة الأولية دائماً `"ar"`، وتنظيف صامت لأي قيمة قديمة `en`/`ku` في `localStorage`.
   - كل المفاتيح والترجمات تبقى في الملف بدون حذف.
3. `<html lang="ar" dir="rtl">` مقفل.

## المرحلة 2 — تحسين PWA شامل

الفحص الحالي: `manifest.webmanifest` صحيح + أيقونات + `InstallGate`. لا يوجد service worker (متوافق مع توجيهات Lovable للـ manifest-only).

**التحسينات:**

1. **`public/manifest.webmanifest`:**
   - إضافة `screenshots` (form_factor: `wide` + `narrow`) لتحسين مربّع تثبيت Chrome/Edge.
   - إضافة `shortcuts`: "ابدأ حكاية جديدة" → `/create`، "طلباتي" → `/my-orders`.
   - `prefer_related_applications: false`, `handle_links: "preferred"`.

2. **`src/routes/__root.tsx` (head):**
   - `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style: black-translucent`, `apple-mobile-web-app-title`, `mobile-web-app-capable`.
   - `theme-color` بلونين (light/dark عبر `media`) لتحسين شريط الحالة على Android.
   - `viewport` مع `viewport-fit=cover` لدعم safe-area (النوتش).
   - `<link rel="apple-touch-startup-image">` (splash) لأجهزة iOS الشائعة (2-3 مقاسات).

3. **`src/components/InstallGate.tsx`:**
   - عدم العرض داخل iframe (`window.top !== window.self`) ولا في `id-preview--*`, `preview--*`, `beta.lovable.dev`, `*.lovableproject.com`.
   - تحسين تعليمات iOS (Share → Add to Home Screen).
   - زر "لاحقاً" مع تذكير بعد N أيام (localStorage timestamp).

4. **CSS safe-area** في `src/styles.css`:
   - `padding-top: env(safe-area-inset-top)` للـ header، و`padding-bottom: env(safe-area-inset-bottom)` للأسفل.
   - `@media (display-mode: standalone)` لإخفاء `InstallGate` في التطبيق المثبت.

**لن نضيف service worker** (طلبك لم يذكر offline، والتوجيهات تمنعه بدون حاجة صريحة).

## المرحلة 3 — تحسين التجاوب (Responsive) شامل

**المشاكل المكتشفة:**
- `flex flex-wrap` في headers متعددة العناصر → ينكسر على الجوال.
- جداول `admin.*` و`my-orders.tsx` بدون scroll أفقي على الجوال.
- عناوين بحجم ثابت `text-2xl+` بدون scale متجاوب.
- بعض الشبكات تقفز من 1 عمود إلى 3 دون خطوة `sm:grid-cols-2`.

**التغييرات:**

1. **Headers نص + ويدجت:** تحويلها إلى النمط المعتمد في `responsive-layout-patterns`:
   ```
   grid grid-cols-[minmax(0,1fr)_auto] sm:flex sm:justify-between
   + min-w-0 على النص + shrink-0 على الأيقونات + truncate على العناوين
   ```
   الملفات: `__root.tsx`, `admin.orders.$id.tsx`, `admin.index.tsx`, `admin.users.tsx`, `my-orders.tsx`, `preview.$orderId.tsx`.

2. **الجداول:** لفّ كل `<table>` في `<div className="overflow-x-auto -mx-4 sm:mx-0"><table className="min-w-full">…` في صفحات الإدارة.

3. **العناوين المتجاوبة:** `text-2xl sm:text-3xl md:text-4xl` في `index.tsx`, `pricing.tsx`, `how-it-works.tsx`, `faq.tsx`.

4. **الشبكات:** `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` + `gap-3 sm:gap-4 md:gap-6`.

5. **`create.tsx`:** فحص خاص — نموذج طويل:
   - حقول full-width على الجوال.
   - أزرار Wizard steps عمود واحد أسفل `sm:`.
   - Character cards grid: `grid-cols-2 sm:grid-cols-3 md:grid-cols-4`.
   - Art style picker: يبقى مربعات، لكن `grid-cols-2 sm:grid-cols-3`.

6. **PDF preview:** تأكيد أن iframe/canvas لا يتخطى `100vw`.

7. **`src/styles.css`:** قاعدة safety net عامة `img, video, iframe { max-width: 100%; height: auto }`.

8. **تحقق بصري:** Playwright بثلاث viewports (375, 768, 1280) على الصفحات الرئيسية بعد التنفيذ.

## الملفات المتأثرة

- `src/lib/i18n.tsx` — قفل اللغة (بدون حذف)
- `src/routes/__root.tsx` — إخفاء LangSwitch + head PWA metadata + safe-area
- `public/manifest.webmanifest` — shortcuts + screenshots
- `src/components/InstallGate.tsx` — guards + تحسينات iOS
- `src/styles.css` — safe-area + responsive safety net
- ~10 صفحات (admin + public) — إصلاحات header/table/grid

## ما لن نغيره

- منطق العمل، قاعدة البيانات، RLS.
- بنية `i18n` أو المفاتيح — كلها محفوظة للمستقبل.
- لن نضيف Service Worker.