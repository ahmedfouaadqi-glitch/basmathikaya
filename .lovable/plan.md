
## الأهداف

تنفيذ سبع مهام: اختبار PDF فعلي على محاكي iPhone/Android، ضبط الهيدر على كل المقاسات، تحسين تخزين PWA المؤقت، إخفاء بوابة الإدارة من واجهة المستخدم وحصرها برقمين هاتف، موازنة النص مع الصورة في صفحات القصة، تكبير وتحريك الشعار، وتكبير أيقونة التثبيت.

---

## 1) اختبار PDF على iPhone وAndroid

- تشغيل Playwright بمحاكاة `iPhone 14 Pro` و`Pixel 7` على مسار `/preview/$orderId` لطلب تجريبي جاهز.
- فتح PDF المُولَّد، تحويله إلى صور صفحة-بصفحة عبر `pdftoppm`، ومعاينة:
  - عدم اقتطاع الصور (الإطار الكامل ضمن A4).
  - تشكيل الحروف العربية (لا حروف منفصلة ولا انعكاس).
  - عدم تبعثر الفقرات (سطر فارغ بين الفقرات، محاذاة يمين سليمة).
- إصلاحات متوقعة في `src/lib/pdf-client.ts`:
  - استبدال `object-fit: cover` بـ `contain` على غلاف وصفحات القصة لمنع قص الصور على الشاشات الصغيرة.
  - استخدام `html2canvas-pro` بـ `scale: window.devicePixelRatio >= 2 ? 2 : 1.5` لتقليل استهلاك الذاكرة على iOS.
  - انتظار `document.fonts.ready` + تأخير `requestAnimationFrame` مزدوج قبل الالتقاط لضمان تحميل خط Tajawal فعلياً قبل snapshot (مصدر شائع لتبعثر النص على iOS).
  - تثبيت `lang="ar"` و`dir="rtl"` على عنصر الـhost لا على الأطفال فقط حتى يتحول bidi بشكل صحيح.

## 2) ضبط الهيدر على جميع المقاسات (وموازنة الموازنة بين نص وصورة)

- في `src/routes/__root.tsx`:
  - تحويل صف الهيدر إلى `grid grid-cols-[auto_minmax(0,1fr)_auto]` على الموبايل/التابلت، وflex على ≥`lg`، مع `min-w-0` و`truncate` للعنوان و`shrink-0` للشعار وأزرار اللغة/القائمة.
  - رفع نقطة كسر القائمة من `md` إلى `lg` لأن التابلت (768–1023px) لا يتسع للروابط الثلاثة + اسم العلامة + زر اللغة.
  - تقليل padding على ≤sm وزيادة الفجوات على ≥md لمنع التراكب أثناء انتقال إطار PWA.

## 3) تحسين تخزين PWA المؤقت ومنع تراكب الهيدر بعد التثبيت

- إنشاء/تحديث `public/manifest.webmanifest`: `display: "standalone"`, `start_url: "/?source=pwa"`, `theme_color: "#169CA3"`, `background_color: "#FFFBF5"`.
- عدم إدخال service worker جديد (لا أوفلاين مطلوب) — الإبقاء على المنهج manifest-only كي لا تُكسر معاينة Lovable.
- معالجة تراكب الهيدر بعد التثبيت: إضافة `padding-top: env(safe-area-inset-top)` على الهيدر + `viewport-fit=cover` (موجود) لتجنّب اختفاء العناوين خلف notch iOS، وضبط ارتفاع ثابت أدنى للهيدر `min-h-[56px]` لمنع القفز بعد تحميل الشعار.

## 4) إخفاء الإدارة من الكود وحصرها برقمين

- حذف رابط "الإدارة" من قائمة الهيدر (سطح المكتب والموبايل) في `src/routes/__root.tsx`.
- إبقاء مسار `/admin/login` يعمل لكن غير مكتشف من الواجهة — الدخول فقط لمن يعرف الرابط.
- في `src/lib/admin-session.server.ts`:
  - تغيير التحقق إلى قائمة بيضاء `["07733570130", "07705828333"]` مع الرمز المشترك `7979`.
  - مقارنة عبر `timingSafeEqual` على كل من رقم الهاتف ورمز الدخول.
- إزالة أي ذكر نصي للوحة الإدارة من `i18n.tsx` في واجهة المستخدم العام.

## 5) موازنة النص والصورة في صفحات PDF

- في `buildPageHtml` ضمن `src/lib/pdf-client.ts`:
  - تقليل ارتفاع كتلة الصورة من `520px` إلى `420px` لإفساح المجال للنص.
  - زيادة `font-size` من 20 إلى 22 و`line-height` من 1.95 إلى 2.1، وإضافة `text-align: justify` مع `text-justify: inter-word`.
  - زيادة الـpadding أسفل الصورة قبل النص إلى 32px، وإضافة فاصل ذهبي خفيف.
- تحديث `generateFullStory` في `src/lib/orders.functions.ts`: رفع الحد الأدنى المطلوب من Gemini لكل صفحة من ~2-3 جمل إلى **4-6 جمل (60-90 كلمة عربية)** ليتوازن النص بصرياً مع الصورة.

## 6) تكبير وتحريك الشعار

- الصفحة الرئيسية `src/routes/index.tsx`: تكبير الشعار البطل إلى `h-48 md:h-64` وإضافة فئة `animate-logo-float` (حركة عائمة + توهج مائي تحته).
- الهيدر: زيادة الحجم إلى `h-12 sm:h-14 md:h-16` مع تطبيق أنيميشن خفيف (`animate-spin-slow` عند hover فقط حتى لا يشتت).
- إضافة keyframes في `src/styles.css`:
  - `@keyframes logo-float` — حركة up/down 6s.
  - `@keyframes water-ripple` — موجة شفافة `::after` تحت الشعار.
  - `@keyframes spin-slow` — دوران 12s.

## 7) تكبير أيقونة التثبيت

- إعادة توليد الأيقونات بحدّ أدنى للحشوة (padding) أصغر وأقصى استخدام للإطار:
  - `public/icons/icon-192.png`، `icon-512.png`، `icon-maskable-512.png`، `apple-touch-icon.png` (180px).
- تحديث `manifest.webmanifest`:
  - إضافة `purpose: "any"` و`purpose: "maskable"` بأيقونات منفصلة.
  - رفع `sizes` ليشمل 192/256/384/512.
- على Android: ضمان أن منطقة "الأمان" داخل maskable تستخدم ~90% من المساحة (بدلاً من 60-70% الحالية) ليظهر الشعار أكبر على الشاشة الرئيسية.

---

## ملفات ستُعدَّل
- `src/lib/pdf-client.ts` (موازنة + جودة + iOS fonts)
- `src/lib/orders.functions.ts` (طول النص في كل صفحة)
- `src/routes/__root.tsx` (هيدر متجاوب + حذف رابط الإدارة + safe-area)
- `src/routes/index.tsx` (تكبير شعار البطل + الأنيميشن)
- `src/styles.css` (keyframes)
- `src/lib/admin-session.server.ts` (قائمة أرقام بيضاء)
- `src/lib/i18n.tsx` (إزالة nav_admin من الواجهة)
- `public/manifest.webmanifest` + إعادة توليد أيقونات `public/icons/*`

## التحقق
- بناء Vite ناجح + Playwright على iPhone/Pixel: لقطات لصفحة PDF + الهيدر في وضعَي portrait/landscape.
- اختبار يدوي لتدفق `/admin/login` بالرقمين الجديدين، والتأكد من اختفاء الرابط نهائياً من قوائم الموقع.
