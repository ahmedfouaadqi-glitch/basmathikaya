import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  adminListReviewQueue,
  adminApproveOrder,
  adminRejectOrder,
  adminRequestIdentity,
} from "@/lib/content-screening.functions";
import { ShieldAlert, Check, X, Fingerprint } from "lucide-react";

export const Route = createFileRoute("/admin/review-queue")({
  component: ReviewQueuePage,
  head: () => ({
    meta: [{ title: "قائمة المراجعة الإدارية" }],
  }),
});

function ReviewQueuePage() {
  const list = useServerFn(adminListReviewQueue);
  const approve = useServerFn(adminApproveOrder);
  const reject = useServerFn(adminRejectOrder);
  const requestId = useServerFn(adminRequestIdentity);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "review-queue"],
    queryFn: () => list(),
  });

  const mApprove = useMutation({
    mutationFn: (orderId: string) => approve({ data: { orderId } }),
    onSuccess: () => { toast.success("تمت الموافقة"); qc.invalidateQueries({ queryKey: ["admin", "review-queue"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mReject = useMutation({
    mutationFn: (p: { orderId: string; reason: string }) => reject({ data: p }),
    onSuccess: () => { toast.success("تم الرفض"); qc.invalidateQueries({ queryKey: ["admin", "review-queue"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mId = useMutation({
    mutationFn: (orderId: string) => requestId({ data: { orderId } }),
    onSuccess: () => { toast.success("تم طلب التوثيق"); qc.invalidateQueries({ queryKey: ["admin", "review-queue"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldAlert className="size-5 text-primary" />
        <h1 className="text-xl font-bold">قائمة المراجعة</h1>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{data?.length ?? 0}</span>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>
      ) : !data || data.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
          لا توجد طلبات بحاجة للمراجعة حالياً.
        </div>
      ) : (
        <div className="grid gap-3">
          {data.map((o: any) => (
            <ReviewCard
              key={o.id}
              order={o}
              onApprove={() => mApprove.mutate(o.id)}
              onReject={(reason) => mReject.mutate({ orderId: o.id, reason })}
              onRequestId={() => mId.mutate(o.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type QueueRow = Awaited<ReturnType<typeof adminListReviewQueue>>[number];

function ReviewCard({
  order,
  onApprove,
  onReject,
  onRequestId,
}: {
  order: QueueRow;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onRequestId: () => void;
}) {
  const [reason, setReason] = useState("");
  const flags = (order.content_flags as string[] | null) ?? [];
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm">#{order.order_number}</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{order.status}</span>
          {order.age_bucket && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              {order.age_bucket}
            </span>
          )}
          {order.identity_verification_status && order.identity_verification_status !== "not_required" && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-700">
              توثيق: {order.identity_verification_status}
            </span>
          )}
          {order.content_mode === "adult" && (
            <span className="rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-xs text-fuchsia-700">
              +18 · {order.adult_content_level}
            </span>
          )}
          {order.real_person_declared && (
            <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-xs text-orange-700">
              شخصية حقيقية · {order.consent_status}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString("ar-IQ")}</span>
      </div>

      {flags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {flags.map((f, i) => (
            <span key={i} className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">{f}</span>
          ))}
        </div>
      )}

      <div className="mb-2 text-sm">
        <strong>الأمزجة:</strong> {(order.moods as string[] | null)?.join("، ") || "—"}
      </div>
      {order.custom_instructions && (
        <div className="mb-2 rounded-md bg-secondary/50 p-2 text-sm">
          <strong>ملاحظات المستخدم:</strong> {order.custom_instructions}
        </div>
      )}
      {order.characters.length > 0 && (
        <ul className="mb-3 space-y-1 text-sm">
          {order.characters.map((c: any, i: number) => (
            <li key={i} className="text-muted-foreground">
              • {c.name} {c.age ? `(${c.age})` : ""} {c.description ? `— ${c.description}` : ""}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onApprove} className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700">
          <Check className="size-4" /> موافقة
        </button>
        <button onClick={onRequestId} className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-secondary">
          <Fingerprint className="size-4" /> طلب توثيق هوية
        </button>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="سبب الرفض…"
          className="flex-1 min-w-40 rounded-md border bg-background px-2 py-1.5 text-sm"
        />
        <button
          onClick={() => {
            if (!reason.trim()) return toast.error("اكتب سبب الرفض");
            onReject(reason.trim());
          }}
          className="inline-flex items-center gap-1 rounded-md bg-destructive px-3 py-1.5 text-sm text-white hover:opacity-90"
        >
          <X className="size-4" /> رفض
        </button>
      </div>
    </div>
  );
}
