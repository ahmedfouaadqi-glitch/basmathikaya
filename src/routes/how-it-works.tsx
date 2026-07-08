import { createFileRoute, Link } from "@tanstack/react-router";
import { Upload, Palette, Sparkles, BookOpen } from "lucide-react";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "كيف يعمل — بصمة حكاية" },
      { name: "description", content: "أربع خطوات فقط: ارفع الصورة، اختر الأجواء، عاين، واستلم PDF." },
      { property: "og:title", content: "كيف يعمل — بصمة حكاية" },
      { property: "og:description", content: "من الصورة إلى الحكاية في دقائق." },
    ],
  }),
  component: HowItWorksPage,
});

const STEPS = [
  { icon: Upload, title: "١. ارفع صورة", body: "صورة واضحة للطفل — نستخرج ملامحه لضمان ثبات الشخصية عبر كل الصفحات." },
  { icon: Palette, title: "٢. اختر الأجواء", body: "ثيم، مواسم، شخصيات إضافية، وأسلوب رسم يناسب ذوقكم." },
  { icon: Sparkles, title: "٣. عاين قبل الدفع", body: "ترى معاينة كاملة، وتوافق عليها قبل أي دفع." },
  { icon: BookOpen, title: "٤. استلم PDF فوري", body: "بعد تأكيد الدفع عبر واتساب، يصلك رابط تحميل جاهز للطباعة." },
];

function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-extrabold">كيف يعمل بصمة حكاية</h1>
        <p className="mt-3 text-muted-foreground">من الصورة إلى قصة بيد طفلك في دقائق.</p>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {STEPS.map((s) => (
          <div key={s.title} className="rounded-2xl border bg-card p-6 shadow-sm">
            <s.icon className="size-7 text-primary" />
            <h3 className="mt-3 text-lg font-bold">{s.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 text-center">
        <Link
          to="/create"
          className="inline-block rounded-xl bg-gradient-to-br from-primary to-accent px-8 py-3 font-bold text-primary-foreground shadow-warm"
        >
          ابدأ حكايتك الآن
        </Link>
      </div>
    </div>
  );
}
