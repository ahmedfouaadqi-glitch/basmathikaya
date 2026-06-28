import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { adminAnalytics } from "../lib/orders.functions";
import { useT } from "../lib/i18n";
import { Download } from "lucide-react";

export const Route = createFileRoute("/admin/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { t } = useT();
  const fn = useServerFn(adminAnalytics);
  const q = useQuery({ queryKey: ["admin-analytics"], queryFn: () => fn(), refetchInterval: 30_000 });
  const a = q.data;

  const csvHref = useMemo(() => {
    if (!a) return "#";
    const lines = [
      "metric,value",
      `total_revenue_iqd,${a.total_revenue_iqd}`,
      `total_cost_iqd,${a.total_cost_iqd}`,
      `total_profit_iqd,${a.total_profit_iqd}`,
      `total_orders,${a.total_orders}`,
      `pdf_orders,${a.by_tier.pdf}`,
      `printed_orders,${a.by_tier.printed}`,
      `video_orders,${a.by_tier.video}`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    return URL.createObjectURL(blob);
  }, [a]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("admin_analytics")}</h1>
        <a href={csvHref} download="basma-analytics.csv" className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-secondary">
          <Download className="size-4" /> {t("export_csv")}
        </a>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <Card label={t("total_revenue")} value={`${Number(a?.total_revenue_iqd ?? 0).toLocaleString()} ${t("iqd")}`} />
        <Card label={t("total_cost")} value={`${Number(a?.total_cost_iqd ?? 0).toLocaleString()} ${t("iqd")}`} tone="rose" />
        <Card label={t("total_profit")} value={`${Number(a?.total_profit_iqd ?? 0).toLocaleString()} ${t("iqd")}`} tone="emerald" />
        <Card label={t("total_orders")} value={String(a?.total_orders ?? 0)} />
      </div>
      <div className="mt-6 rounded-2xl border bg-card p-5">
        <div className="font-semibold mb-3">حسب الباقة</div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div><div className="text-2xl font-bold">{a?.by_tier.pdf ?? 0}</div><div className="text-xs text-muted-foreground">PDF</div></div>
          <div><div className="text-2xl font-bold">{a?.by_tier.printed ?? 0}</div><div className="text-xs text-muted-foreground">Printed</div></div>
          <div><div className="text-2xl font-bold">{a?.by_tier.video ?? 0}</div><div className="text-xs text-muted-foreground">Video</div></div>
        </div>
      </div>
    </div>
  );
}

function Card({ label, value, tone }: { label: string; value: string; tone?: "rose" | "emerald" }) {
  const cls = tone === "rose" ? "text-destructive" : tone === "emerald" ? "text-primary" : "text-foreground";
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-2 text-2xl font-extrabold ${cls}`}>{value}</div>
    </div>
  );
}
