// Poll background_jobs for a given order_id (client-side).
// Returns latest job per kind. Fail-open: any error yields empty state.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type JobStatus = {
  kind: string;
  status: string;
  attempts: number;
  last_error: string | null;
  started_at: string | null;
  finished_at: string | null;
};

async function fetchJobsForOrder(orderId: string): Promise<JobStatus[]> {
  const { data, error } = await supabase
    .from("background_jobs")
    .select("kind, status, attempts, last_error, started_at, finished_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return [];
  // Reduce to latest row per kind.
  const seen = new Set<string>();
  const latest: JobStatus[] = [];
  for (const row of (data as unknown as JobStatus[]) ?? []) {
    if (seen.has(row.kind)) continue;
    seen.add(row.kind);
    latest.push(row);
  }
  return latest;
}

export function useJobStatus(orderId: string | null | undefined, opts?: { intervalMs?: number }) {
  return useQuery({
    queryKey: ["job-status", orderId],
    queryFn: () => fetchJobsForOrder(orderId as string),
    enabled: Boolean(orderId),
    refetchInterval: opts?.intervalMs ?? 3000,
    staleTime: 1500,
  });
}
