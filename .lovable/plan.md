# تجهيز الموقع لتطبيق أندرويد (Capacitor) + assetlinks.json

هدفان:
1. توفير ملف `/.well-known/assetlinks.json` على `urstory.space` ليعمل ربط التطبيق بالنطاق (App Links / TWA) بدون شاشة اختيار المتصفح.
2. عدم ظهور شاشة «ثبّت التطبيق» داخل تطبيق أندرويد نفسه — تظهر فقط في متصفح الجوال.

## 1. ملف assetlinks.json

- ينشأ مسار خادم `src/routes/.well-known/assetlinks[.]json.ts` يعيد JSON بالنوع `application/json` (بدل ملف ثابت، حتى نتحكم بالبصمات دون إعادة نشر الكود في كل مرة).
- اسم الحزمة الافتراضي: `space.urstory.app` (قابل للتعديل عبر متغير بيئة `ANDROID_PACKAGE_NAME`).
- بصمات SHA-256 تُقرأ من متغير بيئة `ANDROID_SHA256_FINGERPRINTS` (قيم مفصولة بفواصل)، وإذا كان فارغاً يعيد المسار مصفوفة فارغة `[]` بدل خطأ.
- النطاق المعتمد: `urstory.space` فقط.

الشكل الناتج:

```text
[{ "relation": ["delegate_permission/common.handle_all_urls"],
   "target": { "namespace": "android_app",
               "package_name": "space.urstory.app",
               "sha256_cert_fingerprints": ["AA:BB:..."] } }]
```

### عن شهادة التوقيع
لا يمكن إنشاء ملف التوقيع (keystore) داخل المشروع — يجب أن يبقى على جهازك ولا يُرفع للمستودع. لذلك بعد بناء التطبيق في Android Studio تحصل على البصمة بأحد الطريقين:

- Android Studio: Build > Generate Signed Bundle/APK لإنشاء keystore جديد، ثم
  `keytool -list -v -keystore my-release.jks -alias my-alias` وانسخ سطر SHA-256.
- أو إن نشرت على Google Play: Play Console > Setup > App integrity > بصمة SHA-256 لشهادة توقيع التطبيق.

ثم تعطيني البصمة وأضعها في الإعداد فيصبح الملف فعّالاً فوراً بلا تعديل كود.

## 2. التمييز بين التطبيق والمتصفح

- إضافة أداة `src/lib/platform.ts` بدالة `isNativeApp()` تتحقق من:
  - وجود `window.Capacitor?.isNativePlatform?.()`
  - أو مخطط الصفحة `capacitor://` / `https://localhost` داخل WebView
  - أو وجود `android-app://` في `document.referrer` (وضع TWA)
  - أو علامة `?native=1` المخزنة في localStorage كاحتياط
- تعديل `src/components/InstallGate.tsx`: إضافة `isNativeApp()` إلى شروط `gateAllowed` بحيث لا تظهر شاشة التثبيت إطلاقاً داخل التطبيق.
- لا تغييرات أخرى في الواجهة (حسب اختيارك: شاشة التثبيت فقط).

## 3. تحسينات صغيرة مرافقة

- إضافة `"related_applications"` و `prefer_related_applications: false` غير مطلوبة الآن؛ يبقى المانيفست كما هو.
- إصلاح خطأ ترطيب (hydration mismatch) ظاهر حالياً في الصفحة الرئيسية بسبب نص سياسة يأتي من قاعدة البيانات ويختلف بين الخادم والعميل — سيُعالج بجعل النص يُعرض من مصدر واحد بعد التحميل.

## التفاصيل التقنية
- ملفات جديدة: `src/routes/.well-known/assetlinks[.]json.ts`، `src/lib/platform.ts`.
- ملفات معدّلة: `src/components/InstallGate.tsx`، وملف الصفحة الرئيسية للنص الديناميكي.
- أسرار مطلوبة لاحقاً: `ANDROID_SHA256_FINGERPRINTS` (وأختياري `ANDROID_PACKAGE_NAME`).
- التحقق: فتح `https://urstory.space/.well-known/assetlinks.json` بعد النشر، ثم أداة Google Digital Asset Links للتأكد.
