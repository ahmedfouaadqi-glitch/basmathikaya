// Admin operational server functions. All require admin session.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function requireAdminSession() {
  const { requireAdmin } = await import("./admin-session.server");
  return requireAdmin();
}

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function audit(action: string, target_type: string, target_id: string | null, before?: unknown, after?: unknown) {
  try {
    const s = await db();
    await s.from("audit_log").insert({
      actor_type: "admin",
      actor_id: "admin",
      action,
      target_type,
      target_id,
      before: (before ?? null) as never,
      after: (after ?? null) as never,
    });
  } catch { /* ignore */ }
}

/* ============= Feature Flags ============= */

export const listFlags = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminSession();
  const s = await db();
  const { data, error } = await s.from("feature_flags").select("*").order("key");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const updateFlag = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    key: z.string(),
    enabled: z.boolean().optional(),
    rollout_percent: z.number().int().min(0).max(100).optional(),
    audience: z.string().optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    await requireAdminSession();
    const s = await db();
    const patch: Record<string, unknown> = {};
    if (data.enabled !== undefined) patch.enabled = data.enabled;
    if (data.rollout_percent !== undefined) patch.rollout_percent = data.rollout_percent;
    if (data.audience !== undefined) patch.audience = data.audience;
    const { error } = await s.from("feature_flags").update(patch as never).eq("key", data.key);
    if (error) throw new Error(error.message);
    await audit("flag.update", "feature_flag", data.key, null, patch);
    return { ok: true as const };
  });

/* ============= Background Jobs ============= */

export const listJobs = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({
    status: z.string().optional(),
    kind: z.string().optional(),
    limit: z.number().int().min(1).max(500).default(100),
  }).parse(d ?? {}))
  .handler(async ({ data }) => {
    await requireAdminSession();
    const s = await db();
    let q = s.from("background_jobs").select("*").order("created_at", { ascending: false }).limit(data.limit);
    if (data.status) q = q.eq("status", data.status);
    if (data.kind) q = q.eq("kind", data.kind);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const retryJob = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdminSession();
    const s = await db();
    const { error } = await s.from("background_jobs").update({
      status: "pending",
      next_run_at: new Date().toISOString(),
      attempts: 0,
      last_error: null,
    } as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit("job.retry", "background_job", data.id);
    return { ok: true as const };
  });

export const cancelJob = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdminSession();
    const s = await db();
    const { error } = await s.from("background_jobs").update({ status: "cancelled" } as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit("job.cancel", "background_job", data.id);
    return { ok: true as const };
  });

/* ============= AI Models ============= */

export const listAiModels = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminSession();
  const s = await db();
  const [{ data: cfg }, { data: health }] = await Promise.all([
    s.from("ai_models_config").select("*").order("task_type").order("priority"),
    s.from("ai_model_health").select("*"),
  ]);
  return { config: cfg ?? [], health: health ?? [] };
});

export const toggleAiModel = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    enabled: z.boolean().optional(),
    priority: z.number().int().min(0).max(100).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    await requireAdminSession();
    const s = await db();
    const patch: Record<string, unknown> = { updated_by: "admin" };
    if (data.enabled !== undefined) patch.enabled = data.enabled;
    if (data.priority !== undefined) patch.priority = data.priority;
    const { error } = await s.from("ai_models_config").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit("ai_model.update", "ai_model", data.id, null, patch);
    return { ok: true as const };
  });

/* ============= Emergency Controls ============= */

export const getEmergency = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminSession();
  const s = await db();
  const { data } = await s.from("emergency_controls").select("*").limit(1).maybeSingle();
  return data;
});

