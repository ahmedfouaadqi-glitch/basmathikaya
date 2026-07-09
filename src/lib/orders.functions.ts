import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  computeTierAmount,
  MIN_PAGES,
  MAX_PAGES,
  MIN_CHARACTERS,
  MAX_CHARACTERS,
  type PricingLike,
  type Tier,
} from "./pricing";

const CharacterInput = z.object({
  name: z.string().trim().min(1).max(60),
  age: z.coerce.number().int().min(1).max(120).optional().nullable(),
  role: z.enum(["protagonist", "friend", "family", "pet", "other"]).default("protagonist"),
  description: z.string().trim().max(300).optional().default(""),
  photo_path: z.string().trim().max(500).optional().nullable(),
});

const CreateInput = z.object({
  characters: z.array(CharacterInput).min(MIN_CHARACTERS).max(MAX_CHARACTERS),
  moods: z.array(z.string().trim().min(1).max(40)).min(1).max(3),
  custom_instructions: z.string().trim().max(500).optional().default(""),
  language: z.enum(["ar", "en", "ku"]).default("ar"),
  page_count: z.coerce.number().int().min(MIN_PAGES).max(MAX_PAGES).default(5),
  draft_id: z.string().trim().min(1).max(64).optional(),
  disclaimer_accepted: z.boolean().default(false),
  coupon_code: z.string().trim().max(40).optional().nullable(),
  tier: z.enum(["pdf", "printed", "video"]).default("pdf"),
  image_quality_tier: z
    .enum(["fast", "standard", "premium"])
    .default("standard")
    .transform((v) => (v === "fast" ? "standard" : v)),
  pdf_orientation: z.enum(["portrait", "landscape"]).default("portrait"),
  art_style_category: z.enum(["realistic", "cartoon"]).optional().nullable(),
  art_style_slug: z.string().trim().min(1).max(60).optional().nullable(),
});


type PricingRow = PricingLike & {
  usd_per_credit: number | string;
  iqd_per_usd: number | string;
};

async function logEvent(
  orderId: string,
  step: string,
  model: string,
  operation: "chat" | "image",
  meta: { log_id: string | null; run_id: string | null; usage: { input_tokens?: number; output_tokens?: number; total_tokens?: number }; duration_ms: number },
  costUsd: number,
  imageCount: number,
  pricing: PricingRow,
  status: "success" | "error" = "success",
  errorMessage: string | null = null,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const cost_iqd = +(costUsd * Number(pricing.iqd_per_usd)).toFixed(2);
  const cost_credits = Number(pricing.usd_per_credit) > 0
    ? +(costUsd / Number(pricing.usd_per_credit)).toFixed(6)
    : 0;
  await supabaseAdmin.from("generation_events").insert({
    order_id: orderId,
    step,
    model,
    operation,
    aig_log_id: meta.log_id,
    aig_run_id: meta.run_id,
    input_tokens: meta.usage.input_tokens ?? 0,
    output_tokens: meta.usage.output_tokens ?? 0,
    total_tokens: meta.usage.total_tokens ?? ((meta.usage.input_tokens ?? 0) + (meta.usage.output_tokens ?? 0)),
    image_count: imageCount,
    cost_credits,
    cost_usd: +costUsd.toFixed(6),
    cost_iqd,
    status,
    error_message: errorMessage,
    duration_ms: meta.duration_ms,
  });
}

async function getPricing(): Promise<PricingRow> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("pricing_settings").select("*").eq("id", 1).maybeSingle();
  if (!data) {
    return {
      usd_per_credit: 0.1,
      iqd_per_usd: 1310,
      tier_pdf_iqd: 3000,
      tier_printed_iqd: 10000,
      tier_video_iqd: 25000,
      per_page_iqd_pdf: 400,
      per_page_iqd_printed: 1200,
      per_page_iqd_video: 2500,
      per_character_iqd_pdf: 1500,
      per_character_iqd_printed: 3000,
      per_character_iqd_video: 6000,
      max_characters: 5,
      print_cost_iqd: 0,
      shipping_cost_iqd: 0,
      image_tier_standard_extra_iqd: 0,
      image_tier_premium_extra_iqd: 2000,
      video_tier_enabled: false,
    };
  }
  return data as PricingRow;
}

// === Create draft (text-only flow: requires authenticated user) ===
// Also picks tier + applies coupon + returns a WhatsApp URL so the client
// can hand the customer off immediately without any AI generation.
export const createOrderDraft = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data }) => {
    const { requireUserSession } = await import("./user-session.server");
    const session = await requireUserSession();
    const userId = session.data.userId!;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Block banned users at draft creation — by user status OR phone-ban list.
    const { data: u } = await supabaseAdmin
      .from("users")
      .select("status, phone")
      .eq("id", userId)
      .maybeSingle();
    if (u && u.status && u.status !== "active") {
      throw new Error(
        u.status === "banned"
          ? "حسابك محظور، لا يمكنك إنشاء طلبات."
          : "حسابك موقوف مؤقتاً، تواصل مع الإدارة.",
      );
    }
    const phoneToCheck = (u?.phone ?? session.data.phone ?? "").trim();
    if (phoneToCheck) {
      const { data: banned } = await supabaseAdmin
        .from("phone_bans").select("reason").eq("phone", phoneToCheck).maybeSingle();
      if (banned) throw new Error(`رقم الهاتف محظور${banned.reason ? ` — السبب: ${banned.reason}` : ""}`);
    }

    // Compute price (server-side) so the client can't tamper with amount.
    const pricing = await getPricing();
    if (data.tier === "video" && !pricing.video_tier_enabled) {
      throw new Error("خدمة الفيديو الفاخر غير متاحة حالياً");
    }
    const chars = data.characters.length;
    const moods = data.moods.length || 1;
    const gross = computeTierAmount(
      data.tier as Tier, data.page_count, pricing, chars, data.image_quality_tier, moods,
    );

    // Coupon validation with new min_pages / applies_quality / applies_tier constraints.
    let discount = 0;
    let couponId: string | null = null;
    const code = data.coupon_code ? data.coupon_code.toUpperCase() : null;
    if (code) {
      const { data: c } = await supabaseAdmin
        .from("coupons")
        .select("id, discount_type, discount_value, max_uses, uses_count, valid_from, valid_to, active, applies_to, min_pages, applies_quality, applies_tier")
        .eq("code", code)
        .maybeSingle();
      const now = Date.now();
      if (c && c.active
        && (!c.valid_from || new Date(c.valid_from).getTime() <= now)
        && (!c.valid_to   || new Date(c.valid_to).getTime()   >= now)
        && (c.max_uses == null || (c.uses_count ?? 0) < c.max_uses)
        && data.page_count >= (c.min_pages ?? 0)
        && ((c.applies_quality ?? []).length === 0 || (c.applies_quality as string[]).includes(data.image_quality_tier))
        && ((c.applies_tier    ?? []).length === 0 || (c.applies_tier    as string[]).includes(data.tier))
      ) {
        discount = c.discount_type === "percent"
          ? Math.round((gross * Number(c.discount_value)) / 100)
          : Math.round(Number(c.discount_value));
        discount = Math.max(0, Math.min(discount, gross));
        couponId = c.id;
      }
    }
    const amount = Math.max(0, gross - discount);

    const { data: ord, error: ordErr } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: userId,
        customer_phone: session.data.phone ?? "",
        status: "pending",
        payment_status: "pending_payment",
        tier: data.tier,
        amount_iqd: amount,
        coupon_discount_iqd: discount,
        page_count: data.page_count,
        moods: data.moods,
        custom_instructions: data.custom_instructions || null,
        image_quality_tier: data.image_quality_tier,
        pdf_orientation: data.pdf_orientation,
        art_style_category: data.art_style_category ?? null,
        art_style_slug: data.art_style_slug ?? null,
        disclaimer_accepted_at: data.disclaimer_accepted ? new Date().toISOString() : null,
        coupon_code: code,
        whatsapp_sent_at: new Date().toISOString(),
      })
      .select("id, order_number")
      .single();
    if (ordErr || !ord) throw new Error(ordErr?.message || "Failed to create order");

    const rows = data.characters.map((c, i) => ({
      order_id: ord.id,
      name: c.name,
      age: c.age ?? null,
      role: c.role,
      description: c.description ?? "",
      photo_path: c.photo_path ?? null,
      is_primary: i === 0,
      position: i,
    }));
    const { error: chErr } = await supabaseAdmin.from("order_characters").insert(rows);
    if (chErr) throw new Error(chErr.message);

    if (couponId && discount > 0) {
      await supabaseAdmin.from("coupon_redemptions").insert({
        coupon_id: couponId, order_id: ord.id, user_id: userId, discount_iqd: discount,
      });
      const { data: cRow } = await supabaseAdmin.from("coupons").select("uses_count").eq("id", couponId).maybeSingle();
      await supabaseAdmin.from("coupons").update({ uses_count: (cRow?.uses_count ?? 0) + 1 }).eq("id", couponId);
    }

    // Build WhatsApp deep link with full order details.
    const waNumber = (pricing as PricingRow & { whatsapp_admin_number?: string }).whatsapp_admin_number || "9647733570130";
    const tierLabel = data.tier === "pdf" ? "PDF فوري" : data.tier === "printed" ? "نسخة مطبوعة" : "فيديو فاخر";
    const qualityLabel = data.image_quality_tier === "premium" ? "احترافي" : "قياسي";
    const lines = [
      "مرحباً، أود إكمال طلبي في بصمة حكاية.",
      `رقم الطلب: #${ord.order_number}`,
      `الباقة: ${tierLabel}`,
      `الجودة: ${qualityLabel}`,
      `عدد الصفحات: ${data.page_count}`,
      `عدد الشخصيات: ${chars}`,
      `الأجواء: ${data.moods.join("، ")}`,
    ];
    if (code) lines.push(`الكوبون: ${code}${discount > 0 ? ` (خصم ${discount.toLocaleString()} د.ع)` : " (غير صالح — لم يُطبَّق)"}`);
    lines.push(`المبلغ الإجمالي: ${amount.toLocaleString()} د.ع`);
    lines.push(`الاسم: ${session.data.name ?? ""}`);
    const whatsapp_url = `https://wa.me/${waNumber}?text=${encodeURIComponent(lines.join("\n"))}`;

    // Run content screening (best-effort). Flags for admin review if needed.
    let requires_review = false;
    let review_reason: string | null = null;
    try {
      const { screenOrder } = await import("./content-screening.functions");
      const res = await screenOrder({ data: { orderId: ord.id } });
      requires_review = res.requires_admin_review;
      review_reason = res.reason;
    } catch {
      /* ignore screening failures — order stays in normal flow */
    }

    return {
      orderId: ord.id as string,
      orderNumber: ord.order_number as number,
      amount_iqd: amount,
      discount_iqd: discount,
      whatsapp_url,
      requires_review,
      review_reason,
    };
  });



