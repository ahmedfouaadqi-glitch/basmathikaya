import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { listRedownloads, approveRedownload, rejectRedownload } from "../lib/admin-ops.functions";

export const Route = createFileRoute("/admin/redownloads")({ component: RedownloadsPage });

type Row = {
  id: string; amount_iqd: number; status: string; requested_at: string;
  orders?: { order_number: number; title: string | null; customer_phone: string | null } | null;
};

function RedownloadsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("pending");
  const listFn = useServerFn(listRedownloads);
  const okFn = useServerFn(approveRedownload);
  const noFn = useServerFn(rejectRedownload);
  const q = useQuery({ queryKey: ["admin-redownloads", status], queryFn: () => listFn({ data: { status } }), refetchInterval: 20_000 });
  const inv = () => qc.invalidateQueries({ queryKey: ["admin-redownloads"] });
  const ok = useMutation({ mutationFn: (id: string) => okFn({ data: { id } }), onSuccess: () => { toast.success("تمت الموافقة"); inv(); } });
  const no = useMutation({
    mutationFn: (v: { id: string; reason?: string }) => noFn({ data: v }),
    onSuccess: () => { toast.success("تم الرفض"); inv(); },
  });
  const rows = (q.data ?? []) as Row[];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">طلبات إعادة التحميل</h1>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border bg-background px-3 py-1.5 text-sm">
          <option value="pending">قيد الانتظار</option>
          <option value="paid">مُوافَق</option>
          <option value="rejected">مرفوض</option>
        </select>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-xs">
            <tr>
              <th className="p-2">#</th><th className="p-2 text-start">القصة</th>
              <th className="p-2">الهاتف</th><th className="p-2">المبلغ</th>
              <th className="p-2">الوقت</th><th className="p-2">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2 text-center font-mono text-xs">{r.orders?.order_number ?? "—"}</td>
                <td className="p-2 text-xs">{r.orders?.title ?? "—"}</td>
                <td className="p-2 text-center font-mono text-xs">{r.orders?.customer_phone ?? "—"}</td>
                <td className="p-2 text-center text-xs">{Number(r.amount_iqd).toLocaleString()}</td>
                <td className="p-2 text-center text-xs">{new Date(r.requested_at).toLocaleString("ar")}</td>
                <td className="p-2 text-center">
                  {r.status === "pending" && (
                    <div className="inline-flex gap-1">
                      <button onClick={() => ok.mutate(r.id)} className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground">وافق</button>
                      <button onClick={() => {
                        const reason = prompt("سبب الرفض؟") ?? undefined;
                        no.mutate({ id: r.id, reason });
                      }} className="rounded border border-destructive text-destructive px-2 py-1 text-xs">ارفض</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
