// Server-only AI Orchestrator.
// Central entry point for every AI task. Handles:
// - Priority-ordered fallback across models from `ai_models_config`
// - Emergency kill switch (`emergency_controls`)
// - Per-call timeout, retry with exponential backoff + jitter
// - Circuit breaker (5 consecutive failures -> open 60s -> half_open probe)
// - Full event logging (`ai_model_events`) + health snapshots (`ai_model_health`)
// - Cost + latency tracking
//
// Backward compatible: if no rows exist for a task_type, callers fall back
// to their previous direct model calls (fail-open).

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  callChat,
  callImage,
  estimateImageCostUsd,
  estimateTextCostUsd,
  type GatewayMeta,
  type Usage,
} from "@/lib/ai-gateway.server";

const CIRCUIT_FAIL_THRESHOLD = 5;
const CIRCUIT_OPEN_MS = 60_000;

export type TaskType =
  | "story"
  | "polish"
  | "image_analysis"
  | "image_gen"
  | "image_gen_cover"
  | "character_sheet"
  | "story_qa"
  | "image_qa";

type TaskKind = "text" | "image";

const TASK_KIND: Record<TaskType, TaskKind> = {
  story: "text",
  polish: "text",
  image_analysis: "text",
  image_gen: "image",
  image_gen_cover: "image",
  character_sheet: "image",
  story_qa: "text",
  image_qa: "text",
};

export type EmergencyState = {
  ai_all_paused: boolean;
  ai_image_paused: boolean;
  ai_text_paused: boolean;
  qa_paused: boolean;
  reason: string | null;
};

export type ModelConfigRow = {
  id: string;
  task_type: string;
  model_id: string;
  priority: number;
  enabled: boolean;
  timeout_ms: number;
  max_retries: number;
  backoff_base_ms: number;
  temperature: number | null;
  top_p: number | null;
  top_k: number | null;
  max_tokens: number | null;
  prompt_version: string;
  params: Record<string, unknown>;
};

export type OrchestratorResult<T> = {
  result: T;
  model_used: string;
  attempts: number;
  total_latency_ms: number;
  total_cost_usd: number;
  degraded: boolean;
};

type Classification =
  | "success"
  | "timeout"
  | "rate_limit"
  | "quota"
  | "unavailable"
  | "failed";

function classify(err: unknown): Classification {
  if (err instanceof Error) {
    const msg = err.message ?? "";
    if (/aborted|timeout/i.test(msg)) return "timeout";
    const m = msg.match(/(\d{3})/);
    const status = m ? Number(m[1]) : 0;
    if (status === 429) return "rate_limit";
    if (status === 402 || /quota|billing|credit/i.test(msg)) return "quota";
    if (status === 503 || status === 500 || status === 408) return "unavailable";
  }
  return "failed";
}

function isRetryable(cls: Classification): boolean {
  return cls === "timeout" || cls === "rate_limit" || cls === "unavailable";
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

let _emergencyCache: { at: number; value: EmergencyState } | null = null;
export async function getEmergencyState(): Promise<EmergencyState> {
  if (_emergencyCache && Date.now() - _emergencyCache.at < 5_000) return _emergencyCache.value;
  try {
    const { data } = await supabaseAdmin
      .from("emergency_controls")
      // @ts-expect-error - table added in stage 0 migration, types regen pending
      .select("ai_all_paused, ai_image_paused, ai_text_paused, qa_paused, reason")
      .eq("id", true)
      .maybeSingle();
    const value: EmergencyState = {
      ai_all_paused: Boolean((data as any)?.ai_all_paused),
      ai_image_paused: Boolean((data as any)?.ai_image_paused),
      ai_text_paused: Boolean((data as any)?.ai_text_paused),
      qa_paused: Boolean((data as any)?.qa_paused),
      reason: (data as any)?.reason ?? null,
    };
    _emergencyCache = { at: Date.now(), value };
    return value;
  } catch {
    return { ai_all_paused: false, ai_image_paused: false, ai_text_paused: false, qa_paused: false, reason: null };
  }
}

function taskBlockedByEmergency(task: TaskType, e: EmergencyState): boolean {
  if (e.ai_all_paused) return true;
  const kind = TASK_KIND[task];
  if (kind === "image" && e.ai_image_paused) return true;
  if (kind === "text" && e.ai_text_paused) return true;
  if ((task === "story_qa" || task === "image_qa") && e.qa_paused) return true;
  return false;
}

async function loadCandidates(task: TaskType): Promise<ModelConfigRow[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("ai_models_config")
      .select("*")
      // @ts-expect-error - table added in stage 0 migration
      .eq("task_type", task)
      .eq("enabled", true)
      .order("priority", { ascending: true });
    if (error) return [];
    return (data as unknown as ModelConfigRow[]) ?? [];
  } catch {
    return [];
  }
}

