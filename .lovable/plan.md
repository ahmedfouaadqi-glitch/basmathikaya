# خطة التحديث الشاملة

## 1) شخصية موحّدة + إطارات مطابقة للثيم

- **Character DNA ثابت**: بعد تحليل Gemini Vision للصور المرفوعة، نُنشئ `character_dna` مفصّل (شكل الوجه، لون البشرة، الشعر، العينين، الملابس الأساسية، السن التقريبي، الجنس) ونحفظه في `orders.character_dna` (jsonb).
- **نمط بصري ثابت لكل قصة**: نولّد `art_style_lock` واحد (مثال: "watercolor storybook, soft pastel, 3D-ish shading") ونستخدمه في **كل** صفحة + الغلاف.
- **اختلاف الإضاءة فقط**: كل صفحة تحمل `lighting_variant` (شروق، ظهر، غروب، ليلي هادئ، مصابيح دافئة…) مع الحفاظ على نفس الـDNA والنمط.
- **إطار الصفحة يتبع الثيم**: بدل الإطار العام، نضيف حقولاً للثيم: `frame_style` (ذهبي عربي، هلال رمضاني، نجوم مولد، ورقي…) و`frame_svg_pattern`، ويُطبَّق في `pdf-client.ts` وفي معاينة الغلاف.
- **مراجع دائمة**: نمرّر صور المستخدم + الغلاف الناتج كمراجع لكل صفحة (Gemini image) لضمان التطابق.

## 2) توسيع الثيمات (المعنى + الألوان + الهيدر)

- ترقية `seasonal_themes` بأعمدة:
  - `meaning_ar` / `meaning_en` (وصف روحاني للشهر/المناسبة)
  - `palette` jsonb (primary/accent/bg/frame)
  - `frame_style` + `motifs[]` (هلال، فانوس، نخلة…)
  - `header_title_ar/en` + `header_size` (sm/md/lg/xl)
  - `active_from` / `active_to` (تفعيل تلقائي حسب التاريخ)
- شاشة **admin.themes** موسّعة: منتقي ألوان، اختيار نمط الإطار، معاينة حيّة، تحكم بحجم عنوان الهيدر.
- تطبيق الثيم النشط تلقائياً على: الهيدر (اللون/الحجم/العنوان)، الغلاف، إطارات صفحات الـPDF، وخلفية الصفحة الرئيسية.

## 3) الصفحة الرئيسية — ترتيب وحذف

- **حذف** زر «اصنع حكايتي الآن» العلوي من `index.tsx`.
- **رفع الترويسة (فيديو الترويج)** إلى أعلى القسم قبل السطر:
  «اختر شخصياتك · حدد جوك · أضف لمستك الخاصة · واحصل على حكاية فريدة · كل حكاية كبصمتك».
- الاحتفاظ بالأزرار السفلية الأصلية للمتابعة.

## 4) فيديوهات الترويسة عبر الإدارة

- جدول `promo_videos`: `id, url, title, sort_order, enabled, muted_default`.
- **admin.videos** (route جديد): رفع فيديو (bucket خاص أو رابط)، ترتيب سحب/إفلات، تفعيل/تعطيل، وسويتش «مكتوم افتراضياً / صوت مفعّل».
- `BrandIntroVideo` يقرأ القائمة، يشغّلها تباعاً، ويحترم إعداد الكتم من الإدارة (مع زر مستخدم للتبديل).

## 5) تصنيف الجودة يؤثر على القصة كلها

- في `create.tsx`: تسمية القسم **«الجودة»** فقط، **حذف** أسماء النماذج (Gemini Flash / Gemini 3 Pro Image) من الواجهة.
- «الجودة» تُطبَّق على النص + الصور + عدد جمل الصفحة:
  - **قياسي**: `gemini-2.5-flash` للنص، `gemini-3.1-flash-image` للصور، 4-5 جمل/صفحة.
  - **احترافي**: `gemini-2.5-pro` للنص (تفاصيل أعمق، حبكة أغنى)، `gemini-3-pro-image` للصور، 6-8 جمل/صفحة + إطار بجودة أعلى.
