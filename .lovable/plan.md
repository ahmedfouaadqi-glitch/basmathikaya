# خطة التنفيذ

## 1) التحقق التلقائي من الكوبون في صفحة الطلب
- في `src/routes/create.tsx`: عند تغيير حقل الكوبون (debounce ~500ms) استدعاء server fn جديدة `validateCoupon({ code, quality, pageCount, tier })` تُرجع `{ valid, reason, discount_value, discount_type }`.
- إظهار أيقونة ✓ خضراء عند الصلاحية أو ✗ حمراء مع سبب (منتهي / غير موجود / لا يشمل هذا التير / أقل من الحد الأدنى للصفحات / استُنفد).
- تحديث السعر النهائي مباشرة.

## 2) تدفق الطلب عبر واتساب بدون توليد
- في `create.tsx` عند تأكيد الحوار: بدل استدعاء `adminConfirmPaymentAndGenerate`، تُنشأ فقط سجل طلب بحالة `pending_payment` عبر server fn جديدة `createOrderDraft` (تحفظ: الشخصيات، الأجواء، الجودة، الصفحات، الكوبون، السعر النهائي).
- توجيه المستخدم فوراً إلى `wa.me/<admin>?text=<تفاصيل الطلب + رقم الطلب + الكوبون + السعر>`.
- لا يتم توليد أي نص أو صورة إلى أن يضغط الأدمن "تأكيد الدفع" في `admin.orders.$id.tsx` — عندها فقط يُشغّل `adminConfirmPaymentAndGenerate` الحالي.
- عند تأكيد الأدمن: يُرسَل إشعار داخل التطبيق (سطر جديد في جدول `notifications` أو حقل `notice` على الطلب) يظهر في `my-orders.tsx`: «تم استلام الدفع، القصة قيد الإعداد وقد تستغرق بعض الوقت».

## 3) منع فتح/توليد الطلبات الملغاة أو المرفوضة أو المحذوفة
- في `preview.$orderId.tsx`: إذا كان `status ∈ {cancelled, rejected}` أو `deleted_at != null` → عرض بطاقة سبب فقط (`rejection_reason` أو "ملغى/محذوف")، بدون تشغيل `useEffect` التوليد ولا زر التحميل ولا الفيديو ولا شارة "قيد الإنشاء".
- في `my-orders.tsx`: النقر على مثل هذه الطلبات يفتح نفس الصفحة ولكن بوضع للقراءة فقط.

## 4) إعادة الطلب المكتمل (Reorder)
- في `my-orders.tsx` للطلبات `delivered`: زر «إعادة الطلب» يفتح Dialog يختار فيه المستخدم الجودة (قياسي/احترافي) وإدخال كوبون اختياري.
- server fn `reorderExisting({ orderId, quality, coupon })` تنسخ الطلب الأصلي (نفس الشخصيات/الأجواء/العنوان/الصفحات) كطلب جديد بحالة `pending_payment`، تحسب السعر بالجودة الجديدة، تُنشئ إشعار للأدمن، ثم تُعيد رابط واتساب مُجهّز بكل التفاصيل ورقم الطلب الجديد.
- خيار ثانٍ داخل نفس الحوار: «إعادة تحميل مدفوعة فقط» (يبقى المسار الحالي `requestRedownload`).
- بعد تأكيد الأدمن الدفع → يبدأ التوليد الطبيعي.

## 5) توسيع صلاحيات الكوبون
- ترحيل: إضافة إلى `coupons`: `min_pages int`, `applies_quality text[]` (قيم: standard/premium)، `applies_tier text[]` (pdf/printed/video).
- تحديث `admin.coupons.tsx`: حقل «يبدأ من عدد صفحات»، checkboxes للجودة، checkboxes للتير.
- منطق `validateCoupon` و `applyCoupon` يتحقق من هذه القيود ويُرجع سبباً محدداً عند الرفض.

## 6) العملاء: حظر فقط (على رقم الهاتف)
- في `admin.users.tsx`: إزالة أزرار الحذف والتعليق، الإبقاء على «حظر / فك الحظر».
- ترحيل: جدول جديد `phone_bans(phone text pk, reason text, banned_at, banned_by)` مع GRANT + RLS.
- تعديل `auth.functions.ts`: منع تسجيل الدخول/التسجيل إذا كان الرقم محظوراً + رسالة السبب.
- server fn `adminBanPhone({phone, reason})` / `adminUnbanPhone({phone, reason})` — تُنشئ إشعاراً داخل التطبيق للمستخدم صاحب الرقم بنص السبب.
- إزالة `adminDeleteUser` و `adminSuspendUser` من الواجهة (يمكن ترك الدوال موجودة لكن غير مستدعاة).

