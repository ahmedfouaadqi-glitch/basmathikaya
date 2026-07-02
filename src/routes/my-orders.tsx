import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useT } from "../lib/i18n";
import { getCurrentUser, userLogout } from "../lib/auth.functions";
import { myOrders, requestRedownload, reorderExisting } from "../lib/orders.functions";
import { listMyNotifications, markAllNotificationsRead } from "../lib/notifications.functions";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { LogOut, Download, Ban, Clock, CheckCircle2, RotateCcw, Bell } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/my-orders")({
  beforeLoad: async ({ location }) => {
    const me = await getCurrentUser();
    if (!me) throw redirect({ to: "/auth", search: { redirect: location.href } });
    return { me };
  },
  component: MyOrdersPage,
});

const STATUS_TONE: Record<string, string> = {
  pending: "bg-accent/25 text-accent-foreground",
  paid: "bg-primary/15 text-primary",
  delivered: "bg-primary/25 text-primary",
  cancelled: "bg-destructive/15 text-destructive",
  rejected: "bg-destructive/15 text-destructive",
};

type Row = {
  id: string; order_number: number; status: string; images_status?: string | null;
  tier: string | null; amount_iqd: number; page_count: number; title: string | null;
  rejection_reason?: string | null;
  redownload_status?: string | null; redownload_amount_iqd?: number | null;
};