- **التسعير المضاعف لكل وحدة** (وليس مبلغاً ثابتاً):
  - `pricing_settings`: `quality_premium_multiplier` (افتراضي 2.0) يُضرب في تكلفة كل صفحة + كل شخصية + الأساس.
  - إزالة `image_tier_premium_extra_iqd` الثابت، والاستعاضة بمُضاعِف.
  - كل هذا قابل للتعديل من **admin.settings**.

## 6) إخلاء المسؤولية

- نص عربي/إنجليزي مركزي في `site_content`:
  «هذه المنصة أداة ذكاء اصطناعي مخصّصة لفكرة "بصمة حكاية"، دون أي تدخل بشري في التوليد. المستخدم وحده مسؤول عن المُدخلات والنتائج. لا تُسترجع المبالغ تحت أي ظرف. تحتفظ الإدارة بحق قبول أو رفض أي طلب.»
- يظهر في:
  1. تذييل الموقع (`SiteFooter`).
  2. صفحة `create.tsx` كخانة موافقة إلزامية قبل الإرسال (يُخزَّن `disclaimer_accepted_at` في الطلب).
  3. **آخر صفحة في PDF** («صفحة إخلاء المسؤولية»).
  4. سطر صغير في **ذيل كل صفحة PDF** بجانب «بصمة حكاية».
- الإدارة تستطيع تعديل النص من `admin.content`، وترى حالة الموافقة في تفاصيل الطلب مع أزرار **قبول/رفض** واضحة تستند لإخلاء المسؤولية.

## قاعدة البيانات (Migration واحد)

- `orders`: `character_dna jsonb`, `art_style_lock text`, `disclaimer_accepted_at timestamptz`.
- `seasonal_themes`: `meaning_ar/en`, `palette jsonb`, `frame_style`, `motifs jsonb`, `header_title_ar/en`, `header_size`, `active_from`, `active_to`.
- جدول جديد `promo_videos` + GRANTs + RLS (قراءة للعموم، كتابة للإدارة عبر service_role من serverFn).
- `pricing_settings`: إضافة `quality_premium_multiplier numeric default 2.0`، وإزالة `image_tier_premium_extra_iqd` من الاستخدام (نُبقي العمود مؤقتاً للتوافق).
- `site_content` مفاتيح جديدة: `disclaimer_ar`, `disclaimer_en`.
- Bucket خاص `promo-videos` (public read).

## الملفات المتأثرة

- `supabase/migrations/*` (جديد)
- `src/lib/orders.functions.ts` — DNA/style lock، تطبيق مُضاعِف الجودة، تخزين قبول الإخلاء.
- `src/lib/pricing.ts` — دالة `applyQualityMultiplier`.
- `src/lib/pdf-client.ts` — إطار الثيم، ذيل الإخلاء، صفحة الإخلاء النهائية.
- `src/lib/themes.functions.ts` + `src/routes/admin.themes.tsx` — الحقول الجديدة.
- `src/lib/promo-videos.functions.ts` (جديد) + `src/routes/admin.videos.tsx` (جديد).
- `src/components/BrandIntroVideo.tsx` — قراءة القائمة الديناميكية + الكتم من الإدارة.
- `src/routes/index.tsx` — إعادة ترتيب/حذف الزر، الترويسة أعلى، تطبيق ألوان/عنوان الثيم على الهيدر.
- `src/routes/create.tsx` — إعادة تسمية «الجودة»، حذف أسماء النماذج، خانة موافقة الإخلاء.
- `src/components/SiteFooter.tsx` — إخلاء مسؤولية.
- `src/routes/admin.content.tsx` — تحرير نص الإخلاء.
- `src/routes/admin.settings.tsx` — حقل `quality_premium_multiplier`.
- `src/routes/admin.orders.$id.tsx` — عرض قبول الإخلاء + أزرار قبول/رفض.

هل نبدأ التنفيذ؟
