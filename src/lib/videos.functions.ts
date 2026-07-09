import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// -------- Public catalog --------
export const listVideoProducts = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: flag } = await supabaseAdmin
    .from("feature_flags")
    .select("enabled")
    .eq("key", "video_generation_enabled")
    .maybeSingle();
  if (!flag?.enabled) return { enabled: false as const, products: [] };
  const { data } = await supabaseAdmin
    .from("video_products")
    .select("*")
    .eq("enabled", true)
    .order("display_order", { ascending: true });
  return { enabled: true as const, products: data ?? [] };
});

// -------- User: create request --------
export const createVideoOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { storyOrderId: string; productId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verify feature enabled
    const { data: flag } = await supabaseAdmin
      .from("feature_flags").select("enabled").eq("key", "video_generation_enabled").maybeSingle();
    if (!flag?.enabled) throw new Error("ميزة الفيديو معطّلة حالياً");

    // Verify product
    const { data: product } = await supabaseAdmin
      .from("video_products").select("*").eq("id", data.productId).eq("enabled", true).maybeSingle();
    if (!product) throw new Error("نوع الفيديو غير متاح");

    // Verify user owns the story order
    const { data: story } = await supabaseAdmin
      .from("orders").select("id, user_id, status")
      .eq("id", data.storyOrderId).maybeSingle();
    if (!story || story.user_id !== context.userId) throw new Error("القصة غير موجودة");
    if (story.status !== "delivered") throw new Error("لا يمكن طلب فيديو إلا لقصة مُسلَّمة");

    // Check daily cap
    const today = new Date().toISOString().slice(0, 10);
    const { data: statsRow } = await supabaseAdmin
      .from("video_daily_stats").select("count").eq("day", today).maybeSingle();
    const globalCap = 30; // global safety cap
    if ((statsRow?.count ?? 0) >= globalCap) {
      throw new Error("تم بلوغ السقف اليومي العام. حاول غداً.");
    }

    const { data: created, error } = await supabaseAdmin
      .from("video_orders")
      .insert({
        user_id: context.userId,
        story_order_id: data.storyOrderId,
        product_id: data.productId,
        price_iqd: product.price_iqd,
        status: "pending_review",
      })
      .select("id")
      .single();
    if (error) throw error;

    await supabaseAdmin.from("audit_log").insert({
      action: "video_order_created",
      target_type: "video_order",
      target_id: created.id,
      user_id: context.userId,
      meta: { product_id: data.productId, story_order_id: data.storyOrderId },
    });

    return { id: created.id };
  });

// -------- User: list my videos --------
export const getMyVideos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("video_orders")
      .select("id, product_id, status, final_url, poster_url, duration_sec, price_iqd, is_public, share_token, created_at, story_order_id, rejection_reason")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const getMyVideo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("video_orders").select("*").eq("id", data.id).maybeSingle();
    if (!row || row.user_id !== context.userId) throw new Error("غير موجود");
    return row;
  });

// -------- User: publish/unpublish to gallery --------
export const publishMyVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; isPublic: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("video_orders").select("user_id, status, share_token")
      .eq("id", data.id).maybeSingle();
    if (!row || row.user_id !== context.userId) throw new Error("غير موجود");
    if (row.status !== "ready") throw new Error("لا يمكن النشر إلا بعد إتمام التوليد");

    let token = row.share_token;
    if (data.isPublic && !token) {
      token = `v_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
    }
    await supabaseAdmin
      .from("video_orders")
      .update({ is_public: data.isPublic, share_token: token })
      .eq("id", data.id);
    return { share_token: token };
  });

// -------- Public: view shared video --------
export const getPublicVideo = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("video_orders")
      .select("id, product_id, final_url, poster_url, duration_sec, story_order_id")
      .eq("share_token", data.token)
      .eq("is_public", true)
      .eq("status", "ready")
      .maybeSingle();
    if (!row) throw new Error("الفيديو غير متاح");
    return row;
  });
