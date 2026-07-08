import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "أسئلة شائعة — بصمة حكاية" },
      { name: "description", content: "إجابات مباشرة عن أشيع الأسئلة حول بصمة حكاية." },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQS.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
  component: FaqPage,
});

const FAQS = [
  { q: "كم يستغرق إنشاء القصة؟", a: "عادةً من 5 إلى 15 دقيقة بعد رفع الصورة واختيار الأجواء." },
  { q: "هل الصورة آمنة؟", a: "نعم — نستخدمها فقط لاستخراج ملامح الشخصية، ولا نشاركها مع أي طرف." },
  { q: "هل يمكنني تعديل القصة قبل الدفع؟", a: "نعم، تحصل على معاينة كاملة قبل أي التزام مالي." },
  { q: "كيف أستلم النسخة المطبوعة؟", a: "نُوصلها إلى باب البيت لكل محافظات العراق خلال 3-7 أيام." },
  { q: "ماذا لو لم تعجبني القصة؟", a: "المعاينة قبل الدفع تحميك — لا تدفع حتى تعجبك." },
  { q: "هل يمكنني إعادة تحميل PDF لاحقاً؟", a: "نعم، عبر صفحة طلباتي بسعر رمزي." },
];

function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl md:text-4xl font-extrabold text-center">أسئلة شائعة</h1>
      <div className="mt-8 space-y-3">
        {FAQS.map((f) => (
          <details key={f.q} className="group rounded-xl border bg-card p-4 open:shadow-sm">
            <summary className="cursor-pointer font-bold text-sm marker:content-none">
              <span className="me-2 text-primary group-open:rotate-45 inline-block transition">+</span>
              {f.q}
            </summary>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
