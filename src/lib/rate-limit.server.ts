// Server-only fixed-window rate limiter backed by `rate_limits`.
// Fail-open: on any DB error we permit the request.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function checkRateLimit(args: {
  bucket: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
}): Promise<{ allowed: boolean; count: number; limit: number; resetAt: Date }> {
  const now = Date.now();
  const window_start = new Date(Math.floor(now / (args.windowSeconds * 1000)) * args.windowSeconds * 1000);
  const resetAt = new Date(window_start.getTime() + args.windowSeconds * 1000);
  try {
    // Insert row if missing, ignore conflict.
    await supabaseAdmin.from("rate_limits").upsert(
      { bucket: args.bucket, identifier: args.identifier, window_start: window_start.toISOString(), count: 0 },
      { onConflict: "bucket,identifier,window_start", ignoreDuplicates: true },
    );
    // Read current
    const { data } = await supabaseAdmin
      .from("rate_limits")
      .select("count")
      .eq("bucket", args.bucket)
      .eq("identifier", args.identifier)
      .eq("window_start", window_start.toISOString())
      .maybeSingle();
    const current = ((data as any)?.count ?? 0) as number;
    if (current >= args.limit) return { allowed: false, count: current, limit: args.limit, resetAt };
    // Increment
    await supabaseAdmin
      .from("rate_limits")
      .update({ count: current + 1 })
      .eq("bucket", args.bucket)
      .eq("identifier", args.identifier)
      .eq("window_start", window_start.toISOString());
    return { allowed: true, count: current + 1, limit: args.limit, resetAt };
  } catch {
    return { allowed: true, count: 0, limit: args.limit, resetAt };
  }
}
