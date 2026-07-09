import { createServerFn } from "@tanstack/react-start";

async function admin() {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function auditAdmin(action: string, targetId: string, after?: unknown) {
  const s = await admin();
  try {
    await s.from("audit_log").insert({
      actor_type: "admin",
      actor_id: "admin",
      action,
      target_type: "video_order",
      target_id: targetId,
      after: (after ?? null) as never,
    });
  } catch { /* ignore */ }
}

// -------- Products --------
export const adminListVideoProducts = createServerFn({ method: "GET" }).handler(async () => {
  const s = await admin();
  const { data } = await s.from("video_products").select("*").order("display_order", { ascending: true });
  return data ?? [];
});

export const adminUpdateVideoProduct = createServerFn({ method: "POST" })
  .inputValidator((input: {
    id: string;
    name_ar?: string;
    description_ar?: string | null;
    duration_sec?: number;
    price_iqd?: number;
    daily_cap?: number;
    enabled?: boolean;
    display_order?: number;
  }) => input)
  .handler(async ({ data }) => {
    const s = await admin();
    const { id, ...patch } = data;
    const { error } = await s.from("video_products").update(patch).eq("id", id);
    if (error) throw error;
    await auditAdmin("video_product_updated", id, patch);
    return { ok: true };
  });

// -------- Orders --------
export const adminListVideoOrders = createServerFn({ method: "GET" })
  .inputValidator((input: { status?: string } | undefined) => input ?? {})
  .handler(async ({ data }) => {
    const s = await admin();
    let q = s
      .from("video_orders")
      .select("id, user_id, story_order_id, product_id, status, price_iqd, ai_credits_used, ai_cost_iqd, is_public, share_token, final_url, created_at, approved_at, completed_at, rejection_reason")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows } = await q;
    return rows ?? [];
  });

export const adminGetVideoOrder = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const s = await admin();
    const { data: row } = await s.from("video_orders").select("*").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("غير موجود");
    return row;
  });

export const adminApproveVideo = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; note?: string }) => input)
  .handler(async ({ data }) => {
    const s = await admin();
    // Check daily cap
    const today = new Date().toISOString().slice(0, 10);
    const { data: stats } = await s.from("video_daily_stats").select("count").eq("day", today).maybeSingle();
    const cap = 30;
    if ((stats?.count ?? 0) >= cap) throw new Error(`تم بلوغ السقف اليومي (${cap} فيديو).`);

    const { error } = await s
      .from("video_orders")
      .update({ status: "approved", approved_at: new Date().toISOString(), admin_note: data.note ?? null })
      .eq("id", data.id);
    if (error) throw error;

    // Bump daily stats
    await s.from("video_daily_stats").upsert({ day: today, count: (stats?.count ?? 0) + 1 }, { onConflict: "day" });
    await auditAdmin("video_order_approved", data.id);
    return { ok: true };
  });

export const adminRejectVideo = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; reason: string }) => input)
  .handler(async ({ data }) => {
    const s = await admin();
    const { error } = await s
      .from("video_orders")
      .update({ status: "rejected", rejection_reason: data.reason })
      .eq("id", data.id);
    if (error) throw error;
    await auditAdmin("video_order_rejected", data.id, { reason: data.reason });
    return { ok: true };
  });

export const adminMarkVideoReady = createServerFn({ method: "POST" })
  .inputValidator((input: {
    id: string;
    final_url: string;
    poster_url?: string | null;
    duration_sec?: number;
    ai_credits_used?: number;
    ai_cost_iqd?: number;
  }) => input)
  .handler(async ({ data }) => {
    const s = await admin();
    const { error } = await s
      .from("video_orders")
      .update({
        status: "ready",
        final_url: data.final_url,
        poster_url: data.poster_url ?? null,
        duration_sec: data.duration_sec ?? null,
        ai_credits_used: data.ai_credits_used ?? 0,
        ai_cost_iqd: data.ai_cost_iqd ?? 0,
        completed_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw error;
    await auditAdmin("video_order_ready", data.id);
    return { ok: true };
  });

// -------- Storyboard generation (text AI) --------
export const adminGenerateStoryboard = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const s = await admin();
    const { data: vo } = await s.from("video_orders").select("*").eq("id", data.id).maybeSingle();
    if (!vo) throw new Error("غير موجود");
    const { data: story } = await s.from("orders").select("id, story_text, image_style").eq("id", vo.story_order_id).maybeSingle();
    if (!story) throw new Error("القصة غير موجودة");

    const { callChat } = await import("./ai-gateway.server");
    const { data: product } = await s.from("video_products").select("*").eq("id", vo.product_id).maybeSingle();

    const prompt = `أنت مخرج فيديو للأطفال. أنشئ storyboard قصير للفيديو التالي:
- نوع الفيديو: ${product?.name_ar ?? vo.product_id} (المدة المطلوبة: ${product?.duration_sec ?? 30} ثانية)
- نص القصة: ${(story as { story_text?: string }).story_text?.slice(0, 2000) ?? ""}

أخرج JSON بهذا الشكل بالضبط:
{
  "scenes": [
    { "n": 1, "duration_sec": 5, "visual": "وصف مشهد بصري بالإنجليزية للـ AI", "narration_ar": "نص السرد بالعربية" }
  ],
  "music_prompt": "وصف الموسيقى المناسبة بالإنجليزية"
}`;

    const r = await callChat({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    let storyboard: unknown;
    try { storyboard = JSON.parse(r.content); }
    catch { throw new Error("فشل توليد الـ storyboard"); }

    await s.from("video_orders").update({ storyboard: storyboard as never }).eq("id", data.id);
    await auditAdmin("video_storyboard_generated", data.id);
    return { storyboard };
  });

// -------- Daily stats --------
export const adminGetVideoStats = createServerFn({ method: "GET" }).handler(async () => {
  const s = await admin();
  const today = new Date().toISOString().slice(0, 10);
  const { data: todayRow } = await s.from("video_daily_stats").select("*").eq("day", today).maybeSingle();
  const { data: recent } = await s.from("video_daily_stats").select("*").order("day", { ascending: false }).limit(14);
  const { data: pending } = await s.from("video_orders").select("id").eq("status", "pending_review");
  const { data: generating } = await s.from("video_orders").select("id").in("status", ["approved", "generating"]);
  return {
    today: todayRow ?? { day: today, count: 0, total_credits: 0 },
    recent: recent ?? [],
    pending_count: pending?.length ?? 0,
    working_count: generating?.length ?? 0,
  };
});