const OrderIdInput = z.object({ orderId: z.string().uuid() });

type StoryPlan = {
  title: string;
  character_visual: string;
  cover_prompt: string;
  pages: Array<{ text: string; image_prompt: string }>;
};

function safeParseJson(text: string): StoryPlan | null {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(cleaned) as StoryPlan;
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]) as StoryPlan; } catch { return null; }
    }
    return null;
  }
}

async function generateOneImage(args: {
  orderId: string;
  step: string;
  prompt: string;
  storagePath: string;
  pricing: PricingRow;
  model?: string;
  referenceImages?: string[];
}): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { callImage, estimateImageCostUsd } = await import("./ai-gateway.server");
  const imgModel = args.model ?? "google/gemini-3.1-flash-image";
  try {
    const img = await callImage({ model: imgModel, prompt: args.prompt, referenceImages: args.referenceImages });
    const buf = Buffer.from(img.b64, "base64");
    const up = await supabaseAdmin.storage
      .from("story-covers")
      .upload(args.storagePath, buf, { contentType: "image/png", upsert: true });
    if (up.error) throw new Error(up.error.message);
    await logEvent(
      args.orderId,
      args.step,
      imgModel,
      "image",
      img.meta,
      estimateImageCostUsd(imgModel, 1),
      1,
      args.pricing,
    );
    return args.storagePath;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logEvent(
      args.orderId,
      args.step,
      imgModel,
      "image",
      { log_id: null, run_id: null, usage: {}, duration_ms: 0 },
      0,
      0,
      args.pricing,
      "error",
      msg,
    );
    return null;
  }
}

/** Download a stored character photo and return a base64 data URL. Caps at ~1MB. */
async function photoToDataUrl(path: string): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const dl = await supabaseAdmin.storage.from("story-uploads").download(path);
    if (dl.error || !dl.data) return null;
    const buf = Buffer.from(await dl.data.arrayBuffer());
    if (buf.byteLength > 2_000_000) return null; // skip if too big; vision still gets brief
    const mime = dl.data.type || "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Run Gemini vision over the uploaded photo to extract a stable visual brief. */
export type CharacterProfile = {
  gender?: string;
  age_group?: string;
  skin_tone?: string;
  hair_color?: string;
  hair_style?: string;
  eye_color?: string;
  face_shape?: string;
  body_build?: string;
  clothing?: string;
  distinctive_features?: string;
  locked?: boolean;
};

async function analyzeCharacterPhoto(args: {
  dataUrl: string;
  name: string;
  language: "ar" | "en" | "ku";
}): Promise<{ brief: string; profile: CharacterProfile | null } | null> {
  try {
    const { callChat } = await import("./ai-gateway.server");
    const isAr = args.language === "ar";
    const jsonHint = `\nAfter the description, append a fenced JSON block with exactly these keys (in English values): {"gender","age_group","skin_tone","hair_color","hair_style","eye_color","face_shape","body_build","clothing","distinctive_features"}. Wrap it in \`\`\`json ... \`\`\`.`;
    const prompt = isAr
      ? `حلّل صورة هذا الشخص (${args.name}) ووصِف بإيجاز (5-7 أسطر، عربي) وبإلزام تام: الجنس (ذكر/أنثى)، الفئة العمرية (طفل صغير/طفل/مراهق/شاب/بالغ/مسنّ)، لون البشرة، الشعر (طول/لون/تسريحة)، لون العينين، شكل الوجه، بنية الجسم، الملابس البارزة، أي ميزات مميزة. يجب أن يبدأ الوصف بسطر: "الجنس والعمر: <ذكر/أنثى> · <الفئة العمرية>". لا تذكر اسماً حقيقياً، فقط الوصف البصري لاستخدامه كمرجع لرسم شخصية كرتونية متطابقة.${jsonHint}`
      : `Analyze this person (${args.name}) and produce 5-7 short lines describing (mandatory): gender (male/female), age group (toddler/child/teen/young adult/adult/senior), skin tone, hair (length/color/style), eye color, face shape, body build, notable clothing, distinctive features. Start with: "Gender & age: <male/female> · <age group>". No real names. Pure visual brief for drawing a consistent cartoon character.${jsonHint}`;
    const r = await callChat({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "user", content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: args.dataUrl } },
        ] },
      ],
    });
    const raw = r.content.trim();
    // Extract JSON if present, keep only the descriptive text as `brief`.
    let profile: CharacterProfile | null = null;
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/i) ?? raw.match(/\{[\s\S]*"gender"[\s\S]*\}/);
    if (jsonMatch) {
      try { profile = { ...JSON.parse(jsonMatch[1] ?? jsonMatch[0]), locked: true }; } catch { /* ignore */ }
    }
    const brief = raw.replace(/```json[\s\S]*?```/gi, "").trim().slice(0, 900);
    return { brief, profile };
  } catch {
    return null;
  }
}

async function runWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Generate the story TEXT only (title, character visual, page texts, image prompts).
 * No images are generated here — that happens after admin confirms payment.
 */
export const generateFullStory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => OrderIdInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { callChat, estimateTextCostUsd } = await import("./ai-gateway.server");

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, page_count, title, character_brief, moods, custom_instructions, content_flags, age_bucket, characters(language)")
      .eq("id", data.orderId)
      .single();
    if (!order) throw new Error("Order not found");

    const { data: chars } = await supabaseAdmin
      .from("order_characters")
      .select("id, name, age, role, description, is_primary, position, photo_path, visual_brief")
      .eq("order_id", data.orderId)
      .order("position");
    if (!chars || chars.length === 0) throw new Error("لا توجد شخصيات في الطلب");

    const legacyCh = (order.characters as { language?: string } | null) ?? null;
    const language = (legacyCh?.language ?? "ar") as "ar" | "en" | "ku";
    const isAr = language === "ar";
    const isKu = language === "ku";
    const langName = isKu ? "Kurdish Sorani (کوردیی سۆرانی)" : isAr ? "Arabic" : "English";
    const pageCount = order.page_count ?? 5;
    const moods = (order.moods as string[]) ?? [];
    const customInstructions = (order.custom_instructions as string | null) ?? "";
    // Adult / sensitive content detection — drives prompt tone + model chain.
    const contentFlags = ((order.content_flags as string[] | null) ?? []).map((f) => f.toLowerCase());
    const isAdult = contentFlags.some((f) =>
      /sexual|erotic|libertine|polyam|romance|colloquial_explicit|trauma|meditation|جنسي|إباحي|تحرري|رومانسي|شبق/.test(f),
    );
    const ageBucket = (order.age_bucket as string | null) ?? null;
    const isAdultAudience = isAdult || ageBucket === "adult" || ageBucket === "young_adult" || ageBucket === "senior";

    const pricing = await getPricing();

    // Skip work if already produced
    const { data: existingPages } = await supabaseAdmin
      .from("story_pages")
      .select("page_number, text, image_prompt")
      .eq("order_id", data.orderId)
      .order("page_number");

    if (existingPages && existingPages.length === pageCount && order.title) {
      return { ok: true as const, alreadyDone: true };
    }

    // === Vision pass: analyze each uploaded character photo for a stable visual brief.
    // Done in parallel; saved on order_characters.visual_brief for re-use.
    await Promise.all(
      chars.map(async (c) => {
        if (c.visual_brief || !c.photo_path) return;
        const dataUrl = await photoToDataUrl(c.photo_path);
        if (!dataUrl) return;
        const res = await analyzeCharacterPhoto({ dataUrl, name: c.name, language });
        if (res) {
          await supabaseAdmin
            .from("order_characters")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .update({ visual_brief: res.brief, character_profile: (res.profile ?? null) as any })
            .eq("id", c.id);
          c.visual_brief = res.brief;
        }
      }),
    );

    const renderChar = (c: typeof chars[number], i: number, ar: boolean) => {
      const head = ar
        ? `${i + 1}. ${c.name}${c.age ? ` (عمر ${c.age})` : ""} — ${c.role}${c.description ? `: ${c.description}` : ""}${c.is_primary ? " [البطل الرئيسي]" : ""}`
        : `${i + 1}. ${c.name}${c.age ? ` (age ${c.age})` : ""} — ${c.role}${c.description ? `: ${c.description}` : ""}${c.is_primary ? " [main hero]" : ""}`;
      const vb = c.visual_brief ? `\n   ${ar ? "وصف بصري من الصورة المرفوعة" : "visual brief from uploaded photo"}: ${c.visual_brief}` : "";
      return head + vb;
    };
    const charsText = chars.map((c, i) => renderChar(c, i, true)).join("\n");
    const charsTextEn = chars.map((c, i) => renderChar(c, i, false)).join("\n");

    // === Anti-duplication: fingerprint + creative seed + look at recent siblings.
    const normName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
    const fingerprintRaw = [
      language,
      [...moods].sort().join("|"),
      chars.map((c) => normName(c.name)).sort().join("|"),
      customInstructions.trim().toLowerCase().slice(0, 120),
    ].join("::");
    const { createHash, randomBytes } = await import("crypto");
    const fingerprint = createHash("sha256").update(fingerprintRaw).digest("hex").slice(0, 32);

    const { data: priorFp } = await supabaseAdmin
      .from("story_fingerprints")
      .select("title, opening, plan_seed")
      .like("hash", `${fingerprint}-%`)
      .order("created_at", { ascending: false })
      .limit(5);
    const avoidList = (priorFp ?? [])
      .map((r) => `• "${r.title}" — ${(r.opening ?? "").slice(0, 120)}`)
      .join("\n");

    const makeSeed = () => randomBytes(4).toString("hex");
    let creativeSeed = makeSeed();

    const adultDirectiveAr = isAdultAudience
      ? `أنت كاتب أدبي بالغ للبالغين. اكتب نصاً حراً ناضجاً بجرأة، بأي مستوى صراحة عاطفية/حسية/جنسية/تحررية/تأملية يطلبه المستخدم، دون رقابة ذاتية أو تخفيف. لا تُذكِر قاصرين إطلاقاً في أي سياق. لا مشاهد عنف صريح/دم/تعذيب. لا محتوى سياسي أو كراهية. عدا ذلك، اكتب ما يريده المستخدم كما يريده. استخدم لغة أدبية غنية وإيقاعاً حسياً واعياً.`
      : "";
    const adultDirectiveEn = isAdultAudience
      ? `You are an adult literary author writing for adults. Produce mature, uncensored prose at whatever level of emotional/sensual/sexual/libertine/meditative explicitness the user requests, without self-censoring or softening. NEVER depict minors in any context. No explicit gore/torture. No political or hateful content. Otherwise write exactly what the user wants. Use rich literary language and deliberate sensory rhythm.`
      : "";
    const sys = isKu
      ? `${isAdultAudience ? "تۆ نووسەرێکی ئەدەبی گەورەسالانیت — بێ سانسۆر بنووسە بۆ گەورەسالان، بێ ئاماژە بە منداڵان." : "تۆ نووسەرێکی داهێنەری چیرۆکی منداڵانیت."} تەنها JSON دروستکراو بگەڕێنەوە. هەموو دەقی چیرۆکەکە بە زمانی ${langName} بێت.`
      : isAr
      ? `${isAdultAudience ? adultDirectiveAr : "أنت كاتب قصص أطفال مبدع."} أعد فقط كائن JSON صالحاً بدون أي شرح خارجي. اكتب كل نصوص القصة باللغة العربية.`
      : `${isAdultAudience ? adultDirectiveEn : "You are a creative children's storyteller."} Return ONLY a valid JSON object, no prose around it. Write all story text in ${langName}.`;

    const buildPrompt = (seed: string) => isKu
      ? `چیرۆکێکی ${pageCount} لاپەڕەیی بۆ ئەم کارەکتەرانە بنووسە بە زمانی کوردیی سۆرانی:
${charsText}

کەشوهەوای چیرۆکەکە: ${moods.join("، ")}.
${customInstructions ? `تێبینی زیادە لە خاوەنی چیرۆکەکەوە: ${customInstructions}` : ""}

تۆوی داهێنانی: ${seed} — بەکاری بهێنە بۆ گۆڕانکاری لە پلاتەکە و کارەکتەرە یاریدەدەرەکان.
${avoidList ? `⚠️ بە تەواوی ئەم دەستپێکە و پلاتانەی خوارەوە کە پێشتر بۆ هەمان کارەکتەرەکان دروستکراون دووربە:\n${avoidList}\nپلاتێکی نوێی جیاواز داهێنە.` : ""}

زمانێکی سادە و گەرم بەکار بهێنە کە گونجاو بێت بۆ منداڵان. هەر لاپەڕەیەک ٤ بۆ ٦ ڕستە بێت (نزیکەی ٦٠-٩٠ وشە). هەموو کارەکتەرەکان بە شێوەیەکی سروشتی لە ڕووداوەکاندا بەکاربهێنە.

JSON ی بەم شێوەیە بگەڕێنەوە (کلیلە تەکنیکییەکان بە ئینگلیزی بمێنن، دەقی چیرۆکەکە بە کوردی):
{
  "title": "ناونیشان بە کوردی",
  "character_visual": "وەسفێکی بینراوی جێگیر بۆ هەموو کارەکتەرەکان بە ئینگلیزی (بۆ نموونەی وێنە)",
  "cover_prompt": "وەسفی سەحنەی بەرگ بە ئینگلیزی",
  "pages": [ { "text": "دەقی لاپەڕە بە کوردی", "image_prompt": "وەسفی سەحنە بە ئینگلیزی" }, ... ${pageCount} دانە ]
}`
      : isAr
      ? `اكتب قصة من ${pageCount} صفحات لمجموعة الشخصيات التالية:
${charsText}

أجواء القصة: ${moods.join("، ")}.
${customInstructions ? `تعليمات إضافية من صاحب القصة: ${customInstructions}` : ""}

بذرة إبداعية: ${seed} — استخدمها لتنويع الحبكة والشخصيات الثانوية والعقدة.
${avoidList ? `⚠️ تجنّب تماماً الافتتاحيات والحبكات التالية التي سبق توليدها لهذه الشخصيات:\n${avoidList}\nاخترع حبكة جديدة مختلفة كلياً.` : ""}

استخدم لغة بسيطة دافئة مناسبة للأطفال. اجعل نص كل صفحة من 4 إلى 6 جمل (تقريباً 60-90 كلمة) لتتوازن بصرياً مع الصورة المرافقة، مع وصف للمشاعر وحوار قصير. أدمج كل الشخصيات في الأحداث بشكل طبيعي. عند وصف الشخصية بصرياً، استخدم المعلومات من "وصف بصري من الصورة المرفوعة" حرفياً.

أعد JSON بهذا الشكل بالضبط:
{
  "title": "...",
  "character_visual": "وصف بصري ثابت ومفصّل لكل الشخصيات (يدمج وصف الصور المرفوعة) لاستخدامه في كل صورة",
  "cover_prompt": "وصف مشهد الغلاف بالإنجليزية يضم كل الشخصيات",
  "pages": [ { "text": "نص الصفحة بالعربية", "image_prompt": "وصف مشهد الصفحة بالإنجليزية" } ، ... ${pageCount} عنصر ]
}`
      : `Write a ${pageCount}-page story for this cast:
${charsTextEn}

Story vibes: ${moods.join(", ")}.
${customInstructions ? `Author's notes: ${customInstructions}` : ""}

