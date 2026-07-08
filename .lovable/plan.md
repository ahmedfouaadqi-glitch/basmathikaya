## المطلوب

تعديلان بصريان صغيران على تدفق إنشاء القصة وعلى ملف PDF، دون كسر أي منطق حالي.

---

### 1) نقل اختيار أسلوب الرسم إلى بداية النموذج (تحت العمر)

**الوضع الحالي:** بلوك "أسلوب الرسم" في `src/routes/create.tsx` يظهر بعد المزاج (Moods) والتعليمات المخصّصة.

**المطلوب:** نقل نفس البلوك ليظهر مباشرة بعد بطاقات الشخصيات (التي تحوي اسم/عمر/صورة الشخصية) وقبل المزاج، بحيث يراه المستخدم مبكراً بشكل "مربعات" — وهو أصلاً بشكل مربعات (grid buttons)، فقط سيتم رفع موقعه في الصفحة.

- لا تغيير على منطق `createOrder` أو الـ state.
- نفس المربعات: صف علوي (واقعي / كرتوني)، وعند اختيار "كرتوني" تظهر مصفوفة الأنماط الفرعية.
- التحقق الحالي (`اختر أسلوب الرسم`) يبقى كما هو.

---

### 2) تصحيح "مخصّصة لـ ..." + إضافة سطر المؤلف

**الوضع الحالي في `src/lib/pdf-client.ts`:**
- الغلاف: `subWith(a.customerName)` → "حكاية مخصّصة لـ {customerName}"
- شهادة البطل في الصفحة الأخيرة: `heroName = a.customerName || fallback`

المشكلة: `customerName` هو اسم صاحب الحساب وليس اسم البطل الذي أدخله المستخدم، فتظهر الحكاية "مخصّصة لصاحب الحساب" بدل البطل.

**التعديل:**

أ) إضافة حقل جديد اختياري إلى `StoryPdfAssets`:
```
heroName?: string | null;   // اسم البطل الأساسي من الشخصيات
authorName?: string | null; // اسم صاحب الحساب (full_name)
```

ب) في `buildCoverHtml` و `buildThanksHtml`:
- استخدم `heroName ?? customerName ?? fallback` بدلاً من `customerName` عند بناء "مخصّصة لـ" واسم شهادة البطل.
- تحت اسم البطل مباشرة في الغلاف وفي بطاقة الشهادة، أضف سطراً واحداً بخط رفيع وأنيق:
  - عربي: `المؤلف: {authorName}` (font-weight: 300، حجم صغير ~11px، لون رمادي هادئ، letter-spacing خفيف)
  - إنجليزي/كردي: نص مقابل (`Author: …` / `نووسەر: …`)
- إذا لم يتوفر `authorName` لا يُطبع السطر (Backward compatible).

ج) تمرير الحقلين من مواقع الاستدعاء:
- `src/routes/preview.$orderId.tsx` → `heroName: progress.hero_name` (أو `progress.characters?.[0]?.name` — يُحدَّد بعد قراءة شكل `progress`)، `authorName: progress.customer_name`.
- `src/routes/admin.orders.$id.tsx` → `heroName: characters.find(c=>c.is_primary)?.name`, `authorName: user?.full_name`.
- في `admin.orders.$id.tsx` الحالي يمرَّر `customerName: p.customer_name || user?.full_name` — نُبقيه كما هو للتوافق مع النسخ القديمة، ونضيف الحقلين الجديدين فقط.

د) الطلبات القديمة (بدون heroName ممرّر) تعمل كما هي: تسقط تلقائياً على `customerName` ثم على `heroFallback`.

---

### الملفات المتأثرة

- `src/routes/create.tsx` — نقل بلوك أسلوب الرسم إلى ما بعد الشخصيات وقبل المزاج.
- `src/lib/pdf-client.ts` — إضافة `heroName` و `authorName` إلى `StoryPdfAssets`، تحديث `buildCoverHtml` و `buildThanksHtml`، إضافة سلاسل "المؤلف" في `STRINGS` للغات الثلاث.
- `src/routes/preview.$orderId.tsx` — تمرير `heroName` و `authorName`.
- `src/routes/admin.orders.$id.tsx` — تمرير `heroName` و `authorName`.

بدون أي تغيير على قاعدة البيانات أو سياسات RLS أو منطق التوليد.
