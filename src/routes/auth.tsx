import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Phone, KeyRound } from "lucide-react";
import { useT } from "../lib/i18n";
import { requestOtp, verifyOtp } from "../lib/auth.functions";
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
  const { redirect } = Route.useSearch();
  const reqFn = useServerFn(requestOtp);
  const verFn = useServerFn(verifyOtp);

  const [step, setStep] = useState<"request" | "verify">("request");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  async function onRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return toast.error("املأ الاسم ورقم الهاتف");
    setLoading(true);
    try {
      const r = await reqFn({ data: { full_name: name.trim(), phone: phone.trim() } });
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
      await verFn({ data: { phone: phone.trim(), code: code.trim(), full_name: name.trim() } });
      toast.success("تم تسجيل الدخول");
      await router.invalidate();
      // When the login was triggered from the preview page, stay on /auth
      // and let the user return manually instead of auto-redirecting.
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

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-extrabold text-center">{t("auth_title")}</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">{t("auth_subtitle")}</p>

        {signedIn ? (
          <div className="mt-6 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-center text-sm text-emerald-700 dark:text-emerald-400">
            تم تسجيل الدخول بنجاح. يمكنك الآن العودة إلى صفحة معاينة طلبك.
          </div>
        ) : step === "request" ? (
          <form onSubmit={onRequest} className="mt-6 space-y-4">
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
              {t("auth_phone")}: <span dir="ltr" className="font-mono">{phone}</span>
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
                {t("auth_change_phone")}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  try {
                    const r = await reqFn({ data: { full_name: name.trim(), phone: phone.trim() } });
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
