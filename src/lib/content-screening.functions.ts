import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Age bucket helper (pure, safe to import anywhere).
export function deriveAgeBucket(age: number | null | undefined): string {
  if (!age || age < 0) return "unknown";
  if (age <= 6) return "early_child";
  if (age <= 12) return "child";
  if (age <= 17) return "teen";
  if (age <= 29) return "young_adult";
  if (age <= 49) return "adult";
  return "senior";
}

type ScreeningResult = {
  category: "A" | "B" | "OK";
  flags: string[];
  reason: string;
  requires_admin_review: boolean;
  requires_identity: boolean;
};

// Internal helper — not a server function. Screens a story request via AI.
async function runScreening(payload: {
  moods: string[];
  instructions: string;
  characterDescriptions: string[];
  heroAge: number | null;
}): Promise<ScreeningResult> {
  const { callChat } = await import("./ai-gateway.server");
  const sys = `أنت مصفّي محتوى لمنصة قصص لجميع الأعمار.
صنّف الطلب إلى:
- "A": محتوى ممنوع تلقائياً (عنف صريح ضد الأطفال، تحريض على القتل/الإرهاب، إساءة دينية مباشرة، محتوى جنسي يشمل قاصرين).
- "B": محتوى شخصي حساس يحتاج مراجعة إدارية (رومانسي/جنسي بين بالغين، محتوى صادم، تعامل مع صدمات، أسماء شخصيات حقيقية).
- "OK": آمن للجميع.
أعِد JSON فقط: {"category":"A|B|OK","flags":["..."],"reason":"سطر عربي واحد يوضح السبب"}`;
  const user = `العمر المُعلَن: ${payload.heroAge ?? "غير محدد"}
الأمزجة: ${payload.moods.join("، ")}
تعليمات المستخدم: ${payload.instructions || "(لا يوجد)"}
وصف الشخصيات: ${payload.characterDescriptions.join(" | ") || "(لا يوجد)"}`;

  try {
    const { content } = await callChat({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    });
    const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned) as { category?: string; flags?: string[]; reason?: string };
    const category = (parsed.category === "A" || parsed.category === "B" ? parsed.category : "OK") as ScreeningResult["category"];
    const flags = Array.isArray(parsed.flags) ? parsed.flags.slice(0, 20).map(String) : [];
    const reason = String(parsed.reason ?? "").slice(0, 500);
    const isIntimate = flags.some((f) => /intim|sexual|جنسي|حميم/i.test(f));
    return {
      category,
      flags,
      reason,
      requires_admin_review: category !== "OK",
      requires_identity: category === "B" && isIntimate,
    };
  } catch (e) {
    // Fail-safe: if screening fails, flag for admin review rather than block or auto-approve.
    return {
      category: "B",
      flags: ["screening_error"],
      reason: `تعذّر فحص المحتوى تلقائياً: ${(e as Error).message}`.slice(0, 500),
      requires_admin_review: true,
      requires_identity: false,
    };
  }
}

// Runs screening for an existing order and updates its review fields.
export const screenOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, moods, custom_instructions")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order) throw new Error("Order not found");
    const { data: chars } = await supabaseAdmin
      .from("order_characters")
      .select("age, description, is_primary")
      .eq("order_id", data.orderId);
    const primary = (chars ?? []).find((c) => c.is_primary) ?? (chars ?? [])[0] ?? null;

    const result = await runScreening({
      moods: (order.moods as string[] | null) ?? [],
      instructions: (order.custom_instructions as string | null) ?? "",
      characterDescriptions: (chars ?? []).map((c) => c.description ?? "").filter(Boolean),
      heroAge: primary?.age ?? null,
    });

    const bucket = deriveAgeBucket(primary?.age ?? null);
    await supabaseAdmin
      .from("orders")
      .update({
        age_bucket: bucket,
        content_flags: result.flags,
        requires_admin_review: result.requires_admin_review,
        status: result.requires_admin_review ? "pending_review" : undefined,
        identity_verification_status: result.requires_identity ? "requested" : "not_required",
      })
      .eq("id", data.orderId);

    await supabaseAdmin.from("content_screening_log").insert({
      order_id: data.orderId,
      category: result.category,
      flags: result.flags,
      decision: result.requires_admin_review ? "review" : "auto_ok",
      reason: result.reason,
      model_used: "google/gemini-2.5-flash-lite",
    });

    return result;
  });

