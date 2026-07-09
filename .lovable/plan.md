## الهدف
1. **بوابة مراجعة إدارية** للطلبات الصريحة (نص + صورة) قبل التوليد.
2. **رفع كفاءة توليد النصوص** (سرد، حوار، مشاعر، صراحة عاطفية/حسية) بحيث تعكس رغبة المستخدم بدقة، مع تجاوز رفض النماذج.
3. **رفع كفاءة توليد الصور** (واقعي + كرتوني) بحيث تطابق النص والبطل والمرفقات.
4. حرية مطلقة للمستخدم البالغ (حب، عشق، شبق، غرامي، جنسي، إباحي، تحرري) + سيطرة كاملة للأدمن.

---

## المحور 1: بوابة المراجعة الإدارية

### 1.1 تفعيل التصنيف الفعلي
`src/lib/content-screening.functions.ts` → `screenOrder`:
- إزالة تثبيت `requires_admin_review: false`؛ إعادة القيم الحقيقية.
- `category === 'B'` → `orders.status = 'pending_review'` + `requires_admin_review = true`.
- `category === 'A'` → `status = 'rejected'` (خط أحمر: قاصر+جنسي، عنف صريح، سياسي/كراهية/أسلحة).
- `OK` → يمر مباشرة.
- تحديث `content_screening_log.decision` بالقيمة الصحيحة.

### 1.2 حجز مهمة التوليد حتى الموافقة
- في `orders.functions.ts` (`createOrder`/`submitOrder`): إذا `pending_review` لا يُدرج `background_jobs`.
- في `adminApproveOrder`: بعد التحديث، إدراج مهمة `generate_story` + إشعار المستخدم.
- `adminRejectOrder` (موجود) — إشعار المستخدم مع السبب.

### 1.3 الواجهة
- `my-orders.tsx`: شارة "قيد المراجعة الإدارية" + شرح.
- `create.tsx`: إذا صُنّف B عند الإرسال → توجيه لصفحة انتظار بدل صفحة التقدم.
- `admin.review-queue.tsx`: موجود ويعمل تلقائياً.

---

## المحور 2: رفع كفاءة النصوص (Story Plan + Pages)

### 2.1 سلسلة نماذج نصية موسّعة للمحتوى البالغ
تحديث `runChat` في `src/lib/orders.functions.ts`:
- ترتيب حسب `content_flags`:
  - **B (بالغ)**: `google/gemini-3.1-pro-preview` → `google/gemini-3.5-flash` → `google/gemini-2.5-pro` (Gemini أكثر تسامحاً مع الأدب الحسي مقارنة بـ OpenAI).
  - **OK (عائلي)**: `google/gemini-3-flash-preview` → `google/gemini-2.5-flash`.
- التقاط `finish_reason: 'SAFETY' | 'content_filter'` والانتقال للتالي تلقائياً.
- في حال فشل السلسلة كاملة → إعلام الأدمن لتحرير الموجّه يدوياً (الأداة موجودة).

### 2.2 موجّهات نصية أقوى وحرة
`buildStoryPrompt` / `buildPagePrompt` في `orders.functions.ts`:
- **System prompt للطلبات B**:
  - توجيه صريح: "أنت كاتب أدب عربي محترف؛ اكتب كما لو كنت نجيب محفوظ للعشق، أو نزار قباني للحسّي، بلا رمزية مبهمة. المستخدم بالغ اختار هذا الأسلوب."
  - إزالة أي جملة "keep it wholesome/family-friendly" من الموجّه الأساسي.
  - السماح بالمفردات التشريحية العربية والعامية (وفق تعليمات المستخدم).
