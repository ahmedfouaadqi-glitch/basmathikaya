import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/content-policy")({
  component: ContentPolicyPage,
  head: () => ({
    meta: [
      { title: "سياسة المحتوى — بصمة حكاية" },
      { name: "description", content: "قواعد المحتوى في بصمة حكاية: منصّة لكل الأعمار مع احترام الخصوصية والحدود الأخلاقية." },
    ],
  }),
});

function ContentPolicyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-5 p-6 leading-relaxed">
      <h1 className="text-3xl font-bold">سياسة المحتوى</h1>
      <p className="text-muted-foreground">
        بصمة حكاية منصّة لكل الأعمار — للأطفال، اليافعين، الشباب والبالغين. نؤمن أن الحكاية أداة شفاء
        ومتعة، وأن لكل إنسان حرية أن يروي قصته كما يشاء ضمن حدود واضحة تحفظ الجميع.
      </p>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">ما هو مسموح دائماً</h2>
        <ul className="list-disc space-y-1 pr-6 text-sm">
          <li>قصص الأطفال والعائلة بجميع أساليبها.</li>
          <li>قصص شبابية وبالغة عن السفر، العمل، الحنين، الشفاء، الحب العفيف.</li>
          <li>مواضيع فلسفية وتأملية.</li>
          <li>استخدام صور واقعية للأشخاص بموافقتهم.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">ما يحتاج مراجعة إدارية</h2>
        <ul className="list-disc space-y-1 pr-6 text-sm">
          <li>محتوى رومانسي/حميمي بين بالغين — قد نطلب توثيق الهوية للتأكد من العمر.</li>
          <li>قصص تعالج صدمات نفسية شديدة أو محتوى صادم.</li>
          <li>استخدام أسماء شخصيات عامة معروفة.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">ما هو ممنوع تلقائياً</h2>
        <ul className="list-disc space-y-1 pr-6 text-sm">
          <li>أي محتوى جنسي يشمل قاصرين — رفض فوري ودائم.</li>
          <li>العنف الصريح ضد الأطفال أو تحريض على الإيذاء.</li>
          <li>تحريض على الكراهية العنصرية أو الدينية أو الإرهاب.</li>
          <li>انتحال شخصيات حقيقية بقصد الإيذاء أو التشهير.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">خصوصيتك</h2>
        <p className="text-sm">
          القصص الشخصية تبقى خاصة بحسابك ولا تُنشر في المعرض إلا بموافقتك الصريحة.
          الوثائق التي نطلبها للتحقق من العمر تُحذف بعد المراجعة ولا تُشارك مع أي طرف.
        </p>
      </section>
    </article>
  );
}
