import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { computeTierAmount, MIN_PAGES, MAX_PAGES, type PricingLike, type Tier } from "./pricing";

const CreateInput = z.object({
  customer_name: z.string().trim().min(1).max(60),
  customer_phone: z.string().trim().min(5).max(30),
  age: z.coerce.number().int().min(1).max(120),
  mood: z.string().trim().min(1).max(40),
  language: z.enum(["ar", "en"]).default("ar"),
  page_count: z.coerce.number().int().min(MIN_PAGES).max(MAX_PAGES).default(5),
  image_data_url: z.string().min(20).max(20_000_000),
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
      print_cost_iqd: 0,
      shipping_cost_iqd: 0,
    };
  }
  return data as PricingRow;
}

export const createOrderDraft = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const m = data.image_data_url.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
    if (!m) throw new Error("Invalid image data URL");
    const mime = m[1];
    const ext = mime.split("/")[1].replace("jpeg", "jpg").split("+")[0];
    const buffer = Buffer.from(m[2], "base64");
    if (buffer.byteLength > 8 * 1024 * 1024) throw new Error("Image too large (max 8MB)");

    const id = crypto.randomUUID();
    const path = `uploads/${id}.${ext}`;
    const up = await supabaseAdmin.storage
      .from("story-uploads")
      .upload(path, buffer, { contentType: mime, upsert: false });
    if (up.error) throw new Error(up.error.message);

    const { data: ch, error: chErr } = await supabaseAdmin
      .from("characters")
      .insert({
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        age: data.age,
        mood: data.mood,
        image_path: path,
        language: data.language,
      })
      .select("id")
      .single();
    if (chErr || !ch) throw new Error(chErr?.message || "Failed to create character");

    const { data: ord, error: ordErr } = await supabaseAdmin
      .from("orders")
      .insert({
        character_id: ch.id,
        customer_phone: data.customer_phone,
        status: "pending",
        page_count: data.page_count,
      })
      .select("id, order_number")
      .single();
    if (ordErr || !ord) throw new Error(ordErr?.message || "Failed to create order");

    return { orderId: ord.id as string, orderNumber: ord.order_number as number };
  });

const OrderIdInput = z.object({ orderId: z.string().uuid() });

type StoryPlan = {
  title: string;
  character_visual: string;
  cover_prompt: string;
  pages: Array<{ text: string; image_prompt: string }>;
};

