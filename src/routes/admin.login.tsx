import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, MessageCircle } from "lucide-react";
import { adminRequestMagicLink } from "../lib/admin.functions";
import { brandLogoUrl } from "../lib/brand";

export const Route = createFileRoute("/admin/login")({
  head: () => ({ meta: [{ title: "دخول الإدارة" }, { name: "robots", content: "noindex" }] }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const requestLink = useServerFn(adminRequestMagicLink);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await requestLink({ data: { phone: phone.trim() } });
      setSent(true);
    } catch {
      toast.error("تعذّر إرسال الرابط، أعد المحاولة");
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
            أدخل رقم هاتفك وسنُرسل لك رابط دخول لمرة واحدة عبر واتساب.
          </p>
        </div>

        {sent ? (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-center">
            <MessageCircle className="mx-auto mb-2 size-8 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
              إن كان الرقم مخوّلاً، فقد أُرسل رابط الدخول إلى واتساب.
            </p>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              افتح الرابط من هاتفك خلال 10 دقائق. الرابط لمرة واحدة فقط، وأي محاولة إعادة استعمال ستفشل تلقائياً.
            </p>
            <button
              type="button"
              onClick={() => { setSent(false); setPhone(""); }}
              className="mt-4 text-xs underline text-muted-foreground"
            >
              استخدام رقم آخر
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit}>
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
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-accent py-3 text-base font-bold text-primary-foreground shadow-warm disabled:opacity-60"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
              أرسل لي رابط الدخول عبر واتساب
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
