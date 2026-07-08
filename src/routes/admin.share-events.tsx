import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { shareEventStats } from "../lib/admin-ops.functions";

export const Route = createFileRoute("/admin/share-events")({ component: ShareEventsPage });

function ShareEventsPage() {
  const fn = useServerFn(shareEventStats);
  const q = useQuery({ queryKey: ["admin-share-events"], queryFn: () => fn(), refetchInterval: 60_000 });
  const d = q.data;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">إحصاءات المشاركة (30 يوم)</h1>
      <div className="mb-6 rounded-xl border bg-card p-4">
        <div className="text-xs text-muted-foreground">إجمالي المشاركات</div>
        <div className="mt-1 text-3xl font-bold">{d?.total ?? "…"}</div>
      </div>

      <h2 className="mb-2 text-lg font-semibold">حسب المنصة</h2>
      <div className="mb-6 space-y-2">
        {(d?.byPlatform ?? []).map(([platform, count]) => (
          <div key={platform} className="flex items-center justify-between rounded-lg border bg-card p-3 text-sm">
            <span className="font-mono">{platform}</span>
            <span className="font-bold">{count}</span>
          </div>
        ))}
        {d && d.byPlatform.length === 0 && <p className="text-sm text-muted-foreground">لا توجد مشاركات بعد.</p>}
      </div>

      <h2 className="mb-2 text-lg font-semibold">أعلى القصص مشاركةً</h2>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-xs">
            <tr>
              <th className="p-2">#</th><th className="p-2 text-start">القصة</th><th className="p-2">مشاركات</th>
            </tr>
          </thead>
          <tbody>
            {(d?.topOrders ?? []).map((o) => (
              <tr key={o.id} className="border-t">
                <td className="p-2 text-center font-mono text-xs">{o.order_number ?? "—"}</td>
                <td className="p-2 text-xs">{o.title ?? "—"}</td>
                <td className="p-2 text-center font-bold">{o.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
