// Server-only audit logger.
// Writes to `audit_log` with a computed shallow diff between before/after.
// Fail-open: never throws so it can wrap any admin action.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

export type AuditActor = { type: "admin" | "user" | "system"; id?: string | null };

function shallowDiff(before: unknown, after: unknown): Record<string, { from: unknown; to: unknown }> | null {
  if (!before || !after || typeof before !== "object" || typeof after !== "object") {
    if (before === after) return null;
    return { _root: { from: before, to: after } };
  }
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  const keys = new Set([...Object.keys(before as object), ...Object.keys(after as object)]);
  for (const k of keys) {
    const a = (before as Record<string, unknown>)[k];
    const b = (after as Record<string, unknown>)[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) diff[k] = { from: a, to: b };
  }
  return Object.keys(diff).length ? diff : null;
}

export async function logAudit(args: {
  actor: AuditActor;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  before?: unknown;
  after?: unknown;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    let ip: string | null = null;
    let ua: string | null = null;
    try {
      ip = getRequestIP({ xForwardedFor: true }) ?? null;
      ua = getRequestHeader("user-agent") ?? null;
    } catch { /* not in a request context */ }
    const diff = args.before !== undefined && args.after !== undefined
      ? shallowDiff(args.before, args.after)
      : null;
    await supabaseAdmin.from("audit_log").insert({
      actor_type: args.actor.type,
      actor_id: args.actor.id ?? null,
      action: args.action,
      target_type: args.target_type ?? null,
      target_id: args.target_id ?? null,
      before: (args.before as never) ?? null,
      after: (args.after as never) ?? null,
      diff: (diff as never) ?? null,
      ip,
      user_agent: ua,
      meta: (args.meta as never) ?? {},
    });
  } catch (e) {
    console.warn("[audit] failed:", e);
  }
}
