# خطة التحديث الشاملة لمشروع "بصمة حكاية"

## 1) رفع صورة لكل شخصية + عرضها في الإدارة
- إضافة عمود `photo_path` (text, nullable) إلى جدول `order_characters` عبر migration.
- في `src/routes/create.tsx`: لكل بطاقة شخصية، إضافة حقل `<input type="file" accept="image/*">` مع معاينة مصغرة. الرفع يتم عبر دالة خادم جديدة `uploadCharacterPhoto` (createServerFn) ترفع الملف إلى bucket `story-uploads` تحت مسار `orders/{orderId}/chars/{idx}.jpg` وتُرجع المسار.
  - ملاحظة: السماح بالرفع قبل إنشاء الطلب عبر إنشاء `draft_id` (UUID مؤقت)، ثم عند إرسال `createOrderDraft` نمرر مصفوفة `photo_paths`.
- في `createOrderDraft`: حفظ `photo_path` لكل شخصية، ونقل الملفات من مسار المسودة إلى مسار الطلب النهائي.
- استخدام صور الشخصيات في `image_prompt` (تمريرها كمراجع ضمن `messages` متعددة الوسائط لنموذج `google/gemini-3.1-flash-image` لضمان ثبات شكل الشخصيات).
- في `src/routes/admin.orders.$id.tsx`: قسم جديد "صور الشخصيات المرفوعة" يعرض جميع الصور مع الأسماء عبر signed URLs.

## 2) إظهار التحميل والإحصائيات الكاملة في الإدارة
- في صفحة تفاصيل الطلب: زر "تحميل PDF" (signed URL لـ `pdf_path`) يظهر دائماً عند توفر الملف، بالإضافة لزر "تحميل صور الشخصيات (zip)" وأزرار "تحميل غلاف" و "تحميل كل الصفحات".
- في `admin.analytics.tsx`: التأكد من ظهور كل المقاييس (إيراد، تكلفة فعلية، ربح، هامش، عدد الطلبات بحسب الحالة، أكثر العملاء طلباً، متوسط الصفحات/الشخصيات) — مع زر تصدير CSV.
- في `admin.index.tsx`: إضافة عمود "PDF" مع أيقونة تحميل سريع لكل طلب جاهز.

## 3) تكبير الشعار في الموقع + ختمه على صور القصص
- استبدال `brand.ts` ليشير إلى الشعار الجديد المرفوع (`شعار_بصمة_حكاية.png`) كـ Lovable asset.
- في `__root.tsx` و `index.tsx`: تكبير الشعار (من ~40px إلى ~72px في الهيدر، و~200px في الواجهة).
- ختم الشعار على كل صورة قصة بعد توليدها في `generateAndUploadImage`:
  - تحميل الشعار مرة واحدة (cache في الذاكرة) ودمجه على زاوية الصورة باستخدام `sharp` — لكنه غير متاح في Cloudflare Workers.
  - الحل: استخدام مكتبة `@cf-wasm/photon` (WASM، متوافق مع Workers) أو تركيب الشعار في الـ PDF مباشرة عبر `pdf-lib` (موجودة فعلاً) كطبقة فوق كل صفحة. والاكتفاء بـ overlay عبر CSS في عرض الويب للصور المنفردة (`<img>` + `<img class="logo-stamp">` بزاوية مع opacity).
  - الاقتراح المعتمد: ختم على PDF عبر `pdf-lib` (دقيق ودائم) + overlay CSS في صفحات الويب (`preview` و `admin`).

## 4) فيديو ترويسي في الواجهة (مكان الشعار الكبير)
- رفع الفيديوهين كـ Lovable assets:
  - `subtle-elegant-animation-the-teal-fingerprint-line.mp4` (الأول)
  - `animate-with-a-different-motion-style-the-teal-fin.mp4` (الثاني)
- مكوّن `BrandIntroVideo` في `index.tsx`: `<video autoPlay muted playsInline>` يعرض الأول ثم عند `onEnded` يبدّل المصدر للثاني ويعمل بشكل تلقائي (loop بين الاثنين). بدون عناصر تحكم.

