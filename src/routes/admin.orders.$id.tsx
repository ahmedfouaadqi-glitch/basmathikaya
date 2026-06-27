import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { adminGetOrder } from "../lib/orders.functions";
import { useT } from "../lib/i18n";
import { supabase } from "../integrations/supabase/client";

export const Route = createFileRoute("/admin/orders/$id")({
  component: OrderDetail,
});

function OrderDetail() {
  const { id } = Route.useParams();
  const { t } = useT();
  const qc = useQueryClient();
  const fn = useServerFn(adminGetOrder);
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
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  if (q.isLoading) return <div className="py-10 text-center text-muted-foreground">…</div>;
  if (!q.data?.order) return <div className="py-10 text-center text-muted-foreground">غير موجود</div>;

  const order = q.data.order as {
    order_number: number; tier: string | null; amount_iqd: number; status: string;
    customer_phone: string; characters?: { customer_name?: string; age?: number; mood?: string };
  };
  const cost = q.data.cost as {
    cost_iqd?: number; cost_usd?: number; cost_credits?: number; gross_profit_iqd?: number;
    margin_pct?: number; total_tokens?: number; images_generated?: number;
  } | null;
  const events = q.data.events ?? [];
  const ch = order.characters;

  return (
    <div>
      <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
        <ArrowRight className="size-4 rotate-180 rtl:rotate-0" /> {t("admin_orders")}
      </Link>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Customer + cover */}
        <div className="space-y-4 lg:col-span-1">
          <div className="rounded-2xl border bg-card p-5">
            <div className="text-xs text-muted-foreground">{t("col_order")}</div>
            <div className="font-mono text-lg font-bold">#{order.order_number}</div>
            <div className="mt-3 text-sm">{ch?.customer_name} • {ch?.age} • {ch?.mood}</div>
            <div className="mt-1 text-xs text-muted-foreground" dir="ltr">{order.customer_phone}</div>
            <div className="mt-3">{order.tier ?? "—"} · {order.amount_iqd?.toLocaleString()} {t("iqd")}</div>
          </div>
          {q.data.upload_url && (
            <div className="rounded-2xl border bg-card p-2">
              <div className="text-xs text-muted-foreground p-2">صورة المستخدم</div>
              <img src={q.data.upload_url} alt="upload" className="w-full aspect-square object-cover rounded-xl" />
            </div>
          )}
          {q.data.cover_url && (
            <div className="rounded-2xl border bg-card p-2">
              <div className="text-xs text-muted-foreground p-2">الغلاف المولَّد</div>
              <img src={q.data.cover_url} alt="cover" className="w-full aspect-[3/4] object-cover rounded-xl" />
            </div>
          )}
        </div>

        {/* Cost summary + events */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label={t("total_revenue")} value={`${order.amount_iqd?.toLocaleString() ?? 0} ${t("iqd")}`} />
            <Stat label={t("col_cost")} value={`${Number(cost?.cost_iqd ?? 0).toLocaleString()} ${t("iqd")}`} tone="rose" />
            <Stat label={t("col_profit")} value={`${Number(cost?.gross_profit_iqd ?? 0).toLocaleString()} ${t("iqd")}`} tone="emerald" />
            <Stat label={t("col_margin")} value={cost?.margin_pct != null ? `${cost.margin_pct}%` : "—"} />
          </div>

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
                        <span className={e.status === "success" ? "text-emerald-700" : "text-rose-700"}>{e.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {q.data.gen?.first_paragraph && (
            <div className="rounded-2xl border bg-card p-5">
              <div className="text-xs font-medium text-muted-foreground mb-2">{t("preview_first_para")}</div>
              <p className="leading-relaxed">{q.data.gen.first_paragraph}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "rose" | "emerald" }) {
  const cls = tone === "rose" ? "text-rose-700" : tone === "emerald" ? "text-emerald-700" : "text-foreground";
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-bold ${cls}`}>{value}</div>
    </div>
  );
}
