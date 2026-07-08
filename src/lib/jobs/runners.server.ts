// Central registration of background job runners.
// Each runner is fail-open: an error only fails its own job, never leaks upstream.
import { registerJob } from "./queue.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { randomBytes } from "node:crypto";

function makeToken(): string {
  return randomBytes(16).toString("base64url");
}

// cleanup_old_drafts: remove pending unpaid orders older than 30 days.
registerJob("cleanup_old_drafts", async () => {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("orders")
    .delete()
    .lt("created_at", cutoff)
    .in("status", ["pending"])
    .select("id");
  if (error) throw error;
  return { deleted: (data as any[] | null)?.length ?? 0 };
});

// send_notification: insert one row into `notifications`.
registerJob("send_notification", async (payload, ctx) => {
  const user_id = String((payload as any).user_id ?? ctx.userId ?? "");
  if (!user_id) return { skipped: true, reason: "missing user_id" };
  const row = {
    user_id,
    title: String((payload as any).title ?? ""),
    body: String((payload as any).body ?? ""),
    type: String((payload as any).type ?? "general"),
    order_id: ctx.orderId ?? null,
    read_at: null,
  } as Record<string, unknown>;
  const { error } = await supabaseAdmin.from("notifications").insert(row as never);
  if (error) throw error;
  return { ok: true };
});

// generate_pdf: placeholder that only flips status. Real render stays on the
// existing path; this job is used later by lazy_pdf_generation.
registerJob("generate_pdf", async (_payload, ctx) => {
  if (!ctx.orderId) return { skipped: true, reason: "no order_id" };
  await supabaseAdmin
    .from("orders")
    .update({ pdf_generation_status: "ready" } as never)
    .eq("id", ctx.orderId);
  return { ok: true };
});

// generate_share_cards: ensure share_token + insert a placeholder card row.
// Full Satori rendering lands in Stage 6.
registerJob("generate_share_cards", async (_payload, ctx) => {
  if (!ctx.orderId) return { skipped: true, reason: "no order_id" };
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, share_token")
    .eq("id", ctx.orderId)
    .maybeSingle();
  if (!order) return { skipped: true, reason: "order not found" };
  let token = (order as any).share_token as string | null;
  if (!token) {
    token = makeToken();
    await supabaseAdmin.from("orders").update({ share_token: token } as never).eq("id", ctx.orderId);
  }
  // Placeholder card entry so admin dashboards see a row; real image URLs land in Stage 6.
  await supabaseAdmin.from("share_cards").upsert(
    {
      order_id: ctx.orderId,
      share_token: token,
      aspect: "og",
      image_path: null,
    } as never,
    { onConflict: "order_id,aspect" },
  );
  return { ok: true, share_token: token };
});

// daily_backup_snapshot: log a marker; real backup handled by hosting.
registerJob("daily_backup_snapshot", async () => {
  return { ok: true, note: "backup handled by hosting provider" };
});

export {};