## 5) تذييل ثابت "بصمة حكاية — جزء من نظام معروف"
- في `__root.tsx`: إضافة `<footer>` يظهر في كل الصفحات يحتوي:
  - "بصمة حكاية — جزء من نظام معروف © 2026"
  - رابط تيكتوك (البند 6)
- إضافة نفس النص كسطر صغير أسفل كل صفحة PDF في `pdf.server.ts`.

## 6) رابط تيكتوك
- في الفوتر وفي الهيدر: أيقونة TikTok (lucide أو SVG مخصص) ترتبط بـ `https://www.tiktok.com/@basmathikaya1` مع `target="_blank" rel="noopener"`.
- إضافة meta tag للقناة في `__root.tsx` head.

## 7) البحث في الإدارة عن العملاء
- في `admin.users.tsx`: إضافة حقل بحث `<input>` يقوم بفلترة العملاء (الاسم/الهاتف) عبر `useState` على البيانات المُحمَّلة. إذا كانت القائمة كبيرة، تحديث `listUsers` server fn لقبول `q: string` وإجراء فلترة SQL (`ilike`).
- إضافة فلترة مشابهة في `admin.index.tsx` للطلبات حسب اسم العميل/الهاتف/رقم الطلب.

## 8) ثيمات موسمية مخصصة
- إنشاء جدول `seasonal_themes`:
  - `name` (محرم، صفر، المولد النبوي، رمضان، …)
  - `start_date`, `end_date`
  - `accent_color`, `bg_pattern_url`, `banner_text`, `banner_url`
  - `active` (boolean)
- صفحة إدارة جديدة `admin.themes.tsx` لإضافة/تعديل/تفعيل الثيمات.
- في `__root.tsx`: تحميل الثيم النشط حالياً (loader) وحقن متغيرات CSS (`--accent`, `--seasonal-banner-bg`) ديناميكياً، وعرض شريط علوي بالنص الموسمي إن وُجد.
- في `pdf.server.ts`: استخدام الثيم النشط (لون الإطار، شعار/نقشة) في صفحات الـ PDF.

---

## التفاصيل التقنية الموجزة

**ملفات جديدة:**
- `supabase/migrations/...` (إضافة `photo_path` + جدول `seasonal_themes`)
- `src/lib/uploads.functions.ts` — `uploadCharacterPhoto`, `uploadDraftPhoto`
- `src/lib/themes.functions.ts` — `listThemes`, `upsertTheme`, `getActiveTheme`
- `src/routes/admin.themes.tsx`
- `src/components/BrandIntroVideo.tsx`
- `src/assets/basma-logo-v2.png.asset.json` + asset pointers للفيديوهين

**ملفات معدّلة:**
- `src/routes/create.tsx` (رفع صور لكل شخصية)
- `src/routes/admin.orders.$id.tsx` (عرض صور + أزرار تحميل)
- `src/routes/admin.users.tsx` و `admin.index.tsx` (بحث)
- `src/routes/admin.analytics.tsx` (تصدير CSV + متريكس إضافية)
- `src/routes/__root.tsx` و `index.tsx` (شعار أكبر + فوتر + فيديو + ثيم)
- `src/lib/orders.functions.ts` (تمرير صور المراجع للمولد + حفظ photo_path)
- `src/lib/pdf.server.ts` (ختم الشعار + التذييل + ألوان الثيم)
- `src/lib/brand.ts`, `src/lib/i18n.tsx`, `src/styles.css`

**ملاحظات:**
- ختم الصور: سيتم على مستوى الـ PDF وعرض الويب فقط (تجنباً لتبعيات native غير متوفرة في Workers). الصور المخزنة في bucket تبقى نظيفة، والختم يُضاف في طبقة العرض.
- صور المراجع تُمرر للنموذج كـ `image_url` في messages متعددة الوسائط (Gemini يدعمها).