function MyOrdersPage() {
  const { t } = useT();
  const { me } = Route.useRouteContext();
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const fn = useServerFn(myOrders);
  const logoutFn = useServerFn(userLogout);
  const reqFn = useServerFn(requestRedownload);
  const reorderFn = useServerFn(reorderExisting);
  const notifFn = useServerFn(listMyNotifications);
  const markAllFn = useServerFn(markAllNotificationsRead);

  const q = useQuery({ queryKey: ["my-orders"], queryFn: () => fn(), refetchInterval: 15_000 });
  const notifQ = useQuery({ queryKey: ["my-notifications"], queryFn: () => notifFn(), refetchInterval: 20_000 });

  const [busy, setBusy] = useState<string | null>(null);
  const [reorderOpen, setReorderOpen] = useState<null | { id: string; number: number }>(null);
  const [reorderQuality, setReorderQuality] = useState<"standard" | "premium">("standard");
  const [reorderCoupon, setReorderCoupon] = useState("");
  const [reordering, setReordering] = useState(false);

  const unread = (notifQ.data ?? []).filter((n) => !n.read_at).length;

  async function askRedownload(id: string) {
    if (!confirm(t("confirm_request_redownload"))) return;
    setBusy(id);
    try {
      const r = await reqFn({ data: { orderId: id } });
      toast.success(`${t("redownload_requested_ok")} · ${r.amount_iqd.toLocaleString()} ${t("iqd")}`);
      qc.invalidateQueries({ queryKey: ["my-orders"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطأ"); }
    finally { setBusy(null); }
  }

  async function doReorder() {
    if (!reorderOpen) return;
    setReordering(true);
    try {
      const r = await reorderFn({ data: {
        orderId: reorderOpen.id,
        quality: reorderQuality,
        coupon_code: reorderCoupon.trim() || undefined,
      } });
      const rr = r as unknown as { whatsapp_url?: string };
      if (rr.whatsapp_url) window.open(rr.whatsapp_url, "_blank");
      toast.success("تم إنشاء طلب جديد. أكمل الدفع عبر واتساب.");
      setReorderOpen(null);
      setReorderCoupon("");
      qc.invalidateQueries({ queryKey: ["my-orders"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطأ"); }
    finally { setReordering(false); }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("my_orders")}</h1>
          <p className="mt-1 text-xs text-muted-foreground">{me?.name} · <span dir="ltr">{me?.phone}</span></p>
        </div>
        <button
          onClick={async () => { await logoutFn(); await router.invalidate(); navigate({ to: "/" }); }}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-secondary"
        >
          <LogOut className="size-4" /> {t("nav_logout")}
        </button>
      </div>

      {/* Notifications */}
      {(notifQ.data ?? []).length > 0 && (
        <div className="mb-4 rounded-2xl border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="inline-flex items-center gap-2 text-sm font-bold">
              <Bell className="size-4" /> الإشعارات
              {unread > 0 && <span className="rounded-full bg-primary text-primary-foreground text-[10px] px-2 py-0.5">{unread}</span>}
            </div>
            {unread > 0 && (
              <button
                onClick={async () => { await markAllFn(); qc.invalidateQueries({ queryKey: ["my-notifications"] }); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >تعليم الكل كمقروء</button>
            )}
          </div>
          <ul className="space-y-2">
            {(notifQ.data ?? []).slice(0, 5).map((n) => (
              <li key={n.id} className={`rounded-lg border p-2 text-xs ${!n.read_at ? "border-primary/40 bg-primary/5" : ""}`}>
                <div className="font-semibold">{n.title}</div>
                {n.body && <p className="mt-0.5 text-muted-foreground">{n.body}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {q.isLoading ? (
        <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">…</div>
      ) : (q.data ?? []).length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">{t("no_my_orders")}</div>
      ) : (
        <div className="space-y-2">
          {((q.data ?? []) as Row[]).map((o) => {
            const canDownload = o.images_status === "ready" && (o.status === "delivered" || o.redownload_status === "paid");
            const canRequestRedownload = o.status === "delivered" && o.redownload_status !== "pending" && o.redownload_status !== "paid";
            const canReorder = o.status === "delivered";
            const isBlocked = o.status === "cancelled" || o.status === "rejected";
            return (
              <div key={o.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={() => navigate({ to: "/preview/$orderId", params: { orderId: o.id } })}
                    className="flex-1 text-start"
                  >
                    <div className="font-mono text-sm font-bold">#{o.order_number}</div>
                    <div className="mt-0.5 text-sm">{o.title ?? "—"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {o.page_count} {t("pages_label")} · {o.tier ?? "—"} · {Number(o.amount_iqd).toLocaleString()} {t("iqd")}
                    </div>
                  </button>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[o.status] ?? "bg-secondary text-muted-foreground"}`}>
                    {t(`status_${o.status}` as never)}
                  </span>
                </div>

                {isBlocked && o.rejection_reason && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                    <Ban className="size-4 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold">{o.status === "rejected" ? t("order_rejected") : "الطلب ملغى"}</div>
                      <p>{o.rejection_reason}</p>
                    </div>
                  </div>
                )}

                {canDownload && (
                  <button
                    onClick={() => navigate({ to: "/preview/$orderId", params: { orderId: o.id } })}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-primary to-accent py-2 text-sm font-bold text-primary-foreground"
                  >
                    <Download className="size-4" /> {t("download_pdf")}
                  </button>
                )}

                {o.redownload_status === "pending" && (
                  <div className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 py-2 text-xs text-amber-700 dark:text-amber-400">
                    <Clock className="size-4" /> {t("redownload_awaiting_admin")}
                    {o.redownload_amount_iqd ? <span className="font-mono">· {Number(o.redownload_amount_iqd).toLocaleString()} {t("iqd")}</span> : null}
                  </div>
                )}
                {o.redownload_status === "paid" && (
                  <div className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/10 py-2 text-xs text-primary">
                    <CheckCircle2 className="size-4" /> {t("redownload_ready")}
                  </div>
                )}

                <div className="mt-2 flex flex-wrap gap-2">
                  {canRequestRedownload && (
                    <button
                      onClick={() => askRedownload(o.id)}
                      disabled={busy === o.id}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs hover:bg-secondary disabled:opacity-60"
                    >
                      {busy === o.id ? "..." : t("request_paid_redownload")}
                    </button>
                  )}
                  {canReorder && (
                    <button
                      onClick={() => { setReorderOpen({ id: o.id, number: o.order_number }); setReorderQuality("standard"); }}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs hover:bg-secondary"
                    >
                      <RotateCcw className="size-3.5" /> إعادة الطلب
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reorder dialog */}
      {reorderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !reordering && setReorderOpen(null)}>
          <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-1 text-lg font-extrabold">إعادة الطلب #{reorderOpen.number}</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              سيتم إنشاء طلب جديد بنفس الشخصيات والأجواء والصفحات. اختر الجودة وأدخل كوبون إن رغبت.
            </p>
            <div className="mb-3">
              <label className="mb-1.5 block text-xs font-semibold">الجودة</label>
              <div className="grid grid-cols-2 gap-2">
                {(["standard", "premium"] as const).map((qv) => (
                  <button
                    key={qv}
                    type="button"
                    onClick={() => setReorderQuality(qv)}
                    className={`rounded-lg border p-2 text-xs ${reorderQuality === qv ? "border-primary bg-primary/10 font-bold" : ""}`}
                  >{qv === "standard" ? "قياسي" : "احترافي"}</button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-semibold">كوبون (اختياري)</label>
              <input
                value={reorderCoupon}
                onChange={(e) => setReorderCoupon(e.target.value.toUpperCase())}
                maxLength={40}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                disabled={reordering}
                onClick={() => setReorderOpen(null)}
                className="rounded-xl border px-4 py-2 text-sm hover:bg-secondary disabled:opacity-50"
              >إلغاء</button>
              <button
                disabled={reordering}
                onClick={doReorder}
                className="rounded-xl bg-gradient-to-br from-primary to-accent px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
              >{reordering ? "..." : "أنشئ الطلب"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
