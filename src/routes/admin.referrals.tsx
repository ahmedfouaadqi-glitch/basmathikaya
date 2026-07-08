import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listReferralsAdmin, referralStatsAdmin } from "../lib/admin-ops.functions";

export const Route = createFileRoute("/admin/referrals")({ component: AdminReferralsPage });

function AdminReferralsPage() {
  const statsFn = useServerFn(referralStatsAdmin);
  const listFn = useServerFn(listReferralsAdmin);
  const stats = useQuery({ queryKey: ["admin-ref-stats"], queryFn: () => statsFn(), refetchInterval: 60_000 });
  const list = useQuery({ queryKey: ["admin-ref-list"], queryFn: () => listFn(), refetchInterval: 60_000 });

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">الإحالات</h1>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">الإجمالي</div>
          <div className="mt-1 text-2xl font-bold">{stats.data?.total ?? "…"}</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">مكتملة</div>
          <div className="mt-1 text-2xl font-bold text-primary">{stats.data?.completed ?? "…"}</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">مكافآت مصروفة (د.ع)</div>
          <div className="mt-1 text-2xl font-bold text-accent">
            {stats.data?.totalRewardIqd.toLocaleString() ?? "…"}
          </div>
        </div>
      </div>

      <h2 className="mb-2 text-lg font-semibold">أعلى المروّجين</h2>
      <div className="mb-6 overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-xs">
            <tr>
              <th className="p-2 text-start">الاسم</th>
              <th className="p-2 text-start">الهاتف</th>
              <th className="p-2">إحالات</th>
            </tr>
          </thead>
          <tbody>
            {(stats.data?.topReferrers ?? []).map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{r.full_name ?? "—"}</td>
                <td className="p-2 font-mono" dir="ltr">{r.phone ?? "—"}</td>
                <td className="p-2 text-center font-bold">{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-lg font-semibold">آخر الإحالات</h2>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-xs">
            <tr>
              <th className="p-2 text-start">المُحيل</th>
              <th className="p-2 text-start">المُحال</th>
              <th className="p-2">الكود</th>
              <th className="p-2">الحالة</th>
              <th className="p-2">المكافأة</th>
              <th className="p-2">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{r.referrer?.full_name ?? "—"}</td>
                <td className="p-2">{r.referred?.full_name ?? "—"}</td>
                <td className="p-2 font-mono">{r.code}</td>
                <td className="p-2 text-center">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                    r.status === "rewarded" ? "bg-primary/15 text-primary" :
                    r.status === "completed" ? "bg-accent/15 text-accent" :
                    "bg-secondary text-muted-foreground"
                  }`}>{r.status}</span>
                </td>
                <td className="p-2 text-center font-mono">{(r.reward_amount_iqd ?? 0).toLocaleString()}</td>
                <td className="p-2 text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString("ar")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