Creative seed: ${seed} — use it to vary plot, supporting cast and conflict.
${avoidList ? `⚠️ Strictly avoid these previously-generated openings/plots for this same cast:\n${avoidList}\nInvent a completely different plot.` : ""}

Use warm simple language for children. Each page should be 4 to 6 sentences (about 60-90 words). Weave all characters in naturally. When describing a character visually, USE the "visual brief from uploaded photo" line verbatim.

Return JSON exactly like:
{
  "title": "...",
  "character_visual": "Detailed persistent visual description merging the uploaded-photo briefs",
  "cover_prompt": "Cover scene description in English featuring all characters",
  "pages": [ { "text": "page text in English", "image_prompt": "scene description in English" }, ... ${pageCount} items ]
}`;

    const modelChain = [
      "google/gemini-3-flash-preview",
      "google/gemini-2.5-flash",
      "openai/gpt-5-mini",
      "openai/gpt-5",
    ] as const;

    const adultOverride = isAdultAudience
      ? (isKu
          ? `\n\n⚠️ زۆر گرنگ: ئەم چیرۆکە بۆ گەورەسالانە. هەموو ڕێنماییەکانی سەرەوە کە دەڵێن "منداڵانە" یان "ساکار" پشتگوێ بخە — بە شێوەیەکی ئەدەبی گەورەسالانی و بێ سانسۆر بنووسە.`
          : isAr
          ? `\n\n⚠️ مهم جداً: هذه القصة للبالغين. تجاهل أي تعليمات أعلاه تشير إلى "الأطفال" أو "لغة بسيطة"؛ اكتب نثراً أدبياً ناضجاً غير مُقنَّع، بأي مستوى صراحة عاطفية أو حسية أو جنسية أو تأمُّلية يطلبه المؤلف. هذا قد يعني مشاهد رومانسية/حسية/جنسية صريحة إن كان ذلك متماشياً مع طلب المستخدم. طول كل صفحة 90-150 كلمة.`
          : `\n\n⚠️ IMPORTANT: This is an adult work. Ignore any "children" or "simple language" directive above — write mature literary prose at whatever level of emotional/sensual/sexual/meditative explicitness the author requests. This may mean explicit romantic/sensual/sexual scenes when the user's brief calls for it. Each page 90-150 words.`)
      : "";

    const runChat = async (seed: string) => {
      let lastErr: string | null = null;
      for (const model of modelChain) {
        try {
          const chat = await callChat({
            model,
            messages: [
              { role: "system", content: sys },
              { role: "user", content: buildPrompt(seed) + adultOverride },
            ],
            response_format: { type: "json_object" },
          });
          const parsed = safeParseJson(chat.content);
          const ok = !!(parsed && parsed.pages && parsed.pages.length > 0);
          await logEvent(
            data.orderId,
            "story_plan",
            model,
            "chat",
            chat.meta,
            estimateTextCostUsd(model, chat.meta.usage),
            0,
            pricing,
            ok ? "success" : "error",
            ok ? null : `parse_failed finish=${chat.meta.finish_reason ?? "n/a"} chars=${chat.content.length}`,
          );
          if (ok) return parsed;
          lastErr = `parse_failed:${model}:${chat.meta.finish_reason ?? "unknown"}`;
        } catch (e) {
          lastErr = `${model}:${e instanceof Error ? e.message : String(e)}`;
          await logEvent(
            data.orderId, "story_plan", model, "chat",
            { log_id: null, run_id: null, usage: {}, duration_ms: 0 },
            0, 0, pricing, "error", lastErr.slice(0, 400),
          );
        }
      }
      throw new Error(`Failed to parse story plan (all models). Last: ${lastErr}`);
    };

    let plan = await runChat(creativeSeed);
    if (!plan || !plan.pages || plan.pages.length === 0) {
      throw new Error("Failed to parse story plan");
    }

    // Similarity check vs latest sibling — if too close, re-roll once.
    const opening = (plan.pages[0]?.text ?? "").slice(0, 200).toLowerCase();
    const jaccard = (a: string, b: string) => {
      const wa = new Set(a.split(/\s+/).filter(Boolean));
      const wb = new Set(b.split(/\s+/).filter(Boolean));
      const inter = [...wa].filter((w) => wb.has(w)).length;
      const uni = new Set([...wa, ...wb]).size;
      return uni === 0 ? 0 : inter / uni;
    };
    const prevOpenings = (priorFp ?? []).map((r) => (r.opening ?? "").toLowerCase());
    if (prevOpenings.some((p) => p && jaccard(opening, p) > 0.7)) {
      creativeSeed = makeSeed();
      const retry = await runChat(creativeSeed);
      if (retry && retry.pages?.length) plan = retry;
    }

    // === Story QA — one shot, one re-run max, fail-open on QA errors. ===
    try {
      const { runStoryQA } = await import("./story-qa.server");
      const heroAge = (chars.find((c) => c.is_primary)?.age as number | null) ?? null;
      let qa = await runStoryQA({
        plan: { title: plan.title, pages: plan.pages },
        pageCount, language, moods, heroAge,
      });
      await logEvent(data.orderId, "story_qa", "google/gemini-3.1-flash-lite", "chat",
        { log_id: null, run_id: null, usage: qa.usage, duration_ms: qa.duration_ms },
        qa.cost_usd, 0, pricing, qa.ok ? "success" : "error", qa.ok ? null : qa.reasons.join(" | "));
      if (!qa.ok) {
        creativeSeed = makeSeed();
        const retry = await runChat(creativeSeed);
        if (retry && retry.pages?.length) {
          plan = retry;
          qa = await runStoryQA({
            plan: { title: plan.title, pages: plan.pages },
            pageCount, language, moods, heroAge,
          });
          await logEvent(data.orderId, "story_qa_retry", "google/gemini-3.1-flash-lite", "chat",
            { log_id: null, run_id: null, usage: qa.usage, duration_ms: qa.duration_ms },
            qa.cost_usd, 0, pricing, qa.ok ? "success" : "error", qa.ok ? null : qa.reasons.join(" | "));
        }
      }
      await supabaseAdmin.from("orders").update({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        story_qa_report: qa as any,
      }).eq("id", data.orderId);
    } catch { /* fail-open: QA must never break the flow */ }

    const pagesPlan = plan.pages.slice(0, pageCount);
    while (pagesPlan.length < pageCount) {
      pagesPlan.push({ text: "", image_prompt: plan.character_visual ?? "" });
    }

    await supabaseAdmin
      .from("orders")
      .update({ title: plan.title, character_brief: plan.character_visual })
      .eq("id", data.orderId);

    await supabaseAdmin.from("generations").upsert(
      {
        order_id: data.orderId,
        first_paragraph: pagesPlan[0]?.text ?? "",
        full_story: JSON.stringify(plan),
      },
      { onConflict: "order_id" },
    );

    for (const [i, p] of pagesPlan.entries()) {
      await supabaseAdmin.from("story_pages").upsert(
        {
          order_id: data.orderId,
          page_number: i + 1,
          text: p.text,
          image_prompt: p.image_prompt,
        },
        { onConflict: "order_id,page_number" },
      );
    }

    // Record fingerprint so future generations for the same cast/moods diverge.
    await supabaseAdmin.from("story_fingerprints").insert({
      hash: `${fingerprint}-${data.orderId.slice(0, 8)}`,
      order_id: data.orderId,
      plan_seed: creativeSeed,
      title: plan.title,
      opening: (pagesPlan[0]?.text ?? "").slice(0, 240),
    }).then(() => {/* ignore conflicts */});

    // === Generate a short reflective question for the child, derived from the
    // story — printed on the thank-you page. Kept separate & cheap.
    try {
      const heroAge = (chars.find((c) => c.is_primary)?.age as number | null) ?? 7;
      const heroName = chars.find((c) => c.is_primary)?.name ?? "";
      const storyText = pagesPlan.map((p) => p.text).filter(Boolean).join("\n").slice(0, 3000);
      const qSys = isKu
        ? "تۆ مامۆستای منداڵانیت. تەنها یەک پرسیار دەردەخەیت، بێ هیچ ڕوونکردنەوەیەک. پرسیارەکە دەبێت بە کوردی بێت."
        : isAr
        ? "أنت مربي أطفال. تُخرج سؤالاً واحداً فقط دون أي شرح."
        : "You are a children's mentor. Output ONE question only, no extra text.";
      const qPrompt = isKu
        ? `لەم چیرۆکەوە، یەک پرسیاری ورد بۆ منداڵێکی ${heroAge} ساڵە${heroName ? ` بەناوی ${heroName}` : ""} بنووسە کە هانی بدات بیر لە بەهاکانی پاڵەوان بکاتەوە. یەک ڕستە، کەمتر لە ٢٠ وشە، بێ پێشەکی.\n\nدەقی چیرۆکەکە:\n${storyText}`
        : isAr
        ? `من هذه القصة، اكتب سؤالاً تأمّلياً واحداً لطفل عمره ${heroAge}${heroName ? ` اسمه ${heroName}` : ""} يشجّعه على التفكير بأخلاق البطل. جملة واحدة، أقل من 20 كلمة، بدون مقدمات.\n\nنص القصة:\n${storyText}`
        : `From this story, write ONE reflective question for a ${heroAge}-year-old child${heroName ? ` named ${heroName}` : ""} that invites them to think about the hero's values. One sentence, under 20 words, no preamble.\n\nStory:\n${storyText}`;
      const qChat = await callChat({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: qSys },
          { role: "user", content: qPrompt },
        ],
      });
      await logEvent(
        data.orderId,
        "reflection_question",
        "google/gemini-3-flash-preview",
        "chat",
        qChat.meta,
        estimateTextCostUsd("google/gemini-3-flash-preview", qChat.meta.usage),
        0,
        pricing,
      );
      const question = qChat.content.trim().replace(/^["'«»\s]+|["'«»\s]+$/g, "").split("\n")[0]?.trim() ?? "";
      if (question) {
        await supabaseAdmin
          .from("orders")
          .update({ reflective_question: question })
          .eq("id", data.orderId);
      }
    } catch (e) {
      console.error("reflection_question generation failed", e);
    }

    return { ok: true as const };
  });