async function loadHealth(task: TaskType): Promise<Map<string, { circuit_state: string; consecutive_failures: number; next_probe_at: string | null }>> {
  const map = new Map();
  try {
    const { data } = await supabaseAdmin
      .from("ai_model_health")
      .select("model_id, circuit_state, consecutive_failures, next_probe_at")
      // @ts-expect-error - table added in stage 0 migration
      .eq("task_type", task);
    for (const row of ((data as any) ?? [])) {
      map.set(row.model_id, {
        circuit_state: row.circuit_state,
        consecutive_failures: row.consecutive_failures,
        next_probe_at: row.next_probe_at,
      });
    }
  } catch {
    /* fail open */
  }
  return map;
}

function isCircuitOpen(h: { circuit_state: string; next_probe_at: string | null } | undefined): boolean {
  if (!h) return false;
  if (h.circuit_state === "open") {
    if (!h.next_probe_at) return true;
    return new Date(h.next_probe_at).getTime() > Date.now();
  }
  return false;
}

async function logEvent(row: {
  task_type: TaskType;
  model_id: string;
  attempt: number;
  status: string;
  error_code?: string | null;
  error_message?: string | null;
  latency_ms?: number | null;
  usage?: Usage;
  cost_usd?: number | null;
  order_id?: string | null;
  user_id?: string | null;
  prompt_version?: string | null;
}) {
  try {
    await supabaseAdmin.from("ai_model_events").insert({
      // @ts-expect-error - table added in stage 0 migration
      task_type: row.task_type,
      model_id: row.model_id,
      attempt: row.attempt,
      status: row.status,
      error_code: row.error_code ?? null,
      error_message: row.error_message ? String(row.error_message).slice(0, 500) : null,
      latency_ms: row.latency_ms ?? null,
      input_tokens: row.usage?.input_tokens ?? null,
      output_tokens: row.usage?.output_tokens ?? null,
      cost_usd: row.cost_usd ?? null,
      order_id: row.order_id ?? null,
      user_id: row.user_id ?? null,
      prompt_version: row.prompt_version ?? null,
    });
  } catch {
    /* logging must not break the caller */
  }
}

async function updateHealthOnSuccess(task: TaskType, model_id: string, latency_ms: number) {
  try {
    await supabaseAdmin.from("ai_model_health").upsert({
      // @ts-expect-error - table added in stage 0 migration
      task_type: task,
      model_id,
      is_healthy: true,
      circuit_state: "closed",
      consecutive_failures: 0,
      last_success_at: new Date().toISOString(),
      avg_latency_1h_ms: latency_ms,
      opened_at: null,
      next_probe_at: null,
      last_error: null,
    });
  } catch { /* ignore */ }
}

async function updateHealthOnFailure(task: TaskType, model_id: string, error_message: string) {
  try {
    // Read current failures atomically-ish; overshooting the threshold is fine.
    const { data } = await supabaseAdmin
      .from("ai_model_health")
      .select("consecutive_failures")
      // @ts-expect-error - table added in stage 0 migration
      .eq("task_type", task)
      .eq("model_id", model_id)
      .maybeSingle();
    const current = ((data as any)?.consecutive_failures ?? 0) + 1;
    const openCircuit = current >= CIRCUIT_FAIL_THRESHOLD;
    await supabaseAdmin.from("ai_model_health").upsert({
      // @ts-expect-error - table added in stage 0 migration
      task_type: task,
      model_id,
      is_healthy: !openCircuit,
      circuit_state: openCircuit ? "open" : "closed",
      consecutive_failures: current,
      last_failure_at: new Date().toISOString(),
      opened_at: openCircuit ? new Date().toISOString() : null,
      next_probe_at: openCircuit ? new Date(Date.now() + CIRCUIT_OPEN_MS).toISOString() : null,
      last_error: String(error_message).slice(0, 500),
    });
  } catch { /* ignore */ }
}

async function runOnce<T>(
  model_id: string,
  timeout_ms: number,
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(new Error(`timeout ${timeout_ms}ms`)), timeout_ms);
  try {
    return await fn(ctl.signal);
  } finally {
    clearTimeout(timer);
  }
}

export type RunOpts = {
  task: TaskType;
  orderId?: string | null;
  userId?: string | null;
};