function safeParseJson(text: string): StoryPlan | null {
  // Strip code fences
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(cleaned) as StoryPlan;
  } catch {
    // try to extract first {...}
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
}): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { callImage, estimateImageCostUsd } = await import("./ai-gateway.server");
  const imgModel = "google/gemini-3.1-flash-image";
  try {
    const img = await callImage({ model: imgModel, prompt: args.prompt });
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
 * Generate the full multi-page story: text plan + cover + page images.
 * Idempotent: if already generated, returns existing data quickly.
 */
export const generateFullStory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => OrderIdInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { callChat, estimateTextCostUsd } = await import("./ai-gateway.server");

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, character_id, page_count, title, character_brief, characters(customer_name, age, mood, language)")
      .eq("id", data.orderId)
      .single();
    if (!order) throw new Error("Order not found");
    const ch = order.characters as { customer_name: string; age: number; mood: string; language: string } | null;
    if (!ch) throw new Error("Character not found");

    const pageCount = order.page_count ?? 5;
    const isAr = ch.language === "ar";
    const pricing = await getPricing();

    // === Step 1: story plan (JSON) ===
    const { data: existingGen } = await supabaseAdmin
      .from("generations")
      .select("*")
      .eq("order_id", data.orderId)
      .maybeSingle();
    const { data: existingPages } = await supabaseAdmin
      .from("story_pages")
      .select("page_number, text, image_prompt")
      .eq("order_id", data.orderId)
      .order("page_number");

    let title = order.title as string | null;
    let characterBrief = order.character_brief as string | null;
    let coverPrompt = "";
    let pagesPlan: Array<{ text: string; image_prompt: string }> = [];

    if (existingPages && existingPages.length === pageCount && title && characterBrief) {
      pagesPlan = existingPages.map((p) => ({ text: p.text ?? "", image_prompt: p.image_prompt ?? "" }));
      coverPrompt = ""; // not re-needed
    } else {
      const textModel = "google/gemini-3-flash-preview";
      const sys = isAr
        ? "أنت كاتب قصص أطفال مبدع. أعد فقط كائن JSON صالحاً بدون أي شرح خارجي."
        : "You are a creative children's storyteller. Return ONLY a valid JSON object, no prose around it.";
      const userPrompt = isAr
        ? `اكتب قصة من ${pageCount} صفحات لبطل اسمه "${ch.customer_name}" عمره ${ch.age} سنة، بجو "${ch.mood}".
استخدم لغة بسيطة دافئة مناسبة للطفل. كل صفحة 2-3 جمل قصيرة.
أعد JSON بهذا الشكل بالضبط:
{
  "title": "...",
  "character_visual": "وصف بصري ثابت للبطل (الملابس، الشعر، اللون، الميزات) لاستخدامه في كل صورة لضمان الاتساق",
  "cover_prompt": "وصف مشهد الغلاف بالإنجليزية",
  "pages": [ { "text": "نص الصفحة بالعربية", "image_prompt": "وصف المشهد بالإنجليزية" }, ... ${pageCount} عنصر ]
}`
        : `Write a ${pageCount}-page story for a hero named "${ch.customer_name}", age ${ch.age}, with a "${ch.mood}" vibe.
Use warm, simple language suitable for a child. Each page is 2-3 short sentences.
Return JSON exactly like:
{
  "title": "...",
  "character_visual": "Persistent visual description of the hero (clothing, hair, color, features) to reuse in every image prompt",
  "cover_prompt": "Cover scene description in English",
  "pages": [ { "text": "page text in English", "image_prompt": "scene description in English" }, ... ${pageCount} items ]
}`;
      const chat = await callChat({
        model: textModel,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      });
      await logEvent(
        data.orderId,
        "story_plan",
        textModel,
        "chat",
        chat.meta,
        estimateTextCostUsd(textModel, chat.meta.usage),
        0,
        pricing,
      );
      const plan = safeParseJson(chat.content);
      if (!plan || !plan.pages || plan.pages.length === 0) {
        throw new Error("Failed to parse story plan");
      }
      title = plan.title;
      characterBrief = plan.character_visual;
      coverPrompt = plan.cover_prompt;
      pagesPlan = plan.pages.slice(0, pageCount);
      while (pagesPlan.length < pageCount) {
        pagesPlan.push({ text: "", image_prompt: characterBrief ?? "" });
      }

      // Persist title + brief + first paragraph
      await supabaseAdmin
        .from("orders")
        .update({ title, character_brief: characterBrief })
        .eq("id", data.orderId);

      await supabaseAdmin.from("generations").upsert(
        {
          order_id: data.orderId,
          first_paragraph: pagesPlan[0]?.text ?? "",
          full_story: JSON.stringify(plan),
          cover_image_path: existingGen?.cover_image_path ?? null,
        },
        { onConflict: "order_id" },
      );

      // Upsert story pages (text only)
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
    }

    const style = "warm storybook illustration, soft watercolor, vibrant colors, cinematic lighting, child-friendly";
    const consistencyTag = characterBrief
      ? `Consistent hero across all pages — ${characterBrief}. `
      : "";

    // === Step 2: cover image (if missing) ===
    let coverPath = existingGen?.cover_image_path as string | null;
    if (!coverPath) {
      const cp = coverPrompt || `Book cover for "${title}" featuring the hero. ${consistencyTag}${style}.`;
      coverPath = await generateOneImage({
        orderId: data.orderId,
        step: "cover_image",
        prompt: cp,
        storagePath: `covers/${data.orderId}.png`,
        pricing,
      });
      if (coverPath) {
        await supabaseAdmin
          .from("generations")
          .update({ cover_image_path: coverPath })
          .eq("order_id", data.orderId);
      }
    }

    // === Step 3: page images (only those missing) ===
    const { data: existingImgs } = await supabaseAdmin
      .from("story_pages")
      .select("page_number, image_path")
      .eq("order_id", data.orderId);
    const haveImg = new Map((existingImgs ?? []).map((r) => [r.page_number, r.image_path]));

    const todo = pagesPlan
      .map((p, i) => ({ p, n: i + 1 }))
      .filter(({ n }) => !haveImg.get(n));

    await runWithConcurrency(todo, 3, async ({ p, n }) => {
      const prompt = `${consistencyTag}Scene: ${p.image_prompt}. ${style}. No text or letters in the image.`;
      const path = await generateOneImage({
        orderId: data.orderId,
        step: `page_${n}_image`,
        prompt,
        storagePath: `pages/${data.orderId}/${n}.png`,
        pricing,
      });
      if (path) {
        await supabaseAdmin
          .from("story_pages")
          .update({ image_path: path })
          .eq("order_id", data.orderId)
          .eq("page_number", n);
      }
    });

    return { ok: true as const };
  });

