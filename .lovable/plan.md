# خطة: تحسين جودة الصور والنصوص + خفض التكلفة

الهدف: رفع واقعية الصور وجودة النص لكل الفئات العمرية والمحتوى، مع تقليل الاستهلاك من AI Gateway، دون تعديل أي تدفق قائم بشكل يكسره. كل التغييرات تمر عبر `ai_models_config` و `feature_flags` و الـ Orchestrator الموجود مسبقاً — لا استبدال للـ pipelines.

## 1) طبقة الصور — جودة أعلى، تكلفة أقل

- **سياسة نموذجين متدرجة (Tiered routing)** داخل `ai_models_config` لكل task:
  - `image_gen_cover` (الغلاف فقط): priority 1 = `google/gemini-3-pro-image` (أعلى جودة، صورة واحدة فقط للطلب).
  - `image_gen` (الصفحات الداخلية): priority 1 = `google/gemini-3.1-flash-image` (Nano Banana 2 — جودة قريبة من Pro بتكلفة أقل بكثير)، fallback = `google/gemini-2.5-flash-image` ثم `openai/gpt-image-1-mini`.
  - يبقى الأعلام (`use_orchestrator`) شغالاً، وأي فشل يسقط تلقائياً للأرخص = صفر انقطاع.
- **Quality Presets حسب الفئة العمرية** (يُبنى من `age_bucket` المضاف مسبقاً):
  - أطفال 0-8: `Nano Banana 2` + prompt "watercolor / soft cartoon" (كلفة أقل، ملائم بصرياً).
  - 9-17: نفس النموذج + prompt أكثر تفصيلاً.
  - 18+ (Inner Child / تأمل / حنين): `gemini-3-pro-image` للصفحات المفتاحية (الغلاف + آخر صفحة) و `Nano Banana 2` للباقي = واقعية أعلى بدون مضاعفة السعر.
- **Prompt hardening**: تحديث `art_styles.prompt_fragment` بإضافة موجهات جودة موحدة (lighting, composition, focal length, negative prompts ضد التشوه/النص المدمج) — بدون تغيير schema.

## 2) توفير التكلفة (بدون كسر)

- **Cache للصور المتكررة**: تفعيل علم `cache_image_gen` جديد يستخدم `prompt_cache` القائم؛ مفتاح = hash(prompt + style + DNA + age_bucket). إعادة توليد نفس الصفحة بنفس المدخلات = 0 تكلفة.
- **Image QA أذكى**: رفع سقف نجاح `runImageQA` من 0 إلى 70 لتقليل إعادة التوليد الكاذبة (retry loop مكلف). QA يبقى `gemini-3.1-flash-lite` (رخيص).
- **حد أقصى للـ retries لكل صفحة**: 2 بدلاً من الافتراضي، مع تصعيد للأدمن بعد ذلك.
- **Downscale ذكي**: الصفحات الداخلية 1024x1024، الغلاف 1536x1024 فقط — يُقنّن من داخل `runImageTask` build().
- **بذر (seed) ثابت لكل قصة** لضمان اتساق الشخصية بدون إعادة توليد.

## 3) طبقة النص — جودة أعمق لكل عمر

- **Model routing حسب `age_bucket`** في task `story`:
  - أطفال: `google/gemini-3.5-flash` (سريع + كافٍ، أرخص).
  - مراهق/شاب: `google/gemini-3.1-pro-preview` (استدلال أعمق).
  - بالغ (Inner Child / شفاء / حنين): `openai/gpt-5.4` مع reasoning متوسط (أفضل حس أدبي)، fallback `gemini-3.1-pro-preview`.
- **Polish stage مشروط**: يُشغّل فقط للفئات 12+ (حيث الأسلوب مهم)، ويُتخطى للأطفال — توفير مباشر ~30% من مكالمات النص.
- **Prompt v2** يضم: نبرة حسب `age_bucket`، طول الجملة، مفردات، وتوجيه "الطفل الداخلي" للبالغين. يُخزّن في `ai_models_config.prompt_version = 'v2'` مع إبقاء v1 كـ fallback (rollback فوري).

## 4) لوحة أدمن — تحكم كامل بدون كود

- إضافة تبويب "Quality Presets" في `/admin/ai-models`:
  - تفعيل/تعطيل كل preset (age_bucket × task).
  - عرض متوسط الكلفة والجودة (من `ai_model_events` القائم).
  - زر A/B: تشغيل النموذج البديل على 10% من الطلبات لقياس الفرق.

## 5) الحماية من الكسر

- كل التغييرات خلف feature flags (`quality_tier_v2`, `cache_image_gen`, `polish_conditional`, `prompt_v2`).
- افتراضي: `quality_tier_v2 = false` عند النشر؛ يُفعّل يدوياً بعد اختبار طلب واحد لكل فئة عمرية.
- Migration واحد فقط: إدراج صفوف جديدة في `ai_models_config` + أعلام. لا `ALTER TABLE`.
- Rollback = إطفاء العلم = عودة فورية للسلوك الحالي.

## 6) خطوات التنفيذ

```
1. Migration: seed ai_models_config الجديد + 4 أعلام (معطلة).
2. Orchestrator: قراءة age_bucket من الطلب واختيار الصف المناسب.
3. Image build(): دمج art_styles.prompt_fragment المحدّث + seed ثابت + size حسب task.
4. Image cache: hook داخل runImageTask (خلف علم).
5. Polish المشروط في orders.functions.ts.
6. صفحة /admin/ai-models: تبويب Presets + زر A/B.
7. اختبار يدوي: طلب لطفل 6، طلب لمراهق 14، طلب لبالغ 30 (Inner Child).
8. تفعيل الأعلام تباعاً ومراقبة ai_model_events.
```

## المخرجات المتوقعة

- تكلفة الصفحة الداخلية ↓ ~40% (Pro → Nano Banana 2 + cache).
- تكلفة النص ↓ ~25% (polish مشروط + routing).
- جودة الغلاف والصفحات المفتاحية للبالغين ↑ (Pro image + GPT-5.4).
- صفر تغيير في تجربة الطلبات الحالية عند إبقاء الأعلام مطفأة.

هل أبدأ بالتنفيذ بهذا الترتيب؟
