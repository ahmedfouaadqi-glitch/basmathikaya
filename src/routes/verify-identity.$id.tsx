import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { submitIdentityDocument, getMyReviewOrder } from "@/lib/content-screening.functions";
import { Fingerprint, ShieldCheck, Upload } from "lucide-react";

export const Route = createFileRoute("/verify-identity/$id")({
  component: VerifyIdentityPage,
  head: () => ({ meta: [{ title: "توثيق الهوية — بصمة حكاية" }] }),
});

function VerifyIdentityPage() {
  const { id } = Route.useParams();
  const getOrder = useServerFn(getMyReviewOrder);
  const submit = useServerFn(submitIdentityDocument);
  const [file, setFile] = useState<File | null>(null);

  const { data: order, refetch } = useQuery({
    queryKey: ["review-order", id],
    queryFn: () => getOrder({ data: { orderId: id } }),
  });

  const m = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("اختر ملفاً أولاً");
      const buf = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      return submit({ data: { orderId: id, fileName: file.name, base64, mimeType: file.type || "application/octet-stream" } });
    },
    onSuccess: () => { toast.success("تم رفع الوثيقة، ستراجعها الإدارة قريباً"); refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const status = order?.identity_verification_status;

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Fingerprint className="size-6 text-primary" />
        <h1 className="text-2xl font-bold">توثيق الهوية</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        طلبك #{order?.order_number ?? "—"} يحتاج توثيقاً للتحقق من العمر قبل توليد المحتوى.
        نطلب هذا احتراماً للخصوصية وضماناً لسلامة كل من على المنصة. الوثيقة تُحذف بعد المراجعة ولا تُشارك أبداً.
      </p>

      {status === "submitted" ? (
        <div className="rounded-2xl border bg-green-500/10 p-4 text-sm text-green-800">
          <ShieldCheck className="mb-2 size-5" />
          استلمنا وثيقتك، ستصلك رسالة عند اكتمال المراجعة.
        </div>
      ) : status === "approved" ? (
        <div className="rounded-2xl border bg-green-500/10 p-4 text-sm text-green-800">تم التحقق بنجاح ✓</div>
      ) : status === "rejected" ? (
        <div className="rounded-2xl border bg-destructive/10 p-4 text-sm">
          لم يتم قبول الوثيقة. السبب: {order?.admin_review_note ?? "—"}
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl border bg-card p-4">
          <label className="block cursor-pointer rounded-md border-2 border-dashed p-4 text-center text-sm hover:bg-secondary/50">
            <Upload className="mx-auto mb-2 size-6" />
            {file ? file.name : "اضغط لاختيار صورة أو PDF لبطاقتك الشخصية"}
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            disabled={!file || m.isPending}
            onClick={() => m.mutate()}
            className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          >
            {m.isPending ? "جارٍ الرفع…" : "رفع الوثيقة"}
          </button>
          <p className="text-xs text-muted-foreground">
            الحد الأقصى ~5MB. تُقبل أنواع: JPG, PNG, PDF.
          </p>
        </div>
      )}
    </div>
  );
}