// -------- TEXT runner --------
export async function runTextTask(
  opts: RunOpts,
  build: (cfg: ModelConfigRow) => { messages: Parameters<typeof callChat>[0]["messages"]; response_format?: unknown },
): Promise<OrchestratorResult<{ content: string; meta: GatewayMeta }>> {
  const emergency = await getEmergencyState();
  if (taskBlockedByEmergency(opts.task, emergency)) {
    throw new Error(`AI paused (${opts.task}): ${emergency.reason ?? "emergency"}`);
  }
  const candidates = await loadCandidates(opts.task);
  const health = await loadHealth(opts.task);
  if (candidates.length === 0) throw new Error(`no models configured for task ${opts.task}`);

  const startedAll = Date.now();
  let attempts = 0;
  let totalCost = 0;
  let lastErr: unknown = null;

  for (let i = 0; i < candidates.length; i++) {
    const cfg = candidates[i];
    if (isCircuitOpen(health.get(cfg.model_id))) {
      await logEvent({
        task_type: opts.task, model_id: cfg.model_id, attempt: 0,
        status: "circuit_open", order_id: opts.orderId, user_id: opts.userId,
      });
      continue;
    }
    for (let attempt = 0; attempt <= cfg.max_retries; attempt++) {
      attempts++;
      const started = Date.now();
      try {
        const { messages, response_format } = build(cfg);
        const result = await runOnce(cfg.model_id, cfg.timeout_ms, async () =>
          callChat({ model: cfg.model_id, messages, response_format }),
        );
        const latency = Date.now() - started;
        const cost = estimateTextCostUsd(cfg.model_id, result.meta.usage);
        totalCost += cost;
        await logEvent({
          task_type: opts.task, model_id: cfg.model_id, attempt: attempt + 1,
          status: "success", latency_ms: latency, usage: result.meta.usage, cost_usd: cost,
          order_id: opts.orderId, user_id: opts.userId, prompt_version: cfg.prompt_version,
        });
        await updateHealthOnSuccess(opts.task, cfg.model_id, latency);
        return {
          result, model_used: cfg.model_id, attempts,
          total_latency_ms: Date.now() - startedAll, total_cost_usd: totalCost,
          degraded: i > 0,
        };
      } catch (err) {
        const cls = classify(err);
        const latency = Date.now() - started;
        lastErr = err;
        await logEvent({
          task_type: opts.task, model_id: cfg.model_id, attempt: attempt + 1,
          status: cls, latency_ms: latency,
          error_message: err instanceof Error ? err.message : String(err),
          order_id: opts.orderId, user_id: opts.userId, prompt_version: cfg.prompt_version,
        });
        await updateHealthOnFailure(opts.task, cfg.model_id, err instanceof Error ? err.message : String(err));
        if (!isRetryable(cls) || attempt >= cfg.max_retries) break; // move to next model
        const backoff = cfg.backoff_base_ms * Math.pow(2, attempt) + Math.random() * 250;
        await sleep(backoff);
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`all models failed for ${opts.task}`);
}

// -------- IMAGE runner --------
export async function runImageTask(
  opts: RunOpts,
  build: (cfg: ModelConfigRow) => { prompt: string; referenceImages?: string[] },
): Promise<OrchestratorResult<{ b64: string; meta: GatewayMeta }>> {
  const emergency = await getEmergencyState();
  if (taskBlockedByEmergency(opts.task, emergency)) {
    throw new Error(`AI paused (${opts.task}): ${emergency.reason ?? "emergency"}`);
  }
  const candidates = await loadCandidates(opts.task);
  const health = await loadHealth(opts.task);
  if (candidates.length === 0) throw new Error(`no models configured for task ${opts.task}`);

  const startedAll = Date.now();
  let attempts = 0;
  let totalCost = 0;
  let lastErr: unknown = null;

  for (let i = 0; i < candidates.length; i++) {
    const cfg = candidates[i];
    if (isCircuitOpen(health.get(cfg.model_id))) {
      await logEvent({
        task_type: opts.task, model_id: cfg.model_id, attempt: 0,
        status: "circuit_open", order_id: opts.orderId, user_id: opts.userId,
      });
      continue;
    }
    for (let attempt = 0; attempt <= cfg.max_retries; attempt++) {
      attempts++;
      const started = Date.now();
      try {
        const { prompt, referenceImages } = build(cfg);
        const result = await runOnce(cfg.model_id, cfg.timeout_ms, async () =>
          callImage({ model: cfg.model_id, prompt, referenceImages }),
        );
        const latency = Date.now() - started;
        const cost = estimateImageCostUsd(cfg.model_id, 1);
        totalCost += cost;
        await logEvent({
          task_type: opts.task, model_id: cfg.model_id, attempt: attempt + 1,
          status: "success", latency_ms: latency, cost_usd: cost,
          order_id: opts.orderId, user_id: opts.userId, prompt_version: cfg.prompt_version,
        });
        await updateHealthOnSuccess(opts.task, cfg.model_id, latency);
        return {
          result, model_used: cfg.model_id, attempts,
          total_latency_ms: Date.now() - startedAll, total_cost_usd: totalCost,
          degraded: i > 0,
        };
      } catch (err) {
        const cls = classify(err);
        const latency = Date.now() - started;
        lastErr = err;
        await logEvent({
          task_type: opts.task, model_id: cfg.model_id, attempt: attempt + 1,
          status: cls, latency_ms: latency,
          error_message: err instanceof Error ? err.message : String(err),
          order_id: opts.orderId, user_id: opts.userId, prompt_version: cfg.prompt_version,
        });
        await updateHealthOnFailure(opts.task, cfg.model_id, err instanceof Error ? err.message : String(err));
        if (!isRetryable(cls) || attempt >= cfg.max_retries) break;
        const backoff = cfg.backoff_base_ms * Math.pow(2, attempt) + Math.random() * 250;
        await sleep(backoff);
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`all image models failed for ${opts.task}`);
}
