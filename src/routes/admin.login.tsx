import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ArrowRight } from "lucide-react";
import { adminLogin } from "../lib/admin.functions";
import { brandLogoUrl } from "../lib/brand";

export const Route = createFileRoute("/admin/login")({
  head: () => ({ meta: [{ title: "دخول الإدارة" }, { name: "robots", content: "noindex" }] }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const login = useServerFn(adminLogin);
  const navigate = useNavigate();
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await login({ data: { phone: phone.trim(), code: code.trim() } });
      if (res.ok) {
        await router.invalidate();
        await navigate({ to: "/admin", replace: true });
      } else {
        toast.error("بيانات دخول غير صحيحة");
      }
    } catch {
      toast.error("تعذّر تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4">
      <div className="w-full rounded-2xl border bg-card p-8 shadow-warm">
        <div className="mb-6 text-center">
          <div className="mx-auto inline-flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-background shadow-sm ring-1 ring-border">
            <img src={brandLogoUrl} alt="بصمة حكاية" className="h-16 w-16 object-contain" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold">دخول الإدارة</h1>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            أدخل رقم هاتف المسؤول والرمز السري.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">رقم الهاتف</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07XXXXXXXXX"
              className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary"
              autoComplete="username"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">الرمز السري</label>
            <input
              type="password"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary font-mono tracking-widest text-center"
              autoComplete="current-password"
              dir="ltr"
            />
          </div>
          <button
            type="submit"
            disabled={loading || phone.trim().length < 6 || code.trim().length < 4}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-accent py-3 text-base font-bold text-primary-foreground shadow-warm disabled:opacity-60"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
            دخول
          </button>
        </form>
      </div>
    </div>
  );
}
