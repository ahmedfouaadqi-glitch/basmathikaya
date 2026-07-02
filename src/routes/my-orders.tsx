import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useT } from "../lib/i18n";
import { getCurrentUser, userLogout } from "../lib/auth.functions";
import { myOrders, requestRedownload } from "../lib/orders.functions";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { LogOut, Download, Ban, Clock, CheckCircle2 } from "lucide-react";
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
  const q = useQuery({ queryKey: ["my-orders"], queryFn: () => fn() });
  const [busy, setBusy] = useState<string | null>(null);

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

      {q.isLoading ? (
        <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">…</div>
      ) : (q.data ?? []).length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">{t("no_my_orders")}</div>
      ) : (
        <div className="space-y-2">
          {((q.data ?? []) as Row[]).map((o) => {
            const canDownload = o.images_status === "ready" && (o.status === "delivered" || o.redownload_status === "paid");
            const canRequestRedownload = o.status === "delivered" && o.redownload_status !== "pending" && o.redownload_status !== "paid";
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

                {o.status === "rejected" && o.rejection_reason && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                    <Ban className="size-4 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold">{t("order_rejected")}</div>
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
                {canRequestRedownload && (
                  <button
                    onClick={() => askRedownload(o.id)}
                    disabled={busy === o.id}
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border py-2 text-xs hover:bg-secondary disabled:opacity-60"
                  >
                    {busy === o.id ? "..." : t("request_paid_redownload")}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