## 7) عرض رصيد الذكاء الاصطناعي للأدمن
- في `admin.index.tsx` (لوحة الأدمن): بطاقة جديدة «الرصيد المتبقي».
- server fn `getAICreditBalance()` تستدعي Lovable AI Gateway (`credits--get_my_usage` عبر REST داخلياً أو حساب تقريبي من `pricing_settings` + متوسط استهلاك القصة).
- الحساب المعروض: `عدد القصص المتبقي (قياسي, 5 صفحات) = floor(balance / cost_standard_per_story)` و نفسه للاحترافي، بدون ذكر اسم النموذج.
- التكلفة التقديرية للقصة تُخزَّن كحقلين في `pricing_settings`: `ai_cost_estimate_standard`, `ai_cost_estimate_premium` (قابلين للتعديل من `admin.settings.tsx`).

---

## التفاصيل التقنية

### ترحيلات SQL
```sql
ALTER TABLE coupons
  ADD COLUMN min_pages int DEFAULT 0,
  ADD COLUMN applies_quality text[] DEFAULT ARRAY['standard','premium'],
  ADD COLUMN applies_tier text[] DEFAULT ARRAY['pdf','printed','video'];

CREATE TABLE phone_bans (
  phone text PRIMARY KEY,
  reason text,
  banned_at timestamptz DEFAULT now(),
  banned_by uuid
);
GRANT SELECT ON phone_bans TO authenticated;
GRANT ALL ON phone_bans TO service_role;
ALTER TABLE phone_bans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own ban" ON phone_bans FOR SELECT TO authenticated USING (true);

ALTER TABLE orders ADD COLUMN payment_status text DEFAULT 'pending_payment';
ALTER TABLE pricing_settings
  ADD COLUMN ai_cost_estimate_standard numeric DEFAULT 0.05,
  ADD COLUMN ai_cost_estimate_premium numeric DEFAULT 0.15,
  ADD COLUMN whatsapp_admin_number text DEFAULT '';

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_id uuid,
  title text NOT NULL,
  body text,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, UPDATE ON notifications TO authenticated;
GRANT ALL ON notifications TO service_role;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications" ON notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
```

### الملفات المُعدَّلة
- `src/lib/orders.functions.ts` — `createOrderDraft`, `reorderExisting`, `validateCoupon`, تحديث تدفق التأكيد.
- `src/lib/pricing.ts` — دالة `evaluateCoupon` مع قيود min_pages/tier/quality.
- `src/lib/auth.functions.ts` — فحص `phone_bans`.
- `src/lib/notifications.functions.ts` (جديد) — `listMyNotifications`, `markRead`.
- `src/lib/ai-credits.functions.ts` (جديد) — رصيد Lovable AI.
- `src/routes/create.tsx` — تحقق الكوبون الفوري + توجيه واتساب.
- `src/routes/my-orders.tsx` — إشعارات، حالة "بانتظار الدفع"، إعادة الطلب.
- `src/routes/preview.$orderId.tsx` — حراسة الحالات الملغاة/المرفوضة.
- `src/routes/admin.users.tsx` — حظر فقط.
- `src/routes/admin.coupons.tsx` — الحقول الجديدة.
- `src/routes/admin.orders.$id.tsx` — زر «تأكيد الدفع وبدء التوليد».
- `src/routes/admin.index.tsx` — بطاقة الرصيد.
- `src/routes/admin.settings.tsx` — رقم واتساب الأدمن + تقديرات التكلفة.

### ملاحظات
- لن يتم استهلاك أي رصيد ذكاء اصطناعي قبل تأكيد الدفع من الأدمن (يحل مشكلة الطلبات الوهمية).
- كل تعديل من الأدمن يستدعي `qc.invalidateQueries` للطلبات والإعدادات لضمان تحديث الكاش تلقائياً.
- لا تغيير في البنية التحتية (نفس Supabase، نفس server functions، نفس TanStack).