export const setEmergency = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    ai_all_paused: z.boolean().optional(),
    ai_image_paused: z.boolean().optional(),
    ai_text_paused: z.boolean().optional(),
    qa_paused: z.boolean().optional(),
    reason: z.string().max(500).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    await requireAdminSession();
    const s = await db();
    const patch: Record<string, unknown> = {
      ...data,
      paused_by: "admin",
      paused_at: new Date().toISOString(),
    };
    const { error } = await s.from("emergency_controls").upsert({ id: true, ...patch } as never, { onConflict: "id" });
    if (error) throw new Error(error.message);
    await audit("emergency.set", "emergency_controls", null, null, patch);
    return { ok: true as const };
  });

/* ============= Audit Log ============= */

export const listAudit = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({
    action: z.string().optional(),
    actor_id: z.string().optional(),
    limit: z.number().int().min(1).max(500).default(100),
    offset: z.number().int().min(0).default(0),
  }).parse(d ?? {}))
  .handler(async ({ data }) => {
    await requireAdminSession();
    const s = await db();
    let q = s.from("audit_log").select("*").order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);
    if (data.action) q = q.ilike("action", `%${data.action}%`);
    if (data.actor_id) q = q.eq("actor_id", data.actor_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/* ============= Phone Bans ============= */

export const listPhoneBans = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminSession();
  const s = await db();
  const { data } = await s.from("phone_bans").select("*").order("banned_at", { ascending: false }).limit(500);
  return data ?? [];
});

export const addPhoneBan = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    phone: z.string().min(3).max(40),
    reason: z.string().max(500).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    await requireAdminSession();
    const s = await db();
    const phone = data.phone.replace(/[\s\-()+]/g, "").replace(/^00964/, "0").replace(/^964/, "0");
    const { error } = await s.from("phone_bans").upsert({ phone, reason: data.reason ?? null } as never, { onConflict: "phone" });
    if (error) throw new Error(error.message);
    await audit("phone_ban.add", "phone", phone, null, { reason: data.reason });
    return { ok: true as const };
  });

export const removePhoneBan = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ phone: z.string() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdminSession();
    const s = await db();
    const { error } = await s.from("phone_bans").delete().eq("phone", data.phone);
    if (error) throw new Error(error.message);
    await audit("phone_ban.remove", "phone", data.phone);
    return { ok: true as const };
  });

/* ============= Redownload Requests ============= */

export const listRedownloads = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ status: z.string().default("pending") }).parse(d ?? {}))
  .handler(async ({ data }) => {
    await requireAdminSession();
    const s = await db();
    const { data: rows, error } = await s.from("redownload_requests")
      .select("id, order_id, user_id, amount_iqd, status, requested_at, paid_at, orders(order_number, title, customer_phone)")
      .eq("status", data.status)
      .order("requested_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const approveRedownload = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdminSession();
    const s = await db();
    const now = new Date().toISOString();
    const { data: row, error } = await s.from("redownload_requests")
      .update({ status: "paid", paid_at: now } as never)
      .eq("id", data.id).select("user_id, order_id").maybeSingle();
    if (error) throw new Error(error.message);
    if (row?.user_id) {
      await s.from("notifications").insert({
        user_id: row.user_id,
        order_id: row.order_id,
        title: "تمت الموافقة على إعادة التحميل",
        body: "يمكنك الآن تحميل قصتك مجددًا.",
        kind: "redownload_paid",
      } as never);
    }
    await audit("redownload.approve", "redownload_request", data.id);
    return { ok: true as const };
  });

export const rejectRedownload = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), reason: z.string().max(500).optional() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdminSession();
    const s = await db();
    const { data: row, error } = await s.from("redownload_requests")
      .update({ status: "rejected" } as never)
      .eq("id", data.id).select("user_id, order_id").maybeSingle();
    if (error) throw new Error(error.message);
    if (row?.user_id) {
      await s.from("notifications").insert({
        user_id: row.user_id,
        order_id: row.order_id,
        title: "تم رفض طلب إعادة التحميل",
        body: data.reason ?? "لمزيد من التفاصيل تواصل مع الدعم.",
        kind: "redownload_rejected",
      } as never);
    }
    await audit("redownload.reject", "redownload_request", data.id, null, { reason: data.reason });
    return { ok: true as const };
  });

