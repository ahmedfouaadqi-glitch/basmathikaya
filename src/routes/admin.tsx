import { createFileRoute, Outlet, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { adminCheck, adminLogout } from "../lib/admin.functions";
import { useT } from "../lib/i18n";
import { LogOut, BarChart3, Settings, ListOrdered, Users, Palette, FileText, Video, Ticket, LayoutTemplate, Flag, ListTree, Cpu, AlertTriangle, ScrollText, PhoneOff, Download, Database, Share2, Gift, Image as ImageIcon, MessageSquareQuote, Brush, ShieldAlert, Type } from "lucide-react";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ location }) => {
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
  const isLogin = typeof window !== "undefined" && window.location.pathname === "/admin/login";
  if (isLogin) return <Outlet />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-3">
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          <Link to="/admin" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-secondary" activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}>
            <ListOrdered className="size-4" />
            {t("admin_orders")}
          </Link>
          <Link to="/admin/review-queue" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-amber-700 hover:bg-amber-500/10" activeProps={{ className: "bg-amber-500/15 font-semibold" }}>
            <ShieldAlert className="size-4" /> المراجعة
          </Link>

          <Link to="/admin/users" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-secondary" activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}>
            <Users className="size-4" />
            {t("admin_users")}
          </Link>
          <Link to="/admin/analytics" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-secondary" activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}>
            <BarChart3 className="size-4" />
            {t("admin_analytics")}
          </Link>
          <Link to="/admin/themes" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-secondary" activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}>
            <Palette className="size-4" />
            {t("admin_themes")}
          </Link>
          <Link to="/admin/art-styles" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-secondary" activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}>
            <Brush className="size-4" /> أنماط الرسم
          </Link>
          <Link to="/admin/templates" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-secondary" activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}>
            <LayoutTemplate className="size-4" />
            قوالب المعاينة
          </Link>
          <Link to="/admin/content" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-secondary" activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}>
            <FileText className="size-4" />
            المحتوى
          </Link>
          <Link to="/admin/site-copy" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-secondary" activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}>
            <Type className="size-4" /> نصوص الموقع
          </Link>
          <Link to="/admin/videos" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-secondary" activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}>
            <Video className="size-4" />
            فيديوهات
          </Link>
          <Link to="/admin/audio" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-secondary" activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}>
            <Video className="size-4" />
            مكتبة الصوت
          </Link>
          <Link to="/admin/coupons" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-secondary" activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}>
            <Ticket className="size-4" />
            {t("admin_coupons")}
          </Link>
          <Link to="/admin/settings" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-secondary" activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}>
            <Settings className="size-4" />
            {t("admin_settings")}
          </Link>
          <Link to="/admin/redownloads" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-secondary" activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}>
            <Download className="size-4" /> إعادة التحميل
          </Link>
          <Link to="/admin/phone-bans" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-secondary" activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}>
            <PhoneOff className="size-4" /> الحظر
          </Link>
          <Link to="/admin/flags" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-secondary" activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}>
            <Flag className="size-4" /> Flags
          </Link>
          <Link to="/admin/jobs" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-secondary" activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}>
            <ListTree className="size-4" /> Jobs
          </Link>
          <Link to="/admin/ai-models" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-secondary" activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}>
            <Cpu className="size-4" /> AI Models
          </Link>
          <Link to="/admin/emergency" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-destructive hover:bg-destructive/10" activeProps={{ className: "bg-destructive/10 font-semibold" }}>
            <AlertTriangle className="size-4" /> طوارئ
          </Link>
          <Link to="/admin/caches" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-secondary" activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}>
            <Database className="size-4" /> الكاش
          </Link>
          <Link to="/admin/share-events" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-secondary" activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}>
            <Share2 className="size-4" /> المشاركات
          </Link>
          <Link to="/admin/referrals" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-secondary" activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}>
            <Gift className="size-4" /> إحالات
          </Link>
          <Link to="/admin/gallery" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-secondary" activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}>
            <ImageIcon className="size-4" /> المعرض
          </Link>
          <Link to="/admin/testimonials" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-secondary" activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}>
            <MessageSquareQuote className="size-4" /> شهادات
          </Link>
          <Link to="/admin/audit" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:bg-secondary" activeProps={{ className: "bg-primary/10 text-primary font-semibold" }}>
            <ScrollText className="size-4" /> التدقيق
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
