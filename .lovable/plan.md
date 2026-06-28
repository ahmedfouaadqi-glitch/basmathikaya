
## السبب الجذري للخطأ الأحمر

عند الفحص تبيّن أمران مجتمعان:

1. **ملف الخطوط `src/lib/tajawal-fonts.server.ts` تالف**: `TAJAWAL_REGULAR_B64` ليس TTF بل base64 لصفحة HTML من github.com — أيّ `embedFont` يفشل حتمًا.
2. **عدم توافق `@pdf-lib/fontkit` مع Cloudflare Worker**: تابعها `restructure` يستخدم helpers من `tslib`؛ مع esbuild/workerd يصبح `__toESM(require("tslib")).default` غير معرّف، فيُرمى:
   `Cannot destructure property '__extends' of '__toESM(...).default' as it is undefined`

النتيجة: `images_error` يُحفظ، لا يُولَّد `pdf_path`، فلا زر تحميل.

---

## الإصلاح — بناء PDF في المتصفح بشكل قصة كاملة

### 1) نقل بناء PDF إلى العميل (يتجنّب workerd كليًا)

ملفات جديدة:
- **`src/lib/pdf-client.ts`** — استيراد كسول لـ `pdf-lib` و`@pdf-lib/fontkit`، وتحميل خط Tajawal من الحزمة المحلية:
  ```ts
  import tajawalRegUrl from "@fontsource/tajawal/files/tajawal-arabic-400-normal.woff?url";
  import tajawalBoldUrl from "@fontsource/tajawal/files/tajawal-arabic-700-normal.woff?url";
  ```
  (Vite يحوّلهما لأصول مُقطّعة hash — لا حاجة لـ base64 ضخم).
- **`getStoryPdfAssets({orderId})`** في `orders.functions.ts` — يُرجع روابط Supabase موقّعة للغلاف وصور الصفحات، وكل بيانات القصة:
  ```ts
  { title, language, customerName, moods, coverUrl, themeAccent,
    pages: [{number, text, imageUrl}] }
  ```

### 2) شكل القصة في الـ PDF (كل التفاصيل + الثيم)

**صفحة الغلاف** (A4 عمودي):
- خلفية ملوّنة بلون الثيم النشط (أو Teal/Gold الافتراضي).
- الغلاف المرسوم يأخذ ~60% من الارتفاع، إطار مدوّر بظل خفيف.
- العنوان بخط Tajawal-Bold ضخم، توسيط، لون من الثيم.
- سطر فرعي: "حكاية مخصصة لـ {اسم العميل}".
- شارات الأجواء كحبّات (chips) أسفل العنوان.
- شعار "بصمة حكاية" صغير في زاوية الغلاف (نفس متطلّب العلامة المائية).

**كل صفحة قصة**:
```
┌──────────────────────────┐
│  ┌────────────────────┐  │
│  │                    │  │  ← الصورة في النصف العلوي
│  │   صورة المشهد     │  │     (مستطيل 4:3 بإطار خفيف)
│  │                    │  │
│  └────────────────────┘  │
│                          │
│   النص العربي المُشكَّل   │  ← Tajawal-Regular 14pt
│   موزّع على أسطر بمحاذاة │     محاذاة يمين، تشكيل عربي
│   يمين، تشكيل صحيح…       │     عبر arabic-persian-reshaper
│                          │     (يعمل بسلاسة في المتصفح)
│                          │
│  ─────────────────────   │
│   صفحة 3        ◆ شعار   │  ← تذييل: رقم الصفحة + شعار صغير
│  بصمة حكاية —            │     + سطر "جزء من نظام معروف"
│  جزء من نظام معروف        │
└──────────────────────────┘
```

تفاصيل:
- لون التذييل والإطارات من `themeAccent` (مثلاً أحمر محرّم في موسمه).
- شعار "بصمة حكاية" PNG صغير ~25px في زاوية كل صفحة.
- ترقيم: «صفحة X من N» بالعربي، «Page X of N» بالإنجليزي.
- صفحة أخيرة "شكرًا" تحوي رابط TikTok وقالب الطلب التالي.

### 3) تكامل مع التدفّق

- **أزرار "تحميل القصة PDF"** في `admin.orders.$id.tsx` و`preview.$orderId.tsx`: تستدعي `getStoryPdfAssets` → `buildAndDownloadStoryPdf` بدلًا من `getStoryPdfUrl`.
- **في `adminConfirmPaymentAndGenerate`**: حذف خطوة بناء/رفع PDF من الخادم. القصة "جاهزة" = الصور كلها مولّدة (`images_status: "ready"`).
- شرط ظهور زر التحميل = `images_status === "ready"` فقط (بدون انتظار `pdf_path`).
- `src/lib/pdf.server.ts` يبقى دون استيراد من المسار الحرج.

### 4) إصلاح ملف الخطوط الاحتياطي
استبدال محتوى `src/lib/tajawal-fonts.server.ts` ببيانات Tajawal TTF حقيقية (احتياط فقط — لم يعد على المسار الحرج).

---

## التحقّق من عمل كل النظام (Playwright)

بعد الإصلاح، أُشغّل اختبارًا حيًا يغطّي السيناريو كاملًا ويحفظ لقطات في `/tmp/browser/`:

1. تسجيل دخول مستخدم (OTP من قاعدة البيانات).
2. إنشاء طلب 5 صفحات + شخصية + جوّ + رفع صورة.
3. تأكيد الطلب → `/preview/$id`.
4. دخول الإدارة (`07733570130` / `7979`) → فتح الطلب.
5. تأكيد الدفع → انتظار `images_status=ready` عبر Realtime.
6. الضغط على "تحميل القصة PDF" والتحقق من:
   - تنزيل الملف فعلًا.
   - فحص بصري عبر `pdftoppm` للقطات الصفحات.
   - وجود الغلاف، النص العربي صحيح الاتجاه ومُشكَّل، الصور فوق النص، الترقيم، التذييل "بصمة حكاية — جزء من نظام معروف"، لون الثيم.
7. التأكد من ظهور صور العميل في الإدارة، البحث، الإحصائيات، صفحة الثيمات.
8. اختبار حاجز التثبيت بـ User-Agent موبايل (يظهر) ومكتبي (لا يظهر).

أُلخّص النتائج (نجاح/فشل لكل خطوة + لقطات) في الردّ النهائي وأُصلح أي خلل جانبي ضمن نفس الجولة.

---

## ملفات تتأثر

| الملف | التغيير |
|---|---|
| `src/lib/pdf-client.ts` | جديد — بناء PDF تجاري بشكل قصة كاملة |
| `src/lib/orders.functions.ts` | إضافة `getStoryPdfAssets`، حذف استدعاء `buildStoryPdfBytes`، عدم رفع PDF من الخادم |
| `src/routes/admin.orders.$id.tsx` | زر التحميل يستخدم pdf-client، شرط الظهور `images_status === "ready"` |
| `src/routes/preview.$orderId.tsx` | المثل |
| `src/lib/tajawal-fonts.server.ts` | استبدال ببيانات TTF حقيقية (احتياط) |