/* ============= Cache Stats ============= */

export const cacheStats = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminSession();
  const s = await db();
  const nowIso = new Date().toISOString();
  const [prompt, promptExpired, char, charExpired, promptSaved, charSaved] = await Promise.all([
    s.from("prompt_cache").select("*", { count: "exact", head: true }),
    s.from("prompt_cache").select("*", { count: "exact", head: true }).lt("expires_at", nowIso),
    s.from("character_analysis_cache").select("*", { count: "exact", head: true }),
    s.from("character_analysis_cache").select("*", { count: "exact", head: true }).lt("expires_at", nowIso),
    s.from("prompt_cache").select("cost_saved_usd, hits").limit(10000),
    s.from("character_analysis_cache").select("cost_saved_usd, hits").limit(10000),
  ]);
  const sum = (rows: unknown[] | null, k: string): number =>
    (rows ?? []).reduce<number>((a, r) => a + Number((r as Record<string, unknown>)[k] ?? 0), 0);
  return {
    prompt: {
      total: prompt.count ?? 0,
      expired: promptExpired.count ?? 0,
      totalHits: sum(promptSaved.data as unknown[], "hits"),
      savedUsd: sum(promptSaved.data as unknown[], "cost_saved_usd"),
    },
    character: {
      total: char.count ?? 0,
      expired: charExpired.count ?? 0,
      totalHits: sum(charSaved.data as unknown[], "hits"),
      savedUsd: sum(charSaved.data as unknown[], "cost_saved_usd"),
    },
  };
});

export const purgeExpiredCache = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdminSession();
  const s = await db();
  const nowIso = new Date().toISOString();
  const [a, b] = await Promise.all([
    s.from("prompt_cache").delete().lt("expires_at", nowIso).select("cache_key"),
    s.from("character_analysis_cache").delete().lt("expires_at", nowIso).select("cache_key"),
  ]);
  await audit("cache.purge_expired", "cache", null, null, {
    prompt: a.data?.length ?? 0, character: b.data?.length ?? 0,
  });
  return { prompt: a.data?.length ?? 0, character: b.data?.length ?? 0 };
});

/* ============= Share Events ============= */

export const shareEventStats = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminSession();
  const s = await db();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await s.from("share_events")
    .select("platform_key, order_id, created_at")
    .gte("created_at", since)
    .limit(5000);
  const byPlatform = new Map<string, number>();
  const byOrder = new Map<string, number>();
  for (const r of (data ?? []) as Array<{ platform_key: string | null; order_id: string | null }>) {
    const p = r.platform_key ?? "unknown";
    byPlatform.set(p, (byPlatform.get(p) ?? 0) + 1);
    if (r.order_id) byOrder.set(r.order_id, (byOrder.get(r.order_id) ?? 0) + 1);
  }
  const topOrderIds = [...byOrder.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  const orderMeta = topOrderIds.length
    ? await s.from("orders").select("id, order_number, title").in("id", topOrderIds.map((x) => x[0]))
    : { data: [] as Array<{ id: string; order_number: number; title: string | null }> };
  const meta = new Map((orderMeta.data ?? []).map((o) => [o.id, o]));
  return {
    total: data?.length ?? 0,
    byPlatform: [...byPlatform.entries()].sort((a, b) => b[1] - a[1]),
    topOrders: topOrderIds.map(([id, count]) => ({
      id, count,
      order_number: meta.get(id)?.order_number ?? null,
      title: meta.get(id)?.title ?? null,
    })),
  };
});

/* ============= Referrals (Admin) ============= */

