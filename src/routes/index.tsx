import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useT } from "../lib/i18n";
import { Sparkles, BookOpen, Truck } from "lucide-react";
import { brandLogoUrl } from "../lib/brand";
import { BrandIntroVideo } from "../components/BrandIntroVideo";
import { getHomeContent, DEFAULT_HOME_CONTENT } from "../lib/site-content.functions";

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

function pick<T extends string>(ar: T, en: T, lang: "ar" | "en"): T {
  return lang === "ar" ? ar : en;
}

function Home() {
  const { t, lang } = useT();
  const homeFn = useServerFn(getHomeContent);
  const q = useQuery({ queryKey: ["site-home"], queryFn: () => homeFn(), staleTime: 60_000 });
  const c = q.data ?? DEFAULT_HOME_CONTENT;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24">
      {/* Hero */}
      <section className="pt-12 md:pt-20 text-center">
        <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
          <Sparkles className="size-3.5 text-primary" />
          {pick(c.tagline_ar, c.tagline_en, lang)}
        </div>
        <h1 className="mt-5 text-4xl md:text-6xl font-extrabold leading-tight text-balance">
          <span className="bg-gradient-to-br from-foreground via-accent to-primary bg-clip-text text-transparent">
            {t("brand")}
          </span>
        </h1>
        <div className="relative mx-auto mt-6 inline-block">
          <div className="absolute inset-0 -z-10 rounded-full bg-gradient-to-br from-primary/30 via-accent/20 to-primary/30 blur-3xl animate-water-ripple" aria-hidden="true" />
          <img
            src={brandLogoUrl}
            alt="شعار بصمة حكاية"
            className="mx-auto h-64 w-64 object-contain drop-shadow-2xl animate-logo-float md:h-80 md:w-80"
          />
        </div>
        <p className="mx-auto mt-5 max-w-xl text-base md:text-lg text-muted-foreground text-balance">
          {pick(c.hero_lead_ar, c.hero_lead_en, lang)}
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            to="/create"
            className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-br from-primary to-accent px-6 py-3.5 text-base font-bold text-primary-foreground shadow-warm transition hover:scale-[1.02] active:scale-[0.99]"
          >
            {pick(c.cta_start_ar, c.cta_start_en, lang)}
            <Sparkles className="size-4 transition group-hover:rotate-12" />
          </Link>
        </div>
      </section>

      {/* Brand intro videos — sequential loop */}
      <section className="mt-16 md:mt-24">
        <div className="relative mx-auto max-w-2xl">
          <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-primary/20 via-transparent to-accent/25 blur-2xl" />
          <div className="relative aspect-[3/4] max-w-sm mx-auto rounded-2xl bg-gradient-to-br from-primary/25 via-background to-accent/30 p-1 shadow-2xl overflow-hidden">
            <BrandIntroVideo className="h-full w-full rounded-xl object-cover bg-background" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mt-16 grid gap-4 md:grid-cols-3">
        {[
          { icon: Sparkles, t: pick(c.feat_1_t_ar, c.feat_1_t_en, lang), d: pick(c.feat_1_d_ar, c.feat_1_d_en, lang) },
          { icon: BookOpen, t: pick(c.feat_2_t_ar, c.feat_2_t_en, lang), d: pick(c.feat_2_d_ar, c.feat_2_d_en, lang) },
          { icon: Truck, t: pick(c.feat_3_t_ar, c.feat_3_t_en, lang), d: pick(c.feat_3_d_ar, c.feat_3_d_en, lang) },
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