/** Returns text-only progress for the preview page. */
export const getStoryProgress = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => OrderIdInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, page_count, title, status, images_status, tier, amount_iqd, user_id, pdf_path, order_number, moods, rejection_reason, redownload_status, redownload_amount_iqd, delivered_at, pdf_orientation, reflective_question")
      .eq("id", data.orderId)
      .maybeSingle();
    const { data: user } = order?.user_id
      ? await supabaseAdmin.from("users").select("full_name").eq("id", order.user_id).maybeSingle()
      : { data: null };
    const { data: gen } = await supabaseAdmin
      .from("generations")
      .select("first_paragraph, cover_image_path")
      .eq("order_id", data.orderId)
      .maybeSingle();
    const { data: pages } = await supabaseAdmin
      .from("story_pages")
      .select("page_number, text, image_path")
      .eq("order_id", data.orderId)
      .order("page_number");
    const { data: primaryChar } = await supabaseAdmin
      .from("order_characters")
      .select("name")
      .eq("order_id", data.orderId)
      .eq("is_primary", true)
      .maybeSingle();

    const imagesReady = order?.images_status === "ready";

    let cover_url: string | null = null;
    if (imagesReady && gen?.cover_image_path) {
      const s = await supabaseAdmin.storage.from("story-covers").createSignedUrl(gen.cover_image_path, 3600);
      cover_url = s.data?.signedUrl ?? null;
    }
    const pagesOut = await Promise.all(
      (pages ?? []).map(async (p) => {
        let url: string | null = null;
        if (imagesReady && p.image_path) {
          const s = await supabaseAdmin.storage.from("story-covers").createSignedUrl(p.image_path, 3600);
          url = s.data?.signedUrl ?? null;
        }
        return { page_number: p.page_number, text: p.text ?? "", image_url: url };
      }),
    );

    let pdf_url: string | null = null;
    if (imagesReady && order?.pdf_path) {
      const s = await supabaseAdmin.storage.from("story-pdfs").createSignedUrl(order.pdf_path, 60 * 60 * 24);
      pdf_url = s.data?.signedUrl ?? null;
    }

    return {
      title: order?.title ?? null,
      page_count: order?.page_count ?? 5,
      customer_name: user?.full_name ?? "",
      hero_name: (primaryChar?.name as string | null) ?? null,
      author_name: user?.full_name ?? null,
      first_paragraph: gen?.first_paragraph ?? "",
      cover_url,
      pages: pagesOut,
      pages_ready: pagesOut.length >= (order?.page_count ?? 0),
      images_status: (order?.images_status as string) ?? "idle",
      order_status: (order?.status as string) ?? "pending",
      tier: (order?.tier as string | null) ?? null,
      amount_iqd: order?.amount_iqd ?? 0,
      pdf_url,
      ready: imagesReady,
      moods: (order?.moods as string[] | null) ?? [],
      order_number: (order?.order_number as number | null) ?? null,
      rejection_reason: (order?.rejection_reason as string | null) ?? null,
      redownload_status: (order?.redownload_status as string | null) ?? null,
      redownload_amount_iqd: (order?.redownload_amount_iqd as number | null) ?? null,
      delivered_at: (order?.delivered_at as string | null) ?? null,
      pdf_orientation: ((order?.pdf_orientation as string | null) ?? "portrait") as "portrait" | "landscape",
      reflective_question: (order?.reflective_question as string | null) ?? null,
    };
  });

const ConfirmInput = z.object({
  orderId: z.string().uuid(),
  tier: z.enum(["pdf", "printed", "video"]),
});

/** User picks a tier. Updates amount + status, opens WhatsApp. NO image / PDF generation here. */
export const confirmTierAndPrepareWhatsapp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ConfirmInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const pricing = await getPricing();
    const { data: o0 } = await supabaseAdmin
      .from("orders")
      .select("page_count, moods, image_quality_tier, coupon_code, user_id")
      .eq("id", data.orderId)
      .single();
    const pageCount = o0?.page_count ?? 5;
    const { count: charCount } = await supabaseAdmin
      .from("order_characters")
      .select("id", { count: "exact", head: true })
      .eq("order_id", data.orderId);
    const characters = Math.max(1, charCount ?? 1);
    const moods = ((o0?.moods as string[] | null) ?? []).length || 1;
    const quality = (o0?.image_quality_tier as "standard" | "premium" | null) ?? "standard";
    const effQuality: "standard" | "premium" = quality === "premium" ? "premium" : "standard";
    const gross = computeTierAmount(data.tier as Tier, pageCount, pricing, characters, effQuality, moods);
    const { moodExtraIqd } = await import("./pricing");
    const moodExtra = moodExtraIqd(pricing, moods);

    // Apply coupon if present and valid.
    let discount = 0;
    let couponId: string | null = null;
    const code = (o0?.coupon_code as string | null)?.toUpperCase() ?? null;
    if (code) {
      const { data: c } = await supabaseAdmin
        .from("coupons")
        .select("id, discount_type, discount_value, max_uses, uses_count, valid_from, valid_to, active, applies_to")
        .eq("code", code)
        .maybeSingle();
      const now = Date.now();
      const valid =
        c && c.active &&
        (!c.valid_from || new Date(c.valid_from).getTime() <= now) &&
        (!c.valid_to || new Date(c.valid_to).getTime() >= now) &&
        (c.max_uses == null || (c.uses_count ?? 0) < c.max_uses);
      if (valid) {
        discount = c.discount_type === "percent"
          ? Math.round((gross * Number(c.discount_value)) / 100)
          : Math.round(Number(c.discount_value));
        discount = Math.max(0, Math.min(discount, gross));
        couponId = c.id;
      }
    }
    const amount = Math.max(0, gross - discount);

    const { data: ord, error } = await supabaseAdmin
      .from("orders")
      .update({
        tier: data.tier,
        amount_iqd: amount,
        coupon_discount_iqd: discount,
        mood_extra_iqd: moodExtra,
        whatsapp_sent_at: new Date().toISOString(),
      })
      .eq("id", data.orderId)
      .select("order_number, tier, amount_iqd, page_count")
      .single();
    if (error || !ord) throw new Error(error?.message || "Failed");

    if (couponId && discount > 0) {
      await supabaseAdmin.from("coupon_redemptions").insert({
        coupon_id: couponId,
        order_id: data.orderId,
        user_id: o0?.user_id ?? null,
        discount_iqd: discount,
      });
      // (uses_count is bumped below via direct update)
      // increment uses_count via update
      const { data: cRow } = await supabaseAdmin
        .from("coupons")
        .select("uses_count")
        .eq("id", couponId)
        .maybeSingle();
      await supabaseAdmin
        .from("coupons")
        .update({ uses_count: (cRow?.uses_count ?? 0) + 1 })
        .eq("id", couponId);
    }

    return {
      order_number: ord.order_number,
      tier: ord.tier,
      amount_iqd: ord.amount_iqd,
      page_count: ord.page_count,
      character_count: characters,
      discount_iqd: discount,
    };
  });

