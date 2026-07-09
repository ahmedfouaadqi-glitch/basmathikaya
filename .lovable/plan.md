
# إكمال المرحلة الثانية من "حرية التعبير"

بعد إنجاز بوابة المراجعة الإدارية وتحسين نص القصص للبالغين، أُكمل ما تبقّى:

## 1) تحرير موجّهات الصور للبالغين
في `src/lib/orders.functions.ts` داخل حلقة توليد صور الصفحات والغلاف:
- استشعار `isAdultAudience` نفسه المستخدم للنص (`content_flags` + `age_bucket`).
- عند البالغين: إزالة كل عبارات "children storybook / whimsical / cute / kid-friendly" من الـ style anchor، واستبدالها بـ:
  - **Realistic**: "cinematic photorealistic 8K, natural anatomy, adult subjects only (18+), tasteful or explicit sensual composition per the scene, professional editorial lighting".
  - **Cartoon/Anime/Pixar…**: احترام النمط المختار من `art_styles.prompt_fragment` + إضافة "mature adult illustration, 18+ characters, sensual/erotic composition allowed per scene".
- Negative prompt يبقى صارماً على: minors, children, underage, gore, torture فقط.

## 2) سلسلة نماذج احتياطية للصور
مثل ما فعلنا للنصوص:
```
google/gemini-3.1-flash-image → google/gemini-2.5-flash-image → openai/gpt-image-2
```
إذا رفض المزوّد بسبب فلاتر السلامة (finish_reason=safety) → ينتقل تلقائياً للنموذج التالي.
سجل كل محاولة في `generation_events` مع `model` و`finish_reason` و`success`.

## 3) شاشة تشخيص أعمق للأدمن
في `src/routes/admin.orders.$id.tsx` أضيف قسم "Generation Log" يعرض لكل صفحة:
- الموجّه النصي المستخدم (`image_prompt` الفعلي بعد إضافة النمط).
- النماذج التي جُرّبت وسبب فشل كل واحد.
- زر "إعادة توليد بموجّه معدّل" يفتح modal يسمح للأدمن بتحرير الموجّه ثم إعادة المحاولة مباشرة.

مصدر البيانات: جدول `generation_events` الموجود مسبقاً (يحتوي `model, event_type, status, error, meta`).

## 4) توسعة `content-screening` لتغذي التوليد
حالياً `content_flags` تُخزَّن على الطلب. أُضيف حقلاً محسوباً `content_intent` (`romantic|sensual|explicit|meditative|traumatic|neutral`) يستنتجه المصنِّف نفسه، ويُمرَّر للـ image prompt كسياق إضافي ("tone: sensual romantic embrace" مثلاً) بدلاً من الاعتماد على النص فقط.
- عمود جديد `orders.content_intent text`.
- تحديث `screenOrder` ليكتبه.
- استخدامه في `buildImagePrompt`.

## تسلسل التنفيذ
1. Migration: `alter table orders add column content_intent text;`
2. تعديل `screenOrder` لكتابة `content_intent`.
3. تعديل حلقة الصور في `adminConfirmPaymentAndGenerate`:
   - قراءة `content_intent` + `isAdultAudience`.
   - بناء style/negative بشكل شرطي.
   - سلسلة نماذج احتياطية مع try/catch وتسجيل.
4. تحديث `admin.orders.$id.tsx` لعرض سجل التوليد وزر إعادة المحاولة بموجّه معدّل (يستدعي `adminRegenerateImage` الموجود مع تمرير `custom_prompt`).
5. تعديل `adminRegenerateImage` في `admin-ops.functions.ts` ليقبل `custom_prompt` اختياري.

## ما لن يتغيّر
- بوابة المراجعة الإدارية (تمّت).
- الخطوط الحمراء: قاصرون، عنف صريح، سياسي/كراهية — تبقى رفضاً تلقائياً.
- منطق النص للبالغين (تمّ).
- تدفّق الدفع والتسليم كما هو.

هل أبدأ التنفيذ بهذا الترتيب؟
