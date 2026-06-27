import { createFileRoute, Link } from "@tanstack/react-router";
import { useT } from "../lib/i18n";
import { Sparkles, BookOpen, Truck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "بصمة حكاية — حكايتك أنت، لا تشبه أحداً" },
      { name: "description", content: "ارفع صورتك، اختر جوّك، واحصل على حكاية فريدة بملامحك. PDF فوري أو نسخة مطبوعة." },
      { property: "og:title", content: "بصمة حكاية" },
      { property: "og:description", content: "حكاية مرسومة بملامحك أنت. فريدة كبصمتك." },
    ],
  }),
  component: Home,
});

function Home() {
  const { t } = useT();
  return (
    <div className="mx-auto max-w-6xl px-4 pb-24">
      {/* Hero */}
      <section className="pt-12 md:pt-20 text-center">
        <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
          <Sparkles className="size-3.5 text-primary" />
          {t("tagline")}
        </div>
        <h1 className="mt-5 text-4xl md:text-6xl font-extrabold leading-tight text-balance">
          <span className="bg-gradient-to-br from-foreground via-accent to-primary bg-clip-text text-transparent">
            {t("brand")}
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base md:text-lg text-muted-foreground text-balance">
          {t("hero_lead")}
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            to="/create"
            className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-br from-primary to-accent px-6 py-3.5 text-base font-bold text-primary-foreground shadow-warm transition hover:scale-[1.02] active:scale-[0.99]"
          >
            {t("cta_start")}
            <Sparkles className="size-4 transition group-hover:rotate-12" />
          </Link>
        </div>
      </section>

      {/* Showcase mock */}
      <section className="mt-16 md:mt-24">
        <div className="relative mx-auto max-w-2xl">
          <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-primary/20 via-transparent to-accent/20 blur-2xl" />
          <div className="relative aspect-[3/4] max-w-sm mx-auto rounded-2xl bg-gradient-to-br from-amber-100 via-orange-200 to-purple-200 p-1 shadow-2xl">
            <div className="watermark-overlay flex h-full w-full flex-col items-center justify-end rounded-xl bg-gradient-to-b from-transparent via-black/10 to-black/60 p-6 text-center text-white">
              <div className="text-3xl font-extrabold drop-shadow-lg">حكاية البطل</div>
              <div className="mt-1 text-sm opacity-80">قصة فريدة — معاينة</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mt-16 grid gap-4 md:grid-cols-3">
        {[
          { icon: Sparkles, t: t("feat_1_t"), d: t("feat_1_d") },
          { icon: BookOpen, t: t("feat_2_t"), d: t("feat_2_d") },
          { icon: Truck, t: t("feat_3_t"), d: t("feat_3_d") },
        ].map((f) => (
          <div key={f.t} className="rounded-2xl border bg-card p-6 shadow-sm">
            <f.icon className="size-7 text-primary" />
            <h3 className="mt-4 text-lg font-bold">{f.t}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{f.d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
