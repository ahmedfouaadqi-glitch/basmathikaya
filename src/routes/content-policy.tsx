import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getSiteCopyBulk } from "../lib/site-copy.functions";
import { SiteMarkdown } from "../components/SiteMarkdown";

export const Route = createFileRoute("/content-policy")({
  component: ContentPolicyPage,
  head: () => ({
    meta: [
      { title: "سياسة المحتوى — بصمة حكاية" },
      { name: "description", content: "حرية إبداعية كاملة للبالغين مع مراجعة إدارية سريعة. خطوط حمراء واضحة تحمي الجميع." },
    ],
  }),
});

const KEYS = ["policy.intro", "policy.safe", "policy.review", "policy.rejected", "policy.privacy"];

function ContentPolicyPage() {
  const fn = useServerFn(getSiteCopyBulk);
  const { data } = useQuery({
    queryKey: ["site-copy-bulk", "content-policy"],
    queryFn: () => fn({ data: { keys: KEYS } }),
    staleTime: 60_000,
  });
  const g = (k: string) => data?.[k] ?? { title: "", body_md: "" };

  return (
    <article className="mx-auto max-w-3xl space-y-6 p-6 leading-relaxed">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">سياسة المحتوى</h1>
        <SiteMarkdown source={g("policy.intro").body_md} className="text-muted-foreground space-y-2" />
      </header>

      <section className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
        <h2 className="text-xl font-semibold text-emerald-700 dark:text-emerald-400">
          {g("policy.safe").title || "آمن للنشر تلقائياً"}
        </h2>
        <SiteMarkdown source={g("policy.safe").body_md} className="text-sm space-y-2" />
      </section>

      <section className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
        <h2 className="text-xl font-semibold text-amber-700 dark:text-amber-400">
          {g("policy.review").title || "حرية شخصية للبالغين — يمر بمراجعة إدارية"}
        </h2>
        <SiteMarkdown source={g("policy.review").body_md} className="text-sm space-y-2" />
      </section>

      <section className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4 space-y-2">
        <h2 className="text-xl font-semibold text-rose-700 dark:text-rose-400">
          {g("policy.rejected").title || "مرفوض تلقائياً — لا استثناء"}
        </h2>
        <SiteMarkdown source={g("policy.rejected").body_md} className="text-sm space-y-2" />
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">{g("policy.privacy").title || "خصوصيتك"}</h2>
        <SiteMarkdown source={g("policy.privacy").body_md} className="text-sm space-y-2" />
      </section>
    </article>
  );
}