export const listReferralsAdmin = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminSession();
  const s = await db();
  const { data: refs } = await s
    .from("referrals")
    .select("id, referrer_user_id, referred_user_id, code, status, reward_amount_iqd, created_at, completed_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const ids = new Set<string>();
  for (const r of refs ?? []) {
    if (r.referrer_user_id) ids.add(r.referrer_user_id);
    if (r.referred_user_id) ids.add(r.referred_user_id);
  }
  const { data: users } = ids.size
    ? await s.from("users").select("id, full_name, phone").in("id", [...ids])
    : { data: [] as Array<{ id: string; full_name: string | null; phone: string | null }> };
  const uMap = new Map((users ?? []).map((u) => [u.id, u]));
  return (refs ?? []).map((r) => ({
    ...r,
    referrer: uMap.get(r.referrer_user_id) ?? null,
    referred: r.referred_user_id ? uMap.get(r.referred_user_id) ?? null : null,
  }));
});

export const referralStatsAdmin = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminSession();
  const s = await db();
  const { data: refs } = await s.from("referrals").select("status, reward_amount_iqd, referrer_user_id");
  const list = refs ?? [];
  const totalReward = list.reduce((a, r) => a + (r.reward_amount_iqd ?? 0), 0);
  const byReferrer = new Map<string, number>();
  for (const r of list) byReferrer.set(r.referrer_user_id, (byReferrer.get(r.referrer_user_id) ?? 0) + 1);
  const topIds = [...byReferrer.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const { data: users } = topIds.length
    ? await s.from("users").select("id, full_name, phone").in("id", topIds.map((x) => x[0]))
    : { data: [] as Array<{ id: string; full_name: string | null; phone: string | null }> };
  const uMap = new Map((users ?? []).map((u) => [u.id, u]));
  return {
    total: list.length,
    completed: list.filter((r) => r.status === "rewarded" || r.status === "completed").length,
    totalRewardIqd: totalReward,
    topReferrers: topIds.map(([id, count]) => ({
      id, count,
      full_name: uMap.get(id)?.full_name ?? null,
      phone: uMap.get(id)?.phone ?? null,
    })),
  };
});

/* ============= Gallery (Admin) ============= */

export const listGalleryAdmin = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminSession();
  const s = await db();
  const { data } = await s
    .from("orders")
    .select("id, order_number, title, public_title, is_public, gallery_featured, share_token, created_at, user_id, show_author, public_author_name")
    .eq("status", "delivered")
    .order("created_at", { ascending: false })
    .limit(200);
  return data ?? [];
});

export const setGalleryFlags = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      orderId: z.string().uuid(),
      isPublic: z.boolean().optional(),
      featured: z.boolean().optional(),
      publicTitle: z.string().max(120).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdminSession();
    const s = await db();
    const patch: { is_public?: boolean; gallery_featured?: boolean; public_title?: string | null } = {};
    if (data.isPublic !== undefined) patch.is_public = data.isPublic;
    if (data.featured !== undefined) patch.gallery_featured = data.featured;
    if (data.publicTitle !== undefined) patch.public_title = data.publicTitle;
    const { error } = await s.from("orders").update(patch).eq("id", data.orderId);
    if (error) throw new Error(error.message);
    await audit("gallery_flags", "order", data.orderId, null, patch);
    return { ok: true as const };
  });

/* ============= Testimonials (Admin) ============= */

export const listTestimonialsAdmin = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdminSession();
  const s = await db();
  const { data } = await s.from("testimonials").select("*").order("sort_order").order("created_at", { ascending: false });
  return data ?? [];
});

export const upsertTestimonial = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      author_name: z.string().min(1).max(120),
      author_city: z.string().max(80).nullable().optional(),
      content: z.string().min(1).max(2000),
      rating: z.number().int().min(1).max(5).default(5),
      avatar_url: z.string().url().nullable().optional(),
      published: z.boolean().default(false),
      featured: z.boolean().default(false),
      sort_order: z.number().int().default(0),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdminSession();
    const s = await db();
    if (data.id) {
      const { error } = await s.from("testimonials").update(data).eq("id", data.id);
      if (error) throw new Error(error.message);
      await audit("testimonial_update", "testimonial", data.id, null, data);
      return { ok: true as const, id: data.id };
    } else {
      const { data: row, error } = await s.from("testimonials").insert(data).select("id").single();
      if (error) throw new Error(error.message);
      await audit("testimonial_create", "testimonial", row.id, null, data);
      return { ok: true as const, id: row.id };
    }
  });