- **User inputs pass-through حرفياً**: تعليمات المستخدم `custom_instructions` تُمرَّر كنص خام غير مُلخَّص.
- **Voice/tone anchor**: حقل جديد اختياري في الطلب (`narrative_tone`: رومانسي، حسّي، صريح، تأملي، شفائي) يُحقن في System.
- **Continuity**: تمرير ملخص الصفحات السابقة لكل صفحة جديدة لضمان تسلسل الحبكة والشخصيات.
- **Length control**: طول الصفحة (قصير/متوسط/طويل) من إعدادات الطلب — بدل الاعتماد على heuristic النموذج.

### 2.3 فحص جودة النص بعد التوليد
تحسين `src/lib/story-qa.server.ts` (موجود):
- بعد كل صفحة، تقييم:
  - تطابق النص مع نية المستخدم (لا تخفيف غير مطلوب).
  - تناسق البطل والأسماء عبر الصفحات.
  - عدم تسرب رفض النموذج (جمل مثل "لا أستطيع كتابة هذا").
- إذا فشل الفحص → إعادة توليد بموجّه أقوى مرة واحدة تلقائياً.

---

## المحور 3: رفع كفاءة الصور

### 3.1 سلسلة نماذج صور احتياطية
دالة `runImageGen` جديدة في `runners.server.ts`:
1. حسب `art_style.preferred_model` (Gemini 3 Pro Image للواقعي، Nano Banana 2 للكرتوني).
2. `google/gemini-3.1-flash-image`.
3. `google/gemini-2.5-flash-image`.
4. `openai/gpt-image-2` بموجّه معاد صياغته فنياً.
- التقاط `content_policy_violation`/`moderation_blocked` والانتقال التلقائي.
- فشل كامل → وسم الصفحة `needs_manual_upload` (الأدمن يرفع يدوياً).

### 3.2 موجّهات صور أقوى
تحديث `buildImagePrompt`:
- **Style anchor**: `art_style.prompt_fragment` في مقدمة الموجّه بصياغة حازمة.
- **Character consistency**: استخدام `character_analysis_cache` (نفس الوصف الحرفي لكل صفحة، لا توليد جديد).
- **Reference photo grounding**: تمرير صور المستخدم كـ `image_url` block ضمن `messages` لنماذج Gemini (multimodal input).
- **Adult content — tasteful anatomy**: للطلبات B، استخدام مصطلحات فنية/تشريحية دقيقة (Gemini يقبلها) بدل التلميحات المبهمة التي ترفضها الفلاتر.
- **Negative prompt**: قسم `AVOID:` صريح (deformed hands, extra fingers, watermarks, text, style mismatch, blurry).
- **Composition control**: `aspect_ratio` + `camera_angle` من الـ storyboard.
- **quality: "high"** تلقائياً للطلبات B.

### 3.3 فحص جودة الصور
تحسين `src/lib/image-qa.server.ts`:
- بعد كل صورة، `google/gemini-2.5-flash` (vision) يتحقق:
  - تطابق البطل مع الوصف (score ≥ 0.7).
  - تطابق النمط الفني (لا خلط واقعي/كرتوني).
  - عدم تشوّه واضح (يدين، وجه، عيون).
- عتبة ضعيفة → إعادة توليد مرة واحدة بموجّه أقوى قبل التسليم.

---

## المحور 4: لوحة تشخيص للأدمن
`src/routes/admin.orders.$id.tsx` — لكل صفحة:
- الموجّه المُرسل (نص + صورة).
- النموذج المُستخدم وعدد المحاولات.
- سبب الرفض إن وُجد.
- درجة QA للنص والصورة.
- زر "إعادة توليد بموجّه مخصص" (يحرره الأدمن قبل الإرسال).

---

## ملاحظات
- لا تغييرات على قاعدة البيانات (الحقول موجودة).
- إضافة حقل اختياري `orders.narrative_tone` (نصي، nullable) في migration واحدة صغيرة.
- الأدمن يحتفظ بكامل أدوات التحرير اليدوي.
- بعد موافقة الأدمن — لا فحص أخلاقي إضافي؛ المحتوى يمر بحرية.
