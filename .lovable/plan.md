
## الهدف
عند فتح "بصمة حكاية" من هاتف أو تابلت عبر المتصفح، يُعرض حاجز إلزامي يطلب تثبيت التطبيق على الشاشة الرئيسية، ولا يُسمح بتصفّح الموقع إلا بعد التثبيت أو من سطح المكتب.

## السلوك المطلوب

| الحالة | ما يحدث |
|---|---|
| سطح المكتب (شاشة ≥ 1024px أو مؤشّر دقيق) | الموقع يعمل عادياً، لا حاجز |
| موبايل/تابلت + تشغيل مُثبَّت (`display-mode: standalone`) | الموقع يعمل عادياً |
| موبايل/تابلت + متصفّح عادي + Chrome/Edge/Android (يدعم `beforeinstallprompt`) | شاشة كاملة إلزامية بزر **"تثبيت التطبيق"** يستدعي `prompt()` مباشرة |
| موبايل/تابلت + iOS Safari (لا يدعم `beforeinstallprompt`) | شاشة كاملة إلزامية تشرح بالعربية والإنجليزية: "اضغط زر المشاركة ← أضف إلى الشاشة الرئيسية"، مع صور إرشادية متحرّكة |
| معاينة Lovable / iframe / `?sw=off` | الحاجز مُعطَّل (لكي لا يحجب التطوير) |

## شاشة الحاجز
- خلفية بهوية المشروع (تدرّج Teal/Gold + الشعار الكبير).
- العنوان: «لتجربة أفضل، ثبّت تطبيق بصمة حكاية» / "Install Basma Hekaya to continue".
- مزايا مختصرة: «أسرع، يعمل كتطبيق، أيقونة على شاشتك».
- زر تثبيت رئيسي + إرشادات iOS عند الحاجة.
- بدون زر تجاوز. (يبقى رابط واتساب الدعم 07733570130 فقط.)

## التغييرات التقنية

| ملف | التغيير |
|---|---|
| `public/manifest.webmanifest` | تحسين الحقول: `name`, `short_name: "بصمة حكاية"`, `display: "standalone"`, `start_url: "/"`, `scope: "/"`, `theme_color`, `background_color`، `lang: "ar"`, `dir: "rtl"`, `categories: ["books","education","kids"]` |
| `public/icons/` (جديد) | أيقونات PNG مُولّدة من الشعار: 192، 512، 512-maskable، apple-touch-icon 180 |
| `src/routes/__root.tsx` | إضافة meta tags لـ iOS: `apple-mobile-web-app-capable`, `apple-mobile-web-app-title`, `apple-touch-icon`، و`theme-color`. تركيب `<InstallGate/>` يلفّ المحتوى |
| `src/components/InstallGate.tsx` (جديد) | منطق الاكتشاف (UA + `matchMedia('(display-mode: standalone)')` + `navigator.standalone` لـ iOS + استثناء iframe/preview) والتقاط `beforeinstallprompt` وعرض شاشة الحاجز |
| `src/components/InstallInstructionsIOS.tsx` (جديد) | إرشادات بصرية لـ iOS (Share → Add to Home Screen) |
| `src/lib/i18n.tsx` | مفاتيح ترجمة جديدة: `installGate.title`, `installGate.subtitle`, `installGate.installBtn`, `installGate.iosStep1..3`, `installGate.benefits.*` |

## ضمانات السلامة
- **لا Service Worker جديد** ولا `vite-plugin-pwa` — هذا تثبيت Manifest-only فقط، وفق توجيه Lovable.
- الحاجز يُعطَّل تلقائياً داخل iframe المعاينة وعلى نطاقات `*.lovableproject.com` لكي لا يُعطّل التحرير.
- يُحفظ تفضيل المستخدم في `localStorage` بعد التثبيت لإيقاف إعادة الفحص، ويُعاد ضبطه إذا فُتح الموقع خارج وضع التطبيق مجدداً.

بعد موافقتك، أُولّد الأيقونات وأُنفّذ الحاجز وأتحقق من ظهوره فعلياً على موبايل وتابلت بدون تأثير على سطح المكتب.
