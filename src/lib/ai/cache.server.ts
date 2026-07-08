// Server-only AI response cache.
// Fail-open: any DB error just skips caching — never blocks the caller.
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export function hashKey(...parts: Array<string | number | null | undefined>): string {
  const s = parts.map((p) => String(p ?? "")).join("\x1f");
  return createHash("sha256").update(s, "utf8").digest("hex").slice(0, 48);
}

export async function getCached<T = unknown>(
  cacheKey: string,
): Promise<T | null> {
  try {
    const { data } = await supabaseAdmin
      .from("prompt_cache")
      .select("response, expires_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (!data) return null;
    if (new Date((data as any).expires_at).getTime() < Date.now()) return null;
    // Best-effort hit counter (do not await).
    void supabaseAdmin
      .from("prompt_cache")
      .update({ hits: (undefined as unknown as number), last_hit_at: new Date().toISOString() })
      .eq("cache_key", cacheKey)
      .then(() => {}, () => {});
    return (data as any).response as T;
  } catch {
    return null;
  }
}

export async function setCached(args: {
  cacheKey: string;
  taskType: string;
  modelId: string;
  response: unknown;
  ttlSeconds: number;
  costUsd?: number;
}): Promise<void> {
  try {
    const expires_at = new Date(Date.now() + args.ttlSeconds * 1000).toISOString();
    await supabaseAdmin.from("prompt_cache").upsert(
      {
        cache_key: args.cacheKey,
        task_type: args.taskType,
        model_id: args.modelId,
        response: args.response as any,
        cost_saved_usd: args.costUsd ?? 0,
        expires_at,
      },
      { onConflict: "cache_key" },
    );
  } catch {
    /* ignore */
  }
}

export async function getCachedCharacterAnalysis(imageHash: string): Promise<{
  character_dna: unknown;
  model_id: string;
} | null> {
  try {
    const { data } = await supabaseAdmin
      .from("character_analysis_cache")
      .select("character_dna, model_id, expires_at")
      .eq("image_hash", imageHash)
      .maybeSingle();
    if (!data) return null;
    if (new Date((data as any).expires_at).getTime() < Date.now()) return null;
    return { character_dna: (data as any).character_dna, model_id: (data as any).model_id };
  } catch {
    return null;
  }
}

export async function setCachedCharacterAnalysis(args: {
  imageHash: string;
  characterDna: unknown;
  modelId: string;
  ttlSeconds?: number;
  costUsd?: number;
}): Promise<void> {
  try {
    const ttl = args.ttlSeconds ?? 60 * 60 * 24 * 30; // 30 days
    const expires_at = new Date(Date.now() + ttl * 1000).toISOString();
    await supabaseAdmin.from("character_analysis_cache").upsert(
      {
        cache_key: args.imageHash,
        image_hash: args.imageHash,
        character_dna: args.characterDna as any,
        model_id: args.modelId,
        cost_saved_usd: args.costUsd ?? 0,
        expires_at,
      },
      { onConflict: "cache_key" },
    );
  } catch {
    /* ignore */
  }
}
