import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useT } from "../lib/i18n";
import { getCurrentUser, userLogout } from "../lib/auth.functions";
import { myOrders } from "../lib/orders.functions";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { LogOut } from "lucide-react";

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
};

function MyOrdersPage() {
  const { t } = useT();
  const { me } = Route.useRouteContext();
  const navigate = useNavigate();
  const router = useRouter();
  const fn = useServerFn(myOrders);
  const logoutFn = useServerFn(userLogout);
  const q = useQuery({ queryKey: ["my-orders"], queryFn: () => fn() });

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
          {(q.data ?? []).map((o) => (
            <button
              key={o.id}
              onClick={() => navigate({ to: "/preview/$orderId", params: { orderId: o.id } })}
              className="block w-full text-start rounded-xl border bg-card p-4 hover:bg-secondary/40 transition"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-sm font-bold">#{o.order_number}</div>
                  <div className="mt-0.5 text-sm">{o.title ?? "—"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {o.page_count} {t("pages_label")} · {o.tier ?? "—"} · {Number(o.amount_iqd).toLocaleString()} {t("iqd")}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[o.status] ?? "bg-secondary text-muted-foreground"}`}>
                  {t(`status_${o.status}` as never)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
