import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "سياسة الخصوصية — بصمة حكاية" },
      { name: "description", content: "كيف نجمع بياناتك، نستخدمها، ونحميها في بصمة حكاية." },
      { property: "og:title", content: "سياسة الخصوصية — بصمة حكاية" },
      { property: "og:description", content: "كيف نجمع بياناتك، نستخدمها، ونحميها في بصمة حكاية." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://urstory.space/privacy" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "سياسة الخصوصية — بصمة حكاية" },
      { name: "twitter:description", content: "كيف نجمع بياناتك، نستخدمها، ونحميها في بصمة حكاية." },
    ],
    links: [{ rel: "canonical", href: "https://urstory.space/privacy" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "سياسة الخصوصية — بصمة حكاية",
          description: "كيف نجمع بياناتك، نستخدمها، ونحميها في بصمة حكاية.",
          url: "https://urstory.space/privacy",
        }),
      },
    ],
  }),
  component: PrivacyPage,
});

const SECTIONS = [
  {
    title: "ما البيانات التي نجمعها",
    body: "نجمع البيانات اللازمة لإنشاء طلبك فقط: الاسم، رقم الهاتف، الصور المرفقة، نص الحكاية، والتعليمات الإضافية. لا نطلب بيانات بطاقة ائتمان أو معلومات هوية رسمية. الصور التي ترفعها تُستخدم لاستخراج ملامح الشخصية وتوليد الرسومات فقط.",
  },
  {
    title: "كيف نستخدم بياناتك",
    body: "نستخدم بياناتك لإنشاء القصة والرسومات، وتواصل معك عبر واتساب لتأكيد الطلب والدفع والتسليم. لا نبيع بياناتك لأي طرف ثالث، ولا نستخدمها لأغراض إعلانية خارج المنصة.",
  },
  {
    title: "الاحتفاظ والحذف",
    body: "نحتفظ بقصتك وصورها لمدة تسمح لك بطلب إعادة التحميل أو إعادة الطباعة لاحقاً. يمكنك طلب حذف بياناتك وطلباتك بشكل نهائي في أي وقت عبر التواصل مع الإدارة. بمجرد الحذف، لا يمكن استعادة الملفات.",
  },
  {
    title: "مشاركة المحتوى",
    body: "المحتوى العام (المعروض في المعرض) يُنشر فقط بعد موافقتك الصريحة. أنت تتحمل المسؤولية الكاملة عن النصوص والصور التي ترفعها، وتقر بأن لك الحق في استخدامها. الإدارة تحتفظ بحق رفض أو حذف أي محتوى يخالف الشروط.",
  },
  {
    title: "الأمان",
    body: "نستخدم اتصالات مشفرة (HTTPS) ونخزّن البيانات في بيئة محمية بأذونات الوصول. ومع ذلك، لا يوجد نظام آمن 100%؛ إذا اكتشفنا أي خرق، سنعمل على إصلاحه وإبلاغ المستخدمين المتأثرين بأسرع وقت.",
  },
  {
    title: "تحديث السياسة",
    body: "قد نُحدّث هذه السياسة من وقت لآخر. سيعكس تاريخ التحديث أسفل الصفحة آخر تغيير. استمرارك في استخدام الموقع يعني موافقتك على النسخة الحالية.",
  },
];

function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 leading-relaxed">
      <h1 className="text-3xl md:text-4xl font-extrabold text-center">سياسة الخصوصية</h1>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        آخر تحديث: 10 أغسطس 2026
      </p>

      <div className="mt-10 space-y-6">
        {SECTIONS.map((s) => (
          <section key={s.title} className="rounded-xl border bg-card p-5">
            <h2 className="text-lg font-bold">{s.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.body}</p>
          </section>
        ))}
      </div>

      <div className="mt-10 text-center text-sm text-muted-foreground">
        إذا كان لديك أي استفسار، تواصل معنا عبر{" "}
        <Link to="/content-policy" className="text-primary underline hover:opacity-80">
          سياسة المحتوى
        </Link>
        {" "}أو صفحة{" "}
        <Link to="/faq" className="text-primary underline hover:opacity-80">
          الأسئلة الشائعة
        </Link>
        .
      </div>
    </article>
  );
}
