import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Loader2, XCircle } from "lucide-react";
import { adminConsumeMagicLink } from "../lib/admin.functions";

export const Route = createFileRoute("/admin/magic/$token")({
  head: () => ({ meta: [{ title: "دخول الإدارة" }, { name: "robots", content: "noindex" }] }),
  component: MagicConsumePage,
});

function MagicConsumePage() {
  const { token } = Route.useParams();
  const consume = useServerFn(adminConsumeMagicLink);
  const router = useRouter();
  const navigate = useNavigate();
  const [state, setState] = useState<
    | { s: "loading" }
    | { s: "ok" }
    | { s: "error"; reason: string }
  >({ s: "loading" });
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    (async () => {
      try {
        const r = await consume({ data: { token } });
        if (r.ok) {
          setState({ s: "ok" });
          await router.invalidate();
          await navigate({ to: "/admin", replace: true });
        } else {
          const map: Record<string, string> = {
            expired: "انتهت صلاحية الرابط. اطلب رابطاً جديداً.",
            used: "استُخدم هذا الرابط سابقاً. اطلب رابطاً جديداً.",
            invalid: "الرابط غير صالح.",
          };
          setState({ s: "error", reason: map[r.reason] ?? "تعذّر إتمام الدخول." });
        }
      } catch {
        setState({ s: "error", reason: "تعذّر الاتصال بالخادم." });
      }
    })();
  }, [consume, token, router, navigate]);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center px-4">
      <div className="w-full rounded-2xl border bg-card p-8 text-center shadow-warm">
        {state.s === "loading" && (
          <>
            <Loader2 className="mx-auto mb-3 size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">جارٍ التحقق من رابط الدخول…</p>
          </>
        )}
        {state.s === "ok" && (
          <>
            <Loader2 className="mx-auto mb-3 size-8 animate-spin text-primary" />
            <p className="text-sm">تم الدخول بنجاح، جارٍ التحويل…</p>
          </>
        )}
        {state.s === "error" && (
          <>
            <XCircle className="mx-auto mb-3 size-10 text-destructive" />
            <h1 className="mb-2 text-lg font-bold text-destructive">تعذّر الدخول</h1>
            <p className="mb-4 text-sm text-muted-foreground">{state.reason}</p>
            <a
              href="/admin/login"
              className="inline-block rounded-xl bg-gradient-to-br from-primary to-accent px-4 py-2.5 text-sm font-bold text-primary-foreground"
            >
              طلب رابط جديد
            </a>
          </>
        )}
      </div>
    </div>
  );
}
