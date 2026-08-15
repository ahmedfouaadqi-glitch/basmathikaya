import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { adminListOrders } from "../lib/orders.functions";
import { getAICreditBalance } from "../lib/ai-credits.functions";
import { useT } from "../lib/i18n";
import { supabase } from "../integrations/supabase/client";
import { Eye, Search, FileDown, Sparkles } from "lucide-react";

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
  const [search, setSearch] = useState("");

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

  const allRows = q.data ?? [];
  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return allRows;
    return allRows.filter((o) => {
      const name = (o as { customer_name?: string | null }).customer_name ?? "";
      return (
        String(o.order_number).includes(s) ||
        name.toLowerCase().includes(s) ||
        (o.customer_phone ?? "").toLowerCase().includes(s) ||
        (o.title ?? "").toLowerCase().includes(s)
      );
    });
  }, [allRows, search]);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">{t("admin_orders")}</h1>

      <CreditBalanceCard />


      <div className="mb-3 relative">
        <Search className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-3 size-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("search_orders")}
          className="w-full rounded-xl border bg-card ps-9 pe-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

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
              <th className="px-3 py-2.5 text-center">PDF</th>
              <th className="px-3 py-2.5 text-center">{t("col_actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">{t("no_orders")}</td></tr>
            )}
            {rows.map((o) => {
              const customerName = (o as { customer_name?: string | null }).customer_name ?? "—";
              const hasPdf = (o as { pdf_path?: string | null }).pdf_path != null;
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
                  <td className="px-3 py-2.5 text-center">
                    {hasPdf ? <FileDown className="inline size-4 text-primary" /> : <span className="text-muted-foreground">—</span>}
                  </td>
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

function CreditBalanceCard() {
  const fn = useServerFn(getAICreditBalance);
  const q = useQuery({ queryKey: ["ai-credits"], queryFn: () => fn(), refetchInterval: 60_000 });
  if (!q.data || !q.data.available) return null;
  const d = q.data;
  const src = (s: "actual" | "estimate") => s === "actual" ? "من متوسط آخر 30 يوم" : "تقدير افتراضي — لا توجد بيانات فعلية بعد";
  return (
    <div className="mb-4 rounded-2xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="size-5" />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <div className="text-xs text-muted-foreground">مزوّد الذكاء</div>
              <div className="mt-0.5 text-lg font-bold">
                OpenRouter
                <span className="ms-2 text-sm font-normal text-muted-foreground">
                  {d.gateway_ok ? "مفعّل" : "غير مهيّأ"}
                </span>
              </div>
            </div>
            {!d.gateway_ok && (
              <span className="rounded-full bg-destructive/15 text-destructive text-[10px] px-2 py-0.5">تعذّر الاتصال بمزوّد الذكاء</span>
            )}
          </div>


          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border bg-background p-3">
              <div className="text-xs text-muted-foreground">قصص متبقية — جودة قياسية</div>
              <div className="mt-1 font-mono text-2xl font-bold text-primary">{d.stories_left_standard ?? "—"}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                متوسط تكلفة القصة: ${d.avg_cost_usd_standard.toFixed(3)} · {src(d.source_standard)}
                {d.source_standard === "actual" && ` (${d.stories_sampled_standard} قصة)`}
              </div>
            </div>
            <div className="rounded-xl border bg-background p-3">
              <div className="text-xs text-muted-foreground">قصص متبقية — جودة احترافية</div>
              <div className="mt-1 font-mono text-2xl font-bold text-primary">{d.stories_left_premium ?? "—"}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                متوسط تكلفة القصة: ${d.avg_cost_usd_premium.toFixed(3)} · {src(d.source_premium)}
                {d.source_premium === "actual" && ` (${d.stories_sampled_premium} قصة)`}
              </div>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground">
            الأرقام تقديرية: تُقسَم قيمة الرصيد الحالي على متوسط تكلفة القصة الفعلي؛ عند غياب قصص من نفس الجودة تُستخدَم قيمة "تقدير التكلفة" في إعدادات التسعير.
          </div>
        </div>
      </div>
    </div>
  );
}

