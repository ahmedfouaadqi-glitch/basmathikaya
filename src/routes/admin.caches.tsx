import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cacheStats, purgeExpiredCache } from "../lib/admin-ops.functions";

export const Route = createFileRoute("/admin/caches")({ component: CachesPage });

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function CachesPage() {
  const qc = useQueryClient();
  const statsFn = useServerFn(cacheStats);
  const purgeFn = useServerFn(purgeExpiredCache);
  const q = useQuery({ queryKey: ["admin-caches"], queryFn: () => statsFn(), refetchInterval: 60_000 });
  const purge = useMutation({
    mutationFn: () => purgeFn(),
    onSuccess: (r) => { toast.success(`حُذف ${r.prompt + r.character} صفوف`); qc.invalidateQueries({ queryKey: ["admin-caches"] }); },
  });
  const d = q.data;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">إحصاءات الكاش</h1>
        <button
          disabled={purge.isPending}
          onClick={() => { if (confirm("حذف كل الصفوف المنتهية؟")) purge.mutate(); }}
          className="rounded-md border px-4 py-2 text-sm hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
        >
          حذف المنتهية
        </button>
      </div>

      <h2 className="mb-2 text-lg font-semibold">Prompt Cache (نصوص)</h2>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="عدد الصفوف" value={d?.prompt.total ?? "…"} />
        <Stat label="منتهية" value={d?.prompt.expired ?? "…"} />
        <Stat label="إجمالي الوصلات" value={d?.prompt.totalHits ?? "…"} />
        <Stat label="توفير $" value={d?.prompt.savedUsd?.toFixed(2) ?? "…"} />
      </div>

      <h2 className="mb-2 text-lg font-semibold">Character Analysis Cache (صور)</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="عدد الصفوف" value={d?.character.total ?? "…"} />
        <Stat label="منتهية" value={d?.character.expired ?? "…"} />
        <Stat label="إجمالي الوصلات" value={d?.character.totalHits ?? "…"} />
        <Stat label="توفير $" value={d?.character.savedUsd?.toFixed(2) ?? "…"} />
      </div>
    </div>
  );
}
