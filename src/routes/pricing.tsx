import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getPublicPricing } from "../lib/orders.functions";
import { Check } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "الأسعار — بصمة حكاية" },
      { name: "description", content: "خطط شفافة: PDF فوري، أو نسخة مطبوعة تصلك للبيت." },
      { property: "og:title", content: "الأسعار — بصمة حكاية" },
      { property: "og:description", content: "اختر ما يناسبك — الأسعار واضحة، لا رسوم مخفية." },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  const fn = useServerFn(getPublicPricing);
  const q = useQuery({ queryKey: ["public-pricing"], queryFn: () => fn(), staleTime: 60_000 });
  const p = q.data;

  const plans = p
    ? [
        {
          name: "PDF فوري",
          price: p.tier_pdf_iqd,
          desc: "قصة PDF جاهزة للطباعة في البيت — تصلك مباشرة.",
          features: ["5 صفحات كأساس", "شخصية رئيسية", "معاينة قبل الدفع", "إعادة تحميل بتكلفة رمزية"],
        },
        {
          name: "نسخة مطبوعة",
          price: p.tier_printed_iqd,
          desc: "كتاب حقيقي مطبوع بجودة عالية يصل إلى باب البيت.",
          features: ["كل مزايا PDF", "طباعة احترافية", "توصيل لكل العراق", "هدية مثالية"],
          featured: true,
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-extrabold">أسعار شفافة</h1>
        <p className="mt-2 text-muted-foreground">لا رسوم مخفية — تعرف السعر النهائي قبل الدفع.</p>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {plans.map((pl) => (
          <div
            key={pl.name}
            className={`rounded-2xl border p-6 ${
              pl.featured ? "border-primary/60 bg-gradient-to-br from-primary/10 to-accent/10 shadow-warm" : "bg-card"
            }`}
          >
            {pl.featured && (
              <div className="mb-2 inline-block rounded-full bg-primary text-primary-foreground text-[10px] px-2 py-0.5">
                الأكثر طلباً
              </div>
            )}
            <h3 className="text-xl font-bold">{pl.name}</h3>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-extrabold">{Number(pl.price).toLocaleString()}</span>
              <span className="text-sm text-muted-foreground">د.ع</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{pl.desc}</p>
            <ul className="mt-4 space-y-2 text-sm">
              {pl.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 text-primary shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/create"
              className="mt-6 inline-block w-full rounded-xl bg-gradient-to-br from-primary to-accent py-2.5 text-center font-bold text-primary-foreground"
            >
              ابدأ الآن
            </Link>
          </div>
        ))}
      </div>

      {p && (
        <div className="mt-8 rounded-2xl border bg-card p-5 text-sm">
          <h3 className="font-bold mb-2">إضافات</h3>
          <ul className="space-y-1 text-muted-foreground">
            <li>صفحة إضافية (PDF): {Number(p.per_page_iqd_pdf).toLocaleString()} د.ع</li>
            <li>شخصية إضافية (PDF): {Number(p.per_character_iqd_pdf).toLocaleString()} د.ع</li>
            <li>جودة احترافية: × {p.quality_premium_multiplier}</li>
            <li>إعادة تحميل PDF: {Number(p.redownload_iqd_pdf).toLocaleString()} د.ع</li>
          </ul>
        </div>
      )}
    </div>
  );
}
