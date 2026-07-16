import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ArrowRight } from "lucide-react";
import { adminRequestOtp, adminVerifyOtp } from "../lib/admin.functions";
import { brandLogoUrl } from "../lib/brand";

export const Route = createFileRoute("/admin/login")({
  head: () => ({ meta: [{ title: "دخول الإدارة" }, { name: "robots", content: "noindex" }] }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const requestOtp = useServerFn(adminRequestOtp);
  const verifyOtp = useServerFn(adminVerifyOtp);
  const navigate = useNavigate();
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [loading, setLoading] = useState(false);

  async function onRequest(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await requestOtp({ data: { phone: phone.trim() } });
      setStep("code");
      toast.success("إذا كان الرقم مسموحاً، تم إرسال رمز إلى البريد المسجّل.");
    } catch {
      toast.error("تعذّر إرسال الرمز");
    } finally {
      setLoading(false);
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await verifyOtp({ data: { phone: phone.trim(), code: code.trim() } });
      if (res.ok) {
        await router.invalidate();
        await navigate({ to: "/admin", replace: true });
      } else {
        toast.error("رمز غير صحيح أو منتهي الصلاحية");
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
            {step === "phone" ? "أدخل رقم هاتف المسؤول لإرسال رمز التحقق." : "أدخل الرمز المرسل إلى بريدك."}
          </p>
        </div>

        {step === "phone" ? (
          <form onSubmit={onRequest} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">رقم الهاتف</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07XXXXXXXXX"
                className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary"
                autoComplete="off"
                dir="ltr"
              />
            </div>
            <button
              type="submit"
              disabled={loading || phone.trim().length < 6}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-accent py-3 text-base font-bold text-primary-foreground shadow-warm disabled:opacity-60"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
              إرسال الرمز
            </button>
          </form>
        ) : (
          <form onSubmit={onVerify} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">الرمز (6 أرقام)</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary font-mono tracking-widest text-center"
                autoComplete="one-time-code"
                dir="ltr"
              />
            </div>
            <button
              type="submit"
              disabled={loading || code.trim().length !== 6}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-accent py-3 text-base font-bold text-primary-foreground shadow-warm disabled:opacity-60"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
              دخول
            </button>
            <button
              type="button"
              onClick={() => { setStep("phone"); setCode(""); }}
              className="w-full text-sm text-muted-foreground hover:text-foreground"
            >
              تغيير الرقم
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
