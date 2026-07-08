// Server-only business_config reader with 60s cache.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Row = { category: string; key: string; value: unknown };

let cache: { at: number; map: Map<string, unknown> } | null = null;
const TTL_MS = 60_000;

async function loadAll(): Promise<Map<string, unknown>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.map;
  const map = new Map<string, unknown>();
  try {
    const { data } = await supabaseAdmin
      .from("business_config")
      .select("category, key, value");
    for (const row of ((data as unknown as Row[]) ?? [])) {
      map.set(`${row.category}.${row.key}`, row.value);
    }
  } catch { /* fail open */ }
  cache = { at: Date.now(), map };
  return map;
}

export async function getConfig<T = unknown>(category: string, key: string, fallback: T): Promise<T> {
  const map = await loadAll();
  const v = map.get(`${category}.${key}`);
  return (v === undefined ? fallback : (v as T));
}

export async function getCategory(category: string): Promise<Record<string, unknown>> {
  const map = await loadAll();
  const out: Record<string, unknown> = {};
  const prefix = `${category}.`;
  for (const [k, v] of map.entries()) {
    if (k.startsWith(prefix)) out[k.slice(prefix.length)] = v;
  }
  return out;
}

export function invalidateBusinessConfigCache() {
  cache = null;
}
