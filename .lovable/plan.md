## خطة تحديث "بصمة حكاية" — 4 ميزات جديدة

### 1) تسجيل دخول المستخدم برقم الهاتف + OTP عبر واتساب/SMS

**جداول جديدة:**
- `users` (id, full_name, phone E.164, created_at, last_login_at, marketing_consent default true, notes)
- `otp_codes` (id, phone, code_hash, expires_at, attempts, consumed_at)
- `user_sessions` (id, user_id, token_hash, expires_at) — كوكي httpOnly مشفّر مثل جلسة الإدارة

**موفر الإرسال:** Twilio عبر Connector Gateway (يدعم WhatsApp + SMS). سيُطلب ربط Twilio من إعدادات الـ Connectors. تكلفة الإرسال على حساب المالك.

**التدفق:**
1. شاشة `/auth` (مدمجة قبل `/create`): يدخل الاسم + رقم الهاتف → ضغط "إرسال رمز" → server fn `requestOtp` يُرسل رمز 6 خانات عبر WhatsApp (مع fallback SMS).
2. إدخال الرمز → `verifyOtp` ينشئ/يحدّث `users` ويصدر جلسة (30 يوم).
3. كل صفحات `/create`, `/preview`, طلبات المستخدم تتطلب الجلسة (middleware `requireUserSession`).
4. الإدارة ترى قائمة `users` مع: الاسم، الهاتف، عدد الطلبات، آخر دخول، مجموع الإنفاق — صفحة `/admin/users` مع تصدير CSV للتسويق.

**الحدود:** 3 رموز/ساعة لكل رقم، صلاحية الرمز 10 دقائق، 5 محاولات قصوى.

---

### 2) عدة شخصيات في الطلب الواحد + تسعير ديناميكي

**تعديل الجدول:** `characters` يُحوّل إلى `order_characters` بعلاقة many-to-one مع `orders`:
- `order_characters` (id, order_id, name, age, role enum: protagonist|friend|family|pet|other, description text)
- إزالة `character_id` من `orders`، تبقى بيانات العميل المُوحّدة على `users`.
- إضافة `extra_characters_count` (محسوبة من العدد - 1) و `companions_brief` على `orders`.

**الحدود والتسعير:**
- شخصية رئيسية واحدة إلزامية (مجانية ضمن السعر الأساس) + حتى 4 شخصيات إضافية.
- إضافة حقول إلى `pricing_settings`: `per_character_iqd_pdf` (default 1500)، `per_character_iqd_printed` (default 3000)، `per_character_iqd_video` (default 6000) — قابلة للتعديل من `/admin/settings`.
- `computeTierAmount(tier, pageCount, characterCount, p)` يضيف `(characterCount - 1) * per_character_iqd_{tier}`.

**واجهة `/create`:** قسم "الشخصيات" — بطاقة لكل شخصية مع زر "+ إضافة شخصية" و"حذف"، وعرض السعر اللحظي يتحدّث مع كل إضافة.

---

### 3) "جو الكتابة" متعدد + تعليمات نصية مخصصة

**تعديل `orders`:** إضافة `moods text[]` (بدل `mood` المفرد على `characters`) و `custom_instructions text` (اختياري، حد 500 حرف).

**واجهة:** البطاقات الحالية للأجواء تصبح اختيار متعدد (toggle)، مع حد 1–3 أجواء. تحت الاختيار يظهر `<textarea>` "تعليمات إضافية للقصة (اختياري)" مع placeholder: "مثال: الأحداث في كركوك، البطل يحب كرة القدم، أضف عبرة عن الصدق…".

**الدمج في توليد القصة:** الـ system prompt يضمّ:
```
أجواء القصة: {moods.join(", ")}
تعليمات المؤلف: {custom_instructions || "—"}
الشخصيات: {characters.map(...)}
```

---

### 4) معاينة بدون صور — الصور تُولَّد بعد تأكيد الدفع

