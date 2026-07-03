import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, Download, Hourglass, ImageIcon, Ban, Clock } from "lucide-react";
import { useT } from "../lib/i18n";
import { getStoryProgress, getOrderPublic, getPublicPricing } from "../lib/orders.functions";
import { getActiveTheme } from "../lib/themes.functions";
import { getHomeContent } from "../lib/site-content.functions";
import { buildAndDownloadStoryPdf } from "../lib/pdf-client";

export const Route = createFileRoute("/preview/$orderId")({
  head: () => ({ meta: [{ title: "معاينة حكايتك — بصمة حكاية" }] }),
  component: PreviewPage,
});

function PreviewPage() {
  const { orderId } = Route.useParams();
  const { t, lang } = useT();
  const progressFn = useServerFn(getStoryProgress);
  const orderFn = useServerFn(getOrderPublic);
  const pricingFn = useServerFn(getPublicPricing);
  const themeFn = useServerFn(getActiveTheme);
  const contentFn = useServerFn(getHomeContent);

  const [building, setBuilding] = useState(false);

  const orderQ = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => orderFn({ data: { orderId } }),
  });
  useQuery({
    queryKey: ["pricing-public"],
    queryFn: () => pricingFn(),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const progressQ = useQuery({
    queryKey: ["story-progress", orderId],
    queryFn: () => progressFn({ data: { orderId } }),
    refetchInterval: (q) => {
      const data = q.state.data;
      if (!data) return 4000;
      if (data.ready) return false;
      return data.images_status === "generating" ? 3000 : 8000;
    },
  });

  const progress = progressQ.data;
  const order = orderQ.data;

  const orderStatus = (order?.status ?? progress?.order_status ?? "") as string;
  const rejectionReason =
    (order as { rejection_reason?: string | null } | null | undefined)?.rejection_reason ??
    progress?.rejection_reason ??
    null;
  const isBlocked = orderStatus === "cancelled" || orderStatus === "rejected";

  async function handleDownload() {
    if (!progress) return;
    setBuilding(true);
    try {
      const [theme, content] = await Promise.all([
        themeFn().catch(() => null),
        contentFn().catch(() => null),
      ]);
      const th = theme as null | { accent_color?: string | null; frame_style?: string | null; palette?: string[] | null };
      await buildAndDownloadStoryPdf({
        title: progress.title || (lang === "ar" ? "حكايتي" : "My Story"),
        language: lang,
        customerName: progress.customer_name || "",
        moods: progress.moods ?? [],
        coverUrl: progress.cover_url,
        pages: progress.pages.map((pg) => ({ number: pg.page_number, text: pg.text, imageUrl: pg.image_url })),
        accentColor: th?.accent_color ?? null,
        orderNumber: progress.order_number ?? order?.order_number ?? null,
        disclaimer: content ? (lang === "ar" ? content.disclaimer_ar : content.disclaimer_en) : null,
        frameStyle: (th?.frame_style as never) ?? null,
        palette: th?.palette ?? null,
        orientation: progress.pdf_orientation ?? "portrait",
        reflectiveQuestion: progress.reflective_question ?? null,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ");
    } finally {
      setBuilding(false);
    }
  }

  if (isBlocked) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-8 text-center">
          <Ban className="mx-auto mb-3 size-10 text-destructive" />
          <h2 className="text-lg font-bold text-destructive mb-1">
            {orderStatus === "rejected" ? "تم رفض الطلب" : "الطلب ملغى"}
          </h2>
          <p className="text-sm text-muted-foreground">{rejectionReason ?? "لا توجد تفاصيل إضافية."}</p>
        </div>
      </div>
    );
  }

  const imagesStatus = progress?.images_status ?? "idle";
  const notStartedYet = !progress || (imagesStatus === "idle" && progress.pages.length === 0);

  if (notStartedYet) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="rounded-2xl border bg-card p-8 text-center">
          <Clock className="mx-auto mb-3 size-10 text-accent" />
          <h2 className="text-lg font-bold mb-1">بانتظار تأكيد الدفع</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            سيبدأ إعداد حكايتك تلقائياً فور تأكيد الإدارة استلام الدفع عبر واتساب.
            ستصلك رسالة داخل «طلباتي» عند البدء.
          </p>
          {order?.order_number ? (
            <div className="mt-4 font-mono text-sm text-muted-foreground">#{order.order_number}</div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <StatusBanner imagesStatus={imagesStatus} tier={progress!.tier} />

      <div className="grid gap-6 md:grid-cols-[260px_1fr] items-start mt-4">
        <CoverArea progress={progress!} />
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" /> {progress!.ready ? t("story_ready") : t("preview_done")}
          </div>
          <h1 className="text-3xl font-extrabold leading-tight">
            {progress!.title || (progress!.customer_name ? `حكاية ${progress!.customer_name}` : "")}
          </h1>
          <p className="mt-2 text-xs text-muted-foreground">{t("preview_blurb_no_images")}</p>
          <div className="mt-4 rounded-xl border bg-card/60 p-4">
            <div className="text-xs font-medium text-muted-foreground mb-1">{t("preview_first_para")}</div>
            <p className="text-base leading-relaxed">{progress!.first_paragraph || "…"}</p>
          </div>
        </div>
      </div>

      {progress!.pages.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-3 text-lg font-bold">{t("story_pages")}</h2>
          <div className="space-y-3">
            {progress!.pages.map((p) => (
              <div key={p.page_number} className="rounded-2xl border bg-card p-4 md:p-5">
                <div className="flex items-start gap-4">
                  <div className="size-12 shrink-0 rounded-xl bg-primary/10 grid place-items-center font-bold text-primary">
                    {p.page_number}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-medium text-muted-foreground mb-1">
                      {t("page_n")} {p.page_number}
                    </div>
                    <p className="text-base leading-relaxed whitespace-pre-wrap">{p.text || "…"}</p>
                    {p.image_url && (
                      <img
                        src={p.image_url}
                        alt={`page-${p.page_number}`}
                        className="mt-3 w-full max-w-md rounded-xl border"
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {progress!.ready &&
        (() => {
          const p = progress! as typeof progress & {
            order_status?: string;
            redownload_status?: string | null;
            redownload_amount_iqd?: number | null;
          };
          const canDownload = p!.order_status === "delivered" || p!.redownload_status === "paid";
          if (canDownload) {
            return (
              <button
                type="button"
                disabled={building}
                onClick={handleDownload}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-accent py-3.5 font-bold text-primary-foreground shadow-warm disabled:opacity-60"
              >
                {building ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                {building ? t("building_pdf") : t("download_pdf")}
              </button>
            );
          }
          if (p!.redownload_status === "pending") {
            return (
              <div className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-center text-sm text-amber-700 dark:text-amber-400">
                {t("redownload_awaiting_admin")}
                {p!.redownload_amount_iqd ? (
                  <span className="ms-1 font-mono">
                    · {Number(p!.redownload_amount_iqd).toLocaleString()} {t("iqd")}
                  </span>
                ) : null}
              </div>
            );
          }
          return null;
        })()}
    </div>
  );
}

function StatusBanner({ imagesStatus, tier }: { imagesStatus: string; tier: string | null }) {
  const { t } = useT();
  if (!tier) return null;
  if (imagesStatus === "idle") {
    return (
      <div className="rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm flex items-center gap-2">
        <Hourglass className="size-4 text-accent" /> {t("awaiting_payment")}
      </div>
    );
  }
  if (imagesStatus === "generating") {
    return (
      <div className="rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm flex items-center gap-2">
        <Loader2 className="size-4 animate-spin text-primary" /> {t("images_generating")}
      </div>
    );
  }
  if (imagesStatus === "ready") {
    return (
      <div className="rounded-xl border border-primary bg-primary/15 p-3 text-sm flex items-center gap-2 font-medium text-primary">
        <Sparkles className="size-4" /> {t("story_ready")}
      </div>
    );
  }
  return null;
}

function CoverArea({ progress }: { progress: { cover_url: string | null; images_status: string } }) {
  const { t } = useT();
  return (
    <div className="watermark-overlay aspect-[3/4] overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/20 via-background to-accent/30 shadow-xl">
      {progress.cover_url ? (
        <img src={progress.cover_url} alt="cover" className="h-full w-full object-cover" />
      ) : progress.images_status === "generating" ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="size-5 animate-spin" />
          {t("generating_cover")}
        </div>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground text-xs text-center px-4">
          <ImageIcon className="size-7 opacity-50" />
          <span>{t("awaiting_payment")}</span>
        </div>
      )}
    </div>
  );
}
