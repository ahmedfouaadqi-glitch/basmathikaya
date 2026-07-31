import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Download, RefreshCw, Loader2, Sparkles, Truck, X, Trash2, RotateCcw } from "lucide-react";
import { adminGetOrder, adminRegeneratePage, adminConfirmPaymentAndGenerate, adminUpdateStatus, getStoryProgress, adminRejectOrder, adminDeleteOrder, adminConfirmRedownload, adminRetryImageGeneration, adminRegenerateCover } from "../lib/orders.functions";
import { adminUpdatePageText, adminUploadPageImage, adminUpdatePagePrompt } from "../lib/admin-ops.functions";
import { getActiveTheme } from "../lib/themes.functions";
import { getHomeContent } from "../lib/site-content.functions";
import { buildAndDownloadStoryPdf, type StoryPdfAssets } from "../lib/pdf-client";
type StoryFrameStyle = NonNullable<StoryPdfAssets["frameStyle"]>;
import { useT } from "../lib/i18n";
import { supabase } from "../integrations/supabase/client";

export const Route = createFileRoute("/admin/orders/$id")({
  component: OrderDetail,
});

function OrderDetail() {
  const { id } = Route.useParams();
  const { t, lang } = useT();
  const qc = useQueryClient();
  const fn = useServerFn(adminGetOrder);
  const regenFn = useServerFn(adminRegeneratePage);
  const progressFn = useServerFn(getStoryProgress);
  const themeFn = useServerFn(getActiveTheme);
  const contentFn = useServerFn(getHomeContent);
  const confirmGenFn = useServerFn(adminConfirmPaymentAndGenerate);
  const updateStatusFn = useServerFn(adminUpdateStatus);
  const rejectFn = useServerFn(adminRejectOrder);
  const deleteFn = useServerFn(adminDeleteOrder);
  const redownloadFn = useServerFn(adminConfirmRedownload);
  const retryImagesFn = useServerFn(adminRetryImageGeneration);
  const regenCoverFn = useServerFn(adminRegenerateCover);
  const [regening, setRegening] = useState<number | null>(null);
  const [retryingImages, setRetryingImages] = useState(false);
  const [regeningCover, setRegeningCover] = useState(false);

  const [buildingPdf, setBuildingPdf] = useState(false);
  const [confirmingPay, setConfirmingPay] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const q = useQuery({
    queryKey: ["admin-order", id],
    queryFn: () => fn({ data: { orderId: id } }),
    refetchInterval: 5000,
  });

  useEffect(() => {
    const ch = supabase
      .channel(`admin-order-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "generation_events", filter: `order_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["admin-order", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["admin-order", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "story_pages", filter: `order_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["admin-order", id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  if (q.isLoading) return <div className="py-10 text-center text-muted-foreground">…</div>;
  if (!q.data?.order) return <div className="py-10 text-center text-muted-foreground">غير موجود</div>;

  const order = q.data.order as {
    order_number: number; tier: string | null; amount_iqd: number; status: string; page_count?: number;
    customer_phone: string; title?: string | null; moods?: string[]; custom_instructions?: string | null;
    images_status?: string; images_error?: string | null;
    rejection_reason?: string | null;
    redownload_status?: string | null; redownload_amount_iqd?: number | null;
  };
  const user = q.data.user as { full_name?: string; phone?: string } | null;
  const chars = q.data.characters ?? [];
  const cost = q.data.cost as {
    cost_iqd?: number; cost_usd?: number; cost_credits?: number; gross_profit_iqd?: number;
    margin_pct?: number;
  } | null;
  const events = q.data.events ?? [];
  const pages = q.data.pages ?? [];

  async function downloadPdf() {
    setBuildingPdf(true);
    try {
      const [p, theme, content] = await Promise.all([
        progressFn({ data: { orderId: id } }),
        themeFn().catch(() => null),
        contentFn().catch(() => null),
      ]);
      if (!p.ready) {
        toast.error(lang === "ar" ? "القصة غير جاهزة بعد" : "Story not ready yet");
        return;
      }
      const th = theme as (null | { accent_color?: string | null; frame_style?: string | null; palette?: string[] | null });
      await buildAndDownloadStoryPdf({
        title: p.title || (lang === "ar" ? "حكايتي" : "My Story"),
        language: lang,
        customerName: p.customer_name || user?.full_name || "",
        heroName: (p as { hero_name?: string | null }).hero_name ?? (q.data?.characters?.find((c) => c.is_primary)?.name ?? null),
        authorName: (p as { author_name?: string | null }).author_name ?? user?.full_name ?? null,
        moods: p.moods ?? [],
        coverUrl: p.cover_url,
        pages: p.pages.map((pg) => ({ number: pg.page_number, text: pg.text, imageUrl: pg.image_url })),
        accentColor: th?.accent_color ?? null,
        orderNumber: p.order_number ?? order.order_number,
        disclaimer: content ? (lang === "ar" ? content.disclaimer_ar : content.disclaimer_en) : null,
        frameStyle: (th?.frame_style as StoryFrameStyle) ?? null,
        palette: th?.palette ?? null,
        orientation: (p as { pdf_orientation?: "portrait" | "landscape" }).pdf_orientation ?? "portrait",
        reflectiveQuestion: (p as { reflective_question?: string | null }).reflective_question ?? null,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ");
    } finally {
      setBuildingPdf(false);
    }
  }

  async function regen(n: number) {
    setRegening(n);
    try {
      await regenFn({ data: { orderId: id, pageNumber: n } });
      toast.success("تم");
      qc.invalidateQueries({ queryKey: ["admin-order", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ");
    } finally {
      setRegening(null);
    }
  }

  async function confirmPayment() {
    setConfirmingPay(true);
    try {
      await confirmGenFn({ data: { orderId: id } });
      toast.success("تم تأكيد الدفع وبدأ توليد الصور");
      qc.invalidateQueries({ queryKey: ["admin-order", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ");
    } finally {
      setConfirmingPay(false);
    }
  }

  async function markDelivered() {
    try {
      await updateStatusFn({ data: { orderId: id, status: "delivered" } });
      toast.success("تم");
      qc.invalidateQueries({ queryKey: ["admin-order", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ");
    }
  }

  async function retryImages() {
    setRetryingImages(true);
    try {
      await retryImagesFn({ data: { orderId: id } });
      toast.success("بدأت إعادة توليد الصور");
      qc.invalidateQueries({ queryKey: ["admin-order", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ");
    } finally {
      setRetryingImages(false);
    }
  }

  async function regenCover() {
    setRegeningCover(true);
    try {
      await regenCoverFn({ data: { orderId: id } });
      toast.success("بدأت إعادة توليد الغلاف");
      qc.invalidateQueries({ queryKey: ["admin-order", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ");
    } finally {
      setRegeningCover(false);
    }
  }


  const imagesReady = order.images_status === "ready";

  return (
    <div>
      <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
        <ArrowRight className="size-4 rotate-180 rtl:rotate-0" /> {t("admin_orders")}
      </Link>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-4 lg:col-span-1">
          <div className="rounded-2xl border bg-card p-5">
            <div className="text-xs text-muted-foreground">{t("col_order")}</div>
            <div className="font-mono text-lg font-bold">#{order.order_number}</div>
            {order.title && <div className="mt-2 text-sm font-bold">{order.title}</div>}
            <div className="mt-3 text-sm">{user?.full_name ?? "—"}</div>
            <div className="mt-0.5 text-xs text-muted-foreground" dir="ltr">{user?.phone ?? order.customer_phone}</div>
            <div className="mt-3 text-sm">{order.tier ?? "—"} · {order.amount_iqd?.toLocaleString()} {t("iqd")} · {order.page_count ?? 5} {t("pages_label")}</div>
            {order.moods && order.moods.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {order.moods.map((m) => (
                  <span key={m} className="rounded-full bg-primary/10 text-primary text-[10px] px-2 py-0.5">{m}</span>
                ))}
              </div>
            )}
            {order.custom_instructions && (
              <div className="mt-3 rounded-lg border bg-secondary/30 p-2 text-xs">
                <div className="text-muted-foreground mb-0.5">تعليمات العميل</div>
                <p className="whitespace-pre-wrap">{order.custom_instructions}</p>
              </div>
            )}

            {/* Action buttons by state */}
            {order.status === "pending" && order.tier && (
              <button
                onClick={confirmPayment}
                disabled={confirmingPay}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-accent py-3 text-sm font-bold text-primary-foreground shadow-warm disabled:opacity-60"
              >
                {confirmingPay ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {t("mark_paid_generate")}
              </button>
            )}
            {order.images_status === "generating" && (
              <div className="mt-4 inline-flex items-center gap-2 text-sm text-primary">
                <Loader2 className="size-4 animate-spin" /> {t("images_generating")}
              </div>
            )}
            {order.images_status === "failed" && (
              <div className="mt-3 space-y-2">
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                  {(() => {
                    const err = order.images_error ?? "";
                    if (/credit_limit|402|403/i.test(err)) {
                      return (
                        <div>
                          <div className="font-semibold mb-1">نفدت حصة مزوّد الذكاء الاصطناعي</div>
                          <p>أضِف رصيداً لمساحة العمل ثم اضغط "إعادة توليد كامل الصور".</p>
                          <p className="mt-1 opacity-70 break-words">{err}</p>
                        </div>
                      );
                    }
                    return <p className="break-words">{err || "فشل توليد الصور"}</p>;
                  })()}
                </div>
                <button
                  onClick={retryImages}
                  disabled={retryingImages}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 py-2 text-xs font-bold text-primary hover:bg-primary/20 disabled:opacity-60"
                >
                  {retryingImages ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                  إعادة توليد كامل الصور
                </button>
              </div>
            )}
            <button
              onClick={regenCover}
              disabled={regeningCover}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border py-2 text-xs font-bold hover:bg-secondary disabled:opacity-60"
            >
              {regeningCover ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
              إعادة توليد الغلاف فقط
            </button>

            {imagesReady && (
              <>
                <button
                  onClick={downloadPdf}
                  disabled={buildingPdf}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-accent py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
                >
                  {buildingPdf ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  {buildingPdf ? t("building_pdf") : t("download_pdf")}
                </button>
                {order.status !== "delivered" && (
                  <button
                    onClick={markDelivered}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium hover:bg-secondary"
                  >
                    <Truck className="size-4" /> {t("mark_delivered")}
                  </button>
                )}
              </>
            )}

            {/* Redownload request from customer */}
            {order.redownload_status === "pending" && (
              <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
                <div className="font-semibold text-primary mb-1">{t("redownload_request_pending")}</div>
                <div className="text-muted-foreground">
                  {t("amount_due")}: <span className="font-mono">{Number(order.redownload_amount_iqd ?? 0).toLocaleString()} {t("iqd")}</span>
                </div>
                <button
                  onClick={async () => {
                    try { await redownloadFn({ data: { orderId: id } }); toast.success("تم"); qc.invalidateQueries({ queryKey: ["admin-order", id] }); }
                    catch (e) { toast.error(e instanceof Error ? e.message : "خطأ"); }
                  }}
                  className="mt-2 w-full rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground"
                >{t("confirm_redownload_payment")}</button>
              </div>
            )}

            {order.status === "rejected" && order.rejection_reason && (
              <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                <div className="font-semibold mb-0.5">{t("rejected")}</div>
                <p>{order.rejection_reason}</p>
              </div>
            )}

            {/* Admin moderation */}
            <div className="mt-3 flex flex-wrap gap-2">
              {order.status !== "rejected" && order.status !== "delivered" && (
                <button
                  onClick={() => setRejectOpen(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                >
                  <X className="size-3.5" /> {t("reject_order")}
                </button>
              )}
              <button
                onClick={async () => {
                  if (!confirm("حذف الطلب نهائياً؟")) return;
                  try {
                    await deleteFn({ data: { orderId: id } });
                    toast.success("تم");
                    window.location.href = "/admin";
                  } catch (e) { toast.error(e instanceof Error ? e.message : "خطأ"); }
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-3.5" /> {t("delete_order")}
              </button>
              {order.status === "rejected" && (
                <button
                  onClick={async () => {
                    try { await updateStatusFn({ data: { orderId: id, status: "pending" } }); toast.success("تم"); qc.invalidateQueries({ queryKey: ["admin-order", id] }); }
                    catch (e) { toast.error(e instanceof Error ? e.message : "خطأ"); }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs hover:bg-secondary"
                >
                  <RotateCcw className="size-3.5" /> {t("reopen_order")}
                </button>
              )}
            </div>
          </div>

          {chars.length > 0 && (
            <div className="rounded-2xl border bg-card p-4">
              <div className="mb-2 text-sm font-semibold">{t("customer_photos")} · {chars.length}</div>
              <ul className="space-y-2 text-sm">
                {chars.map((c, i) => {
                  const ch = c as typeof c & { photo_url?: string | null };
                  return (
                    <li key={i} className="flex gap-2 rounded-lg border p-2">
                      {ch.photo_url ? (
                        <a href={ch.photo_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                          <img src={ch.photo_url} alt="" className="h-16 w-16 rounded-md object-cover ring-1 ring-border" />
                        </a>
                      ) : (
                        <div className="h-16 w-16 shrink-0 rounded-md bg-secondary/50 grid place-items-center text-[10px] text-muted-foreground">—</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{c.name} {c.is_primary && <span className="text-[10px] text-primary">★</span>}</div>
                        <div className="text-xs text-muted-foreground">{c.role}{c.age ? ` · ${c.age}` : ""}</div>
                        {c.description && <p className="mt-1 text-xs line-clamp-2">{c.description}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {q.data.cover_url && (
            <div className="rounded-2xl border bg-card p-2">
              <div className="flex items-center justify-between p-2">
                <div className="text-xs text-muted-foreground">الغلاف</div>
                <a href={q.data.cover_url} download={`order-${order.order_number}-cover.png`} className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] hover:bg-secondary">
                  <Download className="size-3" /> {t("download_cover")}
                </a>
              </div>
              <img src={q.data.cover_url} alt="cover" className="w-full aspect-[3/4] object-cover rounded-xl" />
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label={t("total_revenue")} value={`${order.amount_iqd?.toLocaleString() ?? 0} ${t("iqd")}`} />
            <Stat label={t("col_cost")} value={`${Number(cost?.cost_iqd ?? 0).toLocaleString()} ${t("iqd")}`} tone="rose" />
            <Stat label={t("col_profit")} value={`${Number(cost?.gross_profit_iqd ?? 0).toLocaleString()} ${t("iqd")}`} tone="emerald" />
            <Stat label={t("col_margin")} value={cost?.margin_pct != null ? `${cost.margin_pct}%` : "—"} />
          </div>

          {pages.length > 0 && (
            <div className="rounded-2xl border bg-card p-4">
              <div className="mb-3 text-sm font-semibold">{t("story_pages")} · تحرير كامل</div>
              <div className="grid gap-3 sm:grid-cols-2">
                {pages.map((p) => (
                  <AdminPageEditor key={p.page_number} orderId={id} page={p} onChanged={() => qc.invalidateQueries({ queryKey: ["admin-order", id] })} imagesReady={imagesReady} regening={regening === p.page_number} onRegen={() => regen(p.page_number)} orderNumber={order.order_number} />
                ))}
              </div>
            </div>
          )}

          <AICostSection
            events={events as Array<{ id: string; step: string; operation: string | null; total_tokens: number | null; image_count: number | null; cost_usd: number | string | null; cost_iqd: number | string | null; cost_credits: number | string | null; duration_ms: number | null; status: string }>}
            tier={order.tier}
            pageCount={order.page_count ?? 5}
            charCount={chars.length}
            revenueIqd={Number(order.amount_iqd ?? 0)}
            costIqd={Number(cost?.cost_iqd ?? 0)}
            grossProfitIqd={Number(cost?.gross_profit_iqd ?? 0)}
          />
        </div>
      </div>

      {rejectOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-5 shadow-lg">
            <div className="mb-2 text-lg font-bold">{t("reject_order")}</div>
            <p className="mb-3 text-xs text-muted-foreground">{t("reject_reason_hint")}</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              className="w-full rounded-lg border bg-background p-2 text-sm"
              placeholder={t("reject_reason_placeholder")}
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => { setRejectOpen(false); setRejectReason(""); }}
                className="flex-1 rounded-lg border py-2 text-sm hover:bg-secondary"
              >{t("cancel")}</button>
              <button
                disabled={rejecting || rejectReason.trim().length < 3}
                onClick={async () => {
                  setRejecting(true);
                  try {
                    await rejectFn({ data: { orderId: id, reason: rejectReason.trim() } });
                    toast.success("تم");
                    setRejectOpen(false); setRejectReason("");
                    qc.invalidateQueries({ queryKey: ["admin-order", id] });
                  } catch (e) { toast.error(e instanceof Error ? e.message : "خطأ"); }
                  finally { setRejecting(false); }
                }}
                className="flex-1 rounded-lg bg-destructive py-2 text-sm font-bold text-destructive-foreground disabled:opacity-60"
              >{rejecting ? "..." : t("confirm_reject")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "rose" | "emerald" }) {
  const cls = tone === "rose" ? "text-destructive" : tone === "emerald" ? "text-primary" : "text-foreground";
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-bold ${cls}`}>{value}</div>
    </div>
  );
}

// Translate raw event `step` values into user-facing Arabic labels — never expose model names.
function labelForStep(step: string): string {
  if (step === "story_plan") return "خطة القصة";
  if (step === "first_paragraph") return "نص افتتاحي";
  if (step === "cover_image") return "صورة الغلاف";
  if (step === "reflection_question") return "سؤال تأمّلي للطفل";
  const pageImage = step.match(/^page_(\d+)_image$/);
  if (pageImage) return `صورة صفحة ${pageImage[1]}`;
  const pageRegen = step.match(/^page_(\d+)_regen$/);
  if (pageRegen) return `إعادة توليد صفحة ${pageRegen[1]}`;
  const pageText = step.match(/^page_(\d+)_text$/);
  if (pageText) return `نص صفحة ${pageText[1]}`;
  return step;
}

function tierLabel(t: string | null): string {
  if (t === "pdf") return "PDF";
  if (t === "printed") return "مطبوع";
  if (t === "video") return "فيديو";
  return "—";
}

function AICostSection({
  events, tier, pageCount, charCount, revenueIqd, costIqd, grossProfitIqd,
}: {
  events: Array<{ id: string; step: string; operation: string | null; total_tokens: number | null; image_count: number | null; cost_usd: number | string | null; cost_iqd: number | string | null; cost_credits: number | string | null; duration_ms: number | null; status: string }>;
  tier: string | null;
  pageCount: number;
  charCount: number;
  revenueIqd: number;
  costIqd: number;
  grossProfitIqd: number;
}) {
  const totals = events.reduce(
    (acc, e) => {
      if (e.status !== "success") return acc;
      acc.tokens += Number(e.total_tokens ?? 0);
      acc.images += Number(e.image_count ?? 0);
      acc.usd += Number(e.cost_usd ?? 0);
      acc.iqd += Number(e.cost_iqd ?? 0);
      acc.credits += Number(e.cost_credits ?? 0);
      acc.ms += Number(e.duration_ms ?? 0);
      return acc;
    },
    { tokens: 0, images: 0, usd: 0, iqd: 0, credits: 0, ms: 0 },
  );
  const netProfit = revenueIqd - costIqd;
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-semibold">استهلاك الذكاء لهذا الطلب</div>
        <div className="text-[11px] text-muted-foreground">
          نوع: <span className="font-medium text-foreground">{tierLabel(tier)}</span>
          {" · "}صفحات: <span className="font-mono text-foreground">{pageCount}</span>
          {" · "}شخصيات: <span className="font-mono text-foreground">{charCount}</span>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3 mb-3">
        <MiniStat label="إجمالي تكلفة الذكاء" value={`$${totals.usd.toFixed(3)}`} sub={`${Math.round(totals.iqd).toLocaleString()} د.ع`} />
        <MiniStat label="إجمالي التكلفة التشغيلية" value={`${Math.round(costIqd).toLocaleString()} د.ع`} sub="ذكاء + طباعة + شحن" tone="rose" />
        <MiniStat label="الربح الصافي" value={`${Math.round(netProfit).toLocaleString()} د.ع`} sub={`إيراد ${Math.round(revenueIqd).toLocaleString()} د.ع`} tone={netProfit >= 0 ? "emerald" : "rose"} />
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-full text-xs">
          <thead className="text-muted-foreground bg-secondary/40">
            <tr>
              <th className="px-2 py-1.5 text-start">العملية</th>
              <th className="px-2 py-1.5 text-end">التوكِنز</th>
              <th className="px-2 py-1.5 text-end">صور</th>
              <th className="px-2 py-1.5 text-end">USD</th>
              <th className="px-2 py-1.5 text-end">IQD</th>
              <th className="px-2 py-1.5 text-end">ms</th>
              <th className="px-2 py-1.5 text-start">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && (
              <tr><td colSpan={7} className="px-2 py-4 text-center text-muted-foreground">لا توجد عمليات بعد</td></tr>
            )}
            {events.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="px-2 py-1.5 font-medium">{labelForStep(e.step)}</td>
                <td className="px-2 py-1.5 text-end font-mono">{e.total_tokens ?? 0}</td>
                <td className="px-2 py-1.5 text-end font-mono">{e.image_count ?? 0}</td>
                <td className="px-2 py-1.5 text-end font-mono">{Number(e.cost_usd ?? 0).toFixed(4)}</td>
                <td className="px-2 py-1.5 text-end font-mono">{Number(e.cost_iqd ?? 0).toFixed(0)}</td>
                <td className="px-2 py-1.5 text-end font-mono">{e.duration_ms ?? 0}</td>
                <td className="px-2 py-1.5">
                  <span className={e.status === "success" ? "text-primary" : "text-destructive"}>
                    {e.status === "success" ? "ناجحة" : e.status === "failed" ? "فشلت" : e.status}
                  </span>
                </td>
              </tr>
            ))}
            {events.length > 0 && (
              <tr className="border-t bg-secondary/30 font-semibold">
                <td className="px-2 py-1.5">الإجمالي</td>
                <td className="px-2 py-1.5 text-end font-mono">{totals.tokens.toLocaleString()}</td>
                <td className="px-2 py-1.5 text-end font-mono">{totals.images}</td>
                <td className="px-2 py-1.5 text-end font-mono">{totals.usd.toFixed(4)}</td>
                <td className="px-2 py-1.5 text-end font-mono">{Math.round(totals.iqd).toLocaleString()}</td>
                <td className="px-2 py-1.5 text-end font-mono">{totals.ms.toLocaleString()}</td>
                <td className="px-2 py-1.5 text-[10px] text-muted-foreground">{totals.credits.toFixed(2)} كريدت</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MiniStat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "rose" | "emerald" }) {
  const cls = tone === "rose" ? "text-destructive" : tone === "emerald" ? "text-primary" : "text-foreground";
  return (
    <div className="rounded-xl border bg-background p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-base font-bold ${cls}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

type PageRow = { page_number: number; text: string | null; image_url: string | null; image_prompt?: string | null };

function AdminPageEditor({ orderId, page, onChanged, imagesReady, regening, onRegen, orderNumber }: {
  orderId: string;
  page: PageRow;
  onChanged: () => void;
  imagesReady: boolean;
  regening: boolean;
  onRegen: () => void;
  orderNumber: number;
}) {
  const updateTextFn = useServerFn(adminUpdatePageText);
  const uploadFn = useServerFn(adminUploadPageImage);
  const updatePromptFn = useServerFn(adminUpdatePagePrompt);
  const [text, setText] = useState(page.text ?? "");
  const [prompt, setPrompt] = useState(page.image_prompt ?? "");
  const [savingText, setSavingText] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function saveText() {
    setSavingText(true);
    try {
      await updateTextFn({ data: { orderId, pageNumber: page.page_number, text } });
      toast.success("تم حفظ النص");
      onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطأ"); }
    finally { setSavingText(false); }
  }
  async function savePrompt() {
    setSavingPrompt(true);
    try {
      await updatePromptFn({ data: { orderId, pageNumber: page.page_number, imagePrompt: prompt } });
      toast.success("تم حفظ الموجّه");
      onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطأ"); }
    finally { setSavingPrompt(false); }
  }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      await uploadFn({ data: { orderId, pageNumber: page.page_number, dataUrl } });
      toast.success("تم رفع الصورة");
      onChanged();
    } catch (err) { toast.error(err instanceof Error ? err.message : "خطأ"); }
    finally { setUploading(false); e.target.value = ""; }
  }

  return (
    <div className="rounded-xl border bg-background overflow-hidden">
      {page.image_url ? (
        <img src={page.image_url} alt={`page-${page.page_number}`} className="aspect-square w-full object-cover" />
      ) : (
        <div className="aspect-square w-full flex items-center justify-center bg-secondary/30 text-muted-foreground text-xs">
          {imagesReady ? "—" : "بانتظار الدفع"}
        </div>
      )}
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-1">
          <div className="text-xs font-bold text-primary">صفحة {page.page_number}</div>
          <div className="inline-flex gap-1 flex-wrap">
            {page.image_url && (
              <a href={page.image_url} download={`order-${orderNumber}-page-${page.page_number}.png`}
                className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] hover:bg-secondary">
                <Download className="size-3" />
              </a>
            )}
            <label className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] hover:bg-secondary cursor-pointer">
              {uploading ? <Loader2 className="size-3 animate-spin" /> : "رفع صورة"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFile} disabled={uploading} />
            </label>
            {imagesReady && (
              <button onClick={onRegen} disabled={regening}
                className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] hover:bg-secondary disabled:opacity-60">
                {regening ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                توليد
              </button>
            )}
          </div>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          className="w-full rounded-lg border bg-background p-2 text-xs leading-relaxed"
        />
        <div className="flex justify-end">
          <button onClick={saveText} disabled={savingText || text === (page.text ?? "")}
            className="rounded-md bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground disabled:opacity-50">
            {savingText ? "..." : "حفظ النص"}
          </button>
        </div>
        <details className="text-[11px]">
          <summary className="cursor-pointer text-muted-foreground">موجّه الصورة (Prompt)</summary>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border bg-background p-2 text-[11px]"
            placeholder="وصف مشهد الصورة (بالإنجليزية غالباً)"
          />
          <div className="mt-1 flex justify-end">
            <button onClick={savePrompt} disabled={savingPrompt || prompt === (page.image_prompt ?? "")}
              className="rounded-md border px-2 py-0.5 text-[10px] hover:bg-secondary disabled:opacity-50">
              {savingPrompt ? "..." : "حفظ الموجّه"}
            </button>
          </div>
        </details>
      </div>
    </div>
  );
}
