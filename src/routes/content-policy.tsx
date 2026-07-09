import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/content-policy")({
  component: ContentPolicyPage,
  head: () => ({
    meta: [
      { title: "سياسة المحتوى — بصمة حكاية" },
      { name: "description", content: "حرية إبداعية كاملة للبالغين مع مراجعة إدارية سريعة. خطوط حمراء واضحة تحمي الجميع." },
    ],
  }),
});

function ContentPolicyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-6 p-6 leading-relaxed">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">سياسة المحتوى</h1>
        <p className="text-muted-foreground">
          بصمة حكاية منصّة لكل الأعمار — للأطفال، اليافعين، الشباب والبالغين. نؤمن بأن الحكاية أداة شفاء
          وحرية شخصية، وأن لكل إنسان بالغ الحقّ في أن يروي قصّته كما يشاء ضمن خطوط حمراء واضحة تحمي الجميع.
        </p>
      </header>

      <section className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
        <h2 className="text-xl font-semibold text-emerald-700 dark:text-emerald-400">آمن للنشر تلقائياً</h2>
        <ul className="list-disc space-y-1 pr-6 text-sm">
          <li>قصص الأطفال والعائلة بكل أساليبها.</li>
          <li>قصص شبابية عن السفر، الصداقة، العمل، المغامرة، الحنين.</li>
          <li>خيال، فانتازيا، تعليم، تأمل عام، حبّ عفيف.</li>
          <li>استخدام صور واقعية للأشخاص بموافقتهم.</li>
        </ul>
      </section>

      <section className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
        <h2 className="text-xl font-semibold text-amber-700 dark:text-amber-400">حرية شخصية للبالغين — يمر بمراجعة إدارية</h2>
        <p className="text-sm">
          لك <strong>الحرية الكاملة</strong> في كتابة قصّتك بأيّ أسلوب أو مستوى صراحة تريده، بالفصحى الراقية
          أو باللهجة العامية الجريئة. المحتوى للبالغين يمرّ بمراجعة إدارية سريعة قبل التوليد للتأكد من
          احترام الخطوط الحمراء أدناه — الرأي النهائي للإدارة، ولا حكم مسبق على أسلوب أو ذوق أيّ مستخدم.
        </p>
        <ul className="list-disc space-y-1 pr-6 text-sm">
          <li>محتوى جنسي، إباحي، تحرري، تعددي بين بالغين — بأيّ درجة صراحة.</li>
          <li>رومانسي، عشق، حسّي، شبقي، غرامي.</li>
          <li>لهجة عامية جريئة أو مفردات صريحة.</li>
          <li>تأمل عميق، شفاء داخلي، مواجهة صدمات نفسية.</li>
          <li>محتوى ديني/ثقافي حساس غير مسيء، أو ذكر أسماء شخصيات حقيقية بلا قصد تشهير.</li>
        </ul>
        <p className="text-xs text-muted-foreground">
          للفئة الجنسية الصريحة قد نطلب توثيق هوية بسيط للتأكد من العمر (18+). الوثائق تُحذف بعد المراجعة.
        </p>
      </section>

      <section className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4 space-y-2">
        <h2 className="text-xl font-semibold text-rose-700 dark:text-rose-400">مرفوض تلقائياً — لا استثناء</h2>
        <ul className="list-disc space-y-1 pr-6 text-sm">
          <li><strong>أيّ محتوى جنسي أو عنيف يشمل قاصرين</strong> (تحت 18) — رفض دائم ومطلق.</li>
          <li>عنف صريح مصوَّر، تعذيب، إيذاء ذاتي بتعليمات، دم مصوَّر (gore).</li>
          <li>محتوى سياسي حزبي، تحريض، دعاية إرهاب، تمجيد قتل.</li>
          <li>جرائم كراهية، تحريض عنصري/طائفي/ديني مباشر.</li>
          <li>تعليمات أسلحة، متفجرات، أو مواد ضارّة.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">خصوصيتك</h2>
        <p className="text-sm">
          كلّ القصص الشخصية تبقى خاصة بحسابك ولا تُنشر في المعرض العام إلا بموافقتك الصريحة.
          وثائق التحقق من العمر تُحذف بعد المراجعة ولا تُشارك مع أيّ طرف ثالث.
        </p>
      </section>
    </article>
  );
}
