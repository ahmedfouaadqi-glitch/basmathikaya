import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { adminListOrders } from "../lib/orders.functions";
import { useT } from "../lib/i18n";
import { supabase } from "../integrations/supabase/client";
import { Eye } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminOrders,
});

function fmt(n: number | string | null | undefined) {
  if (n === null || n === undefined) return "—";
  return Number(n).toLocaleString();
}

function statusBadge(s: string, t: (k: never) => string) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: t("status_pending" as never), cls: "bg-accent/25 text-accent-foreground" },
    paid: { label: t("status_paid" as never), cls: "bg-primary/15 text-primary" },
    delivered: { label: t("status_delivered" as never), cls: "bg-primary/25 text-primary" },
    cancelled: { label: t("status_cancelled" as never), cls: "bg-destructive/15 text-destructive" },
  };
  const m = map[s] ?? { label: s, cls: "bg-secondary text-muted-foreground" };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>;
}

function AdminOrders() {
  const { t } = useT();
  const qc = useQueryClient();
  const listFn = useServerFn(adminListOrders);

  const q = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => listFn(),
    refetchInterval: 15_000,
  });

  useEffect(() => {
    const ch = supabase
      .channel("admin-orders-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-orders"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "generation_events" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-orders"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const rows = q.data ?? [];

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">{t("admin_orders")}</h1>

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-secondary/60 text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-start">{t("col_order")}</th>
              <th className="px-3 py-2.5 text-start">{t("col_customer")}</th>
              <th className="px-3 py-2.5 text-start">{t("col_tier")}</th>
              <th className="px-3 py-2.5 text-start">{t("col_status")}</th>
              <th className="px-3 py-2.5 text-end">{t("col_revenue")}</th>
              <th className="px-3 py-2.5 text-end">{t("col_cost")}</th>
              <th className="px-3 py-2.5 text-end">{t("col_profit")}</th>
              <th className="px-3 py-2.5 text-end">{t("col_margin")}</th>
              <th className="px-3 py-2.5 text-center">{t("col_actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">{t("no_orders")}</td></tr>
            )}
            {rows.map((o) => {
              const customerName = (o as { customer_name?: string | null }).customer_name ?? "—";
              return (
                <tr key={o.id} className="border-t hover:bg-secondary/30">
                  <td className="px-3 py-2.5 font-mono font-medium">#{o.order_number}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{customerName}</div>
                    <div className="text-xs text-muted-foreground" dir="ltr">{o.customer_phone}</div>
                  </td>
                  <td className="px-3 py-2.5">{o.tier ?? "—"}</td>
                  <td className="px-3 py-2.5">{statusBadge(o.status, t as never)}</td>
                  <td className="px-3 py-2.5 text-end font-mono">{fmt(o.amount_iqd)}</td>
                  <td className="px-3 py-2.5 text-end font-mono text-destructive">{fmt(o.cost?.cost_iqd)}</td>
                  <td className="px-3 py-2.5 text-end font-mono text-primary">{fmt(o.cost?.gross_profit_iqd)}</td>
                  <td className="px-3 py-2.5 text-end font-mono">{o.cost?.margin_pct != null ? `${o.cost.margin_pct}%` : "—"}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-1">
                      <Link to="/admin/orders/$id" params={{ id: o.id }} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-secondary">
                        <Eye className="size-3.5" /> {t("view")}
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
