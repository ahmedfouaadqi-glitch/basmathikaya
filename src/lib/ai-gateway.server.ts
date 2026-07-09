// Server-only Lovable AI Gateway helpers + cost computation.
const BASE = "https://ai.gateway.lovable.dev/v1";

export type Usage = { input_tokens?: number; output_tokens?: number; total_tokens?: number };

// Approximate USD pricing per model. Used to estimate cost in real time
// before the official AI Gateway log reconciles. Keep conservative.
const TEXT_PRICING_PER_1M: Record<string, { input: number; output: number }> = {
  "google/gemini-3-flash-preview": { input: 0.075, output: 0.30 },
  "google/gemini-2.5-flash": { input: 0.075, output: 0.30 },
  "google/gemini-2.5-pro": { input: 1.25, output: 5.0 },
  "google/gemini-3.5-flash": { input: 0.10, output: 0.40 },
};
const IMAGE_PRICING_PER_IMAGE: Record<string, number> = {
  "openai/gpt-image-2": 0.011,
  "openai/gpt-image-1-mini": 0.005,
  "google/gemini-3.1-flash-image": 0.039,
  "google/gemini-2.5-flash-image": 0.039,
  "google/gemini-3-pro-image": 0.08,
};

export function estimateTextCostUsd(model: string, usage: Usage): number {
  const p = TEXT_PRICING_PER_1M[model] ?? { input: 0.10, output: 0.40 };
  const inT = usage.input_tokens ?? 0;
  const outT = usage.output_tokens ?? 0;
  return (inT * p.input + outT * p.output) / 1_000_000;
}

export function estimateImageCostUsd(model: string, images: number): number {
  return (IMAGE_PRICING_PER_IMAGE[model] ?? 0.05) * Math.max(1, images);
}

function key() {
  const k = process.env.LOVABLE_API_KEY;
  if (!k) throw new Error("LOVABLE_API_KEY missing");
  return k;
}

export type GatewayMeta = {
  log_id: string | null;
  run_id: string | null;
  usage: Usage;
  duration_ms: number;
  finish_reason?: string | null;
};

type TextContent = { type: "text"; text: string };
type ImageContent = { type: "image_url"; image_url: { url: string } };
type ContentBlock = TextContent | ImageContent;
type Message = {
  role: "system" | "user" | "assistant";
  content: string | ContentBlock[];
};

export async function callChat(args: {
  model: string;
  messages: Message[];
  response_format?: unknown;
}): Promise<{ content: string; meta: GatewayMeta }> {
  const started = Date.now();
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      messages: args.messages,
      ...(args.response_format ? { response_format: args.response_format } : {}),
    }),
  });
  const duration_ms = Date.now() - started;
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`AI Gateway chat error ${res.status}: ${txt.slice(0, 200)}`);
  }
  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string }; finish_reason?: string; native_finish_reason?: string }>;
    usage?: Usage;
  };
  const choice = body.choices?.[0];
  const content = choice?.message?.content ?? "";
  const finish_reason = choice?.native_finish_reason ?? choice?.finish_reason ?? null;
  return {
    content,
    meta: {
      log_id: res.headers.get("X-Lovable-AIG-Log-ID"),
      run_id: res.headers.get("X-Lovable-AIG-Run-ID"),
      usage: body.usage ?? {},
      duration_ms,
      finish_reason,
    },
  };
}

export async function callImage(args: {
  model: string;
  prompt: string;
  /** Optional reference image data URLs (data:image/...;base64,...) for likeness. Gemini image models only. */
  referenceImages?: string[];
}): Promise<{ b64: string; meta: GatewayMeta }> {
  const started = Date.now();
  const isGemini = args.model.startsWith("google/");
  const refs = args.referenceImages?.filter(Boolean) ?? [];

  let body: unknown;
  if (isGemini) {
    const content: ContentBlock[] = [
      { type: "text", text: args.prompt },
      ...refs.map<ImageContent>((url) => ({ type: "image_url", image_url: { url } })),
    ];
    body = {
      model: args.model,
      messages: [{ role: "user", content }],
      modalities: ["image", "text"],
    };
  } else {
    // OpenAI gpt-image endpoint here doesn't accept reference images;
    // we just embed a textual description instead. (Reference images already
    // shaped the character_visual brief.)
    body = {
      model: args.model,
      prompt: args.prompt,
      size: "1024x1024",
      quality: "low",
      n: 1,
    };
  }
  const res = await fetch(`${BASE}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const duration_ms = Date.now() - started;
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`AI Gateway image error ${res.status}: ${txt.slice(0, 200)}`);
  }
  const j = (await res.json()) as {
    data?: Array<{ b64_json?: string }>;
    usage?: Usage;
  };
  const b64 = j.data?.[0]?.b64_json ?? "";
  if (!b64) throw new Error("AI Gateway returned empty image");
  return {
    b64,
    meta: {
      log_id: res.headers.get("X-Lovable-AIG-Log-ID"),
      run_id: res.headers.get("X-Lovable-AIG-Run-ID"),
      usage: j.usage ?? {},
      duration_ms,
    },
  };
}
