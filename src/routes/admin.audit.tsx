import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listAudit } from "../lib/admin-ops.functions";

export const Route = createFileRoute("/admin/audit")({ component: AuditPage });

type Row = {
  id: string; actor_type: string; actor_id: string | null; action: string;
  target_type: string | null; target_id: string | null; created_at: string;
  before: unknown; after: unknown;
};

function AuditPage() {
  const listFn = useServerFn(listAudit);
  const [action, setAction] = useState("");
  const [page, setPage] = useState(0);
  const q = useQuery({
    queryKey: ["admin-audit", action, page],
    queryFn: () => listFn({ data: { action: action || undefined, limit: 50, offset: page * 50 } }),
  });
  const rows = (q.data ?? []) as Row[];

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">سجل التدقيق</h1>
      <div className="mb-3 flex items-center gap-2">
        <input value={action} onChange={(e) => { setAction(e.target.value); setPage(0); }}
          placeholder="ابحث في الإجراء…"
          className="w-64 rounded-md border bg-background px-3 py-1.5 text-sm" />
        <div className="ms-auto flex items-center gap-2 text-sm">
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
            className="rounded border px-3 py-1 disabled:opacity-40">←</button>
          <span className="text-muted-foreground">صفحة {page + 1}</span>
          <button onClick={() => setPage(page + 1)} disabled={rows.length < 50}
            className="rounded border px-3 py-1 disabled:opacity-40">→</button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-xs">
          <thead className="bg-secondary/50">
            <tr>
              <th className="p-2 text-start">الوقت</th><th className="p-2 text-start">Actor</th>
              <th className="p-2 text-start">Action</th><th className="p-2 text-start">Target</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString("ar")}</td>
                <td className="p-2">{r.actor_type}/{r.actor_id ?? "—"}</td>
                <td className="p-2 font-mono">{r.action}</td>
                <td className="p-2 font-mono">{r.target_type}/{r.target_id ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