export const deleteTestimonial = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdminSession();
    const s = await db();
    const { error } = await s.from("testimonials").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit("testimonial_delete", "testimonial", data.id, null, null);
    return { ok: true as const };
  });

/* ============= Story Page Editing (Admin manual override) ============= */

export const adminUpdatePageText = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    orderId: z.string().uuid(),
    pageNumber: z.coerce.number().int().min(1),
    text: z.string().max(5000),
  }).parse(d))
  .handler(async ({ data }) => {
    await requireAdminSession();
    const s = await db();
    const { error } = await s.from("story_pages")
      .update({ text: data.text })
      .eq("order_id", data.orderId)
      .eq("page_number", data.pageNumber);
    if (error) throw new Error(error.message);
    // Invalidate cached PDF so next download rebuilds with new text.
    const { data: ord } = await s.from("orders").select("pdf_path").eq("id", data.orderId).maybeSingle();
    if (ord?.pdf_path) {
      await s.storage.from("story-pdfs").remove([ord.pdf_path]);
      await s.from("orders").update({ pdf_path: null }).eq("id", data.orderId);
    }
    await audit("page.text_update", "story_page", `${data.orderId}#${data.pageNumber}`, null, { len: data.text.length });
    return { ok: true as const };
  });

export const adminUploadPageImage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    orderId: z.string().uuid(),
    pageNumber: z.coerce.number().int().min(0), // 0 = cover
    dataUrl: z.string().min(20),
  }).parse(d))
  .handler(async ({ data }) => {
    await requireAdminSession();
    const s = await db();
    const m = data.dataUrl.match(/^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/);
    if (!m) throw new Error("Invalid data URL");
    const mime = m[1];
    const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
    const bytes = Buffer.from(m[2], "base64");
    const isCover = data.pageNumber === 0;
    const bucket = isCover ? "story-covers" : "story-uploads";
    const path = isCover
      ? `covers/${data.orderId}.${ext}`
      : `pages/${data.orderId}/${data.pageNumber}.${ext}`;
    const { error: upErr } = await s.storage.from(bucket).upload(path, bytes, {
      contentType: mime,
      upsert: true,
    });
    if (upErr) throw new Error(upErr.message);
    if (isCover) {
      await s.from("generations")
        .upsert({ order_id: data.orderId, cover_image_path: path } as never, { onConflict: "order_id" });
    } else {
      await s.from("story_pages")
        .update({ image_path: path })
        .eq("order_id", data.orderId)
        .eq("page_number", data.pageNumber);
    }
    // Invalidate cached PDF.
    const { data: ord } = await s.from("orders").select("pdf_path").eq("id", data.orderId).maybeSingle();
    if (ord?.pdf_path) {
      await s.storage.from("story-pdfs").remove([ord.pdf_path]);
      await s.from("orders").update({ pdf_path: null }).eq("id", data.orderId);
    }
    await audit("page.image_upload", "story_page", `${data.orderId}#${data.pageNumber}`, null, { bytes: bytes.length });
    return { ok: true as const };
  });

export const adminUpdatePagePrompt = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    orderId: z.string().uuid(),
    pageNumber: z.coerce.number().int().min(1),
    imagePrompt: z.string().max(4000),
  }).parse(d))
  .handler(async ({ data }) => {
    await requireAdminSession();
    const s = await db();
    const { error } = await s.from("story_pages")
      .update({ image_prompt: data.imagePrompt })
      .eq("order_id", data.orderId)
      .eq("page_number", data.pageNumber);
    if (error) throw new Error(error.message);
    await audit("page.prompt_update", "story_page", `${data.orderId}#${data.pageNumber}`, null, { len: data.imagePrompt.length });
    return { ok: true as const };
  });