/** Returns progressive state for the preview page. Cheap to poll. */
export const getStoryProgress = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => OrderIdInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, page_count, title, characters(customer_name, language)")
      .eq("id", data.orderId)
      .maybeSingle();
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

    let cover_url: string | null = null;
    if (gen?.cover_image_path) {
      const s = await supabaseAdmin.storage.from("story-covers").createSignedUrl(gen.cover_image_path, 3600);
      cover_url = s.data?.signedUrl ?? null;
    }
    const pagesOut = await Promise.all(
      (pages ?? []).map(async (p) => {
        let url: string | null = null;
        if (p.image_path) {
          const s = await supabaseAdmin.storage.from("story-covers").createSignedUrl(p.image_path, 3600);
          url = s.data?.signedUrl ?? null;
        }
        return { page_number: p.page_number, text: p.text, image_url: url };
      }),
    );

    const totalImages = (order?.page_count ?? 0);
    const readyImages = pagesOut.filter((p) => p.image_url).length;
    return {
      title: order?.title ?? null,
      page_count: order?.page_count ?? 5,
      customer_name: (order?.characters as { customer_name?: string } | null)?.customer_name ?? "",
      language: (order?.characters as { language?: string } | null)?.language ?? "ar",
      first_paragraph: gen?.first_paragraph ?? "",
      cover_url,
      pages: pagesOut,
      ready: pagesOut.length >= totalImages && readyImages >= totalImages && !!cover_url,
      ready_images: readyImages,
      total_images: totalImages,
    };
  });

const ConfirmInput = z.object({
  orderId: z.string().uuid(),
  tier: z.enum(["pdf", "printed", "video"]),
});

async function ensurePdf(orderId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("pdf_path, title, characters(customer_name, language)")
    .eq("id", orderId)
    .single();
  if (order?.pdf_path) return order.pdf_path as string;

  const { data: gen } = await supabaseAdmin
    .from("generations")
    .select("cover_image_path")
    .eq("order_id", orderId)
    .maybeSingle();
  const { data: pages } = await supabaseAdmin
    .from("story_pages")
    .select("page_number, text, image_path")
    .eq("order_id", orderId)
    .order("page_number");

  async function fetchPng(path: string | null | undefined): Promise<Uint8Array | null> {
    if (!path) return null;
    const dl = await supabaseAdmin.storage.from("story-covers").download(path);
    if (dl.error || !dl.data) return null;
    const ab = await dl.data.arrayBuffer();
    return new Uint8Array(ab);
  }

  const ch = order?.characters as { customer_name?: string; language?: string } | null;
  const lang = (ch?.language ?? "ar") as "ar" | "en";
  const title = (order?.title as string | null) ?? (lang === "ar" ? "حكايتي" : "My Story");

  const coverPng = await fetchPng(gen?.cover_image_path);
  const pageInputs = await Promise.all(
    (pages ?? []).map(async (p) => ({
      number: p.page_number,
      text: p.text ?? "",
      imagePng: await fetchPng(p.image_path),
    })),
  );

  const { buildStoryPdfBytes } = await import("./pdf.server");
  const bytes = await buildStoryPdfBytes({
    title,
    language: lang,
    coverPng,
    pages: pageInputs,
    customerName: ch?.customer_name ?? "",
  });

  const pdfPath = `${orderId}.pdf`;
  const up = await supabaseAdmin.storage
    .from("story-pdfs")
    .upload(pdfPath, Buffer.from(bytes), { contentType: "application/pdf", upsert: true });
  if (up.error) throw new Error(up.error.message);

  await supabaseAdmin.from("orders").update({ pdf_path: pdfPath }).eq("id", orderId);
  return pdfPath;
}

export const confirmTierAndPrepareWhatsapp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ConfirmInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const pricing = await getPricing();
    const { data: o0 } = await supabaseAdmin
      .from("orders")
      .select("page_count")
      .eq("id", data.orderId)
      .single();
    const pageCount = o0?.page_count ?? 5;
    const amount = computeTierAmount(data.tier as Tier, pageCount, pricing);

    // Build PDF (for pdf & printed tiers we definitely need it; video tier benefits from a script too)
    let pdfUrl: string | null = null;
    try {
      const pdfPath = await ensurePdf(data.orderId);
      const s = await supabaseAdmin.storage.from("story-pdfs").createSignedUrl(pdfPath, 60 * 60 * 24);
      pdfUrl = s.data?.signedUrl ?? null;
    } catch (e) {
      console.error("PDF build failed", e);
    }

    const { data: ord, error } = await supabaseAdmin
      .from("orders")
      .update({ tier: data.tier, amount_iqd: amount, whatsapp_sent_at: new Date().toISOString() })
      .eq("id", data.orderId)
      .select("order_number, tier, amount_iqd, page_count")
      .single();
    if (error || !ord) throw new Error(error?.message || "Failed");
    return { order_number: ord.order_number, tier: ord.tier, amount_iqd: ord.amount_iqd, page_count: ord.page_count, pdf_url: pdfUrl };
  });