export const getOrderPublic = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => OrderIdInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: o } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, tier, amount_iqd, status, images_status, page_count, title, moods, custom_instructions, user_id, pdf_path, image_quality_tier, rejection_reason, rejected_at, redownload_status, redownload_amount_iqd, coupon_code, coupon_discount_iqd")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!o) return null;
    const { count: charCount } = await supabaseAdmin
      .from("order_characters")
      .select("id", { count: "exact", head: true })
      .eq("order_id", data.orderId);
    return { ...o, character_count: charCount ?? 1 };
  });

// Public pricing snapshot for /create and /preview
export const getPublicPricing = createServerFn({ method: "GET" }).handler(async () => {
  const p = await getPricing();
  return {
    tier_pdf_iqd: Number(p.tier_pdf_iqd),
    tier_printed_iqd: Number(p.tier_printed_iqd),
    tier_video_iqd: Number(p.tier_video_iqd),
    per_page_iqd_pdf: Number(p.per_page_iqd_pdf),
    per_page_iqd_printed: Number(p.per_page_iqd_printed),
    per_page_iqd_video: Number(p.per_page_iqd_video),
    per_character_iqd_pdf: Number(p.per_character_iqd_pdf ?? 1500),
    per_character_iqd_printed: Number(p.per_character_iqd_printed ?? 3000),
    per_character_iqd_video: Number(p.per_character_iqd_video ?? 6000),
    max_characters: Number(p.max_characters ?? 5),
    image_tier_standard_extra_iqd: Number((p as PricingRow).image_tier_standard_extra_iqd ?? 0),
    image_tier_premium_extra_iqd: Number((p as PricingRow).image_tier_premium_extra_iqd ?? 0),
    quality_premium_multiplier: Number((p as PricingRow).quality_premium_multiplier ?? 2),
    video_tier_enabled: Boolean((p as PricingRow).video_tier_enabled ?? false),
    free_moods_count: Number((p as PricingRow).free_moods_count ?? 1),
    mood_extra_iqd: Number((p as PricingRow).mood_extra_iqd ?? 0),
    redownload_iqd_pdf: Number((p as PricingRow).redownload_iqd_pdf ?? 1500),
    redownload_iqd_printed: Number((p as PricingRow).redownload_iqd_printed ?? 3000),
    redownload_iqd_video: Number((p as PricingRow).redownload_iqd_video ?? 5000),
  };
});

// List the current user's orders (for /my-orders)
export const myOrders = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUserSession } = await import("./user-session.server");
  const s = await requireUserSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, status, images_status, tier, amount_iqd, page_count, title, created_at, rejection_reason, rejected_at, redownload_status, redownload_amount_iqd, is_public, public_title, show_author, public_author_name, requires_admin_review, admin_review_note")
    .eq("user_id", s.data.userId!)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
});

// ============ ADMIN ============

async function gate() {
  const { requireAdmin } = await import("./admin-session.server");
  await requireAdmin();
}

export const adminListOrders = createServerFn({ method: "GET" }).handler(async () => {
  await gate();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, tier, amount_iqd, status, images_status, customer_phone, page_count, created_at, user_id, title, characters(customer_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  const userIds = Array.from(new Set((orders ?? []).map((o) => o.user_id).filter(Boolean) as string[]));
  const { data: users } = userIds.length
    ? await supabaseAdmin.from("users").select("id, full_name, phone").in("id", userIds)
    : { data: [] };
  const userById = new Map((users ?? []).map((u) => [u.id, u]));
  const { data: costs } = await supabaseAdmin
    .from("order_costs_v")
    .select("order_id, cost_iqd, gross_profit_iqd, margin_pct, total_tokens, images_generated, cost_credits, cost_usd");
  const byId = new Map((costs ?? []).map((c) => [c.order_id, c]));
  return (orders ?? []).map((o) => {
    const u = o.user_id ? userById.get(o.user_id) : null;
    const legacy = (o.characters as { customer_name?: string } | null) ?? null;
    return {
      ...o,
      customer_name: u?.full_name ?? legacy?.customer_name ?? null,
      customer_phone: u?.phone ?? o.customer_phone,
      cost: byId.get(o.id) ?? null,
    };
  });
});

export const adminGetOrder = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => OrderIdInput.parse(d))
  .handler(async ({ data }) => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: order }, { data: events }, { data: gen }, { data: cost }, { data: pages }, { data: chars }] = await Promise.all([
      supabaseAdmin.from("orders").select("*").eq("id", data.orderId).single(),
      supabaseAdmin.from("generation_events").select("*").eq("order_id", data.orderId).order("created_at", { ascending: true }),
      supabaseAdmin.from("generations").select("*").eq("order_id", data.orderId).maybeSingle(),
      supabaseAdmin.from("order_costs_v").select("*").eq("order_id", data.orderId).maybeSingle(),
      supabaseAdmin.from("story_pages").select("page_number, text, image_path, image_prompt").eq("order_id", data.orderId).order("page_number"),
      supabaseAdmin.from("order_characters").select("name, age, role, description, is_primary, position, photo_path").eq("order_id", data.orderId).order("position"),
    ]);
    const { data: user } = order?.user_id
      ? await supabaseAdmin.from("users").select("id, full_name, phone, created_at").eq("id", order.user_id).maybeSingle()
      : { data: null };

    let cover_url: string | null = null;
    let pdf_url: string | null = null;
    if (gen?.cover_image_path) {
      const s = await supabaseAdmin.storage.from("story-covers").createSignedUrl(gen.cover_image_path, 60 * 60);
      cover_url = s.data?.signedUrl ?? null;
    }
    const pdfPath = (order as { pdf_path?: string | null } | null)?.pdf_path;
    if (pdfPath) {
      const s = await supabaseAdmin.storage.from("story-pdfs").createSignedUrl(pdfPath, 60 * 60 * 24);
      pdf_url = s.data?.signedUrl ?? null;
    }
    const pageUrls = await Promise.all(
      (pages ?? []).map(async (p) => {
        let url: string | null = null;
        if (p.image_path) {
          const s = await supabaseAdmin.storage.from("story-covers").createSignedUrl(p.image_path, 60 * 60);
          url = s.data?.signedUrl ?? null;
        }
        return { page_number: p.page_number, text: p.text, image_url: url };
      }),
    );
    const charactersWithUrls = await Promise.all(
      (chars ?? []).map(async (c) => {
        let photo_url: string | null = null;
        if (c.photo_path) {
          const s = await supabaseAdmin.storage.from("story-uploads").createSignedUrl(c.photo_path, 60 * 60);
          photo_url = s.data?.signedUrl ?? null;
        }
        return { ...c, photo_url };
      }),
    );
    return {
      order,
      user,
      characters: charactersWithUrls,
      events: events ?? [],
      gen,
      cost,
      cover_url,
      pdf_url,
      pages: pageUrls,
    };
  });

