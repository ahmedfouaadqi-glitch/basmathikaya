## تعديل تسجيل دخول الأدمن ليعمل عبر رمز OTP بالإيميل (بدون واتساب)

### الهدف
استبدال آلية "الرابط السحري عبر واتساب" برمز OTP مكوّن من 6 أرقام يُرسل إلى إيميل الأدمن، مع بقاء رابط الدخول كما هو `/admin/login` والعملية كاملة في نفس الصفحة.

### 1) قاعدة البيانات (migration جديدة)
- جدول جديد `admin_otp_codes`:
  - `id uuid pk`
  - `phone text not null`
  - `code_hash text not null` (SHA-256 للرمز، لا نخزّن الرمز الأصلي)
  - `expires_at timestamptz not null` (الآن + 5 دقائق)
  - `used_at timestamptz`
  - `attempts int default 0` (لإيقاف التخمين بعد 5 محاولات فاشلة)
  - `ip text`, `created_at timestamptz default now()`
- RLS مفعّل + سياسة "لا وصول للعموم" (كل الوصول عبر `service_role` من السيرفر).
- GRANT فقط لـ `service_role`.
- جدول `admin_login_tokens` القديم يبقى موجوداً لكن نتوقّف عن استخدامه (يمكن حذفه لاحقاً).

### 2) إعداد قائمة الأدمن + الإيميل
- قائمة أرقام الأدمن تبقى في الكود كما هي (`07733570130`, `07705828333`, + `ADMIN_PHONE` من المتغيرات).
- إضافة خريطة `phone → email` داخل `admin.functions.ts`:
  - `07733570130` → `ahmedfouaad.qi@gmail.com`
  - إمكانية استبدالها عبر متغير `ADMIN_EMAIL` (اختياري).

### 3) توليد رمز OTP آمن (سيرفر فقط)
- استخدام `crypto.randomInt(0, 1_000_000)` من `node:crypto` للحصول على 6 أرقام عشوائية آمنة (ليست متسلسلة، مقاومة للتخمين).
- تخزين SHA-256 فقط + `expires_at` (5 دقائق).
- حد أقصى 3 طلبات OTP لكل رقم/IP خلال 15 دقيقة (rate limit).

### 4) إرسال الإيميل
- استخدام بنية إيميلات Lovable المدمجة:
  - تشغيل `email_domain--setup_email_infra` ثم `email_domain--scaffold_transactional_email` إن لم تكن مهيّأة.
  - إن لم يكن هناك domain، عرض حوار إعداد الإيميل قبل المتابعة.
- إنشاء قالب جديد `src/lib/email-templates/admin-otp.tsx`:
  - يعرض الرمز بحجم كبير، صلاحية 5 دقائق، تحذير أمني.
  - علامة "بصمة حكاية" وألوان المشروع.
- الاستدعاء عبر `sendTransactionalEmail({ templateName: "admin-otp", recipientEmail, idempotencyKey, templateData: { code, expiresInMinutes: 5 } })`.

### 5) الـ Server Functions الجديدة (في `src/lib/admin.functions.ts`)
- `adminRequestOtp({ phone })`:
  - يتحقّق من كون الرقم أدمن (رد موحّد "ok" حتى لو لم يكن، لمنع كشف الأرقام).
  - يطبّق rate limit.
  - يولّد OTP، يخزّن hash، يرسل الإيميل للأدمن، يرجّع `{ ok: true }`.
- `adminVerifyOtp({ phone, code })`:
  - يبحث عن أحدث OTP غير مستخدم وغير منتهي للرقم.
  - يقارن hash بأمان زمني ثابت.
  - عند النجاح: `used_at = now()` + فتح جلسة `readAdminSession().update({ authenticated: true })` + `{ ok: true }`.
  - عند الفشل: `attempts++`، وبعد 5 محاولات يُبطل الرمز.
- حذف/تعطيل `adminRequestMagicLink` و`adminConsumeMagicLink` (والصفحة `admin.magic.$token.tsx`).

### 6) واجهة `/admin/login`
- خطوة 1: حقل "رقم الهاتف" + زر "دخول" → يستدعي `adminRequestOtp`.
- خطوة 2 (في نفس الصفحة): يظهر `InputOTP` بستة خانات + زر "تحقق" → يستدعي `adminVerifyOtp`.
  - عدّاد تنازلي 5 دقائق.
  - رابط "إعادة إرسال الرمز" (مقيّد بـ rate limit).
- عند النجاح: `navigate({ to: "/admin" })`.
- الرسائل المعروضة عامة (لا تكشف صحة الرقم).

### 7) الأمان
- لا رموز ثابتة في الكود إطلاقاً (نتأكد من إزالة أي بقايا لـ `ADMIN_CODE` من التحقق).
- OTP عشوائي 6 أرقام، مخزّن كـ SHA-256، صلاحية 5 دقائق، استخدام واحد.
- مقارنة hash عبر `timingSafeEqual`.
- Rate limit على الطلب + عدّاد محاولات على التحقق.
- ردود مبهمة تمنع تعداد الأرقام.
- كل الجلسة تُفتح داخل السيرفر عبر cookie مشفّرة (`SESSION_SECRET`).

### الملفات
- جديدة: migration لجدول `admin_otp_codes`، `src/lib/email-templates/admin-otp.tsx`.
- تُعدَّل: `src/lib/admin.functions.ts`, `src/routes/admin.login.tsx`, `src/lib/email-templates/registry.ts`.
- تُحذف: `src/routes/admin.magic.$token.tsx`.

### ملاحظة قبل التنفيذ
سنحتاج إلى تهيئة بنية الإيميلات (نطاق إيميل + بنية الإرسال) في هذا المشروع إن لم تكن مُفعّلة. إن لم يكن هناك نطاق إيميل، سأعرض شاشة إعداد النطاق أولاً ثم أكمل بقية الخطوات في نفس المهمة.
