## الهدف
توسيع صلاحيات الإدارة لتشمل تحرير محتوى الصفحة الرئيسية ونصوص الواجهة، دمج مستويات جودة الصور إلى مستويين (قياسي + محترف)، وتعطيل/تغويش المستوى الثالث (الفيديو) مع إبقاء سعره ظاهراً فقط.

---

## 1) دمج مستويات جودة الصور (سريع + قياسي → قياسي)

- في `src/routes/create.tsx`: تقليل خيارات `image_quality_tier` إلى:
  - **قياسي** (`standard`) — الافتراضي، يستخدم Gemini Flash (دمج ما كان "سريع" + "قياسي").
  - **محترف** (`premium`) — Gemini 3 Pro / أعلى نموذج متاح.
- في `src/lib/orders.functions.ts` و`src/lib/ai-gateway.server.ts`:
  - `fast` يُعامل كـ alias لـ `standard` (للتوافق مع الطلبات القديمة).
  - تحديث جدول الأسعار: `image_tier_extra_iqd` لكل مستوى.
- في `pricing_settings`: إضافة عمودَي `image_tier_standard_extra_iqd` و`image_tier_premium_extra_iqd` لتحكم الإدارة بفارق السعر.

## 2) تغويش (تعطيل) مستوى "فيديو"

- في `src/routes/create.tsx`: بطاقة الفيديو تبقى ظاهرة مع السعر الحالي (يُحسب من `tier_video_iqd + per_page + per_character` كما هو الآن).
- تُضاف خصائص: `disabled`, `aria-disabled`, `cursor-not-allowed`, شفافية 60%، شارة "قريباً".
- إخفاء تفاصيل/وصف المستوى (ميزات الفيديو) — يبقى العنوان والسعر فقط.
- منع اختياره: `tier` لا يقبل `"video"` في النموذج، والـ submit يرفضه.

## 3) تحرير محتوى الصفحة الرئيسية من الإدارة

جدول جديد `site_content` (key/value JSONB) لتخزين النصوص القابلة للتحرير:

```text
key                         value (JSONB)
---------------------------  ------------------------------------------
home.hero                    { title_ar, title_en, subtitle_ar, subtitle_en, cta_ar, cta_en }
home.features                [ { icon, title_ar, title_en, desc_ar, desc_en } ]
home.how_it_works            [ { step, title_ar, title_en, desc_ar, desc_en } ]
home.footer_note             { ar, en }
create.intro                 { ar, en }
auth.intro                   { ar, en }
```

- RLS: قراءة عامة (`TO anon SELECT`)، كتابة فقط عبر `service_role` (server fn محمي بـ `requireAdmin`).
- Server functions في `src/lib/site-content.functions.ts`:
  - `getSiteContent({ key })` — عام، مع cache.
  - `adminListSiteContent()` / `adminUpsertSiteContent({ key, value })` — محمي.
- صفحة إدارة جديدة `src/routes/admin.content.tsx`: محرر JSON منظّم لكل مفتاح (حقول AR/EN لكل عنصر).
- تحديث `src/routes/index.tsx` لقراءة النصوص من `site_content` بدلاً من السلاسل الثابتة (مع fallback للنصوص الحالية).

## 4) توسيع الثيمات الموسمية لكل الأشهر والمناسبات

- في `src/routes/admin.themes.tsx`: إضافة "قوالب جاهزة" (presets) يضغط الأدمن لإنشائها مرة واحدة:
  - محرم، صفر، ربيع الأول (المولد النبوي)، رجب، شعبان، رمضان، شوال (العيد)، ذو الحجة (عيد الأضحى)، عاشوراء، الإسراء والمعراج، ليلة القدر، رأس السنة الهجرية، رأس السنة الميلادية، عيد الأم، اليوم الوطني، الصيف، الشتاء.
- كل preset يملأ: `name`, `start_date`, `end_date` (تقريبي/سنوي), `accent_color`, `banner_text_ar/en`.
- إضافة عمود `pattern` (اختياري) لاسم نمط زخرفي (هندسي/نباتي/فلكي) يُستخدم في الـPDF والواجهة.
- تطبيق الثيم النشط أوتوماتيكياً على: شريط الموقع، خلفية صفحة الإنشاء، غلاف الـPDF (accent border + banner text).

## 5) لوحة إدارة موسّعة (Hub)

- إعادة تنظيم `src/routes/admin.tsx`:
  - أقسام: الطلبات • المستخدمون • التحليلات • المحتوى (جديد) • الثيمات • الإعدادات.
- في `admin.settings.tsx`: إضافة قسمَي:
  - **جودة الصور**: حقول `image_tier_standard_extra_iqd`, `image_tier_premium_extra_iqd`.
  - **حالة المستويات**: مفتاح `video_tier_enabled` (افتراضياً `false`) للتحكم بإظهار/تعطيل الفيديو لاحقاً دون نشر تحديث.

---

## التفاصيل التقنية

**Migration (نسخة مختصرة):**

```sql
-- site content
CREATE TABLE public.site_content (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_content TO anon, authenticated;
GRANT ALL ON public.site_content TO service_role;
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.site_content FOR SELECT TO anon, authenticated USING (true);

-- pricing additions
ALTER TABLE public.pricing_settings
  ADD COLUMN IF NOT EXISTS image_tier_standard_extra_iqd int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_tier_premium_extra_iqd int NOT NULL DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS video_tier_enabled boolean NOT NULL DEFAULT false;

-- themes additions
ALTER TABLE public.seasonal_themes
  ADD COLUMN IF NOT EXISTS pattern text;
```

**Backward compatibility:** الطلبات الموجودة بـ `image_quality_tier='fast'` تُعالج كـ `standard` في كل من PDF/AI gateway/pricing.

**الملفات المُعدّلة:**
- `src/routes/create.tsx` — تقليل خيارات الجودة + تعطيل بطاقة الفيديو.
- `src/routes/index.tsx` — قراءة من `site_content`.
- `src/routes/admin.tsx` — رابط "المحتوى".
- `src/routes/admin.content.tsx` — جديد، محرر النصوص.
- `src/routes/admin.themes.tsx` — أزرار presets.
- `src/routes/admin.settings.tsx` — حقول مستويات الجودة + مفتاح الفيديو.
- `src/lib/site-content.functions.ts` — جديد.
- `src/lib/orders.functions.ts` + `src/lib/ai-gateway.server.ts` — alias `fast→standard`، استخدام أسعار الجودة الجديدة.
- `src/lib/pricing.ts` — دالة `imageTierExtra(tier, pricing)`.

---

## ما لن يتغير
- مسار المصادقة الإدارية (الرقمان + الرمز 7979).
- منطق توليد القصة والصور وفحص التكرار.
- بنية الـPDF الحالية (تستفيد فقط من accent color للثيم).
