import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail, ShieldCheck, ArrowRight } from "lucide-react";
import { adminRequestOtp, adminVerifyOtp } from "../lib/admin.functions";
import { brandLogoUrl } from "../lib/brand";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../components/ui/input-otp";

export const Route = createFileRoute("/admin/login")({
  head: () => ({ meta: [{ title: "دخول الإدارة" }, { name: "robots", content: "noindex" }] }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const requestOtp = useServerFn(adminRequestOtp);
  const verifyOtp = useServerFn(adminVerifyOtp);
  const navigate = useNavigate();
  const router = useRouter();

  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [remaining, setRemaining] = useState(0); // seconds until code expires
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  function startCountdown() {
    setRemaining(5 * 60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { if (timerRef.current) clearInterval(timerRef.current); return 0; }
        return r - 1;
      });
    }, 1000);
  }

  async function onRequest(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      await requestOtp({ data: { phone: phone.trim() } });
      setStep("code");
      setCode("");
      startCountdown();
      toast.success("إن كان الرقم مخوّلاً، سيصلك الرمز إلى البريد الإلكتروني للإدارة.");
    } catch {
      toast.error("تعذّر إرسال الرمز، أعد المحاولة");
    } finally {
      setLoading(false);
    }
  }

  async function onVerify(submittedCode?: string) {
    const finalCode = (submittedCode ?? code).trim();
    if (!/^\d{6}$/.test(finalCode)) return;
    setErrorMsg(null);
    setVerifying(true);
    try {
      const res = await verifyOtp({ data: { phone: phone.trim(), code: finalCode } });
      if (res.ok) {
        await router.invalidate();
        await navigate({ to: "/admin", replace: true });
      } else {
        const map: Record<string, string> = {
          expired: "انتهت صلاحية الرمز. اطلب رمزاً جديداً.",
          used: "استُخدم هذا الرمز سابقاً.",
          locked: "تم تجاوز عدد المحاولات. اطلب رمزاً جديداً.",
          invalid: "الرمز غير صحيح.",
        };
        setErrorMsg(map[res.reason] ?? "تعذّر التحقق من الرمز.");
        setCode("");
      }
    } catch {
      setErrorMsg("تعذّر الاتصال بالخادم.");
    } finally {
      setVerifying(false);
    }
  }

  async function onResend() {
    setCode("");
    await onRequest(new Event("submit") as unknown as React.FormEvent);
  }

  const mm = Math.floor(remaining / 60).toString().padStart(2, "0");
  const ss = (remaining % 60).toString().padStart(2, "0");

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4">
      <div className="w-full rounded-2xl border bg-card p-8 shadow-warm">
        <div className="mb-6 text-center">
          <div className="mx-auto inline-flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-background shadow-sm ring-1 ring-border">
            <img src={brandLogoUrl} alt="بصمة حكاية" className="h-16 w-16 object-contain" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold">دخول الإدارة</h1>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            {step === "phone"
              ? "أدخل رقم هاتف المسؤول، وسنُرسل رمز دخول لمرة واحدة إلى بريد الإدارة."
              : "أدخل الرمز المكوّن من 6 أرقام الذي أُرسل إلى بريد الإدارة."}
          </p>
        </div>

        {step === "phone" ? (
          <form onSubmit={onRequest}>
            <label className="block text-sm font-medium mb-2">رقم الهاتف</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07XXXXXXXXX"
              className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary mb-6"
              autoComplete="off"
              dir="ltr"
            />
            <button
              type="submit"
              disabled={loading || phone.trim().length < 6}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-accent py-3 text-base font-bold text-primary-foreground shadow-warm disabled:opacity-60"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
              دخول
            </button>
          </form>
        ) : (
          <div>
            <div className="mb-4 flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
              <Mail className="size-4 text-primary" />
              <span className="text-muted-foreground">تم إرسال الرمز إلى بريد الإدارة</span>
            </div>

            <div className="mb-4 flex justify-center" dir="ltr">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(v) => {
                  setCode(v);
                  if (v.length === 6) onVerify(v);
                }}
                disabled={verifying}
              >
                <InputOTPGroup>
                  {[0,1,2,3,4,5].map((i) => (
                    <InputOTPSlot key={i} index={i} className="h-12 w-11 text-lg font-bold" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            {errorMsg && (
              <p className="mb-3 text-center text-sm text-destructive">{errorMsg}</p>
            )}

            <div className="mb-4 text-center text-xs text-muted-foreground">
              {remaining > 0 ? (
                <>الرمز صالح لـ <span className="font-mono">{mm}:{ss}</span></>
              ) : (
                <>انتهت صلاحية الرمز.</>
              )}
            </div>

            <button
              type="button"
              onClick={() => onVerify()}
              disabled={verifying || code.length !== 6}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-accent py-3 text-base font-bold text-primary-foreground shadow-warm disabled:opacity-60"
            >
              {verifying ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              تحقق ودخول
            </button>

            <div className="mt-4 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => { setStep("phone"); setCode(""); setErrorMsg(null); }}
                className="text-muted-foreground underline"
              >
                تغيير رقم الهاتف
              </button>
              <button
                type="button"
                onClick={onResend}
                disabled={loading || remaining > 4 * 60} // allow resend after ~1 min
                className="text-primary underline disabled:opacity-40"
              >
                إعادة إرسال الرمز
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
