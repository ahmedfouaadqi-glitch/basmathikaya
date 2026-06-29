## الخطة

### 1) تحسين توليد PDF (وضوح + ضغط ذكي بدون قص أو تبعثر)

`src/lib/pdf-client.ts` يُعاد ضبطه ليكون متكيّفاً مع الجهاز:

- **اكتشاف الجهاز**: تحديد iOS/Android/Desktop عبر `userAgent` + `devicePixelRatio` + `deviceMemory` (إن توفّر).
- **مقياس Canvas تكيّفي**: 
  - Desktop: `scale = 2`
  - Android (>=4GB ذاكرة): `scale = 1.75`
  - iPhone/iPad: `scale = 1.5` (لمنع كراش WebKit)
  - أجهزة ضعيفة (<3GB): `scale = 1.25`
- **ضغط الصور قبل html2canvas**: كل صورة تُمرَّر عبر canvas مساعد لإعادة قياسها إلى الحد الأقصى المطلوب (مثلاً 1400px على الجانب الأطول للغلاف، 1100px للصفحات) ثم تُحوَّل إلى JPEG/WebP بجودة 0.85. هذا يمنع تمدّد PNG العملاقة في الذاكرة على iOS.
- **منع القص**: حاوية الصورة تستخدم `object-fit: contain` مع نسبة عرض ثابتة (4:3 للصفحة، 3:4 للغلاف) وخلفية كريمية متناسقة بدل قطع جزء من الصورة.
- **إطارات مناسبة**: لكل صفحة إطار مزخرف خفيف بلون الثيم (accent) + ظل ناعم + زوايا مستديرة. الغلاف يأخذ إطاراً مزدوجاً (ذهبي + لون رئيسي) مع زخرفة زاوية بسيطة.
- **جودة JPEG النهائية للـPDF**: 0.88 على الموبايل و0.94 على الديسكتوب، مع `compress: true` في jsPDF.
- **معالجة الصفحة صفحة-بصفحة**: بناء كل صفحة في host ثم إزالتها قبل بناء التالية → يخفّض ذروة الذاكرة جذرياً على iOS.
- **انتظار تحميل الخطوط والصور**: `document.fonts.ready` + `img.decode()` لكل صورة قبل اللقطة.

### 2) توليد صور مطابقة للشخصيات المرفوعة

حالياً الصور تُولَّد من وصف نصي فقط بدون تحليل صور المستخدم. التحديث:

**أ. تحليل الصور (Vision) قبل كتابة القصة** — في `generateFullStory`:
- بعد جلب الشخصيات، إذا كان `photo_path` موجوداً، تُحمَّل الصورة من Supabase storage وتُرسَل إلى `google/gemini-2.5-pro` (multimodal) مع طلب JSON يصف: الجنس، الفئة العمرية التقريبية، لون البشرة، الشعر (طول/لون/تسريحة)، العينين، الملابس، ملامح مميزة. يُحفظ الناتج في `order_characters.visual_brief` (عمود جديد).
- ناتج التحليل يُدمَج في `character_visual` بدل الاعتماد على وصف المستخدم النصي وحده → الشخصية تظهر متطابقة في كل صفحة.

**ب. توليد صور عالية الجودة باستخدام كل النماذج**:
- إعداد جديد في `pricing_settings`: `image_quality_tier` (fast/standard/premium).
- **standard (افتراضي)**: `google/gemini-3.1-flash-image` (الحالي).
- **premium**: `google/gemini-3-pro-image` للغلاف، `google/gemini-3.1-flash-image` للصفحات الداخلية.
- **fast**: `openai/gpt-image-1-mini`.
- التكلفة الإضافية تظهر في الأدمن ويختار المستخدم المستوى عند الطلب.

