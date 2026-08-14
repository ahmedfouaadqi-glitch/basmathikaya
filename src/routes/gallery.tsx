import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { listPublicGallery } from "../lib/gallery.functions";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "معرض القصص — بصمة حكاية" },
      { name: "description", content: "معرض منفصل لقصص الأطفال وقصص الكبار." },
      { property: "og:title", content: "معرض القصص — بصمة حكاية" },
      { property: "og:description", content: "قصص منشورة مصنفة حسب الفئة العمرية." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: GalleryPage,
});

type GalleryCategory = "kids" | "adults";

function GalleryPage() {
  const fn = useServerFn(listPublicGallery);
  const [category, setCategory] = useState<GalleryCategory>("kids");
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const q = useQuery({
    queryKey: ["public-gallery", category, adultConfirmed],
    queryFn: () => fn({ data: { limit: 48, category, adultConfirmed } }),
    staleTime: 60_000,
    enabled: category === "kids" || adultConfirmed,
  });

  function chooseCategory(next: GalleryCategory) {
    if (next === "adults" && !adultConfirmed) {
      const confirmed = window.confirm("هذا المعرض مخصص للبالغين فقط. هل تؤكد أن عمرك 18 سنة أو أكثر؟");
      if (!confirmed) return;
      setAdultConfirmed(true);
    }
    setCategory(next);
  }

  const isKids = category === "kids";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
          <Sparkles className="size-3.5 text-primary" /> معرض القصص
        </div>
        <h1 className="mt-4 text-3xl font-extrabold md:text-4xl">
          {isKids ? "قصص الصغار" : "قصص الكبار"}
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          {isKids
            ? "قصص عائلية مناسبة للأطفال والعائلات."
            : "قصص مخصصة للبالغين فقط؛ الشخصيات والمحتوى يخضعان لتصنيف الإدارة."}
        </p>
        <div className="mt-5 inline-flex rounded-xl border bg-card p-1">
          <button
            type="button"
            onClick={() => chooseCategory("kids")}
            className={`rounded-lg px-4 py-2 text-sm font-bold ${isKids ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            قصص الصغار
          </button>
          <button
            type="button"
            onClick={() => chooseCategory("adults")}
            className={`rounded-lg px-4 py-2 text-sm font-bold ${!isKids ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            قصص الكبار 18+
          </button>
        </div>
      </div>

      {q.isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : q.isError ? (
        <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">
          تعذّر تحميل هذا المعرض حاليًا.
        </div>
      ) : (q.data ?? []).length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">
          لا توجد قصص منشورة في هذا المعرض بعد.
          <div className="mt-4">
            <Link to="/create" className="text-primary underline underline-offset-4">
              أنشئ قصتك الآن ←
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {(q.data ?? []).map((g) => (
            <a
              key={g.id}
              href={g.share_token ? `/s/${g.share_token}` : "#"}
              className="group block overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:shadow-lg"
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-br from-primary/10 to-accent/10">
                {g.cover_signed_url ? (
                  <img
                    src={g.cover_signed_url}
                    alt={g.public_title ?? g.title ?? "قصة"}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                    <Sparkles className="size-8" />
                  </div>
                )}
                {g.featured && (
                  <span className="absolute start-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">
                    مميّزة
                  </span>
                )}
              </div>
              <div className="p-3">
                <div className="line-clamp-1 text-sm font-bold">{g.public_title ?? g.title ?? `قصة #${g.order_number}`}</div>
                {g.show_author && g.public_author_name && (
                  <div className="mt-0.5 truncate text-[11px] text-muted-foreground">بواسطة: {g.public_author_name}</div>
                )}
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  {new Date(g.created_at).toLocaleDateString("ar")}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}

      <div className="mt-12 rounded-2xl border bg-gradient-to-br from-primary/10 to-accent/10 p-6 text-center">
        <h2 className="text-lg font-bold">اصنع حكايتك أنت</h2>
        <p className="mt-1 text-sm text-muted-foreground">اختر نوع القصة من نموذج الإنشاء، ثم دع الإدارة تصنفها في المعرض المناسب.</p>
        <Link
          to="/create"
          className="mt-4 inline-block rounded-xl bg-gradient-to-br from-primary to-accent px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-warm"
        >
          ابدأ الآن
        </Link>
      </div>
    </div>
  );
}
