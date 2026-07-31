import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Phone, KeyRound, Mail } from "lucide-react";
import { useT } from "../lib/i18n";
import { requestOtp, verifyOtp, requestEmailOtp, verifyEmailOtp, getCurrentUser } from "../lib/auth.functions";
import { redeemReferralCode } from "../lib/referrals.functions";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
    ref: typeof s.ref === "string" ? s.ref : undefined,
  }),
  head: () => ({ meta: [{ title: "تسجيل دخول — بصمة حكاية" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const router = useRouter();
  const { redirect, ref } = Route.useSearch();
  const reqFn = useServerFn(requestOtp);
  const verFn = useServerFn(verifyOtp);
  const reqEmailFn = useServerFn(requestEmailOtp);
  const verEmailFn = useServerFn(verifyEmailOtp);
  const meFn = useServerFn(getCurrentUser);
  const redeemFn = useServerFn(redeemReferralCode);

  const [step, setStep] = useState<"request" | "verify">("request");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<"phone" | "email">("phone");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [referralCode, setReferralCode] = useState<string>(ref ?? "");

  useEffect(() => {
    // Also read from ?ref= or from localStorage stashed by index page
    if (!referralCode && typeof window !== "undefined") {
      const stored = localStorage.getItem("bh_ref");
      if (stored) setReferralCode(stored);
    }
  }, [referralCode]);

  async function onRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("اكتب اسمك");
    if (mode === "phone" && !phone.trim()) return toast.error("اكتب رقم الهاتف");
    if (mode === "email" && !email.trim()) return toast.error("اكتب البريد الإلكتروني");
    setLoading(true);
    try {
      const r =
        mode === "phone"
          ? await reqFn({ data: { full_name: name.trim(), phone: phone.trim() } })
          : await reqEmailFn({ data: { full_name: name.trim(), email: email.trim() } });
      if (r.dev_code) {
        setDevCode(r.dev_code);
        toast.success(`(وضع التطوير) رمزك: ${r.dev_code}`);
      } else {
        toast.success("تم إرسال رمز التحقق");
      }
      setStep("verify");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ");
    } finally {
      setLoading(false);
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    if (code.trim().length !== 6) return toast.error("الرمز 6 أرقام");
    setLoading(true);
    try {
      if (mode === "phone") {
        await verFn({ data: { phone: phone.trim(), code: code.trim(), full_name: name.trim() } });
      } else {
        await verEmailFn({ data: { email: email.trim(), code: code.trim(), full_name: name.trim() } });
      }
      // Confirm the session cookie was actually stored (some preview iframes
      // block cross-site cookies even with SameSite=None; Partitioned).
      const me = await meFn();
      if (!me) {
        toast.error("تعذّر حفظ الجلسة داخل هذا الإطار");
        setSignedIn(true);
        return;
      }
      toast.success("تم تسجيل الدخول");
      if (referralCode.trim()) {
        try { await redeemFn({ data: { code: referralCode.trim().toUpperCase() } }); } catch { /* ignore */ }
        if (typeof window !== "undefined") localStorage.removeItem("bh_ref");
      }
      await router.invalidate();
      if (redirect && redirect.startsWith("/preview")) {
        setSignedIn(true);
      } else {
        navigate({ to: redirect || "/create" });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ");
    } finally {
      setLoading(false);
    }
  }

  function openInTopTab() {
    const target = redirect || "/create";
    if (typeof window === "undefined") return;
    try {
      if (window.top && window.top !== window.self) {
        window.top.location.href = target;
        return;
      }
    } catch { /* cross-origin top; fallback below */ }
    window.open(target, "_blank", "noopener");
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-extrabold text-center">{t("auth_title")}</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">{t("auth_subtitle")}</p>

        {signedIn ? (
          <div className="mt-6 space-y-3">
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-center text-sm text-emerald-700 dark:text-emerald-400">
              تم تسجيل الدخول. إذا لم يتم الانتقال تلقائياً، افتح الرابط في تبويب جديد.
            </div>
            <button
              type="button"
              onClick={openInTopTab}
              className="w-full rounded-xl bg-gradient-to-br from-primary to-accent py-3 font-bold text-primary-foreground shadow-warm"
            >
              فتح {redirect || "/create"} في تبويب جديد
            </button>
          </div>
        ) : step === "request" ? (
          <form onSubmit={onRequest} className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-1 rounded-xl border bg-secondary/40 p-1 text-sm">
              <button
                type="button"
                onClick={() => setMode("phone")}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 font-medium transition ${mode === "phone" ? "bg-background shadow-sm text-primary" : "text-muted-foreground"}`}
              >
                <Phone className="size-4" /> رقم الهاتف
              </button>
              <button
                type="button"
                onClick={() => setMode("email")}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 font-medium transition ${mode === "email" ? "bg-background shadow-sm text-primary" : "text-muted-foreground"}`}
              >
                <Mail className="size-4" /> البريد الإلكتروني
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">{t("auth_full_name")}</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
            {mode === "phone" ? (
              <div>
                <label className="block text-sm font-medium mb-1.5">{t("auth_phone")}</label>
                <div className="relative">
                  <Phone className="size-4 absolute top-3 start-3 text-muted-foreground" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t("auth_phone_placeholder")}
                    className="w-full rounded-lg border bg-background ps-9 pe-3 py-2.5 outline-none focus:ring-2 focus:ring-primary"
                    dir="ltr"
                    required
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium mb-1.5">البريد الإلكتروني</label>
                <div className="relative">
                  <Mail className="size-4 absolute top-3 start-3 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full rounded-lg border bg-background ps-9 pe-3 py-2.5 outline-none focus:ring-2 focus:ring-primary"
                    dir="ltr"
                    required
                  />
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1.5">كود إحالة (اختياري)</label>
              <input
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                maxLength={20}
                dir="ltr"
                className="w-full rounded-lg border bg-background px-3 py-2.5 font-mono tracking-wider outline-none focus:ring-2 focus:ring-primary"
                placeholder="ABC12345"
              />
            </div>
            <button
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-accent py-3 font-bold text-primary-foreground shadow-warm disabled:opacity-60"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {t("auth_send_code")}
            </button>
          </form>
        ) : (
          <form onSubmit={onVerify} className="mt-6 space-y-4">
            <div className="text-center text-sm text-muted-foreground">
              {mode === "phone" ? t("auth_phone") : "البريد الإلكتروني"}:{" "}
              <span dir="ltr" className="font-mono">{mode === "phone" ? phone : email}</span>
            </div>
            {devCode && (
              <div className="rounded-lg border border-accent/40 bg-accent/10 p-3 text-center text-sm">
                (وضع التطوير) رمزك: <strong className="font-mono text-lg">{devCode}</strong>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1.5">{t("auth_code")}</label>
              <div className="relative">
                <KeyRound className="size-4 absolute top-3 start-3 text-muted-foreground" />
                <input
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full rounded-lg border bg-background ps-9 pe-3 py-2.5 font-mono text-lg tracking-widest text-center outline-none focus:ring-2 focus:ring-primary"
                  dir="ltr"
                  required
                />
              </div>
            </div>
            <button
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-accent py-3 font-bold text-primary-foreground shadow-warm disabled:opacity-60"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {t("auth_verify")}
            </button>
            <div className="flex justify-between text-xs">
              <button type="button" onClick={() => { setStep("request"); setCode(""); setDevCode(null); }} className="text-muted-foreground hover:text-foreground">
                {mode === "phone" ? t("auth_change_phone") : "تغيير البريد"}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  try {
                    const r =
                      mode === "phone"
                        ? await reqFn({ data: { full_name: name.trim(), phone: phone.trim() } })
                        : await reqEmailFn({ data: { full_name: name.trim(), email: email.trim() } });
                    if (r.dev_code) setDevCode(r.dev_code);
                    toast.success("تم الإرسال مجدداً");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "خطأ");
                  } finally {
                    setLoading(false);
                  }
                }}
                className="text-primary hover:underline"
              >
                {t("auth_resend")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
