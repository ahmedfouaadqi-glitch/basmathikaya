## اعتماد نص إخلاء المسؤولية الموحّد

النص العربي الجديد (يُستخدم في كل مكان):
> إخلاء مسؤولية: «بصمة حكاية» أداة ذكاء اصطناعي مخصّصة لهذه الفكرة بدون أي تدخّل بشري. المستخدم هو المسؤول الوحيد عن كل المُدخلات والنتائج، بعد تسديد المبالغ لا يتم استرجاعها. تحتفظ الإدارة بحق قبول أو رفض الطلب.

النص الإنجليزي (يبقى كما هو حالياً في `DEFAULT_DISCLAIMER_EN` مع تعديل بسيط ليطابق البنية العربية):
> Disclaimer: Basma Hekaya is an AI tool built for this concept with no human involvement. The user is solely responsible for all inputs and outputs; paid amounts are non-refundable. The admin reserves the right to accept or reject any order.

### التعديلات

1. **`src/lib/site-content.functions.ts`** — تحديث `DEFAULT_DISCLAIMER_AR` و`DEFAULT_DISCLAIMER_EN` إلى النص الجديد. هذا يُغذّي: الصفحة الرئيسية، ذيل الموقع، صفحة المعاينة، ملف PDF، وشاشة الأدمن.

2. **`src/routes/create.tsx` (سطر 524–528)** — استبدال النص المكتوب يدوياً بجوار مربع الموافقة بالنص الموحّد الجديد (بدل "أنا المسؤول الوحيد" ← "المستخدم هو المسؤول الوحيد" وإعادة الصياغة لتطابق).

3. **`src/lib/pdf-client.ts` (سطر 372–376)** — تحديث نص الـ fallback داخل `buildAndDownloadStoryPdf` ليطابق النص الجديد (يُستخدم فقط لو لم يمرَّر disclaimer، لكن للاتساق).

### ملاحظات

- المستخدمون الذين حفظوا نصاً مخصّصاً في جدول `site_content` سيبقى نصهم كما هو (لن نلمس قاعدة البيانات). النص الجديد يسري على القيم الافتراضية فقط، وأي مشروع لم يخصّص المحتوى سيراه فوراً.
- لا تغييرات على المخطط أو الـ RLS أو الـ backend logic.
