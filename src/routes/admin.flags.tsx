import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listFlags, updateFlag } from "../lib/admin-ops.functions";

export const Route = createFileRoute("/admin/flags")({ component: FlagsPage });

type Flag = {
  key: string; enabled: boolean; rollout_percent: number; audience: string | null;
  description: string | null; owner: string | null; updated_at: string;
};

function FlagsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listFlags);
  const upFn = useServerFn(updateFlag);
  const q = useQuery({ queryKey: ["admin-flags"], queryFn: () => listFn() });
  const inv = () => qc.invalidateQueries({ queryKey: ["admin-flags"] });
  const toggle = useMutation({
    mutationFn: (v: { key: string; enabled: boolean }) => upFn({ data: v }),
    onSuccess: () => { toast.success("تم"); inv(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "خطأ"),
  });
  const rollout = useMutation({
    mutationFn: (v: { key: string; rollout_percent: number }) => upFn({ data: v }),
    onSuccess: inv,
  });
  const rows = (q.data ?? []) as Flag[];

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Feature Flags</h1>
      <p className="mb-4 text-sm text-muted-foreground">تحكم في المزايا الجديدة قبل نشرها للجميع.</p>
      {q.isLoading ? <div className="p-6 text-muted-foreground">…</div> : (
        <div className="space-y-2">
          {rows.map((f) => (
            <div key={f.key} className="rounded-xl border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-sm font-bold">{f.key}</code>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${f.enabled ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
                      {f.enabled ? "فعّال" : "معطّل"}
                    </span>
                  </div>
                  {f.description && <p className="mt-1 text-xs text-muted-foreground">{f.description}</p>}
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <label className="text-muted-foreground">التوزيع %</label>
                    <input
                      type="number" min={0} max={100} defaultValue={f.rollout_percent}
                      className="w-20 rounded border bg-background px-2 py-1"
                      onBlur={(e) => {
                        const v = Math.max(0, Math.min(100, Number(e.target.value)));
                        if (v !== f.rollout_percent) rollout.mutate({ key: f.key, rollout_percent: v });
                      }}
                    />
                    {f.owner && <span className="text-muted-foreground">· {f.owner}</span>}
                  </div>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs">
                  <input
                    type="checkbox" checked={f.enabled}
                    onChange={(e) => toggle.mutate({ key: f.key, enabled: e.target.checked })}
                  />
                  <span>تفعيل</span>
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
