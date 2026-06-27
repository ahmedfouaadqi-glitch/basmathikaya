import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, Download } from "lucide-react";
import { useT } from "../lib/i18n";
import {
  generateFullStory,
  getStoryProgress,
  confirmTierAndPrepareWhatsapp,
  getOrderPublic,
  getPublicPricing,
} from "../lib/orders.functions";
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

  const [confirming, setConfirming] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [genStarted, setGenStarted] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const orderQ = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => orderFn({ data: { orderId } }),
  });
  const pricingQ = useQuery({ queryKey: ["pricing-public"], queryFn: () => pricingFn(), staleTime: 60_000 });

  // Kick off generation once
  useEffect(() => {
    if (genStarted) return;
    setGenStarted(true);
    generateFn({ data: { orderId } }).catch((e) => {
      setGenError(e instanceof Error ? e.message : "Generation failed");
    });
  }, [genStarted, generateFn, orderId]);

  const progressQ = useQuery({
    queryKey: ["story-progress", orderId],
    queryFn: () => progressFn({ data: { orderId } }),
    refetchInterval: (q) => (q.state.data?.ready ? false : 3000),
  });

  const progress = progressQ.data;
  const order = orderQ.data;
  const pageCount = order?.page_count ?? progress?.page_count ?? 5;
  const pricing = pricingQ.data ?? DEFAULT_PRICING;
  const estimates = useMemo(() => ({
    pdf: computeTierAmount("pdf", pageCount, pricing),
    printed: computeTierAmount("printed", pageCount, pricing),
    video: computeTierAmount("video", pageCount, pricing),
  }), [pageCount, pricing]);

  async function pick(tier: "pdf" | "printed" | "video") {
    setConfirming(tier);
    try {
      const r = await confirmFn({ data: { orderId, tier } });
      if (r.pdf_url) setPdfUrl(r.pdf_url);
      const isAr = lang === "ar";
      const tierLabel =
        tier === "pdf"
          ? isAr ? "PDF فوري" : "Instant PDF"
          : tier === "printed"
            ? isAr ? "نسخة مطبوعة" : "Printed copy"
            : isAr ? "فيديو فاخر" : "Premium video";
      const ch = order?.characters as { customer_name?: string } | null | undefined;
      const pdfLine = r.pdf_url
        ? (isAr ? `\nرابط القصة PDF: ${r.pdf_url}` : `\nStory PDF: ${r.pdf_url}`)
        : "";
      const msg = isAr
        ? `مرحباً، أود إكمال طلبي في بصمة حكاية.\nرقم الطلب: #${r.order_number}\nالباقة: ${tierLabel}\nعدد الصفحات: ${r.page_count}\nالمبلغ: ${r.amount_iqd} د.ع\nالاسم: ${ch?.customer_name ?? ""}${pdfLine}`
        : `Hello, I'd like to complete my order at Basma Hekaya.\nOrder #: ${r.order_number}\nTier: ${tierLabel}\nPages: ${r.page_count}\nAmount: ${r.amount_iqd} IQD\nName: ${ch?.customer_name ?? ""}${pdfLine}`;
      const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
      window.open(url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ");
    } finally {
      setConfirming(null);
    }
  }

  const ch = order?.characters as { customer_name?: string } | null | undefined;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      {genError ? (
        <div className="rounded-2xl border bg-card p-8 text-center">
          <p className="text-destructive">{genError}</p>
        </div>
      ) : !progress ? (
        <LoadingCard />
      ) : (
        <>
          {/* Cover + first paragraph */}
          <div className="grid gap-6 md:grid-cols-[260px_1fr] items-start">
            <div className="watermark-overlay aspect-[3/4] overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/20 via-background to-accent/30 shadow-xl">
              {progress.cover_url ? (
                <img src={progress.cover_url} alt="cover" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                  <Loader2 className="size-5 animate-spin mr-2" />
                  {t("generating_cover")}
                </div>
              )}
            </div>
            <div>
              <div className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                <Sparkles className="size-3.5" /> {progress.ready ? t("preview_done") : t("story_progress")}
              </div>
              <h1 className="text-3xl font-extrabold leading-tight">
                {progress.title || (ch?.customer_name ? `حكاية ${ch.customer_name}` : "")}
              </h1>
              <p className="mt-2 text-xs text-muted-foreground">{t("preview_blurb")}</p>
              <div className="mt-4 rounded-xl border bg-card/60 p-4">
                <div className="text-xs font-medium text-muted-foreground mb-1">{t("preview_first_para")}</div>
                <p className="text-base leading-relaxed">{progress.first_paragraph || "…"}</p>
              </div>
              {!progress.ready && (
                <div className="mt-3 text-xs text-muted-foreground">
                  {progress.ready_images} / {progress.total_images} {t("pages_ready")}
                </div>
              )}
            </div>
          </div>

          {/* Pages preview grid */}
          {progress.pages.length > 0 && (
            <div className="mt-10">
              <h2 className="mb-3 text-lg font-bold">{t("story_pages")}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {progress.pages.map((p) => (
                  <div key={p.page_number} className="watermark-overlay aspect-square overflow-hidden rounded-xl border bg-secondary/30">
                    {p.image_url ? (
                      <img src={p.image_url} alt={`page-${p.page_number}`} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <Loader2 className="size-5 animate-spin" />
                      </div>
                    )}
                    <div className="px-2 py-1 text-[10px] text-muted-foreground text-center">{t("page_n")} {p.page_number}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tiers */}
          <div className="mt-10">
            <h2 className="mb-4 text-xl font-bold">{t("choose_tier")}</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <TierCard price={estimates.pdf} label={t("tier_pdf")} desc={t("tier_pdf_d")} onPick={() => pick("pdf")} loading={confirming === "pdf"} accent />
              <TierCard price={estimates.printed} label={t("tier_printed")} desc={t("tier_printed_d")} onPick={() => pick("printed")} loading={confirming === "printed"} />
              <TierCard price={estimates.video} label={t("tier_video")} desc={t("tier_video_d")} onPick={() => pick("video")} loading={confirming === "video"} muted />
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground">{t("whatsapp_msg_open")}</p>

            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-primary py-3 font-bold text-primary hover:bg-primary/5"
              >
                <Download className="size-4" /> {t("download_pdf")}
              </a>
            )}
          </div>
        </>
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
