# خطة Stage 4 — Background Jobs

الأصغر والأكثر استقلالية من المراحل المتبقية. سأنفّذه كاملاً في هذه الجولة.

## 1. Runners حقيقية في `src/lib/jobs/runners.server.ts`
- `send_notification` — يقرأ `payload.user_id` و`payload.title` و`payload.body`، ويكتب صفاً في `notifications`.
- `generate_pdf` — placeholder آمن: يعلّم `orders.pdf_generation_status='ready'` (التوليد الفعلي يبقى في المسار الحالي كما هو، هذا فقط لكسر تعلّق UI اللاحق).
- `generate_share_cards` — placeholder ينشئ `share_token` إن لم يكن موجوداً ويكتب صفاً واحداً في `share_cards` (Satori الحقيقي في Stage 6).

كلها **fail-open**: خطأ في runner يرفع فشل الـ job فقط، لا يكسر أي شيء آخر.

## 2. `useJobStatus(orderId)` hook
- `src/hooks/use-job-status.ts` — يقرأ آخر job لكل نوع لطلب معيّن، polling كل 3s عبر React Query.
- استخدام اختياري: لا يُدمج في أي صفحة الآن (بلا كسر UI).

## 3. Endpoint فحص من admin
- `src/routes/api/public/hooks/jobs-tick.ts` موجود بالفعل — سأتأكد أنه يستدعي `processJobs()` مرة واحدة.

## 4. جدولة pg_cron
- عبر `supabase--insert` (وليس migration): جدولة كل دقيقة لاستدعاء `/api/public/hooks/jobs-tick` بـ `apikey: <anon>`.
- URL: `https://project--71f5789e-f8c3-4faf-95ba-9308bc0ea4d7.lovable.app/api/public/hooks/jobs-tick`.

## المبادئ
- كل شيء fail-open + backward compatible.
- لا تغيير في `orders.functions.ts` أو أي API حالية.
- Runners الحالية للطلبات تبقى كما هي — Jobs مسار موازي فقط.

## مخرج نهائي
- ملف hook جديد.
- runners.server.ts موسّع.
- pg_cron schedule واحد.
- تقرير مختصر عند الانتهاء.

بعد Stage 4 سأنتقل مباشرة لباقي المراحل في جولات لاحقة (5-8 كلٌ منها كبير: family CRUD، Satori، 9 صفحات admin).
