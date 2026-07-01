import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Download, RefreshCw, Loader2, Sparkles, Truck } from "lucide-react";
import { adminGetOrder, adminRegeneratePage, adminConfirmPaymentAndGenerate, adminUpdateStatus, getStoryProgress } from "../lib/orders.functions";
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
  const [regening, setRegening] = useState<number | null>(null);
  const [buildingPdf, setBuildingPdf] = useState(false);
  const [confirmingPay, setConfirmingPay] = useState(false);

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
        moods: p.moods ?? [],
        coverUrl: p.cover_url,
        pages: p.pages.map((pg) => ({ number: pg.page_number, text: pg.text, imageUrl: pg.image_url })),
        accentColor: th?.accent_color ?? null,
        orderNumber: p.order_number ?? order.order_number,
        disclaimer: content ? (lang === "ar" ? content.disclaimer_ar : content.disclaimer_en) : null,
        frameStyle: (th?.frame_style as StoryFrameStyle) ?? null,
        palette: th?.palette ?? null,
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
            {order.images_status === "failed" && order.images_error && (
              <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                {order.images_error}
              </div>
            )}
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
              <div className="mb-3 text-sm font-semibold">{t("story_pages")}</div>
              <div className="grid gap-3 sm:grid-cols-2">
                {pages.map((p) => (
                  <div key={p.page_number} className="rounded-xl border bg-background overflow-hidden">
                    {p.image_url ? (
                      <img src={p.image_url} alt={`page-${p.page_number}`} className="aspect-square w-full object-cover" />
                    ) : (
                      <div className="aspect-square w-full flex items-center justify-center bg-secondary/30 text-muted-foreground text-xs">
                        {imagesReady ? "—" : "بانتظار الدفع"}
                      </div>
                    )}
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-1 gap-1">
                        <div className="text-xs font-bold text-primary">{t("page_n")} {p.page_number}</div>
                        <div className="inline-flex gap-1">
                          {p.image_url && (
                            <a
                              href={p.image_url}
                              download={`order-${order.order_number}-page-${p.page_number}.png`}
                              className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] hover:bg-secondary"
                            >
                              <Download className="size-3" />
                            </a>
                          )}
                          {imagesReady && (
                            <button
                              onClick={() => regen(p.page_number)}
                              disabled={regening === p.page_number}
                              className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] hover:bg-secondary disabled:opacity-60"
                            >
                              {regening === p.page_number ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                              {t("regenerate_image")}
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap">{p.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border bg-card p-2">
            <div className="px-3 py-2 text-sm font-semibold">{t("cost_events")}</div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="text-muted-foreground bg-secondary/40">
                  <tr>
                    <th className="px-2 py-1.5 text-start">step</th>
                    <th className="px-2 py-1.5 text-start">model</th>
                    <th className="px-2 py-1.5 text-end">tokens</th>
                    <th className="px-2 py-1.5 text-end">imgs</th>
                    <th className="px-2 py-1.5 text-end">USD</th>
                    <th className="px-2 py-1.5 text-end">IQD</th>
                    <th className="px-2 py-1.5 text-end">ms</th>
                    <th className="px-2 py-1.5 text-start">status</th>
                  </tr>
                </thead>
                <tbody>
                  {events.length === 0 && (
                    <tr><td colSpan={8} className="px-2 py-4 text-center text-muted-foreground">—</td></tr>
                  )}
                  {events.map((e) => (
                    <tr key={e.id} className="border-t">
                      <td className="px-2 py-1.5 font-medium">{e.step}</td>
                      <td className="px-2 py-1.5 text-muted-foreground text-[10px]">{e.model}</td>
                      <td className="px-2 py-1.5 text-end font-mono">{e.total_tokens}</td>
                      <td className="px-2 py-1.5 text-end font-mono">{e.image_count}</td>
                      <td className="px-2 py-1.5 text-end font-mono">{Number(e.cost_usd).toFixed(4)}</td>
                      <td className="px-2 py-1.5 text-end font-mono">{Number(e.cost_iqd).toFixed(0)}</td>
                      <td className="px-2 py-1.5 text-end font-mono">{e.duration_ms}</td>
                      <td className="px-2 py-1.5">
                        <span className={e.status === "success" ? "text-primary" : "text-destructive"}>{e.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
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
