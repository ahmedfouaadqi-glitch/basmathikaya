
## الهدف
إلغاء اعتماد إرسال OTP عبر البريد (لأنه لا يوجد دومين/واتساب مربوط حالياً)، والعودة إلى تسجيل دخول للأدمن بخطوة واحدة: **رقم الهاتف + رمز سري ثابت**، مع إبقاء الحماية على مستوى:
- الرمز لا يُخزَّن كنص عادي، بل **SHA-256 hash** داخل سرّ `ADMIN_CODE_HASH`.
- المقارنة `timingSafeEqual` (كما هو حالياً).
- بقاء قائمة أرقام الأدمن البيضاء (`ADMIN_PHONES` + `ADMIN_PHONE`).
- بقاء حد المحاولات (Rate limit) لكن على جدول جديد بسيط أو إعادة استخدام `admin_otp_codes` كسجل محاولات فقط.

سأولّد الرمز عشوائياً (8 أرقام)، وأخزّن **الـ hash** فقط في `ADMIN_CODE_HASH`، ثم أعرض لك **الرمز الأصلي مرة واحدة في المحادثة** لتحفظه — بعدها لن يظهر مجدداً في أي مكان.

## التعديلات

### 1. الأسرار (Secrets)
- توليد سرّ جديد `ADMIN_CODE_HASH` (قيمة hex 64 حرفاً = SHA-256 لرمز عشوائي من 8 أرقام).
- سيتم إعلامك بالرمز الأصلي في ردّ المحادثة فوراً بعد التوليد.
- إبقاء `ADMIN_PHONE` كما هو.
- `ADMIN_CODE` القديم يبقى موجوداً لكن غير مستخدم (يمكن حذفه لاحقاً).

### 2. `src/lib/admin.functions.ts`
- حذف: `adminRequestOtp`, `adminVerifyOtp`, `sendAdminOtpEmail`, `generateOtp`, `hashCode` (المتعلق بالإيميل)، وكل ما يخص جدول `admin_otp_codes` للإرسال.
- إضافة `adminLogin({ phone, code })`:
  1. تطبيع الهاتف والتحقق من كونه ضمن `allowedPhones()`.
  2. Rate-limit بسيط عبر جدول `admin_login_attempts` (5 محاولات فاشلة / 15 دقيقة لكل IP+هاتف).
  3. حساب `sha256(code)` ومقارنته بـ `process.env.ADMIN_CODE_HASH` عبر `timingSafeEqual`.
  4. عند النجاح: فتح جلسة الأدمن (`readAdminSession().update({ authenticated: true })`).
  5. عند الفشل: تسجيل المحاولة وإرجاع `{ ok: false }` بدون تسريب السبب.
- إبقاء `adminLogout` و `adminCheck` كما هما.

### 3. `src/routes/admin.login.tsx`
- تبسيط الواجهة إلى نموذج واحد بخطوة واحدة: **حقل الهاتف + حقل الرمز + زر دخول**.
- إزالة تدفق الخطوتين (`step: "phone" | "code"`).
- استدعاء `adminLogin` مباشرة.
- رسائل خطأ عربية موحّدة ("بيانات دخول غير صحيحة").

### 4. Migration جديد
```sql
CREATE TABLE public.admin_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  ip text,
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.admin_login_attempts (phone, created_at DESC);
CREATE INDEX ON public.admin_login_attempts (ip, created_at DESC);
ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;
-- لا policies: يُقرأ/يُكتب فقط عبر service_role
GRANT ALL ON public.admin_login_attempts TO service_role;
```
- يمكن ترك جدول `admin_otp_codes` كما هو (بدون كسر شيء)، أو إسقاطه لاحقاً في migration نظافة.

### 5. لا تعديلات أخرى
- لا حاجة لتغيير `admin-session.server.ts` أو أي صفحة أخرى.

## ملاحظات أمنية
- الرمز 8 أرقام = مساحة 100 مليون، مع rate-limit 5 محاولات/15 دقيقة = عملياً غير قابل للتخمين.
- الـ hash فقط في الأسرار؛ حتى لو سُرّبت متغيّرات البيئة يبقى استرجاع الرمز الأصلي مكلفاً (لكنه ممكن نظرياً لأنه 8 أرقام فقط) — لذلك ننصح لاحقاً بترقية الرمز إلى 12+ خانة عندما تفعّل قناة إرسال (واتساب/بريد).
- عند الحاجة لتدوير الرمز مستقبلاً: أعِد استدعائي وسأولّد رمزاً جديداً وأحدّث `ADMIN_CODE_HASH` وأشاركه معك.

## نتيجة التنفيذ
- شاشة `/admin/login`: هاتف + رمز → دخول مباشر.
- الرمز الأصلي يظهر لك مرّة واحدة في المحادثة بعد التنفيذ (احفظه في مدير كلمات السر).
