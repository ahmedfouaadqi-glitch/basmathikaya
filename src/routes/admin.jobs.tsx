import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { listJobs, retryJob, cancelJob } from "../lib/admin-ops.functions";

export const Route = createFileRoute("/admin/jobs")({ component: JobsPage });

type Job = {
  id: string; kind: string; status: string; priority: number;
  attempts: number; max_attempts: number;
  next_run_at: string | null; started_at: string | null; finished_at: string | null;
  last_error: string | null; order_id: string | null; created_at: string;
};

const STATUSES = ["", "pending", "running", "success", "failed", "cancelled"];

function JobsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const listFn = useServerFn(listJobs);
  const retryFn = useServerFn(retryJob);
  const cancelFn = useServerFn(cancelJob);
  const q = useQuery({
    queryKey: ["admin-jobs", status],
    queryFn: () => listFn({ data: { status: status || undefined, limit: 100 } }),
    refetchInterval: 10_000,
  });
  const inv = () => qc.invalidateQueries({ queryKey: ["admin-jobs"] });
  const retry = useMutation({ mutationFn: (id: string) => retryFn({ data: { id } }), onSuccess: () => { toast.success("Retry queued"); inv(); } });
  const cancel = useMutation({ mutationFn: (id: string) => cancelFn({ data: { id } }), onSuccess: () => { toast.success("Cancelled"); inv(); } });
  const rows = (q.data ?? []) as Job[];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Background Jobs</h1>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border bg-background px-3 py-1.5 text-sm">
          {STATUSES.map((s) => <option key={s} value={s}>{s || "الكل"}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-xs">
            <tr>
              <th className="p-2 text-start">النوع</th><th className="p-2">الحالة</th>
              <th className="p-2">محاولات</th><th className="p-2">تالي</th>
              <th className="p-2 text-start">خطأ</th><th className="p-2">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((j) => (
              <tr key={j.id} className="border-t">
                <td className="p-2 font-mono text-xs">{j.kind}</td>
                <td className="p-2 text-center">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${j.status === "success" ? "bg-primary/15 text-primary" : j.status === "failed" ? "bg-destructive/15 text-destructive" : "bg-secondary"}`}>
                    {j.status}
                  </span>
                </td>
                <td className="p-2 text-center text-xs">{j.attempts}/{j.max_attempts}</td>
                <td className="p-2 text-center text-xs">{j.next_run_at ? new Date(j.next_run_at).toLocaleTimeString() : "—"}</td>
                <td className="p-2 text-xs text-destructive truncate max-w-[200px]" title={j.last_error ?? ""}>{j.last_error?.slice(0, 60) ?? "—"}</td>
                <td className="p-2 text-center">
                  <div className="inline-flex gap-1">
                    {j.status === "failed" && (
                      <button onClick={() => retry.mutate(j.id)} className="rounded border px-2 py-0.5 text-xs hover:bg-secondary">إعادة</button>
                    )}
                    {j.status === "pending" && (
                      <button onClick={() => cancel.mutate(j.id)} className="rounded border px-2 py-0.5 text-xs hover:bg-destructive/10 text-destructive">إلغاء</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