**تغيير جوهري في دورة الحياة:**

```text
draft → preview_ready (نص فقط) → tier_chosen → payment_pending
      → payment_confirmed (الإدارة) → images_generating → ready_for_delivery
```

**التنفيذ:**
1. `generateFullStory` يُولّد فقط: العنوان + ملخص الشخصية + نص كل صفحة + `image_prompt` لكل صفحة (يُحفظ بدون توليد صورة). تكلفة AI تنخفض ~95٪ في المعاينة.
2. `/preview/$orderId` يعرض: عنوان، ملخص، قائمة نصوص الصفحات (بدون صور)، أزرار الباقات.
3. عند اختيار باقة → `confirmTierAndPrepareWhatsapp` يضع الطلب في `payment_pending` ويفتح واتساب (بدون PDF بعد).
4. في `/admin/orders/$id` زر **"تأكيد الدفع وبدء توليد الصور"** → server fn `confirmPaymentAndGenerateImages`:
   - يولّد الغلاف + صور الصفحات بالتوازي
   - يبني PDF
   - يحدّث الحالة إلى `ready_for_delivery` ويحفظ `pdf_path`
5. المستخدم في `/preview/$orderId` (polling مستمر) يرى لمّا يصير `ready_for_delivery`: تظهر الصور + زر "تحميل PDF" + رسالة "تم تأكيد الدفع — قصتك جاهزة".
6. صفحة `/my-orders` للمستخدم المسجّل تعرض كل طلباته وحالاتها.

---

### المخطط التقني المختصر

| ملف | التغيير |
|---|---|
| Migration | جداول `users`, `otp_codes`, `user_sessions`, `order_characters`; إضافة `moods`, `custom_instructions`, حقول التسعير; تعديل `orders` enum للحالات الجديدة |
| `src/lib/twilio.server.ts` | جديد — إرسال WhatsApp/SMS عبر Connector Gateway |
| `src/lib/user-session.server.ts` | جديد — كوكي جلسة المستخدم + `requireUserSession` middleware |
| `src/lib/auth.functions.ts` | جديد — `requestOtp`, `verifyOtp`, `logout`, `getCurrentUser` |
| `src/lib/pricing.ts` | تحديث `computeTierAmount` ليضيف تكلفة الشخصيات |
| `src/lib/orders.functions.ts` | فصل `generateFullStory` (نص فقط) عن `confirmPaymentAndGenerateImages` (صور+PDF)؛ دعم عدة شخصيات وأجواء |
| `src/routes/auth.tsx` | جديد — شاشة تسجيل الدخول OTP |
| `src/routes/create.tsx` | بناء الشخصيات الديناميكي، اختيار أجواء متعدد، textarea تعليمات، سعر لحظي |
| `src/routes/preview.$orderId.tsx` | إزالة عرض الصور، عرض النص فقط، polling لحالة `ready_for_delivery` |
| `src/routes/my-orders.tsx` | جديد — طلبات المستخدم |
| `src/routes/admin.users.tsx` | جديد — قائمة العملاء + تصدير CSV |
| `src/routes/admin.orders.$id.tsx` | زر "تأكيد الدفع وبدء التوليد"، عرض الشخصيات والأجواء والتعليمات |
| `src/routes/admin.settings.tsx` | حقول تسعير الشخصيات الإضافية |
| `src/lib/i18n.tsx` | مفاتيح ترجمة جديدة |

**ما يحتاج من المستخدم قبل التنفيذ:**
- ربط **Twilio** من قائمة الـ Connectors (للـ OTP عبر WhatsApp/SMS). إن لم يتوفر الآن، نبدأ بـ "وضع التطوير" يطبع الرمز في console الإدارة ويُستبدل بـ Twilio لاحقاً بدون تغييرات.

**ما لن يتغيّر:**
- تدفق الدفع اليدوي عبر واتساب
- صلاحيات الإدارة (07733570130 / 7979)
- شعار وألوان العلامة