export const getStoryPdfUrl = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => OrderIdInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const pdfPath = await ensurePdf(data.orderId);
    const s = await supabaseAdmin.storage.from("story-pdfs").createSignedUrl(pdfPath, 60 * 60 * 24);
    return { url: s.data?.signedUrl ?? null };
  });

export const getOrderPublic = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => OrderIdInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: o } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, tier, amount_iqd, status, page_count, title, characters(customer_name, mood, language)")
      .eq("id", data.orderId)
      .maybeSingle();
    return o;
  });

// Public pricing snapshot for use on /create and /preview
export const getPublicPricing = createServerFn({ method: "GET" }).handler(async () => {
  const p = await getPricing();
  return {
    tier_pdf_iqd: Number(p.tier_pdf_iqd),
    tier_printed_iqd: Number(p.tier_printed_iqd),
    tier_video_iqd: Number(p.tier_video_iqd),
    per_page_iqd_pdf: Number(p.per_page_iqd_pdf),
    per_page_iqd_printed: Number(p.per_page_iqd_printed),
    per_page_iqd_video: Number(p.per_page_iqd_video),
  };
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
    .select("id, order_number, tier, amount_iqd, status, customer_phone, page_count, created_at, characters(customer_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  const { data: costs } = await supabaseAdmin
    .from("order_costs_v")
    .select("order_id, cost_iqd, gross_profit_iqd, margin_pct, total_tokens, images_generated, cost_credits, cost_usd");
  const byId = new Map((costs ?? []).map((c) => [c.order_id, c]));
  return (orders ?? []).map((o) => ({ ...o, cost: byId.get(o.id) ?? null }));
});

export const adminGetOrder = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => OrderIdInput.parse(d))
  .handler(async ({ data }) => {
    await gate();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: order }, { data: events }, { data: gen }, { data: cost }, { data: pages }] = await Promise.all([
      supabaseAdmin
        .from("orders")
        .select("*, characters(*)")
        .eq("id", data.orderId)
        .single(),
      supabaseAdmin
        .from("generation_events")
        .select("*")
        .eq("order_id", data.orderId)
        .order("created_at", { ascending: true }),
      supabaseAdmin.from("generations").select("*").eq("order_id", data.orderId).maybeSingle(),
      supabaseAdmin.from("order_costs_v").select("*").eq("order_id", data.orderId).maybeSingle(),
      supabaseAdmin
        .from("story_pages")
        .select("page_number, text, image_path")
        .eq("order_id", data.orderId)
        .order("page_number"),
    ]);
    let cover_url: string | null = null;
    let upload_url: string | null = null;
    let pdf_url: string | null = null;
    if (gen?.cover_image_path) {
      const s = await supabaseAdmin.storage.from("story-covers").createSignedUrl(gen.cover_image_path, 60 * 60);
      cover_url = s.data?.signedUrl ?? null;
    }
    const ch = order?.characters as { image_path?: string | null } | null;
    if (ch?.image_path) {
      const s = await supabaseAdmin.storage.from("story-uploads").createSignedUrl(ch.image_path, 60 * 60);
      upload_url = s.data?.signedUrl ?? null;
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
    return { order, events: events ?? [], gen, cost, cover_url, upload_url, pdf_url, pages: pageUrls };
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
    const prompt = `Consistent hero across all pages — ${brief}. Scene: ${page?.image_prompt ?? ""}. warm storybook illustration, soft watercolor, vibrant colors. No text in the image.`;
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
      // Invalidate cached PDF so a fresh one is built next time
      if (order?.pdf_path) {
        await supabaseAdmin.storage.from("story-pdfs").remove([order.pdf_path]);
        await supabaseAdmin.from("orders").update({ pdf_path: null }).eq("id", data.orderId);
      }
    }
    return { ok: true as const };
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
  print_cost_iqd: z.coerce.number().int().nonnegative(),
  shipping_cost_iqd: z.coerce.number().int().nonnegative(),
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
