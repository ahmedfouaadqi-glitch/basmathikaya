import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { useT } from "../lib/i18n";
import { generatePreview, confirmTierAndPrepareWhatsapp, getOrderPublic } from "../lib/orders.functions";

export const Route = createFileRoute("/preview/$orderId")({
  head: () => ({ meta: [{ title: "معاينة حكايتك — بصمة حكاية" }] }),
  component: PreviewPage,
});

const WHATSAPP_NUMBER = "9647733570130";

function PreviewPage() {
  const { orderId } = Route.useParams();
  const { t, lang } = useT();
  const previewFn = useServerFn(generatePreview);
  const orderFn = useServerFn(getOrderPublic);
  const confirmFn = useServerFn(confirmTierAndPrepareWhatsapp);

  const [confirming, setConfirming] = useState<string | null>(null);

  const orderQ = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => orderFn({ data: { orderId } }),
  });

  const previewQ = useQuery({
    queryKey: ["preview", orderId],
    queryFn: () => previewFn({ data: { orderId } }),
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  const order = orderQ.data;
  const ch = order?.characters as { customer_name?: string } | null | undefined;

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
        ? `مرحباً، أود إكمال طلبي في بصمة حكاية.\nرقم الطلب: #${r.order_number}\nالباقة: ${tierLabel}\nالمبلغ: ${r.amount_iqd} د.ع\nالاسم: ${ch?.customer_name ?? ""}`
        : `Hello, I'd like to complete my order at Basma Hekaya.\nOrder #: ${r.order_number}\nTier: ${tierLabel}\nAmount: ${r.amount_iqd} IQD\nName: ${ch?.customer_name ?? ""}`;
      const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ");
      setConfirming(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {previewQ.isLoading ? (
        <LoadingCard />
      ) : previewQ.isError ? (
        <div className="rounded-2xl border bg-card p-8 text-center">
          <p className="text-destructive">{t("cover_failed")}</p>
          <button onClick={() => previewQ.refetch()} className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground">
            إعادة المحاولة
          </button>
        </div>
      ) : (
        <>
          {/* Cover + first paragraph */}
          <div className="grid gap-6 md:grid-cols-[260px_1fr] items-start">
            <div className="watermark-overlay aspect-[3/4] overflow-hidden rounded-2xl border bg-gradient-to-br from-amber-100 to-purple-200 shadow-xl">
              {previewQ.data?.cover_url ? (
                <img src={previewQ.data.cover_url} alt="cover" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground text-sm">{t("generating_cover")}</div>
              )}
            </div>
            <div>
              <div className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                <Sparkles className="size-3.5" /> {t("preview_done")}
              </div>
              <h1 className="text-3xl font-extrabold leading-tight">
                {ch?.customer_name ? `حكاية ${ch.customer_name}` : ""}
              </h1>
              <div className="mt-4 rounded-xl border bg-card/60 p-4">
                <div className="text-xs font-medium text-muted-foreground mb-1">{t("preview_first_para")}</div>
                <p className="text-base leading-relaxed">{previewQ.data?.first_paragraph}</p>
              </div>
            </div>
          </div>

          {/* Tiers */}
          <div className="mt-10">
            <h2 className="mb-4 text-xl font-bold">{t("choose_tier")}</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <TierCard tier="pdf" price={3000} label={t("tier_pdf")} desc={t("tier_pdf_d")} onPick={() => pick("pdf")} loading={confirming === "pdf"} accent />
              <TierCard tier="printed" price={10000} label={t("tier_printed")} desc={t("tier_printed_d")} onPick={() => pick("printed")} loading={confirming === "printed"} />
              <TierCard tier="video" price={25000} label={t("tier_video")} desc={t("tier_video_d")} onPick={() => pick("video")} loading={confirming === "video"} muted />
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground">{t("whatsapp_msg_open")}</p>
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
}: { tier: string; price: number; label: string; desc: string; onPick: () => void; loading: boolean; accent?: boolean; muted?: boolean }) {
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
