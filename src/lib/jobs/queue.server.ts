// Server-only background job queue backed by `background_jobs`.
// Runners are registered here; the cron hook (/api/public/hooks/jobs-tick)
// calls `runPending()` up to a budget.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type JobKind =
  | "generate_share_cards"
  | "generate_pdf"
  | "send_notification"
  | "daily_backup_snapshot"
  | "cleanup_old_drafts";

type Runner = (payload: Record<string, unknown>, ctx: { jobId: string; orderId?: string | null; userId?: string | null }) => Promise<unknown>;

const REGISTRY = new Map<JobKind, Runner>();

export function registerJob(kind: JobKind, runner: Runner) {
  REGISTRY.set(kind, runner);
}

export async function enqueueJob(args: {
  kind: JobKind;
  payload?: Record<string, unknown>;
  priority?: number;
  maxAttempts?: number;
  orderId?: string | null;
  userId?: string | null;
  runAt?: Date;
}): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("background_jobs")
      .insert({
        kind: args.kind,
        payload: (args.payload ?? {}) as never,
        priority: args.priority ?? 100,
        max_attempts: args.maxAttempts ?? 3,
        next_run_at: (args.runAt ?? new Date()).toISOString(),
        order_id: args.orderId ?? null,
        user_id: args.userId ?? null,
      })
      .select("id")
      .maybeSingle();
    if (error) {
      console.warn("[jobs] enqueue failed:", error.message);
      return null;
    }
    return (data as any)?.id ?? null;
  } catch (e) {
    console.warn("[jobs] enqueue exception:", e);
    return null;
  }
}

async function claimNext(): Promise<null | {
  id: string; kind: string; payload: Record<string, unknown>; attempts: number;
  max_attempts: number; order_id: string | null; user_id: string | null;
}> {
  // Pick oldest pending row that's due; update status to running.
  // Without RPC-level SKIP LOCKED this is best-effort; concurrent workers may collide
  // but the update filter (status='pending') keeps only one winner.
  const { data: candidates } = await supabaseAdmin
    .from("background_jobs")
    .select("id, kind, payload, attempts, max_attempts, order_id, user_id")
    .eq("status", "pending")
    .lte("next_run_at", new Date().toISOString())
    .order("priority", { ascending: true })
    .order("next_run_at", { ascending: true })
    .limit(1);
  const row = (candidates as any)?.[0];
  if (!row) return null;
  const { data: claimed } = await supabaseAdmin
    .from("background_jobs")
    .update({ status: "running", started_at: new Date().toISOString(), attempts: row.attempts + 1 })
    .eq("id", row.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (!(claimed as any)?.id) return null; // lost the race
  return row;
}

async function markSucceeded(id: string, result: unknown) {
  await supabaseAdmin.from("background_jobs").update({
    status: "succeeded",
    finished_at: new Date().toISOString(),
    result: (result ?? null) as never,
    last_error: null,
  }).eq("id", id);
}

async function markFailedOrRetry(id: string, attempts: number, max: number, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  if (attempts >= max) {
    await supabaseAdmin.from("background_jobs").update({
      status: "dead",
      finished_at: new Date().toISOString(),
      last_error: message.slice(0, 500),
    }).eq("id", id);
  } else {
    const backoffMs = Math.min(60_000 * Math.pow(2, attempts - 1), 30 * 60_000);
    await supabaseAdmin.from("background_jobs").update({
      status: "pending",
      started_at: null,
      last_error: message.slice(0, 500),
      next_run_at: new Date(Date.now() + backoffMs).toISOString(),
    }).eq("id", id);
  }
}

export async function runPending(budget: { maxJobs: number; maxMs: number }): Promise<{ processed: number; succeeded: number; failed: number }> {
  const started = Date.now();
  let processed = 0, succeeded = 0, failed = 0;
  while (processed < budget.maxJobs && Date.now() - started < budget.maxMs) {
    const row = await claimNext();
    if (!row) break;
    processed++;
    const runner = REGISTRY.get(row.kind as JobKind);
    if (!runner) {
      await markFailedOrRetry(row.id, row.attempts + 1, row.max_attempts, new Error(`no runner registered for kind: ${row.kind}`));
      failed++;
      continue;
    }
    try {
      const result = await runner(row.payload, { jobId: row.id, orderId: row.order_id, userId: row.user_id });
      await markSucceeded(row.id, result);
      succeeded++;
    } catch (err) {
      await markFailedOrRetry(row.id, row.attempts + 1, row.max_attempts, err);
      failed++;
    }
  }
  return { processed, succeeded, failed };
}