export const adminUpdateStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      orderId: z.string().uuid(),
      status: z.enum(["pending", "paid", "delivered", "cancelled"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const patch = {
      status: data.status,
      ...(data.status === "paid" ? { paid_at: now } : {}),
      ...(data.status === "delivered" ? { delivered_at: now } : {}),
    };
    const { error } = await supabaseAdmin.from("orders").update(patch).eq("id", data.orderId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * Admin confirms payment → triggers cover + page image generation + PDF build.
 * Sets images_status='generating' then 'ready' on success, 'failed' on error.
 */
export const adminConfirmPaymentAndGenerate = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => OrderIdInput.parse(d))
  .handler(async ({ data }) => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Content-review gate: an order still flagged for admin review cannot start generation.
    // Admin must first approve via /admin/review-queue (adminApproveOrder).
    const { data: guard } = await supabaseAdmin
      .from("orders")
      .select("requires_admin_review, status")
      .eq("id", data.orderId).maybeSingle();
    if (guard?.requires_admin_review || guard?.status === "pending_review") {
      throw new Error("الطلب قيد المراجعة الإدارية — اعتمد المراجعة أولاً من قائمة المراجعة قبل تأكيد الدفع.");
    }
    if (guard?.status === "rejected") {
      throw new Error("الطلب مرفوض — لا يمكن بدء التوليد.");
    }

    await supabaseAdmin
      .from("orders")
      .update({
        status: "paid",
        payment_status: "paid",
        paid_at: new Date().toISOString(),
        payment_confirmed_at: new Date().toISOString(),
        images_status: "generating",
        images_error: null,
      })
      .eq("id", data.orderId);

    // Notify the customer (once) that payment is received and generation began.
    const { data: notifyOrder } = await supabaseAdmin
      .from("orders")
      .select("user_id, order_number, payment_confirmed_notified_at")
      .eq("id", data.orderId).maybeSingle();
    if (notifyOrder?.user_id && !notifyOrder.payment_confirmed_notified_at) {
      await supabaseAdmin.from("notifications").insert({
        user_id: notifyOrder.user_id,
        order_id: data.orderId,
        title: "تم استلام الدفع",
        body: `طلبك #${notifyOrder.order_number} قيد الإعداد الآن، قد يستغرق ذلك بعض الوقت.`,
        kind: "payment_confirmed",
      });
      await supabaseAdmin.from("orders")
        .update({ payment_confirmed_notified_at: new Date().toISOString() })
        .eq("id", data.orderId);
    }

    // Ensure the story text is generated BEFORE we start images (nothing runs before admin confirms).
    try {
      const { data: existingGen } = await supabaseAdmin
        .from("generations").select("full_story").eq("order_id", data.orderId).maybeSingle();
      if (!existingGen?.full_story) {
        await (generateFullStory as unknown as (a: { data: { orderId: string } }) => Promise<unknown>)({ data: { orderId: data.orderId } });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabaseAdmin.from("orders").update({ images_status: "failed", images_error: msg }).eq("id", data.orderId);
      throw e;
    }


    try {
      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("id, title, character_brief, page_count, customer_phone, user_id, image_quality_tier, art_style_lock, art_style_slug, art_style_category, pdf_orientation, characters(language)")
        .eq("id", data.orderId)
        .single();
      if (!order) throw new Error("Order missing");
      const { data: gen } = await supabaseAdmin
        .from("generations")
        .select("full_story, cover_image_path")
        .eq("order_id", data.orderId)
        .maybeSingle();
      const { data: pages } = await supabaseAdmin
        .from("story_pages")
        .select("page_number, image_prompt, image_path")
        .eq("order_id", data.orderId)
        .order("page_number");
      const { data: chars } = await supabaseAdmin
        .from("order_characters")
        .select("photo_path, is_primary, visual_brief, character_profile")
        .eq("order_id", data.orderId)
        .order("position");

      const pricing = await getPricing();
      const tier = (order.image_quality_tier as "fast" | "standard" | "premium" | null) ?? "standard";
      const effectiveTier: "standard" | "premium" = tier === "premium" ? "premium" : "standard";
      const coverModel = effectiveTier === "premium"
        ? "google/gemini-3-pro-image"
        : "google/gemini-3.1-flash-image";
      // Cost/quality win: on premium, use pro-image ONLY for the cover
      // (which becomes an additional reference for every page); pages use
      // flash-image guided by that pro cover → ~30% savings, quality stays
      // near-pro because the cover locks composition/style.
      const pageModel = "google/gemini-3.1-flash-image";

      // Preload primary character photo as data URL → used as visual reference for Gemini image gen.
      const primary = (chars ?? []).find((c) => c.is_primary) ?? (chars ?? [])[0];
      const referenceImages: string[] = [];
      if (primary?.photo_path && coverModel.startsWith("google/")) {
        const url = await photoToDataUrl(primary.photo_path);
        if (url) referenceImages.push(url);
      }

      const brief = (order.character_brief as string | null) ?? "";
      // Persistent art style lock — same style repeated across cover + every page,
      // so the whole book feels like one illustrated set. Only the LIGHTING varies per page.
      let artStyleLock = (order.art_style_lock as string | null) ?? "";
      if (!artStyleLock) {
        // Try to build lock from the chosen art_style_slug (new orders) → fallback to the default in DB → fallback to hardcoded storybook.
        const chosenSlug = (order as { art_style_slug?: string | null }).art_style_slug ?? null;
        let fragment: string | null = null;
        if (chosenSlug) {
          const { data: sty } = await supabaseAdmin
            .from("art_styles")
            .select("prompt_fragment")
            .eq("slug", chosenSlug)
            .maybeSingle();
          fragment = (sty as { prompt_fragment?: string } | null)?.prompt_fragment ?? null;
        }
        if (!fragment) {
          const { data: def } = await supabaseAdmin
            .from("art_styles")
            .select("prompt_fragment")
            .eq("is_default", true)
            .eq("category", "cartoon")
            .maybeSingle();
          fragment = (def as { prompt_fragment?: string } | null)?.prompt_fragment ?? null;
        }
        artStyleLock = fragment ??
          "warm children's storybook illustration, soft watercolor washes, gentle gouache textures, consistent thick outlines, saturated but harmonious palette, cinematic depth, clean composition centered on the subject, no letters or text in the illustration";
        await supabaseAdmin.from("orders").update({ art_style_lock: artStyleLock }).eq("id", data.orderId);
      }
      const style = artStyleLock;
      // Prefer the locked JSON character_profile when present; fall back to the free-text visual_brief.
      const dnaLines = (chars ?? [])
        .map((c) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const p = c.character_profile as any as CharacterProfile | null;
          if (p && typeof p === "object") {
            const parts = [
              p.gender && `gender: ${p.gender}`,
              p.age_group && `age: ${p.age_group}`,
              p.skin_tone && `skin: ${p.skin_tone}`,
              p.hair_color && `hair color: ${p.hair_color}`,
              p.hair_style && `hair style: ${p.hair_style}`,
              p.eye_color && `eyes: ${p.eye_color}`,
              p.face_shape && `face: ${p.face_shape}`,
              p.body_build && `build: ${p.body_build}`,
              p.clothing && `outfit: ${p.clothing}`,
              p.distinctive_features && `features: ${p.distinctive_features}`,
            ].filter(Boolean).join(", ");
            return parts ? `• ${parts}` : (c.visual_brief ? `• ${c.visual_brief}` : "");
          }
          return c.visual_brief ? `• ${c.visual_brief}` : "";
        })
        .filter(Boolean)
        .join("\n");
      const dnaTag = dnaLines
        ? `Character DNA (must match every page):\n${dnaLines}\n`
        : "";
      const consistencyTag = brief ? `Consistent cast across all pages — ${brief}. ` : "";
      const likenessTag = referenceImages.length
        ? "Use the reference photo ONLY to preserve facial features, hair, skin tone and body build of the illustrated character. "
        : "";

      // Aspect-ratio hint so the illustrator generates a frame that matches
      // the PDF orientation (prevents heads/feet being cropped in landscape PDFs).
      const orientation = ((order as { pdf_orientation?: string | null }).pdf_orientation ?? "portrait") as "portrait" | "landscape";
      const aspectTag = orientation === "landscape"
        ? "Frame the illustration in a WIDE 4:3 landscape composition, characters centered, plenty of horizontal scene around them. "
        : "Frame the illustration in a 3:4 portrait composition, characters centered, room above and below. ";

      // Strong negative constraints — prevent Gemini from ever pasting the reference photo
      // (or any inset/frame/thumbnail of it) into the final illustration.
      const negatives =
        "STRICT RULES: The output MUST be a single full-scene storybook illustration only. " +
        "ABSOLUTELY NO photograph, no photo-of-a-photo, no photo-in-photo, no picture-in-picture, " +
        "no inset image, no side panel, no thumbnail, no polaroid, no framed reference on any wall or table, " +
        "no collage, no before/after comparison, no split screen, no reference sheet, no character turnaround, " +
        "no watermark, no logo, no text, no letters, no captions, no signatures. " +
        "Never render the original uploaded photo or any cropped part of it inside the scene. " +
        "Only the illustrated storybook scene fills the frame. " +
        "Preserve gender, age group, hair, skin tone, body build from the character DNA exactly. " +
        // Anatomy + quality guardrails (2026-07 quality lift)
        "No deformed hands, no extra fingers, no missing fingers, no fused faces, no melting features, " +
        "no plastic skin, no dead eyes, no low-resolution artifacts, no muddy shadows, no lazy or empty background. ";

      // Quality master directive — always injected for a consistent, cinematic result.
      const qualityMaster =
        "QUALITY MASTER: cinematic lighting, balanced rule-of-thirds composition, coherent color palette across the book, " +
        "sharp focal subject, expressive but anatomically correct hands and faces, painterly texture, " +
        "rich depth of field, professional illustration finish, 8K detail, magazine-cover polish.";


      // Cover
      let coverPath = gen?.cover_image_path as string | null;
      if (!coverPath) {
        let coverPrompt = "";
        try {
          const parsed = gen?.full_story ? JSON.parse(gen.full_story as string) as { cover_prompt?: string } : null;
          coverPrompt = parsed?.cover_prompt ?? "";
        } catch { /* ignore */ }
        const cp = coverPrompt
          ? `${aspectTag}${likenessTag}${dnaTag}${consistencyTag}${coverPrompt}. ${style}. ${qualityMaster} ${negatives} Book cover composition, leave headroom for title.`
          : `${aspectTag}${likenessTag}${dnaTag}${consistencyTag}Book cover for "${order.title ?? "Story"}". ${style}. ${qualityMaster} ${negatives}`;

        coverPath = await generateOneImage({
          orderId: data.orderId,
          step: "cover_image",
          prompt: cp,
          storagePath: `covers/${data.orderId}.png`,
          pricing,
          model: coverModel,
          referenceImages,
        });
        if (coverPath) {
          await supabaseAdmin
            .from("generations")
            .upsert({ order_id: data.orderId, cover_image_path: coverPath }, { onConflict: "order_id" });
        }
      }

      // Add the cover itself as an extra reference for every page — this
      // locks composition, color palette and character look across the book.
      const pageRefs: string[] = [...referenceImages];
      if (coverPath) {
        try {
          const signed = await supabaseAdmin.storage.from("story-covers").createSignedUrl(coverPath, 60 * 60);
          if (signed.data?.signedUrl) {
            const dataUrl = await photoToDataUrl(coverPath).catch(() => null);
            if (dataUrl) pageRefs.push(dataUrl);
          }
        } catch { /* ignore */ }
      }

      // Page images
      const todo = (pages ?? []).filter((p) => !p.image_path);
      const { runImageQA } = await import("./image-qa.server");
      const characterDna = dnaLines || brief;
      const langForQa = ((order.characters as { language?: string } | null)?.language ?? "ar") as "ar" | "en" | "ku";
      await runWithConcurrency(todo, 3, async (p) => {
        const lights = ["soft morning light", "warm golden hour", "gentle dusk", "cool overcast noon", "candle-lit dusk", "bright noon sun"];
        const lighting = lights[((p.page_number ?? 1) - 1) % lights.length];
        const basePrompt = `${aspectTag}${likenessTag}${dnaTag}${consistencyTag}Scene: ${p.image_prompt ?? ""}. ${style}, lighting: ${lighting}. Keep the same character faces, outfits and art style as the cover. ${qualityMaster} ${negatives}`;
        let path = await generateOneImage({
          orderId: data.orderId,
          step: `page_${p.page_number}_image`,
          prompt: basePrompt,
          storagePath: `pages/${data.orderId}/${p.page_number}.png`,
          pricing,
          model: pageModel,
          referenceImages: pageModel.startsWith("google/") ? pageRefs : undefined,
        });
        if (path) {
          // Image QA — one retry max, fail-open on QA errors.
          try {
            const qa = await runImageQA({
              imagePath: path,
              expectedScene: p.image_prompt ?? "",
              characterDna,
              language: langForQa,
            });
            await logEvent(data.orderId, `image_qa_page_${p.page_number}`, "google/gemini-3.1-flash-lite", "chat",
              { log_id: null, run_id: null, usage: qa.usage, duration_ms: qa.duration_ms },
              qa.cost_usd, 0, pricing, qa.ok ? "success" : "error", qa.ok ? null : qa.issues.join(" | "));
            let retries = 0;
            let finalQa = qa;
            if (!qa.ok) {
              const stronger = basePrompt + " AVOID: deformed hands, extra limbs, embedded text, image-in-image, character cropping. ";
              const retryPath = await generateOneImage({
                orderId: data.orderId,
                step: `page_${p.page_number}_image_retry`,
                prompt: stronger,
                storagePath: `pages/${data.orderId}/${p.page_number}.png`,
                pricing,
                model: pageModel,
                referenceImages: pageModel.startsWith("google/") ? pageRefs : undefined,
              });
              if (retryPath) {
                path = retryPath;
                retries = 1;
                finalQa = await runImageQA({
                  imagePath: retryPath,
                  expectedScene: p.image_prompt ?? "",
                  characterDna,
                  language: langForQa,
                });
                await logEvent(data.orderId, `image_qa_page_${p.page_number}_retry`, "google/gemini-3.1-flash-lite", "chat",
                  { log_id: null, run_id: null, usage: finalQa.usage, duration_ms: finalQa.duration_ms },
                  finalQa.cost_usd, 0, pricing, finalQa.ok ? "success" : "error", finalQa.ok ? null : finalQa.issues.join(" | "));
              }
            }
            await supabaseAdmin
              .from("story_pages")
              .update({
                image_path: path,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                qa_report: finalQa as any,
                qa_retries: retries,
              })
              .eq("order_id", data.orderId)
              .eq("page_number", p.page_number);
          } catch {
            await supabaseAdmin
              .from("story_pages")
              .update({ image_path: path })
              .eq("order_id", data.orderId)
              .eq("page_number", p.page_number);
          }
        }
      });

      // PDF is built in the browser (pdf-client.ts) on demand to avoid Worker bundler
      // interop issues with @pdf-lib/fontkit; once all page images exist the story is "ready".
      await supabaseAdmin
        .from("orders")
        .update({ images_status: "ready" })
        .eq("id", data.orderId);

      return { ok: true as const };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabaseAdmin
        .from("orders")
        .update({ images_status: "failed", images_error: msg })
        .eq("id", data.orderId);
      throw e;
    }
  });

export const adminRegeneratePage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid(), pageNumber: z.coerce.number().int().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: page } = await supabaseAdmin
      .from("story_pages")
      .select("image_prompt")
      .eq("order_id", data.orderId)
      .eq("page_number", data.pageNumber)
      .maybeSingle();
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("character_brief, pdf_path")
      .eq("id", data.orderId)
      .single();
    const brief = order?.character_brief ?? "";
    const prompt = `Consistent cast across all pages — ${brief}. Scene: ${page?.image_prompt ?? ""}. warm storybook illustration, soft watercolor, vibrant colors. No text in the image.`;
    const pricing = await getPricing();
    const path = await generateOneImage({
      orderId: data.orderId,
      step: `page_${data.pageNumber}_regen`,
      prompt,
      storagePath: `pages/${data.orderId}/${data.pageNumber}.png`,
      pricing,
    });
    if (path) {
      await supabaseAdmin
        .from("story_pages")
        .update({ image_path: path })
        .eq("order_id", data.orderId)
        .eq("page_number", data.pageNumber);
      if (order?.pdf_path) {
        await supabaseAdmin.storage.from("story-pdfs").remove([order.pdf_path]);
        await supabaseAdmin.from("orders").update({ pdf_path: null }).eq("id", data.orderId);
      }
    }
    return { ok: true as const };
  });

