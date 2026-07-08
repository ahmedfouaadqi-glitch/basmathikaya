import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listAiModels, toggleAiModel } from "../lib/admin-ops.functions";

export const Route = createFileRoute("/admin/ai-models")({ component: AiModelsPage });

type Config = { id: string; task_type: string; model_id: string; priority: number; enabled: boolean; notes: string | null };
type Health = { task_type: string; model_id: string; is_healthy: boolean; circuit_state: string; consecutive_failures: number; failure_rate_1h: number | null; avg_latency_1h_ms: number | null; last_error: string | null };

function AiModelsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAiModels);
  const upFn = useServerFn(toggleAiModel);
  const q = useQuery({ queryKey: ["admin-ai-models"], queryFn: () => listFn(), refetchInterval: 15_000 });
  const inv = () => qc.invalidateQueries({ queryKey: ["admin-ai-models"] });
  const toggle = useMutation({
    mutationFn: (v: { id: string; enabled?: boolean; priority?: number }) => upFn({ data: v }),
    onSuccess: () => { toast.success("تم"); inv(); },
  });
  const config = (q.data?.config ?? []) as Config[];
  const healthList = (q.data?.health ?? []) as Health[];
  const healthMap = new Map(healthList.map((h) => [`${h.task_type}::${h.model_id}`, h]));

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">AI Models</h1>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-xs">
            <tr>
              <th className="p-2 text-start">المهمة</th><th className="p-2 text-start">النموذج</th>
              <th className="p-2">أولوية</th><th className="p-2">مفعّل</th>
              <th className="p-2">صحّي</th><th className="p-2">إخفاق %</th><th className="p-2">زمن ms</th>
            </tr>
          </thead>
          <tbody>
            {config.map((c) => {
              const h = healthMap.get(`${c.task_type}::${c.model_id}`);
              return (
                <tr key={c.id} className="border-t">
                  <td className="p-2 text-xs">{c.task_type}</td>
                  <td className="p-2 font-mono text-xs">{c.model_id}</td>
                  <td className="p-2 text-center">
                    <input type="number" min={0} max={100} defaultValue={c.priority} className="w-16 rounded border bg-background px-2 py-1 text-xs"
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== c.priority) toggle.mutate({ id: c.id, priority: v });
                      }} />
                  </td>
                  <td className="p-2 text-center">
                    <input type="checkbox" checked={c.enabled}
                      onChange={(e) => toggle.mutate({ id: c.id, enabled: e.target.checked })} />
                  </td>
                  <td className="p-2 text-center">
                    {h ? (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${h.is_healthy ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}>
                        {h.circuit_state}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="p-2 text-center text-xs">{h?.failure_rate_1h != null ? `${(Number(h.failure_rate_1h) * 100).toFixed(1)}%` : "—"}</td>
                  <td className="p-2 text-center text-xs">{h?.avg_latency_1h_ms ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
