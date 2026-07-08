import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Share2, Gift, Users } from "lucide-react";
import { getCurrentUser } from "../lib/auth.functions";
import { getMyReferralStats } from "../lib/referrals.functions";

export const Route = createFileRoute("/referrals")({
  beforeLoad: async ({ location }) => {
    const me = await getCurrentUser();
    if (!me) throw redirect({ to: "/auth", search: { redirect: location.href } });
  },
  head: () => ({
    meta: [
      { title: "برنامج الإحالات — بصمة حكاية" },
      { name: "description", content: "اِدعُ أصدقاءك واحصل على رصيد مقابل كل صديق يُنجز أول طلب." },
    ],
  }),
  component: ReferralsPage,
});

function ReferralsPage() {
  const fn = useServerFn(getMyReferralStats);
  const q = useQuery({ queryKey: ["my-referrals"], queryFn: () => fn(), refetchInterval: 30_000 });
  const d = q.data;

  const shareUrl = typeof window !== "undefined" && d?.code
    ? `${window.location.origin}/?ref=${d.code}`
    : "";

  async function copy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    toast.success("تم نسخ رابط الإحالة");
  }

  async function share() {
    if (!shareUrl) return;
    if (navigator.share) {
      await navigator
        .share({ title: "بصمة حكاية", text: "اصنع حكايتك الخاصة!", url: shareUrl })
        .catch(() => {});
    } else {
      await copy();
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Gift className="size-6 text-primary" /> برنامج الإحالات
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          شارك رابطك — عند إتمام صديقك أول طلب، تحصل على رصيد إحالة يُخصم من طلبك القادم.
        </p>
      </div>

      {q.isLoading ? (
        <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">…</div>
      ) : d ? (
        <>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl border bg-card p-4 text-center">
              <div className="text-xs text-muted-foreground">إحالات</div>
              <div className="mt-1 text-2xl font-bold">{d.totalReferrals}</div>
            </div>
            <div className="rounded-xl border bg-card p-4 text-center">
              <div className="text-xs text-muted-foreground">مكتملة</div>
              <div className="mt-1 text-2xl font-bold text-primary">{d.completedReferrals}</div>
            </div>
            <div className="rounded-xl border bg-card p-4 text-center">
              <div className="text-xs text-muted-foreground">رصيدك (د.ع)</div>
              <div className="mt-1 text-2xl font-bold text-accent">
                {d.availableCreditIqd.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="mb-6 rounded-2xl border bg-card p-5">
            <div className="text-xs font-semibold text-muted-foreground mb-2">كودك</div>
            <div className="font-mono text-2xl font-bold tracking-wider">{d.code}</div>
            <div className="mt-3 flex flex-col gap-2">
              <input
                readOnly
                value={shareUrl}
                dir="ltr"
                className="w-full rounded-lg border bg-secondary/40 px-3 py-2 text-sm font-mono"
              />
              <div className="flex gap-2">
                <button
                  onClick={copy}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border py-2 text-sm hover:bg-secondary"
                >
                  <Copy className="size-4" /> نسخ
                </button>
                <button
                  onClick={share}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-accent py-2 text-sm font-bold text-primary-foreground"
                >
                  <Share2 className="size-4" /> مشاركة
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Users className="size-4" /> سجل الإحالات
            </div>
            {d.recent.length === 0 ? (
              <p className="text-xs text-muted-foreground">لا توجد إحالات بعد — ابدأ بمشاركة رابطك!</p>
            ) : (
              <ul className="space-y-2">
                {d.recent.map((r) => (
                  <li key={r.id} className="flex items-center justify-between rounded-lg border p-2 text-xs">
                    <span className="text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("ar")}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-semibold ${
                        r.status === "rewarded"
                          ? "bg-primary/15 text-primary"
                          : r.status === "completed"
                            ? "bg-accent/15 text-accent"
                            : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {r.status === "rewarded"
                        ? `+${r.reward_amount_iqd.toLocaleString()} د.ع`
                        : r.status === "completed"
                          ? "مكتملة"
                          : "بانتظار أول طلب"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
