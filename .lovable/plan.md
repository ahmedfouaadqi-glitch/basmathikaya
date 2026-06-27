
# خطة بناء MVP "بصمة حكاية" (مُحدّثة v3)

منصة PWA لتوليد قصص مخصصة، مع طلب عبر واتساب، **لوحة إدارة بدخول مُقيّد برقم وكلمة سر ثابتين**، وتتبع تكلفة لحظي حقيقي.

## 1) البنية التقنية

- TanStack Start + Tailwind + shadcn + **Lovable Cloud** + **Lovable AI Gateway**.
- PWA: manifest + أيقونات + theme-color (بدون Service Worker).
- RTL/LTR: عربي/إنجليزي مع مبدّل لغة. خطوط Tajawal + Inter.

## 2) الهوية البصرية

`#FFFBF5` خلفية، `#1A1410` نص، `#D97706` ذهبي أساسي، `#6B21A8` لمسة عميقة. حواف ناعمة وانتقالات سلسة.

## 3) المستخدمون والوصول

**المستخدم العادي:** لا يحتاج تسجيل. يدخل `/create` مباشرة، يملأ النموذج، يرى المعاينة، يطلب عبر واتساب. (نربط الطلب برقم هاتف يُدخله في النموذج بدل حساب).

**الإدارة:** دخول مقيّد عبر بوابة كلمة سر مشتركة:
- الرقم المسموح فقط: `07733570130`
- كلمة السر: `7979`
- المسار: `/admin/login`
- بعد الدخول: جلسة مشفّرة (cookie httpOnly) صالحة 7 أيام → الوصول إلى كل `/admin/*`.
- زر "خروج" يمسح الجلسة.

### آلية تنفيذ بوابة الإدارة (Server-side gate)

- المقارنة تتم في `createServerFn` فقط، باستخدام `timingSafeEqual`.
- القيم تُحفظ كأسرار خادم (env vars):
  - `ADMIN_PHONE = 07733570130`
  - `ADMIN_CODE = 7979`
  - `SESSION_SECRET` = سلسلة عشوائية 32 حرفاً (يُولّدها النظام).
- الجلسة عبر `useSession` من `@tanstack/react-start/server`.
- كل route تحت `/admin/*` يستدعي `requireAdmin()` في الـ loader، فيرمي `redirect({ to: "/admin/login" })` إن لم تكن مفتوحة.
- كل server function إدارية (تعديل حالة، تغيير إعدادات، حذف) تستدعي `requireAdmin()` في `.handler()` قبل أي عملية — حتى لا يكفي تجاوز الواجهة.
- لا توجد جداول `profiles` ولا `user_roles` ولا `auth.users` للمسؤول — البوابة كافية لشخص واحد.

## 4) رحلة المستخدم

```text
/                       صفحة الهبوط
/create                 رفع صورة + اسم + عمر + جو القصة + رقم هاتف العميل
/preview/:orderId       معاينة الغلاف + الفقرة الأولى + اختيار باقة + زر واتساب
/order/:orderId         صفحة حالة الطلب (متابعة)
/admin/login            بوابة الإدارة (رقم + كود)
/admin                  لوحة الإدارة (طلبات + تكاليف)
/admin/orders/:id       تفاصيل الطلب والتكلفة الفعلية
/admin/analytics        إحصائيات
/admin/settings         إعدادات الأسعار
```

## 5) المستويات والأسعار

| المستوى | السعر (د.ع) |
|---|---|
| PDF فوري | 3,000 |
| نسخة مطبوعة | 10,000 |
| فيديو فاخر | لاحقاً |

رابط واتساب: `https://wa.me/9647733570130?text=...` برسالة جاهزة (رقم الطلب + الباقة + المبلغ).

## 6) تتبع التكلفة اللحظي (كما هو في v2)

- جدول `generation_events` يسجّل كل استدعاء AI Gateway: الموديل، التوكنز، الصور، `aig_log_id`، `cost_credits`، الزمن، الحالة.
- جدول `pricing_settings`: `usd_per_credit`, `iqd_per_usd`, أسعار الباقات، تكلفة طباعة/شحن.
- View `order_costs_v` يجمع لكل طلب: الإيراد، التكلفة الفعلية، الربح، الهامش %.
- بعد كل استدعاء AI Gateway، تُستدعى مهمة مزامنة تجلب التكلفة الحقيقية من `ai_gateway_logs--get_ai_gateway_request` وتحدّث الصف.
- **Realtime** على `orders` و `generation_events` → لوحة الإدارة تتحدث لحظياً.

## 7) قاعدة البيانات

```sql
characters(id, customer_name, customer_phone, age, mood, image_path, created_at)

orders(
  id uuid PK,
  order_number serial unique,
  character_id → characters,
  customer_phone text,
  tier text check in ('pdf','printed','video'),
  amount_iqd int,
  status text check in ('pending','paid','delivered','cancelled') default 'pending',
  whatsapp_sent_at, paid_at, delivered_at,
  created_at
)

generations(id, order_id, first_paragraph, cover_image_path, full_story, created_at)

generation_events(... كما في v2 ...)
pricing_settings(... كما في v2 ...)
```

- **RLS:** الجداول كلها مقفولة من `anon` و `authenticated` (لا يوجد مستخدمون مسجلون). كل القراءة/الكتابة تمر عبر server functions باستخدام service role، والتي بدورها:
  - لإنشاء الطلب: تتحقق من صحة المدخلات فقط (بدون حماية إضافية، الإنشاء عام).
  - لقراءة/تعديل الإدارة: تستدعي `requireAdmin()` أولاً.
- Buckets: `story-uploads` (private، الوصول عبر signed URLs)، `story-covers` (public).

## 8) ما هو خارج النطاق

- توليد الفيديو وتحريك الشفاه.
- توليد PDF آلي وإرساله (يدوي عبر واتساب).
- بوابات دفع آلية.
- إشعارات Push.
- حسابات مستخدمين متعددة (المستخدم العادي لا يسجّل دخول).

## ترتيب التنفيذ

1. تفعيل Lovable Cloud + إنشاء الجداول وRLS وStorage وView.
2. إضافة الأسرار: `ADMIN_PHONE`, `ADMIN_CODE`, `SESSION_SECRET`.
3. PWA + i18n + RTL + هوية بصرية + Header.
4. صفحة الهبوط + `/create` + التحقق من المدخلات.
5. Server functions للنص و server route للصورة (streaming) + التقاط `aig_log_id`.
6. مزامنة التكلفة من AI Gateway.
7. `/preview` مع البث + الباقات + زر واتساب.
8. `/admin/login` (بوابة كلمة سر مشتركة) + `requireAdmin()`.
9. `/admin` (جدول طلبات Realtime) + `/admin/orders/:id` + `/admin/analytics` + `/admin/settings`.
10. اختبار الرحلة كاملة والتحقق من دقة التكلفة.

هل أبدأ التنفيذ؟
