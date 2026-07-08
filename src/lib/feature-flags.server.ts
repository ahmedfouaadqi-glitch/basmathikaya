// Server-only Feature Flags helper. Reads `feature_flags` with a 60s cache.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Flag = {
  key: string;
  enabled: boolean;
  rollout_percent: number;
  audience: string;
  user_ids: string[];
};

let cache: { at: number; map: Map<string, Flag> } | null = null;
const TTL_MS = 60_000;

async function loadAll(): Promise<Map<string, Flag>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.map;
  const map = new Map<string, Flag>();
  try {
    const { data } = await supabaseAdmin
      .from("feature_flags")
      .select("key, enabled, rollout_percent, audience, user_ids");
    for (const row of ((data as unknown as Flag[]) ?? [])) map.set(row.key, row);
  } catch { /* fail open */ }
  cache = { at: Date.now(), map };
  return map;
}

// Deterministic 0..99 bucket from a string.
function bucket(key: string, salt: string): number {
  let h = 5381;
  const s = `${salt}:${key}`;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 100;
}

export async function isFeatureEnabled(
  key: string,
  ctx: { userId?: string | null; isAdmin?: boolean } = {},
): Promise<boolean> {
  const map = await loadAll();
  const flag = map.get(key);
  if (!flag) return false;          // unknown flag => off
  if (!flag.enabled) return false;
  const uid = ctx.userId ?? null;
  if (flag.audience === "admins") return Boolean(ctx.isAdmin);
  if (flag.audience === "user_list") return Boolean(uid && flag.user_ids.includes(uid));
  // 'all' or 'new_users' — treat new_users same as all for now (no signup-date wiring yet)
  if (flag.rollout_percent >= 100) return true;
  if (flag.rollout_percent <= 0) return false;
  const b = bucket(key, uid ?? "anon");
  return b < flag.rollout_percent;
}

export function invalidateFeatureFlagsCache() {
  cache = null;
}