**ج. إعادة استخدام صورة الشخصية في طلب التوليد** — multimodal image input لـ Gemini image models: يُمرَّر `image_url` (data URL لصورة المستخدم) كمرجع بصري داخل `messages` → الناتج يحاكي ملامح الشخص. `callImage` في `src/lib/ai-gateway.server.ts` يُمدَّد ليقبل `referenceImages?: string[]`.

**د. أسلوب إطار الصور داخل الـPDF**:
- الغلاف: عنوان كبير فوق الصورة بإطار ذهبي مزدوج، اسم البطل، شارات الأجواء.
- الصفحات: الصورة في إطار accent 3px + ظل، يليها فاصل ذهبي، ثم النص.
- صفحة شكر ختامية: شعار + تيكتوك (موجودة بالفعل، يُحسَّن تصميمها).

### 3) منع تكرار القصص والنصوص

- **بصمة محتوى**: عند توليد الخطة، نحسب hash من (mood + custom_instructions + character_names normalized) ونحفظه في `story_fingerprints (hash text primary key, order_id, plan_seed text, created_at)`.
- **بذرة تنويع**: قبل استدعاء Gemini للنص، نضيف إلى الـuser prompt: 
  - رقم عشوائي `creative_seed` (8 أرقام)
  - قائمة بعناوين/افتتاحيات آخر 5 طلبات لنفس البصمة مع تعليمة صريحة: "تجنّب هذه الافتتاحيات والحبكات السابقة".
- **فحص تشابه بعد التوليد**: إذا أول 200 حرف من القصة الجديدة تطابق سابقتها (Jaccard على المفردات > 0.7) نُعيد التوليد مرة واحدة بـseed مختلف.
- نفس الفكرة على مستوى الصفحة: prompts الصور تأخذ `style_seed` يختلف لكل قصة (مثلاً نوع الإضاءة/الزاوية) لتنويع الشكل البصري.

### 4) قاعدة البيانات (Migration)

```sql
alter table public.order_characters add column visual_brief text;
alter table public.pricing_settings add column image_quality_tier text 
  not null default 'standard' check (image_quality_tier in ('fast','standard','premium'));
alter table public.orders add column image_quality_tier text;

create table public.story_fingerprints (
  hash text primary key,
  order_id uuid references public.orders(id) on delete cascade,
  plan_seed text not null,
  title text,
  opening text,
  created_at timestamptz not null default now()
);
grant select, insert on public.story_fingerprints to authenticated;
grant all on public.story_fingerprints to service_role;
alter table public.story_fingerprints enable row level security;
create policy "service only" on public.story_fingerprints for all using (false);
```

### 5) ملفات ستُعدَّل

- `src/lib/pdf-client.ts` — إعادة كتابة منطق Canvas/ضغط/إطارات.
- `src/lib/ai-gateway.server.ts` — دعم `referenceImages` في `callImage` + إضافة pricing للنماذج الجديدة.
- `src/lib/orders.functions.ts` — تحليل صور الشخصيات، seed التنويع، فحص البصمة، تمرير صور مرجعية للمولّد، اختيار النموذج حسب الـtier.
- `src/routes/create.tsx` — اختيار مستوى الجودة (سريع/قياسي/متميّز) مع عرض السعر الإضافي.
- `src/routes/admin.settings.tsx` — ضبط أسعار الـtiers.
- `supabase/migrations/*` — الجداول/الأعمدة أعلاه.

### نقاط فنية

- استدعاءات Gemini multimodal تُمرَّر بصيغة `messages[].content[]` بعناصر `{type:"image_url", image_url:{url:"data:image/...;base64,..."}}` للتحليل، وبصيغة OpenRouter image generation للتوليد (`modalities:["image","text"]`).
- تكلفة كل صورة تُسجَّل في `generation_events` (موجود) بالنموذج المستخدم فعلاً → الأدمن يرى تكلفة دقيقة لكل tier.
- صور المرجع تُحدَّد سقف حجمها 1024×1024 قبل الإرسال لتقليل token cost.