// ============ ADMIN ============

async function gate() {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
}

export const adminListReviewQueue = createServerFn({ method: "GET" }).handler(async () => {
  await gate();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, status, age_bucket, content_flags, requires_admin_review, identity_verification_status, admin_review_note, custom_instructions, moods, created_at, user_id, customer_phone")
    .or("requires_admin_review.eq.true,status.eq.pending_review")
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = data ?? [];
  const ids = rows.map((r) => r.id);
  const { data: chars } = ids.length
    ? await supabaseAdmin.from("order_characters").select("order_id, name, age, description, is_primary").in("order_id", ids)
    : { data: [] };
  const grouped = new Map<string, typeof chars>();
  for (const c of chars ?? []) {
    const list = grouped.get(c.order_id) ?? [];
    list.push(c);
    grouped.set(c.order_id, list);
  }
  return rows.map((r) => ({ ...r, characters: grouped.get(r.id) ?? [] }));
});

export const adminApproveOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid(), note: z.string().max(500).optional() }).parse(d))
  .handler(async ({ data }) => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("orders")
      .update({
        requires_admin_review: false,
        status: "pending",
        admin_review_note: data.note ?? "approved",
        admin_reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.orderId);
    await supabaseAdmin.from("audit_log").insert({
      actor_type: "admin",
      actor_id: "admin",
      action: "review_approve",
      target_type: "orders",
      target_id: data.orderId,
      after: { note: data.note ?? null } as never,
    });
    return { ok: true };
  });

export const adminRejectOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid(), reason: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ data }) => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("orders")
      .update({
        status: "rejected",
        requires_admin_review: false,
        admin_review_note: data.reason,
        admin_reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.orderId);
    await supabaseAdmin.from("audit_log").insert({
      actor_type: "admin",
      actor_id: "admin",
      action: "review_reject",
      target_type: "orders",
      target_id: data.orderId,
      after: { reason: data.reason } as never,
    });
    return { ok: true };
  });

export const adminRequestIdentity = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid(), note: z.string().max(500).optional() }).parse(d))
  .handler(async ({ data }) => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("orders")
      .update({
        identity_verification_status: "requested",
        admin_review_note: data.note ?? "identity requested",
      })
      .eq("id", data.orderId);
    await supabaseAdmin.from("audit_log").insert({
      actor_type: "admin",
      actor_id: "admin",
      action: "identity_request",
      target_type: "orders",
      target_id: data.orderId,
      after: {} as never,
    });
    return { ok: true };
  });


// ============ USER: submit identity document ============

export const submitIdentityDocument = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        fileName: z.string().min(1).max(120),
        base64: z.string().min(100).max(8_000_000),
        mimeType: z.string().min(3).max(60),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requireUserSession } = await import("./user-session.server");
    const session = await requireUserSession();
    const userId = session.data.userId!;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, user_id")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order || order.user_id !== userId) throw new Error("Order not found");

    const ext = data.fileName.includes(".") ? data.fileName.split(".").pop()!.slice(0, 6) : "bin";
    const path = `identity/${userId}/${data.orderId}-${Date.now()}.${ext}`;
    const bytes = Buffer.from(data.base64, "base64");
    const { error } = await supabaseAdmin.storage
      .from("story-uploads")
      .upload(path, bytes, { contentType: data.mimeType, upsert: true });
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("orders")
      .update({ identity_document_path: path, identity_verification_status: "submitted" })
      .eq("id", data.orderId);

    return { ok: true };
  });

export const getMyReviewOrder = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireUserSession } = await import("./user-session.server");
    const session = await requireUserSession();
    const userId = session.data.userId!;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, order_number, status, admin_review_note, identity_verification_status, requires_admin_review, content_flags")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order || order.user_id !== userId) throw new Error("Order not found");
    return order;

  });
