import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, Download, Hourglass, ImageIcon } from "lucide-react";
import { useT } from "../lib/i18n";
import {
  generateFullStory,
  getStoryProgress,
  confirmTierAndPrepareWhatsapp,
  getOrderPublic,
  getPublicPricing,
} from "../lib/orders.functions";
import { getActiveTheme } from "../lib/themes.functions";
import { getHomeContent } from "../lib/site-content.functions";
import { buildAndDownloadStoryPdf } from "../lib/pdf-client";
import { computeTierAmount, DEFAULT_PRICING } from "../lib/pricing";

export const Route = createFileRoute("/preview/$orderId")({
  head: () => ({ meta: [{ title: "معاينة حكايتك — بصمة حكاية" }] }),
  component: PreviewPage,
});

const WHATSAPP_NUMBER = "9647733570130";

function PreviewPage() {
  const { orderId } = Route.useParams();
  const { t, lang } = useT();
  const generateFn = useServerFn(generateFullStory);
  const progressFn = useServerFn(getStoryProgress);
  const orderFn = useServerFn(getOrderPublic);
  const confirmFn = useServerFn(confirmTierAndPrepareWhatsapp);
  const pricingFn = useServerFn(getPublicPricing);

  const themeFn = useServerFn(getActiveTheme);
  const contentFn = useServerFn(getHomeContent);


  const [confirming, setConfirming] = useState<string | null>(null);
  const [genStarted, setGenStarted] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [textReady, setTextReady] = useState(false);
  const [building, setBuilding] = useState(false);

  const orderQ = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => orderFn({ data: { orderId } }),
  });
  const pricingQ = useQuery({
    queryKey: ["pricing-public"],
    queryFn: () => pricingFn(),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (genStarted) return;
    setGenStarted(true);
    generateFn({ data: { orderId } })
      .then(() => setTextReady(true))
      .catch((e) => setGenError(e instanceof Error ? e.message : "Generation failed"));
  }, [genStarted, generateFn, orderId]);

  const progressQ = useQuery({
    queryKey: ["story-progress", orderId],
    queryFn: () => progressFn({ data: { orderId } }),
    refetchInterval: (q) => {
      const data = q.state.data;
      if (!data) return 2500;
      if (data.ready) return false;
      // Poll faster while text loads, then slow down while waiting for admin payment confirmation
      return data.pages_ready && data.images_status === "idle" ? 8000 : 3000;
    },
  });

  const progress = progressQ.data;
  const order = orderQ.data;
  const pageCount = order?.page_count ?? progress?.page_count ?? 5;
  const pricing = pricingQ.data ?? DEFAULT_PRICING;
  const videoEnabled = Boolean((pricingQ.data as { video_tier_enabled?: boolean } | undefined)?.video_tier_enabled ?? false);
  const charCount = Number((order as { character_count?: number } | null | undefined)?.character_count ?? 1);
  const qualityTier = ((order as { image_quality_tier?: "standard" | "premium" } | null | undefined)?.image_quality_tier ?? "standard") as "standard" | "premium";
  const moodCount = Array.isArray(order?.moods) ? Math.max(1, order!.moods.length) : 1;
  const estimates = useMemo(() => {
    return {
      pdf: computeTierAmount("pdf", pageCount, pricing, charCount, qualityTier, moodCount),
      printed: computeTierAmount("printed", pageCount, pricing, charCount, qualityTier, moodCount),
      video: computeTierAmount("video", pageCount, pricing, charCount, qualityTier, moodCount),
    };
  }, [pageCount, pricing, charCount, qualityTier, moodCount]);

  async function pick(tier: "pdf" | "printed" | "video") {
    setConfirming(tier);
    try {
      const r = await confirmFn({ data: { orderId, tier } });
      const isAr = lang === "ar";
      const tierLabel =
        tier === "pdf"
          ? isAr ? "PDF فوري" : "Instant PDF"
          : tier === "printed"
            ? isAr ? "نسخة مطبوعة" : "Printed copy"
            : isAr ? "فيديو فاخر" : "Premium video";
      const msg = isAr
        ? `مرحباً، أود إكمال طلبي في بصمة حكاية.\nرقم الطلب: #${r.order_number}\nالباقة: ${tierLabel}\nعدد الصفحات: ${r.page_count}\nعدد الشخصيات: ${r.character_count}\nالمبلغ: ${r.amount_iqd} د.ع\nالاسم: ${progress?.customer_name ?? ""}`
        : `Hello, I'd like to complete my order at Basma Hekaya.\nOrder #: ${r.order_number}\nTier: ${tierLabel}\nPages: ${r.page_count}\nCharacters: ${r.character_count}\nAmount: ${r.amount_iqd} IQD\nName: ${progress?.customer_name ?? ""}`;
      const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
      window.open(url, "_blank");
      orderQ.refetch();
      progressQ.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ");
    } finally {
      setConfirming(null);
    }
  }

  async function handleDownload() {
    if (!progress) return;
    setBuilding(true);
    try {
      const [theme, content] = await Promise.all([
        themeFn().catch(() => null),
        contentFn().catch(() => null),
      ]);
      const th = theme as (null | { accent_color?: string | null; frame_style?: string | null; palette?: string[] | null });
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
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ");
    } finally {
      setBuilding(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      {genError ? (
        <div className="rounded-2xl border bg-card p-8 text-center">
          <p className="text-destructive">{genError}</p>
        </div>
      ) : !progress || (!textReady && progress.pages.length === 0) ? (
        <LoadingCard />
      ) : (
        <>
          {/* Status banner */}
          <StatusBanner imagesStatus={progress.images_status} tier={progress.tier} />

          {/* Title + first paragraph */}
          <div className="grid gap-6 md:grid-cols-[260px_1fr] items-start mt-4">
            <CoverArea progress={progress} />
            <div>
              <div className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                <Sparkles className="size-3.5" /> {progress.ready ? t("story_ready") : t("preview_done")}
              </div>
              <h1 className="text-3xl font-extrabold leading-tight">
                {progress.title || (progress.customer_name ? `حكاية ${progress.customer_name}` : "")}
              </h1>
              <p className="mt-2 text-xs text-muted-foreground">{t("preview_blurb_no_images")}</p>
              <div className="mt-4 rounded-xl border bg-card/60 p-4">
                <div className="text-xs font-medium text-muted-foreground mb-1">{t("preview_first_para")}</div>
                <p className="text-base leading-relaxed">{progress.first_paragraph || "…"}</p>
              </div>
            </div>
          </div>

          {/* Pages text */}
          {progress.pages.length > 0 && (
            <div className="mt-10">
              <h2 className="mb-3 text-lg font-bold">{t("story_pages")}</h2>
              <div className="space-y-3">
                {progress.pages.map((p) => (
                  <div key={p.page_number} className="rounded-2xl border bg-card p-4 md:p-5">
                    <div className="flex items-start gap-4">
                      <div className="size-12 shrink-0 rounded-xl bg-primary/10 grid place-items-center font-bold text-primary">
                        {p.page_number}
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-medium text-muted-foreground mb-1">{t("page_n")} {p.page_number}</div>
                        <p className="text-base leading-relaxed whitespace-pre-wrap">{p.text || "…"}</p>
                        {p.image_url && (
                          <img src={p.image_url} alt={`page-${p.page_number}`} className="mt-3 w-full max-w-md rounded-xl border" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PDF download when ready (built in the browser) */}
          {progress.ready && (
            <button
              type="button"
              disabled={building}
              onClick={handleDownload}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-accent py-3.5 font-bold text-primary-foreground shadow-warm disabled:opacity-60"
            >
              {building ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {building ? t("building_pdf") : t("download_pdf")}
            </button>
          )}

          {/* Tier selection (only if not yet picked) */}
          {!progress.tier && (
            <div className="mt-10">
              <h2 className="mb-4 text-xl font-bold">{t("choose_tier")}</h2>
              <div className="grid gap-3 md:grid-cols-3">
                <TierCard price={estimates.pdf} label={t("tier_pdf")} desc={t("tier_pdf_d")} onPick={() => pick("pdf")} loading={confirming === "pdf"} accent />
                <TierCard price={estimates.printed} label={t("tier_printed")} desc={t("tier_printed_d")} onPick={() => pick("printed")} loading={confirming === "printed"} />
                <TierCard
                  price={estimates.video}
                  label={t("tier_video")}
                  desc={t("tier_video_d")}
                  onPick={() => videoEnabled && pick("video")}
                  loading={confirming === "video"}
                  disabled={!videoEnabled}
                />
              </div>
              <p className="mt-4 text-center text-xs text-muted-foreground">{t("whatsapp_msg_open")}</p>
            </div>
          )}
        </>
      )}
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

function LoadingCard() {
  const { t } = useT();
  return (
    <div className="rounded-2xl border bg-card p-12 text-center">
      <Loader2 className="mx-auto size-10 animate-spin text-primary" />
      <p className="mt-4 text-lg font-medium">{t("preview_loading")}</p>
    </div>
  );
}

function TierCard({
  price, label, desc, onPick, loading, accent, muted,
}: { price: number; label: string; desc: string; onPick: () => void; loading: boolean; accent?: boolean; muted?: boolean }) {
  const { t } = useT();
  return (
    <div className={`flex flex-col rounded-2xl border p-5 shadow-sm transition ${accent ? "border-primary bg-primary/5" : "bg-card"} ${muted ? "opacity-70" : ""}`}>
      <div className="text-base font-bold">{label}</div>
      <div className="mt-1 text-2xl font-extrabold text-primary">
        {price.toLocaleString()} <span className="text-sm font-medium text-muted-foreground">{t("iqd")}</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground flex-1">{desc}</p>
      <button
        onClick={onPick}
        disabled={loading}
        className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-accent py-2.5 text-sm font-bold text-primary-foreground shadow-warm disabled:opacity-60"
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        {t("confirm_whatsapp")}
      </button>
    </div>
  );
}
