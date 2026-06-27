import { createFileRoute, Outlet, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { adminCheck, adminLogout } from "../lib/admin.functions";
import { useT } from "../lib/i18n";
import { LogOut, BarChart3, Settings, ListOrdered } from "lucide-react";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ location }) => {
    // Skip gate for /admin/login itself
    if (location.pathname === "/admin/login") return;
    const check = await adminCheck();
    if (!check.authenticated) {
      throw redirect({ to: "/admin/login" });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { t } = useT();
  const navigate = useNavigate();
  const logout = useServerFn(adminLogout);
  // hide nav on /admin/login
  const isLogin = typeof window !== "undefined" && window.location.pathname === "/admin/login";
  if (isLogin) return <Outlet />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-3">
        <nav className="flex items-center gap-1 text-sm">
          <Link to="/admin" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-secondary" activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}>
            <ListOrdered className="size-4" />
            {t("admin_orders")}
          </Link>
          <Link to="/admin/analytics" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-secondary" activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}>
            <BarChart3 className="size-4" />
            {t("admin_analytics")}
          </Link>
          <Link to="/admin/settings" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-secondary" activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}>
            <Settings className="size-4" />
            {t("admin_settings")}
          </Link>
        </nav>
        <button
          onClick={async () => { await logout(); navigate({ to: "/admin/login" }); }}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-secondary"
        >
          <LogOut className="size-4" />
          {t("admin_logout")}
        </button>
      </div>
      <Outlet />
    </div>
  );
}
