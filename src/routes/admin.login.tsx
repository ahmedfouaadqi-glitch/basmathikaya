import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { adminLogin } from "../lib/admin.functions";
import { useT } from "../lib/i18n";
import { brandLogoUrl } from "../lib/brand";

export const Route = createFileRoute("/admin/login")({
  head: () => ({ meta: [{ title: "دخول الإدارة" }, { name: "robots", content: "noindex" }] }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const { t } = useT();
  const router = useRouter();
  const navigate = useNavigate();
  const login = useServerFn(adminLogin);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await login({ data: { phone: phone.trim(), code: code.trim() } });
      if (!r.ok) {
        toast.error(t("admin_login_err"));
        setLoading(false);
        return;
      }
      await router.invalidate();
      await navigate({ to: "/admin", replace: true });
    } catch {
      toast.error(t("admin_login_err"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4">
      <form onSubmit={onSubmit} className="w-full rounded-2xl border bg-card p-8 shadow-warm">
        <div className="mb-6 text-center">
          <div className="mx-auto inline-flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-background shadow-sm ring-1 ring-border">
            <img src={brandLogoUrl} alt="بصمة حكاية" className="h-16 w-16 object-contain" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold">{t("admin_login_title")}</h1>
        </div>
        <label className="block text-sm font-medium mb-2">{t("admin_phone")}</label>
        <input
          type="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary mb-4"
          autoComplete="off"
          dir="ltr"
        />
        <label className="block text-sm font-medium mb-2">{t("admin_code")}</label>
        <input
          type="password"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary mb-6"
          autoComplete="current-password"
          dir="ltr"
        />
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-accent py-3 text-base font-bold text-primary-foreground shadow-warm disabled:opacity-60"
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          {t("admin_login_btn")}
        </button>
      </form>
    </div>
  );
}