export const getStoryPdfUrl = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => OrderIdInput.parse(d))
  .handler(async ({ data }) => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("pdf_path")
      .eq("id", data.orderId)
      .single();
    if (!order?.pdf_path) return { url: null };
    const s = await supabaseAdmin.storage.from("story-pdfs").createSignedUrl(order.pdf_path, 60 * 60 * 24);
    return { url: s.data?.signedUrl ?? null };
  });

export const adminGetPricing = createServerFn({ method: "GET" }).handler(async () => {
  await gate();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("pricing_settings").select("*").eq("id", 1).single();
  return data;
});

const PricingInput = z.object({
  usd_per_credit: z.coerce.number().positive(),
  iqd_per_usd: z.coerce.number().positive(),
  tier_pdf_iqd: z.coerce.number().int().nonnegative(),
  tier_printed_iqd: z.coerce.number().int().nonnegative(),
  tier_video_iqd: z.coerce.number().int().nonnegative(),
  per_page_iqd_pdf: z.coerce.number().int().nonnegative(),
  per_page_iqd_printed: z.coerce.number().int().nonnegative(),
  per_page_iqd_video: z.coerce.number().int().nonnegative(),
  per_character_iqd_pdf: z.coerce.number().int().nonnegative(),
  per_character_iqd_printed: z.coerce.number().int().nonnegative(),
  per_character_iqd_video: z.coerce.number().int().nonnegative(),
  max_characters: z.coerce.number().int().min(1).max(10),
  print_cost_iqd: z.coerce.number().int().nonnegative(),
  shipping_cost_iqd: z.coerce.number().int().nonnegative(),
  image_tier_standard_extra_iqd: z.coerce.number().int().nonnegative().default(0),
  image_tier_premium_extra_iqd: z.coerce.number().int().nonnegative().default(0),
  quality_premium_multiplier: z.coerce.number().positive().max(20).default(2),
  video_tier_enabled: z.coerce.boolean().default(false),
  free_moods_count: z.coerce.number().int().nonnegative().default(1),
  mood_extra_iqd: z.coerce.number().int().nonnegative().default(0),
  redownload_iqd_pdf: z.coerce.number().int().nonnegative().default(1500),
  redownload_iqd_printed: z.coerce.number().int().nonnegative().default(3000),
  redownload_iqd_video: z.coerce.number().int().nonnegative().default(5000),
  ai_cost_estimate_standard: z.coerce.number().nonnegative().default(0.05),
  ai_cost_estimate_premium: z.coerce.number().nonnegative().default(0.15),
  whatsapp_admin_number: z.string().trim().min(3).max(40).default("9647733570130"),
});


export const adminUpdatePricing = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => PricingInput.parse(d))
  .handler(async ({ data }) => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("pricing_settings").update(data).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminAnalytics = createServerFn({ method: "GET" }).handler(async () => {
  await gate();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: costs } = await supabaseAdmin
    .from("order_costs_v")
    .select("revenue_iqd, cost_iqd, gross_profit_iqd, status, tier");
  const rows = costs ?? [];
  let revenue = 0, cost = 0, profit = 0;
  for (const r of rows) {
    if (r.status === "paid" || r.status === "delivered") {
      revenue += Number(r.revenue_iqd) || 0;
      profit += Number(r.gross_profit_iqd) || 0;
    }
    cost += Number(r.cost_iqd) || 0;
  }
  return {
    total_revenue_iqd: revenue,
    total_cost_iqd: cost,
    total_profit_iqd: profit,
    total_orders: rows.length,
    by_tier: {
      pdf: rows.filter((r) => r.tier === "pdf").length,
      printed: rows.filter((r) => r.tier === "printed").length,
      video: rows.filter((r) => r.tier === "video").length,
    },
  };
});

// === Users (admin) ===
export const adminListUsers = createServerFn({ method: "GET" }).handler(async () => {
  await gate();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: users } = await supabaseAdmin
    .from("users")
    .select("id, full_name, phone, marketing_consent, notes, last_login_at, created_at, status")
    .order("created_at", { ascending: false })
    .limit(500);
  const ids = (users ?? []).map((u) => u.id);
  const phones = (users ?? []).map((u) => u.phone).filter(Boolean) as string[];
  const [{ data: orders }, { data: bans }] = await Promise.all([
    ids.length
      ? supabaseAdmin.from("orders").select("user_id, amount_iqd, status").in("user_id", ids)
      : Promise.resolve({ data: [] as { user_id: string | null; amount_iqd: number | null; status: string }[] }),
    phones.length
      ? supabaseAdmin.from("phone_bans").select("phone, reason").in("phone", phones)
      : Promise.resolve({ data: [] as { phone: string; reason: string | null }[] }),
  ]);
  const stats = new Map<string, { count: number; spent: number }>();
  for (const o of orders ?? []) {
    if (!o.user_id) continue;
    const s = stats.get(o.user_id) ?? { count: 0, spent: 0 };
    s.count++;
    if (o.status === "paid" || o.status === "delivered") s.spent += Number(o.amount_iqd) || 0;
    stats.set(o.user_id, s);
  }
  const bannedPhones = new Map<string, string | null>();
  for (const b of bans ?? []) bannedPhones.set(b.phone, b.reason);
  return (users ?? []).map((u) => {
    const isBanned = (u.phone && bannedPhones.has(u.phone)) || u.status === "banned";
    return {
      ...u,
      order_count: stats.get(u.id)?.count ?? 0,
      total_spent_iqd: stats.get(u.id)?.spent ?? 0,
      status: (isBanned ? "banned" : (u.status ?? "active")) as "active" | "suspended" | "banned",
      ban_reason: u.phone ? bannedPhones.get(u.phone) ?? null : null,
    };
  });
});

// ============= User moderation (admin) =============

const UserIdInput = z.object({ userId: z.string().uuid() });

export const adminSetUserStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      userId: z.string().uuid(),
      status: z.enum(["active", "suspended", "banned"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("users").update({ status: data.status }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => UserIdInput.parse(d))
  .handler(async ({ data }) => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // orders have ON DELETE CASCADE via user_id? If not, null user_id or delete orders too.
    // Delete cascade child data first to be safe (orders may not have cascade).
    const { data: orders } = await supabaseAdmin.from("orders").select("id").eq("user_id", data.userId);
    for (const o of orders ?? []) {
      await supabaseAdmin.from("orders").delete().eq("id", o.id);
    }
    const { error } = await supabaseAdmin.from("users").delete().eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ============= Order moderation (admin) =============

export const adminRejectOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ orderId: z.string().uuid(), reason: z.string().trim().min(1).max(500) }).parse(d),
  )
  .handler(async ({ data }) => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("orders")
      .update({
        status: "cancelled",
        rejection_reason: data.reason,
        rejected_at: new Date().toISOString(),
      })
      .eq("id", data.orderId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminDeleteOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => OrderIdInput.parse(d))
  .handler(async ({ data }) => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("orders").delete().eq("id", data.orderId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ============= Coupons (admin) =============

const CouponInput = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().min(2).max(40).transform((s) => s.toUpperCase()),
  discount_type: z.enum(["percent", "fixed"]),
  discount_value: z.coerce.number().positive(),
  max_uses: z.coerce.number().int().positive().nullable().optional(),
  valid_from: z.string().optional().nullable(),
  valid_to: z.string().optional().nullable(),
  applies_to: z.enum(["all", "new"]).default("all"),
  min_pages: z.coerce.number().int().nonnegative().default(0),
  applies_quality: z.array(z.enum(["standard", "premium"])).default(["standard", "premium"]),
  applies_tier: z.array(z.enum(["pdf", "printed", "video"])).default(["pdf", "printed", "video"]),
  active: z.boolean().default(true),
});

export const adminListCoupons = createServerFn({ method: "GET" }).handler(async () => {
  await gate();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("coupons").select("*").order("created_at", { ascending: false });
  return data ?? [];
});

export const adminUpsertCoupon = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CouponInput.parse(d))
  .handler(async ({ data }) => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      code: data.code,
      discount_type: data.discount_type,
      discount_value: data.discount_value,
      max_uses: data.max_uses ?? null,
      valid_from: data.valid_from || null,
      valid_to: data.valid_to || null,
      applies_to: data.applies_to,
      min_pages: data.min_pages,
      applies_quality: data.applies_quality,
      applies_tier: data.applies_tier,
      active: data.active,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("coupons").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("coupons").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });


