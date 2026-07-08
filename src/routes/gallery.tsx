import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listPublicGallery } from "../lib/gallery.functions";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "معرض القصص — بصمة حكاية" },
      { name: "description", content: "استعرض قصصاً حقيقية أنشأها آباء عبر بصمة حكاية — لكل طفل حكايته." },
      { property: "og:title", content: "معرض القصص — بصمة حكاية" },
      { property: "og:description", content: "قصص فريدة برسوم بملامح أطفال حقيقيين." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: GalleryPage,
});

function GalleryPage() {
  const fn = useServerFn(listPublicGallery);
  const q = useQuery({
    queryKey: ["public-gallery"],
    queryFn: () => fn({ data: { limit: 48 } }),
    staleTime: 60_000,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
          <Sparkles className="size-3.5 text-primary" /> معرض عام
        </div>
        <h1 className="mt-4 text-3xl md:text-4xl font-extrabold">قصص من عائلاتنا</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-xl mx-auto">
          كل بطاقة هنا قصة كاملة بملامح طفل حقيقي — شارك المؤلفون قصصهم لتلهم الآخرين.
        </p>
      </div>

      {q.isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : (q.data ?? []).length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">
          لا توجد قصص عامة بعد.
          <div className="mt-4">
            <Link to="/create" className="text-primary underline underline-offset-4">
              كُن أول من ينشر →
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {(q.data ?? []).map((g) => (
            <a
              key={g.id}
              href={g.share_token ? `/s/${g.share_token}` : "#"}
              className="group block overflow-hidden rounded-2xl border bg-card shadow-sm hover:shadow-lg transition"
            >
              <div className="relative aspect-[3/4] bg-gradient-to-br from-primary/10 to-accent/10 overflow-hidden">
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
                  <span className="absolute top-2 start-2 rounded-full bg-primary text-primary-foreground text-[10px] px-2 py-0.5">
                    مميّزة
                  </span>
                )}
              </div>
              <div className="p-3">
                <div className="text-sm font-bold line-clamp-1">
                  {g.public_title ?? g.title ?? `قصة #${g.order_number}`}
                </div>
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
        <p className="mt-1 text-sm text-muted-foreground">ارفع صورة طفلك واحصل على قصة فريدة خلال دقائق.</p>
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
