import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listTestimonials } from "../lib/marketing.functions";
import { Star } from "lucide-react";

export const Route = createFileRoute("/testimonials")({
  head: () => ({
    meta: [
      { title: "آراء العائلات — بصمة حكاية" },
      { name: "description", content: "شهادات حقيقية من عائلات أنشأت قصصاً لأطفالها عبر بصمة حكاية." },
    ],
  }),
  component: TestimonialsPage,
});

function TestimonialsPage() {
  const fn = useServerFn(listTestimonials);
  const q = useQuery({ queryKey: ["testimonials"], queryFn: () => fn(), staleTime: 60_000 });

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-extrabold">آراء عائلاتنا</h1>
        <p className="mt-2 text-muted-foreground">شهادات صادقة من آباء وأمهات جرّبوا التجربة.</p>
      </div>

      {q.isLoading ? (
        <div className="mt-10 text-center text-muted-foreground">…</div>
      ) : (q.data ?? []).length === 0 ? (
        <div className="mt-10 rounded-2xl border bg-card p-10 text-center text-muted-foreground">
          سيتم إضافة الشهادات قريباً.
        </div>
      ) : (
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {(q.data ?? []).map((t) => (
            <div key={t.id} className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-3">
                {t.avatar_url ? (
                  <img src={t.avatar_url} alt={t.author_name} className="size-10 rounded-full object-cover" />
                ) : (
                  <div className="size-10 rounded-full bg-gradient-to-br from-primary/40 to-accent/40 flex items-center justify-center font-bold text-primary-foreground">
                    {t.author_name.slice(0, 1)}
                  </div>
                )}
                <div>
                  <div className="text-sm font-bold">{t.author_name}</div>
                  {t.author_city && (
                    <div className="text-[11px] text-muted-foreground">{t.author_city}</div>
                  )}
                </div>
              </div>
              <div className="mt-2 flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`size-3.5 ${i < t.rating ? "fill-primary text-primary" : "text-muted-foreground/30"}`}
                  />
                ))}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-foreground/90">{t.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