export const adminDeleteCoupon = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("coupons").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// Public: check a coupon before submitting.
// Accepts optional pageCount/quality/tier for constraint-aware validation.
export const validateCoupon = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    code: z.string().trim().min(1).max(40),
    pageCount: z.coerce.number().int().min(1).max(100).optional(),
    quality: z.enum(["standard", "premium"]).optional(),
    tier: z.enum(["pdf", "printed", "video"]).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = data.code.toUpperCase();
    const { data: c } = await supabaseAdmin
      .from("coupons")
      .select("code, discount_type, discount_value, max_uses, uses_count, valid_from, valid_to, active, min_pages, applies_quality, applies_tier")
      .eq("code", code)
      .maybeSingle();
    if (!c) return { ok: false as const, reason: "الكوبون غير موجود" };
    if (!c.active) return { ok: false as const, reason: "الكوبون متوقف" };
    const now = Date.now();
    if (c.valid_from && new Date(c.valid_from).getTime() > now)
      return { ok: false as const, reason: "الكوبون لم يبدأ بعد" };
    if (c.valid_to && new Date(c.valid_to).getTime() < now)
      return { ok: false as const, reason: "الكوبون منتهي الصلاحية" };
    if (c.max_uses != null && (c.uses_count ?? 0) >= c.max_uses)
      return { ok: false as const, reason: "استُنفدَ حد استخدام الكوبون" };
    if (data.pageCount != null && data.pageCount < (c.min_pages ?? 0))
      return { ok: false as const, reason: `الكوبون يبدأ من ${c.min_pages} صفحات` };
    const aq = (c.applies_quality ?? []) as string[];
    if (data.quality && aq.length > 0 && !aq.includes(data.quality))
      return { ok: false as const, reason: "الكوبون لا يشمل هذه الجودة" };
    const at = (c.applies_tier ?? []) as string[];
    if (data.tier && at.length > 0 && !at.includes(data.tier))
      return { ok: false as const, reason: "الكوبون لا يشمل هذه الباقة" };
    return {
      ok: true as const,
      code: c.code,
      discount_type: c.discount_type,
      discount_value: Number(c.discount_value),
    };
  });

// ============= Phone bans (admin) =============
const PhoneBanInput = z.object({ phone: z.string().trim().min(3).max(40), reason: z.string().trim().max(500).optional() });

export const adminBanPhone = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => PhoneBanInput.parse(d))
  .handler(async ({ data }) => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { normalizePhone } = await import("./sms.server");
    const phone = normalizePhone(data.phone);
    await supabaseAdmin.from("phone_bans").upsert(
      { phone, reason: data.reason ?? null, banned_at: new Date().toISOString() },
      { onConflict: "phone" },
    );
    // Also mark the user row (if any) and drop an in-app notification.
    const { data: u } = await supabaseAdmin.from("users").select("id").eq("phone", phone).maybeSingle();
    if (u) {
      await supabaseAdmin.from("users").update({ status: "banned" }).eq("id", u.id);
      await supabaseAdmin.from("notifications").insert({
        user_id: u.id,
        title: "تم حظر حسابك",
        body: data.reason ? `السبب: ${data.reason}` : "تواصل مع الإدارة لمزيد من التفاصيل.",
        kind: "ban",
      });
    }
    return { ok: true as const };
  });

export const adminUnbanPhone = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => PhoneBanInput.parse(d))
  .handler(async ({ data }) => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { normalizePhone } = await import("./sms.server");
    const phone = normalizePhone(data.phone);
    await supabaseAdmin.from("phone_bans").delete().eq("phone", phone);
    const { data: u } = await supabaseAdmin.from("users").select("id").eq("phone", phone).maybeSingle();
    if (u) {
      await supabaseAdmin.from("users").update({ status: "active" }).eq("id", u.id);
      await supabaseAdmin.from("notifications").insert({
        user_id: u.id,
        title: "تم رفع الحظر عن حسابك",
        body: data.reason ? `السبب: ${data.reason}` : "يمكنك الآن استخدام الموقع من جديد.",
        kind: "unban",
      });
    }
    return { ok: true as const };
  });

// ============= Reorder (completed order) =============
export const reorderExisting = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    orderId: z.string().uuid(),
    quality: z.enum(["standard", "premium"]),
    coupon_code: z.string().trim().max(40).optional().nullable(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { requireUserSession } = await import("./user-session.server");
    const s = await requireUserSession();
    const userId = s.data.userId!;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: src } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, page_count, moods, custom_instructions, tier")
      .eq("id", data.orderId).maybeSingle();
    if (!src || src.user_id !== userId) throw new Error("غير مصرح");

    const { data: chars } = await supabaseAdmin
      .from("order_characters")
      .select("name, age, role, description, photo_path, is_primary, position")
      .eq("order_id", data.orderId)
      .order("position");
    const characters = (chars ?? []).map((c) => ({
      name: c.name, age: c.age ?? null, role: c.role,
      description: c.description ?? "", photo_path: c.photo_path ?? null,
    }));
    // Delegate to createOrderDraft's logic by inlining the safe parts here.
    // We reuse `createOrderDraft` handler by calling its innards via a small trick:
    // just build a synthetic input and route through the same logic path.
    // For simplicity we call it directly with the same auth session already present.
    const input = {
      characters,
      moods: (src.moods as string[]) ?? ["adventure"],
      custom_instructions: src.custom_instructions ?? "",
      language: "ar" as const,
      page_count: src.page_count ?? 5,
      disclaimer_accepted: true,
      coupon_code: data.coupon_code ?? undefined,
      tier: (src.tier as "pdf" | "printed" | "video") ?? "pdf",
      image_quality_tier: data.quality,
    };
    // Direct call — we're already inside a server context with the same session.
    return await createOrderDraft({ data: input });

  });



// ============= Redownload (paid re-download) =============

export const requestRedownload = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => OrderIdInput.parse(d))
  .handler(async ({ data }) => {
    const { requireUserSession } = await import("./user-session.server");
    const s = await requireUserSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, tier, user_id, redownload_status")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order || order.user_id !== s.data.userId) throw new Error("غير مصرح");
    if (order.redownload_status === "pending") throw new Error("طلبك موجود مسبقاً");
    const pricing = await getPricing();
    const { redownloadPrice } = await import("./pricing");
    const amount = redownloadPrice(pricing, order.tier);
    await supabaseAdmin.from("redownload_requests").insert({
      order_id: order.id,
      user_id: s.data.userId!,
      amount_iqd: amount,
    });
    await supabaseAdmin
      .from("orders")
      .update({
        redownload_status: "pending",
        redownload_amount_iqd: amount,
        redownload_requested_at: new Date().toISOString(),
      })
      .eq("id", order.id);
    return { ok: true as const, amount_iqd: amount };
  });

export const adminConfirmRedownload = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => OrderIdInput.parse(d))
  .handler(async ({ data }) => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    await supabaseAdmin
      .from("orders")
      .update({ redownload_status: "paid", redownload_paid_at: now })
      .eq("id", data.orderId);
    await supabaseAdmin
      .from("redownload_requests")
      .update({ status: "paid", paid_at: now })
      .eq("order_id", data.orderId)
      .eq("status", "pending");
    return { ok: true as const };
  });

// ============= Admin: retry image generation after failure =============

/**
 * Resets a failed order's image state and re-runs the full image generation pipeline.
 * Safe to call multiple times; existing cover/page images are reused.
 */
export const adminRetryImageGeneration = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => OrderIdInput.parse(d))
  .handler(async ({ data }) => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("orders")
      .update({ images_error: null, images_status: "generating" })
      .eq("id", data.orderId);
    // Delegate to the same pipeline used on initial payment confirmation.
    // It is idempotent: existing story text and images are reused.
    return await (adminConfirmPaymentAndGenerate as unknown as (a: { data: { orderId: string } }) => Promise<{ ok: true }>)(
      { data: { orderId: data.orderId } },
    );
  });

// ============= User: prefill data for "recreate with new options" =============

export type OrderPrefill = {
  characters: Array<{
    name: string;
    age: number | null;
    role: "protagonist" | "friend" | "family" | "pet" | "other";
    description: string;
    photo_path: string | null;
  }>;
  moods: string[];
  custom_instructions: string;
  language: "ar" | "en" | "ku";
  page_count: number;
  pdf_orientation: "portrait" | "landscape";
  image_quality_tier: "standard" | "premium";
  tier: "pdf" | "printed" | "video";
};

export const getOrderPrefill = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => OrderIdInput.parse(d))
  .handler(async ({ data }): Promise<OrderPrefill> => {
    const { requireUserSession } = await import("./user-session.server");
    const s = await requireUserSession();
    const userId = s.data.userId!;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, page_count, moods, custom_instructions, tier, image_quality_tier, pdf_orientation, characters(language)")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order || order.user_id !== userId) throw new Error("غير مصرح");

    const { data: chars } = await supabaseAdmin
      .from("order_characters")
      .select("name, age, role, description, photo_path, position")
      .eq("order_id", data.orderId)
      .order("position");

    const iq = ((order.image_quality_tier as string | null) ?? "standard").toLowerCase();
    const quality: "standard" | "premium" = iq === "premium" ? "premium" : "standard";
    const lang = (((order.characters as { language?: string } | null)?.language ?? "ar") as "ar" | "en" | "ku");

    return {
      characters: (chars ?? []).map((c) => ({
        name: (c.name as string | null) ?? "",
        age: (c.age as number | null) ?? null,
        role: (((c.role as string) ?? "protagonist") as OrderPrefill["characters"][number]["role"]),
        description: (c.description as string | null) ?? "",
        photo_path: (c.photo_path as string | null) ?? null,
      })),
      moods: ((order.moods as string[] | null) ?? ["adventure"]),
      custom_instructions: (order.custom_instructions as string | null) ?? "",
      language: lang,
      page_count: (order.page_count as number | null) ?? 5,
      pdf_orientation: (((order.pdf_orientation as string | null) ?? "portrait") as "portrait" | "landscape"),
      image_quality_tier: quality,
      tier: (((order.tier as string | null) ?? "pdf") as "pdf" | "printed" | "video"),
    };
  });


